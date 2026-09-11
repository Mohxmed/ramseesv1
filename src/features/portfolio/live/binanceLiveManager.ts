"use client";

/**
 * Centralized Binance live connection manager (browser side).
 *
 * THE single owner of the wallet's live connection. Design rules it enforces
 * across the whole feature:
 *
 *  - ONE account active at a time, ONE leader socket set per account:
 *    the first subscribing tab wins a Web-Lock lease (per-account name) and
 *    owns the only two websockets â€” a Binance FUTURES user-data stream
 *    (<listenKey>) and ONE combined @markPrice@1s stream for the open symbols.
 *    Non-leader tabs subscribe to a BroadcastChannel and never open sockets.
 *  - No API secrets near the browser: the server mints the short-lived
 *    listenKey (the session route) and renews it (the keepalive route).
 *    A listenKey is NOT a credential â€” it expires and cannot move funds.
 *  - Reconcile-on-disconnect: after any WS loss the store is re-seeded from
 *    the REST live-state route before reconnecting (exponential backoff +
 *    full jitter). Live updates themselves never touch Firestore.
 *  - Manual refresh (the Portfolio "طھط­ط¯ظٹط«" button) goes straight to the
 *    live-state route â€” a deliberate, user-paced call, never a timer.
 */

import { exchangesApi } from "@/features/portfolio/services/exchanges.api";
import type { LivePositionDto, LivePositionsDto } from "@/features/portfolio/types";
import {
  aggregateOf,
  applyMarkPrice,
  emptyLiveStore,
  markStreamNeedsUpdate,
  mergeAccountUpdate,
  openSymbols,
  type LiveStatus,
  type LiveStoreState,
  type RawAccountUpdateEvent,
} from "./state";
import { tickLiveMetric, getLiveMetrics, installLiveDebugHook } from "./metrics";

export interface LiveSnapshot {
  accountId: string;
  status: LiveStatus;
  error: string | null;
  data: LivePositionsDto | null;
  /** UTC ms of the last successful REST reconciliation / REST seed. */
  lastReconcileAt: number | null;
}

const USER_WS = "wss://fstream.binance.com/ws";
const MARK_WS = "wss://fstream.binance.com/stream";
const KEEPALIVE_MS = 25 * 60_000;
const BROADCAST_MIN_INTERVAL_MS = 1_000;
const RECONNECT_MIN_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;
const MARK_WS_DEBOUNCE_MS = 600;
const MAX_SAFE_RETRY_STEPS = 5;

interface BroadcastMessage {
  type: "state" | "status";
  snapshot?: LiveSnapshot;
  status?: LiveStatus;
  error?: string | null;
  at: number;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

function toLiveSnapshot(
  accountId: string,
  store: LiveStoreState,
  status: LiveStatus,
  error: string | null,
  lastReconcileAt: number | null
): LiveSnapshot {
  const agg = aggregateOf(store);
  const positions: LivePositionDto[] = store.positions
    .filter((p) => p.quantity > 0)
    .map((p) => ({
      symbol: p.symbol,
      side: p.side,
      quantity: p.quantity,
      entryPrice: p.entryPrice,
      // Before the first mark tick, mark â‰ˆ entry is the least-wrong display.
      markPrice: p.markPrice ?? p.entryPrice,
      liquidationPrice: p.liquidationPrice,
      leverage: p.leverage,
      margin: p.margin,
      unrealizedPnl: p.unrealizedPnl,
      unrealizedPnlPct: p.unrealizedPnlPct,
      realizedPnl: 0,
      notional: p.notional,
      timestamp: p.updatedAt,
      pricedLive: p.markAt != null,
      valuedAt: p.markAt ?? p.updatedAt,
    }));
  const data: LivePositionsDto = {
    positions,
    aggregate: agg,
    live: status === "live" || status === "reconnecting",
    at: store.lastUpdateAt ?? Date.now(),
    equity: store.equity,
    walletBalance: store.walletBalance,
    availableBalance: store.availableBalance,
  };
  return { accountId, status, error, data, lastReconcileAt };
}

class LiveManager {
  private accountId = "";
  private store = emptyLiveStore();
  private status: LiveStatus = "idle";
  private error: string | null = null;
  private lastReconcileAt: number | null = null;
  private cached: LiveSnapshot | null = null;

  private readonly listeners = new Set<(snap: LiveSnapshot) => void>();
  private subscribedAccounts = new Set<string>();
  private disposed = true;

  // Leader coordination.
  private lockCtrl: AbortController | null = null;
  private leaderActive = false;
  private channel: BroadcastChannel | null = null;
  private lastBroadcastAt = 0;
  private pendingBroadcast: ReturnType<typeof setTimeout> | null = null;

  // Sockets.
  private userWs: WebSocket | null = null;
  private markWs: WebSocket | null = null;
  private markSubscribed: string[] = [];
  private sessionKey: string | null = null;

  // Retry state.
  private reconnectUserTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectMarkTimer: ReturnType<typeof setTimeout> | null = null;
  private userBackoffStep = 0;
  private markBackoffStep = 0;
  private keepAliveTimer: ReturnType<typeof setInterval> | null = null;
  private markResubDebounce: ReturnType<typeof setTimeout> | null = null;
  private fetching = false;

  /** Stable snapshot for useSyncExternalStore (mutated by reference swap). */
  getSnapshot(): LiveSnapshot | null {
    if (!this.cached) {
      this.cached = toLiveSnapshot(this.accountId, this.store, this.status, this.error, this.lastReconcileAt);
    }
    return this.cached;
  }

  subscribe(accountId: string, cb: (snap: LiveSnapshot) => void): () => void {
    installLiveDebugHook(); // dev-only, idempotent
    if (accountId && this.accountId !== accountId) {
      this.switchAccount(accountId);
    }
    this.listeners.add(cb);
    const wasDisposed = this.disposed;
    this.disposed = false;
    if (accountId) this.subscribedAccounts.add(accountId);
    cb(this.getSnapshot()!);

    if (wasDisposed || this.subscribedAccounts.size === 1) {
      this.ensureCoordinated();
    }

    return () => {
      this.listeners.delete(cb);
      if (this.listeners.size === 0) {
        this.dispose();
      }
    };
  }

  private switchAccount(accountId: string): void {
    // Release the old account's lease/channel before switching; otherwise the
    // next ensureCoordinated() would early-return on a stale leader state and
    // never bootstrap the new account.
    this.abortLeadership();
    this.teardownSockets();
    this.sessionKey = null;
    this.store = emptyLiveStore();
    this.status = "idle";
    this.error = null;
    this.lastReconcileAt = null;
    this.accountId = accountId;
    this.cached = null;
    this.broadcastStatus();
  }

  /** Manual Portfolio refresh â€” REST snapshot through the server, user-paced. */
  async refresh(accountId: string): Promise<LiveSnapshot> {
    if (!accountId) return this.getSnapshot()!;
    if (accountId !== this.accountId) this.switchAccount(accountId);
    tickLiveMetric("manualRefreshes");
    return this.reconcileFromREST(accountId, { force: true });
  }

  /** Force a fresh session + sockets now (retry button). */
  reconnect(accountId: string): void {
    if (!accountId || accountId !== this.accountId) {
      if (accountId) this.switchAccount(accountId);
      return;
    }
    this.scheduleUserReconnect(true);
  }

  dispose(): void {
    this.disposed = true;
    this.subscribedAccounts.clear();
    this.teardownSockets();
    this.clearTimers();
    this.abortLeadership();
    this.sessionKey = null;
    this.status = "idle";
    this.error = null;
    this.cached = null;
  }

  /* â”€â”€ Coordination â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

  private ensureCoordinated(): void {
    if (typeof window === "undefined") return;
    this.openChannel();
    const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
    if (!locks?.request) {
      // Very old browsers: every tab runs its own connection (still correct,
      // just not connection-sharing).
      this.runAsSoleLeader();
      return;
    }
    if (this.leaderActive || this.lockCtrl) return;
    const lockName = `ramsees-live:${this.accountId}`;
    this.lockCtrl = new AbortController();
    const ctrl = this.lockCtrl;
    void locks
      .request(lockName, { signal: ctrl.signal }, () => {
        this.runAsSoleLeader();
        return new Promise<void>((resolve) => {
          // The lease lives until the tab closes or dispose() aborts the
          // controller; sockets + timers are released by those paths.
          if (ctrl.signal.aborted) {
            resolve();
            return;
          }
          ctrl.signal.addEventListener("abort", () => resolve(), { once: true });
        });
      })
      .catch(() => {
        /* aborted by dispose â€” expected */
      });
  }

  private runAsSoleLeader(): void {
    if (this.leaderActive) return;
    this.leaderActive = true;
    void this.bootstrapChain();
  }

  private openChannel(): void {
    if (!this.accountId || typeof BroadcastChannel === "undefined" || this.channel) return;
    const ch = new BroadcastChannel(`ramsees-live:${this.accountId}`);
    ch.onmessage = (ev: MessageEvent<BroadcastMessage>) => {
      const msg = ev.data;
      if (!msg || typeof msg !== "object") return;
      tickLiveMetric("followMerges");
      if (msg.type === "state" && msg.snapshot) {
        this.applyChannelSnapshot(msg.snapshot);
      } else if (msg.type === "status") {
        this.status = msg.status ?? this.status;
        this.error = msg.error ?? this.error;
        this.cached = null;
        this.notify();
      }
    };
    this.channel = ch;
  }

  private abortLeadership(): void {
    this.leaderActive = false;
    this.lockCtrl?.abort();
    this.lockCtrl = null;
    this.closeChannel();
    this.lastBroadcastAt = 0;
  }

  private closeChannel(): void {
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
  }

  private applyChannelSnapshot(snap: LiveSnapshot): void {
    if (snap.accountId && this.accountId !== snap.accountId) return;
    this.status = snap.status;
    this.error = snap.error;
    this.lastReconcileAt = snap.lastReconcileAt;
    if (snap.data) {
      this.applyDtoToStore(snap.data);
    }
    this.cached = null;
    this.notify();
  }

  private applyDtoToStore(dto: LivePositionsDto): void {
    if (dto.equity != null) this.store.equity = dto.equity;
    if (dto.walletBalance != null) this.store.walletBalance = dto.walletBalance;
    if (dto.availableBalance != null) this.store.availableBalance = dto.availableBalance;
    const positions: LiveStoreState["positions"] = dto.positions.map((p) => ({
      symbol: p.symbol,
      side: p.side,
      quantity: p.quantity,
      entryPrice: p.entryPrice,
      markPrice: p.markPrice || null,
      liquidationPrice: p.liquidationPrice,
      leverage: p.leverage,
      margin: p.margin,
      unrealizedPnl: p.unrealizedPnl,
      unrealizedPnlPct: p.unrealizedPnlPct,
      notional: p.notional,
      updatedAt: p.valuedAt ?? p.timestamp,
      markAt: p.valuedAt ?? null,
    }));
    this.store.positions = positions;
    this.store.lastUpdateAt = Math.max(this.store.lastUpdateAt ?? 0, dto.at);
  }

  /* â”€â”€ Leader bootstrap / reconcile â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

  private async bootstrapChain(): Promise<void> {
    let step = 0;
    // A session failure is recoverable (network/platform). Keep retrying with
    // growing backoff, but never on a timer â€” attempts react to events.
    for (;;) {
      if (this.disposed || !this.leaderActive || this.status === "live") break;
      const ok = await this.tryBootstrap();
      if (ok) break;
      if (this.disposed || !this.leaderActive) break;
      const wait = this.backoffFor(step, RECONNECT_MIN_MS, RECONNECT_MAX_MS);
      step = Math.min(step + 1, MAX_SAFE_RETRY_STEPS);
      await awaitableSleep(wait, () => this.disposed || !this.leaderActive);
    }
  }

  private async tryBootstrap(): Promise<boolean> {
    if (!this.accountId || this.disposed || !this.leaderActive) return false;
    try {
      this.setStatus("connecting");
      const session = await exchangesApi.liveSession(this.accountId);
      tickLiveMetric("sessions");
      if (!session.listenKey) {
        // Non-futures account (or missing credential): nothing to watch. Settle
        // as idle â€” no retry loop; the manual refresh re-probes live-state.
        this.setStatus("idle");
        this.reconcileFromDto(session.snapshot);
        return true;
      }
      this.sessionKey = session.listenKey;
      this.reconcileFromDto(session.snapshot);
      this.openUserSocket(session.listenKey);
      this.syncMarkSubscription();
      this.startKeepAlive();
      this.setStatus("live");
      return true;
    } catch (err) {
      tickLiveMetric("sessionFailures");
      this.setErrorState(err);
      return false;
    }
  }

  private reconcileFromDto(snap: {
    equity: number;
    walletBalance: number;
    unrealizedPnl: number;
    availableBalance: number;
    positions: LivePositionDto[];
    at: number;
  }): void {
    this.store.equity = snap.equity;
    this.store.walletBalance = snap.walletBalance;
    this.store.unrealizedPnl = snap.unrealizedPnl;
    this.store.availableBalance = snap.availableBalance;
    this.store.positions = snap.positions.map((p) => ({
      symbol: p.symbol,
      side: p.side,
      quantity: p.quantity,
      entryPrice: p.entryPrice,
      markPrice: p.markPrice || null,
      liquidationPrice: p.liquidationPrice,
      leverage: p.leverage,
      margin: p.margin,
      unrealizedPnl: p.unrealizedPnl,
      unrealizedPnlPct: p.unrealizedPnlPct,
      notional: p.notional,
      updatedAt: p.valuedAt ?? p.timestamp ?? snap.at,
      markAt: snap.at,
    }));
    this.store.lastUpdateAt = Math.max(this.store.lastUpdateAt ?? 0, snap.at);
    this.store.lastReconcileAt = snap.at;
    this.lastReconcileAt = snap.at;
    this.cached = null;
    this.notify();
    this.syncMarkSubscription();
  }

  /** REST refresh â€” manual button press or post-disconnect reconciliation. */
  private async reconcileFromREST(
    accountId: string,
    opts: { force?: boolean } = {}
  ): Promise<LiveSnapshot> {
    if (!accountId) return this.getSnapshot()!;
    if (this.fetching && !opts.force) return this.getSnapshot()!;
    this.fetching = true;
    try {
      const state = await exchangesApi.liveState(accountId);
      // The account may have switched while the request was in flight; never
      // write another account's state into the current store.
      if (this.accountId !== accountId) return this.getSnapshot()!;
      tickLiveMetric("reconciliations");
      this.store.equity = state.equity;
      this.store.walletBalance = state.walletBalance;
      this.store.unrealizedPnl = state.unrealizedPnl;
      this.store.availableBalance = state.availableBalance;
      this.store.positions = state.positions.map((p) => ({
        symbol: p.symbol,
        side: p.side,
        quantity: p.quantity,
        entryPrice: p.entryPrice,
        markPrice: p.markPrice || null,
        liquidationPrice: p.liquidationPrice,
        leverage: p.leverage,
        margin: p.margin,
        unrealizedPnl: p.unrealizedPnl,
        unrealizedPnlPct: p.unrealizedPnlPct,
        notional: p.notional,
        updatedAt: p.valuedAt ?? p.timestamp ?? state.at,
        markAt: state.at,
      }));
      this.store.lastUpdateAt = state.at;
      this.store.lastReconcileAt = state.at;
      this.lastReconcileAt = state.at;
      this.error = null;
      this.cached = null;
      this.notify();
      this.broadcastNow();
      this.syncMarkSubscription();
      return this.getSnapshot()!;
    } catch (err) {
      this.setErrorState(err);
      return this.getSnapshot()!;
    } finally {
      this.fetching = false;
    }
  }

  /* â”€â”€ User Data socket â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

  private openUserSocket(listenKey: string): void {
    this.closeUserSocket();
    tickLiveMetric("userSockets");
    let ws: WebSocket;
    try {
      ws = new WebSocket(`${USER_WS}/${listenKey}`);
    } catch {
      this.onUserSocketLost();
      return;
    }
    this.userWs = ws;

    ws.onopen = () => {
      this.userBackoffStep = 0;
      this.setStatus("live");
    };
    ws.onmessage = (ev: MessageEvent<string>) => {
      let msg: RawAccountUpdateEvent & { e?: string };
      try {
        msg = JSON.parse(String(ev.data)) as typeof msg;
      } catch {
        return;
      }
      if (!msg || typeof msg !== "object") return;
      if (msg.e === "ACCOUNT_UPDATE") {
        tickLiveMetric("accountUpdates");
        mergeAccountUpdate(this.store, msg);
        this.cached = null;
        this.notify();
        this.syncMarkSubscription();
      } else if (msg.e === "ORDER_TRADE_UPDATE" || msg.e === "MARGIN_CALL") {
        tickLiveMetric("orderUpdates");
        // Phase 2 wires ORDER_TRADE_UPDATE fills into idempotent persistence;
        // here we only keep the store alive + the metrics honest.
      }
    };
    ws.onclose = () => {
      if (this.userWs === ws) this.userWs = null;
      this.onUserSocketLost();
    };
    ws.onerror = () => {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    };
  }

  private onUserSocketLost(): void {
    tickLiveMetric("userSocketsLost");
    this.stopKeepAlive();
    this.sessionKey = null;
    if (this.disposed || !this.leaderActive) return;
    this.setStatus("reconnecting");
    // Reconcile immediately so the last view stays current during the outage.
    if (this.accountId) void this.reconcileFromREST(this.accountId);
    this.scheduleUserReconnect();
  }

  private scheduleUserReconnect(immediate = false): void {
    if (this.disposed || !this.leaderActive) return;
    if (this.reconnectUserTimer) return;
    if (immediate) {
      void this.userReconnectLoop();
      return;
    }
    const wait = this.backoffFor(this.userBackoffStep, RECONNECT_MIN_MS, RECONNECT_MAX_MS);
    this.userBackoffStep = Math.min(this.userBackoffStep + 1, MAX_SAFE_RETRY_STEPS);
    this.reconnectUserTimer = setTimeout(() => {
      this.reconnectUserTimer = null;
      void this.userReconnectLoop();
    }, wait);
  }

  private async userReconnectLoop(): Promise<void> {
    tickLiveMetric("userReconnects");
    if (this.disposed || !this.leaderActive) return;
    const ok = await this.tryBootstrap();
    if (!ok && this.leaderActive && this.reconnectUserTimer == null) {
      this.scheduleUserReconnect();
    }
  }

  /* â”€â”€ Mark price socket â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

  private syncMarkSubscription(): void {
    if (this.disposed || !this.leaderActive) return;
    const next = openSymbols(this.store);
    if (!markStreamNeedsUpdate(this.markSubscribed, next)) return;
    this.markSubscribed = next;
    // Debounce rapid position-set changes (open/close spreads over a few events).
    if (this.markResubDebounce) return;
    this.markResubDebounce = setTimeout(() => {
      this.markResubDebounce = null;
      this.reopenMarkSocket();
    }, MARK_WS_DEBOUNCE_MS);
  }

  private reopenMarkSocket(): void {
    this.closeMarkSocket();
    if (this.disposed || !this.leaderActive) return;
    const symbols = this.markSubscribed;
    if (symbols.length === 0) return;
    tickLiveMetric("markSockets");
    tickLiveMetric("markResubscribes");
    const streams = symbols.map((s) => `${s.toLowerCase()}@markPrice@1s`).join("/");
    let ws: WebSocket;
    try {
      ws = new WebSocket(`${MARK_WS}?streams=${streams}`);
    } catch {
      this.onMarkSocketLost();
      return;
    }
    this.markWs = ws;

    ws.onopen = () => {
      this.markBackoffStep = 0;
    };
    ws.onmessage = (ev: MessageEvent<string>) => {
      let payload: { stream?: string; data?: { e?: string; s?: string; p?: string } };
      try {
        payload = JSON.parse(String(ev.data)) as typeof payload;
      } catch {
        return;
      }
      const d = payload?.data;
      if (d?.e === "markPriceUpdate" && d.s && d.p != null) {
        tickLiveMetric("markTicks");
        const mark = Number(d.p);
        if (Number.isFinite(mark)) {
          applyMarkPrice(this.store, d.s, mark, Date.now());
          this.cached = null;
          this.notify();
        }
      }
    };
    ws.onclose = () => {
      if (this.markWs === ws) this.markWs = null;
      this.onMarkSocketLost();
    };
    ws.onerror = () => {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    };
  }

  private onMarkSocketLost(): void {
    if (this.disposed || !this.leaderActive) return;
    this.markBackoffStep = Math.min(this.markBackoffStep + 1, MAX_SAFE_RETRY_STEPS);
    if (this.reconnectMarkTimer) return;
    const wait = this.backoffFor(this.markBackoffStep, RECONNECT_MIN_MS, RECONNECT_MAX_MS);
    this.reconnectMarkTimer = setTimeout(() => {
      this.reconnectMarkTimer = null;
      if (!this.disposed && this.leaderActive) this.reopenMarkSocket();
    }, wait);
  }

  /* â”€â”€ Keepalive â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

  private startKeepAlive(): void {
    this.stopKeepAlive();
    this.keepAliveTimer = setInterval(() => {
      if (!this.accountId || !this.sessionKey) return;
      void exchangesApi
        .keepAliveSession(this.accountId, this.sessionKey)
        .then(() => tickLiveMetric("keepAlivesOk"))
        .catch(() => {
          tickLiveMetric("keepAliveFailures");
          // A failed renewal means the server side expired the session; force a
          // fresh one instead of waiting for the socket to die on Binance.
          if (!this.disposed && this.leaderActive) {
            try {
              this.userWs?.close();
            } catch {
              /* ignore */
            }
          }
        });
    }, KEEPALIVE_MS);
  }

  private stopKeepAlive(): void {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
  }

  /* â”€â”€ Shared plumbing â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

  private setErrorState(err: unknown): void {
    this.error =
      err instanceof Error && err.message ? err.message : "طھط¹ط°ط± ط§ظ„ط§طھطµط§ظ„ ط¨ظ…ظ†طµط© Binance.";
    this.status = "error";
    this.cached = null;
    this.notify();
    this.broadcastStatus();
  }

  private setStatus(status: LiveStatus): void {
    if (this.status === status) return;
    this.status = status;
    this.cached = null;
    this.notify();
    this.broadcastStatus();
  }

  private notify(): void {
    const snap = this.getSnapshot()!;
    for (const cb of this.listeners) {
      try {
        cb(snap);
      } catch {
        /* listener errors are non-fatal */
      }
    }
    this.broadcastThrottled();
  }

  private broadcastThrottled(): void {
    if (typeof BroadcastChannel === "undefined" || !this.channel) return;
    const now = Date.now();
    if (now - this.lastBroadcastAt >= BROADCAST_MIN_INTERVAL_MS) {
      this.broadcastNow();
      return;
    }
    if (this.pendingBroadcast) return;
    this.pendingBroadcast = setTimeout(() => {
      this.pendingBroadcast = null;
      this.broadcastNow();
    }, BROADCAST_MIN_INTERVAL_MS);
  }

  private broadcastNow(): void {
    if (typeof BroadcastChannel === "undefined" || !this.channel) return;
    tickLiveMetric("broadcasts");
    this.lastBroadcastAt = Date.now();
    const msg: BroadcastMessage = { type: "state", snapshot: this.getSnapshot()!, at: Date.now() };
    try {
      this.channel.postMessage(msg);
    } catch {
      /* Channel closed mid-write is non-fatal. */
    }
  }

  private broadcastStatus(): void {
    if (typeof BroadcastChannel === "undefined" || !this.channel) return;
    const msg: BroadcastMessage = { type: "status", status: this.status, error: this.error, at: Date.now() };
    try {
      this.channel.postMessage(msg);
    } catch {
      /* ignore */
    }
  }

  private backoffFor(step: number, min: number, max: number): number {
    return Math.min(max, min * 2 ** Math.min(step, MAX_SAFE_RETRY_STEPS)) * (0.5 + Math.random() * 0.5);
  }

  private teardownSockets(): void {
    this.closeUserSocket();
    this.closeMarkSocket();
    this.stopKeepAlive();
    if (this.reconnectUserTimer) {
      clearTimeout(this.reconnectUserTimer);
      this.reconnectUserTimer = null;
    }
    if (this.reconnectMarkTimer) {
      clearTimeout(this.reconnectMarkTimer);
      this.reconnectMarkTimer = null;
    }
    if (this.markResubDebounce) {
      clearTimeout(this.markResubDebounce);
      this.markResubDebounce = null;
    }
  }

  private closeUserSocket(): void {
    const ws = this.userWs;
    this.userWs = null;
    if (ws) {
      ws.onopen = null;
      ws.onmessage = null;
      ws.onclose = null;
      ws.onerror = null;
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    }
  }

  private closeMarkSocket(): void {
    const ws = this.markWs;
    this.markWs = null;
    if (ws) {
      ws.onopen = null;
      ws.onmessage = null;
      ws.onclose = null;
      ws.onerror = null;
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    }
  }

  private clearTimers(): void {
    this.stopKeepAlive();
    if (this.reconnectUserTimer) {
      clearTimeout(this.reconnectUserTimer);
      this.reconnectUserTimer = null;
    }
    if (this.reconnectMarkTimer) {
      clearTimeout(this.reconnectMarkTimer);
      this.reconnectMarkTimer = null;
    }
    if (this.markResubDebounce) {
      clearTimeout(this.markResubDebounce);
      this.markResubDebounce = null;
    }
    if (this.pendingBroadcast) {
      clearTimeout(this.pendingBroadcast);
      this.pendingBroadcast = null;
    }
  }

  /** Debug surface (dev console): `__ramseesLiveDebug.liveManager()`. */
  debugInfo(): Record<string, unknown> {
    return {
      accountId: this.accountId,
      status: this.status,
      error: this.error,
      metrics: getLiveMetrics(),
      store: {
        equity: this.store.equity,
        positions: this.store.positions.length,
        lastReconcileAt: this.store.lastReconcileAt,
        lastUpdateAt: this.store.lastUpdateAt,
      },
      sockets: { user: this.userWs != null, mark: this.markWs != null },
    };
  }
}

/** Awaits `ms`, but resolves early when the guard turns true (abort path). */
async function awaitableSleep(ms: number, shouldAbort: () => boolean): Promise<void> {
  const then = Date.now();
  while (Date.now() - then < ms) {
    if (shouldAbort()) return;
    await sleep(Math.min(100, ms));
  }
}

export const liveManager = new LiveManager();