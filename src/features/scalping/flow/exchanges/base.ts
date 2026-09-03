/**
 * Base WebSocket Exchange Adapter
 *
 * Shared WebSocket lifecycle management following aggr.trade patterns, plus a
 * connection state machine and per-exchange diagnostics:
 *
 *   CONNECTING   — transport not yet open or no valid trade received yet
 *   LIVE         — WS open + subscription accepted + valid fresh trade received
 *   STALE        — no valid trade within the stale threshold (via last valid event)
 *   DISCONNECTED — WS connection lost / never connected
 *   ERROR        — unrecovered WS error
 *
 * Concrete adapters extend this and implement
 * normalizeTrade/normalizeLiquidation/handleMessage.
 */

import type {
  ExchangeAdapter,
  ExchangeConnection,
  ExchangeStatus,
  NormalizedTrade,
  SubscriptionStatus,
} from "../types";

/** How long after the last valid event before an exchange is marked STALE. */
export const STALE_EVENT_THRESHOLD_MS = 5000;

/** Max time a socket may spend in CONNECTING before it is torn down & retried. */
export const CONNECT_TIMEOUT_MS = 15_000;

/** Max time with no inbound WS message (any kind) before a silent socket is dropped. */
export const MESSAGE_TIMEOUT_MS = 30_000;

/** How often the liveness watchdog evaluates the message-timeout. */
export const WATCHDOG_INTERVAL_MS = 5_000;

/** Upper bound on the exponential-reconnect delay before jitter is applied. */
export const MAX_RECONNECT_DELAY_MS = 30_000;

/**
 * Recompute the clock-skew median only every N valid trades (warmup included)
 * instead of sorting the full sample window on EVERY trade. Skew drifts slowly,
 * so batching the median cuts per-trade allocation/sort churn on the hot path
 * with no meaningful accuracy loss.
 */
const SKEW_RECOMPUTE_EVERY = 32;

/**
 * Decode an inbound WebSocket frame into a parsed JSON value. Exchange feeds are
 * inconsistent about wire encoding: Upbit ships binary Blob/ArrayBuffer frames
 * containing JSON text, HTX's proxy sends plain-text JSON, and Node buffers
 * arrive as TextDecoder views. Normalise everything here so concrete adapters
 * only ever see a parsed object (a malformed frame simply throws → ignored).
 */
async function decodeFrame(data: unknown): Promise<unknown> {
  if (typeof data === "string") return JSON.parse(data);
  if (data instanceof ArrayBuffer) return JSON.parse(new TextDecoder().decode(data));
  if (ArrayBuffer.isView(data)) {
    return JSON.parse(new TextDecoder().decode(data as ArrayBufferView<ArrayBuffer>));
  }
  if (data instanceof Blob) return JSON.parse(await data.text());
  throw new Error("unsupported WebSocket frame type");
}

export abstract class BaseExchangeAdapter implements ExchangeAdapter {
  abstract readonly id: string;
  abstract readonly label: string;
  abstract readonly market: "spot" | "perpetual" | "futures";

  protected ws: WebSocket | null = null;
  protected wsOpen = false;
  protected reconnectCount = 0;
  protected subscribedSymbols = new Set<string>();
  protected pingInterval: ReturnType<typeof setInterval> | null = null;
  protected watchdogInterval: ReturnType<typeof setInterval> | null = null;
  protected reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  protected lastPong = 0;

  /** Timestamp the currently-open socket was created (0 until it first opens). */
  protected socketOpenedAt = 0;

  /** Incremented on every (re)connect so stale-socket handlers never fire late. */
  protected wsGeneration = 0;

  /** Set by disconnect() to gate all reconnect/watchdog/timer activity. */
  protected disposed = false;

  // Diagnostics / health
  protected lastValidAt = 0; // receivedAt of last valid trade (0 = none)
  protected lastEventTs = 0; // exchange timestamp of last valid trade (0 = none)
  protected lastProcessedAt = 0; // processedAt of last valid trade (0 = none)
  protected eventCount = 0;
  protected latency = -1; // -1 = N/A
  protected transportLatency = -1; // -1 = N/A
  protected processingLatency = -1; // -1 = N/A
  protected dataAge = -1; // -1 = N/A
  protected subscription: SubscriptionStatus = "pending";
  protected lastError = "";
  protected wsEverOpened = false;

  // Reconnect-gap diagnostics: a reconnect means in-flight events during the
  // outage were NOT replayed by the exchange (none of our 16 offer rollback
  // replay on the public trade stream), so metrics crossing the gap are known
  // to be incomplete until the window rolls past it. Track when it happened.
  protected lastReconnectMs = 0;
  protected lastDisconnectAt = 0;
  protected reconnectGapMs = 0; // duration of the most recent outage
  protected overflowCount = 0; // times the ingest/queue path overflowed locally

  // Per-exchange monitoring: rolling msg rate, dropped-event and sequence-gap
  // counters. Dropped/duplicate events are bumped by the engine (the only place
  // a dedup decision is made); they are exposed here for the health snapshot.
  protected droppedCount = 0;
  protected gapCount = 0;
  private msgTicks: number[] = []; // timestamps of the last (valid or dropped) WS trades for rate

  // Out-of-order detection: track the exchange timestamps already seen so a
  // significantly older event arriving after a newer one is flagged (rather
  // than silently corrupting the flow). Reset on reconnect (new sequence).
  protected lastSeqTs = 0;
  protected outOfOrderCount = 0;

  // Clock-skew estimation. Independent exchanges timestamp events in true UTC,
  // which may be ahead of this host's local clock (NTP skew). We estimate the
  // skew as the most-ahead (timestamp - receivedAt) sample and subtract it, so
  // reported latency reflects real network latency and is never negative.
  private skewSamples: number[] = [];
  private skewOffset = 0;
  private static readonly SKEW_WINDOW = 64;

  /** Ingest callback — set by the engine to feed trades into the flow. */
  onTrade: ((trade: NormalizedTrade) => void) | null = null;

  // Subclass hooks
  protected abstract getWsUrl(): string;
  protected abstract getSubscribeMsg(symbol: string): unknown;
  protected abstract getUnsubscribeMsg(symbol: string): unknown;
  protected abstract getPingMsg(): unknown | null;
  protected abstract getPingIntervalMs(): number;
  protected abstract handleMessage(data: unknown): void;

  abstract normalizeTrade(data: unknown): NormalizedTrade[];
  abstract normalizeLiquidation(data: unknown): NormalizedTrade[];

  // ── Per-exchange tunables (overridden by adapters with specific needs) ──

  /** How long after the last valid trade an open socket is marked STALE/DEGRADED. */
  protected getStaleThresholdMs(): number {
    return STALE_EVENT_THRESHOLD_MS;
  }

  /** Max time a socket may spend in CONNECTING before it is torn down & retried. */
  protected getConnectTimeoutMs(): number {
    return CONNECT_TIMEOUT_MS;
  }

  /** Max time with no inbound WS message (any kind) before a silent socket is dropped. */
  protected getMessageTimeoutMs(): number {
    return MESSAGE_TIMEOUT_MS;
  }

  /** How often the liveness watchdog evaluates the message-timeout. */
  protected getWatchdogIntervalMs(): number {
    return WATCHDOG_INTERVAL_MS;
  }

  /** Upper bound on the exponential-reconnect delay before jitter is applied. */
  protected getMaxReconnectDelayMs(): number {
    return MAX_RECONNECT_DELAY_MS;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────

  connect(): void {
    if (this.ws) return; // duplicate-connection guard
    this.disposed = false;
    this.createWs();
  }

  disconnect(): void {
    this.disposed = true;
    this.wsGeneration++; // invalidate any stale-socket handlers
    this.clearTimers();
    this.stopWatchdog();
    if (this.ws) {
      const w = this.ws;
      this.ws = null;
      this.wsOpen = false;
      w.onopen = null;
      w.onmessage = null;
      w.onerror = null;
      w.onclose = null;
      try {
        w.close();
      } catch {
        /* ignore */
      }
    }
  }

  subscribe(symbol: string): void {
    if (!this.subscribedSymbols.has(symbol)) {
      this.subscribedSymbols.add(symbol);
      this.subscription = "pending";
    }
    if (this.wsOpen) {
      this.send(this.getSubscribeMsg(symbol));
    }
  }

  unsubscribe(symbol: string): void {
    this.subscribedSymbols.delete(symbol);
    if (this.wsOpen) {
      this.send(this.getUnsubscribeMsg(symbol));
    }
  }

  /** The symbol actually being fed (first subscribed symbol). */
  protected currentSymbol(): string {
    return this.subscribedSymbols.size
      ? Array.from(this.subscribedSymbols)[0]
      : "";
  }

  /** Most recent time a valid trade arrived over the WebSocket (0 = none). */
  protected lastWsTradeAt = 0;

  /** Call from the WS message handler after emitting valid trades. */
  protected markWsTrade(): void {
    this.lastWsTradeAt = Date.now();
  }

  /** Record any incoming WS message for the rolling throughput (msg/sec) metric. */
  protected recordMessage(): void {
    this.msgTicks.push(Date.now());
    if (this.msgTicks.length > 512) {
      this.msgTicks = this.msgTicks.slice(-512);
    }
  }

  /** Record a local duplicate/stale drop (called by the engine on dedup). */
  recordDropped(): void {
    this.droppedCount++;
    this.recordMessage();
  }

  /** Record a detected sequence gap in the trade stream. */
  recordGap(): void {
    this.gapCount++;
  }

  /** Valid trades delivered during the last second (rolling window). */
  protected messagesPerSec(): number {
    if (this.msgTicks.length === 0) return 0;
    const now = Date.now();
    const cutoff = now - 1000;
    let n = 0;
    for (let i = this.msgTicks.length - 1; i >= 0; i--) {
      if (this.msgTicks[i] >= cutoff) n++;
      else break;
    }
    return n;
  }

  /**
   * Called by the engine for every non-duplicate, valid real trade. Updates the
   * last-valid-event clock (source of STALE/LIVE) and stores latency ONLY when
   * it is finite and non-negative (a future/invalid timestamp is never shown).
   */
  markTradeValid(trade: NormalizedTrade): void {
    const now = Date.now();
    const received = Number.isFinite(trade.receivedAt) ? trade.receivedAt : now;
    const pAt = trade.processedAt;
    const processed = typeof pAt === "number" && Number.isFinite(pAt) ? pAt : now;
    this.eventCount++;
    this.lastEventTs = trade.timestamp;
    this.lastValidAt = received;
    this.lastProcessedAt = processed;
    this.lastError = "";

    if (Number.isFinite(trade.timestamp) && trade.timestamp > 0) {
      // Out-of-order / sequence detection: an event whose exchange timestamp is
      // meaningfully older than the newest already seen is out of order (or a
      // duplicate backfill). Flag it for monitoring; it is not ingested as fresh.
      if (this.lastSeqTs > 0 && trade.timestamp < this.lastSeqTs - 100) {
        this.outOfOrderCount++;
      }
      if (trade.timestamp > this.lastSeqTs) this.lastSeqTs = trade.timestamp;

      // Estimate clock skew: how far the exchange clock leads this host's
      // clock, approximated by (timestamp - receivedAt) samples. The median is
      // robust to a single out-of-band stale/backfilled/REST-glitch sample that
      // would otherwise inflate `max` and drag reported latency up for the
      // whole window (e.g. an 18-second false reading that persists).
      this.skewSamples.push(trade.timestamp - received);
      this.trimSkewSamples();
      // Recompute the median on a sample basis, not on every trade (warmup
      // recomputes through the first window so early latency stays accurate).
      if (this.eventCount <= BaseExchangeAdapter.SKEW_WINDOW || this.eventCount % SKEW_RECOMPUTE_EVERY === 0) {
        this.recomputeSkew();
      }

      // Corrected network latency = (receivedAt - timestamp) + skewOffset.
      // Floor to a whole millisecond so the displayed latency reads clean.
      const latency = Math.floor(received - trade.timestamp + this.skewOffset);
      if (Number.isFinite(latency) && latency >= 0) {
        this.latency = latency;
      }

      // Data age: how old the underlying market reading is right now. Even for
      // a low-wire-latency feed, `dataAge` grows as the reading ages — the two
      // are deliberately kept separate (transport vs. freshness).
      const age = Math.floor(now - trade.timestamp + this.skewOffset);
      if (Number.isFinite(age) && age >= 0) this.dataAge = age;

      // Transport latency: exchange timestamp → local receipt (wire + decode).
      if (Number.isFinite(latency) && latency >= 0) this.transportLatency = latency;
      // Processing latency: local receipt → validated/ingested.
      const proc = processed - received;
      if (Number.isFinite(proc) && proc >= 0) this.processingLatency = proc;
    }
  }

  /** Trim the skew-sample window to the bound (no allocation when under it). */
  private trimSkewSamples(): void {
    if (this.skewSamples.length > BaseExchangeAdapter.SKEW_WINDOW) {
      this.skewSamples = this.skewSamples.slice(-BaseExchangeAdapter.SKEW_WINDOW);
    }
  }

  /** Recompute the median clock-skew offset over the current sample window. */
  private recomputeSkew(): void {
    const samples = this.skewSamples;
    if (samples.length === 0) return;
    const sorted = samples.slice().sort((a, b) => a - b);
    const mid = sorted.length >> 1;
    this.skewOffset =
      sorted.length % 2 === 1
        ? sorted[mid]
        : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  /** Record a local backpressure/ingest overflow (called by the engine queue). */
  recordOverflow(): void {
    this.overflowCount++;
  }

  /** Mark a transport reconnect so downstream metrics can flag the data gap. */
  markReconnect(outageMs: number): void {
    this.lastReconnectMs = Date.now();
    if (outageMs > 0) this.reconnectGapMs = Math.max(this.reconnectGapMs, outageMs);
    // A reconnect starts a fresh sequence — the old socket's sequence is void.
    this.lastSeqTs = 0;
  }

  getHealth(): ExchangeConnection {
    const now = Date.now();
    let status: ExchangeStatus = this.computeStatus(now);

    // A latched ERROR with no live socket: keep ERROR (real error is recorded).
    if (this.lastError && status === "DISCONNECTED" && this.reconnectCount === 0) {
      status = "ERROR";
    }

    return {
      exchange: this.id,
      label: this.label,
      status,
      latency: this.latency,
      transportLatency: this.transportLatency,
      processingLatency: this.processingLatency,
      dataAge: this.dataAge,
      lastEvent: this.lastEventTs,
      receivedAt: this.lastValidAt,
      processedAt: this.lastProcessedAt,
      eventCount: this.eventCount,
      subscription: this.subscription,
      wsOpen: this.wsOpen,
      reconnectCount: this.reconnectCount,
      lastError: this.lastError,
      subscribedSymbols: Array.from(this.subscribedSymbols),
      messagesPerSec: this.messagesPerSec(),
      droppedEvents: this.droppedCount,
      sequenceGaps: this.gapCount,
      outOfOrderEvents: this.outOfOrderCount,
      overflowCount: this.overflowCount,
      lastReconnectAt: this.lastReconnectMs,
      reconnectGapMs: this.reconnectGapMs,
    };
  }

  /** Cheap hot-path latency read — avoids building the full health object. */
  get lastLatency(): number {
    return this.latency;
  }

  protected computeStatus(now: number): ExchangeStatus {
    if (!this.wsOpen) {
      const staleMs = this.getStaleThresholdMs();
      // Connection lost — a real trade may still be recent enough to show STALE.
      if (this.lastValidAt > 0 && now - this.lastValidAt <= staleMs) {
        return "STALE";
      }
      return "DISCONNECTED";
    }

    // Socket is open. Report LIVE only when real, fresh data arrived on THIS
    // socket; a freshly (re)connected socket is never marked LIVE from a prior
    // socket's health.
    const dataSinceOpen = this.socketOpenedAt > 0 && this.lastValidAt >= this.socketOpenedAt;

    const staleMs = this.getStaleThresholdMs();
    if (this.lastValidAt > 0 && now - this.lastValidAt > staleMs) {
      // Socket is open but market data has gone quiet/stale → DEGRADED.
      return "DEGRADED";
    }

    if (dataSinceOpen) {
      if (this.subscription !== "failed") return "LIVE";
      return "DEGRADED";
    }

    // Never received valid data on this socket yet.
    if (this.subscribedSymbols.size > 0 && this.subscription !== "none") {
      return "SUBSCRIBING";
    }
    return "CONNECTED";
  }

  /** Record the subscription was accepted by the exchange (optional, improves diagnostics). */
  protected confirmSubscription(): void {
    this.subscription = "subscribed";
  }

  /** Record a real upstream subscription/connection error message. */
  protected recordError(message: string): void {
    if (message) this.lastError = String(message).slice(0, 300);
  }

  /** Raise/latch an error state with a real error message. */
  protected setError(message: string): void {
    this.recordError(message);
    if (this.subscription !== "subscribed") this.subscription = "failed";
  }

  // ── WebSocket internals ────────────────────────────────────────────

  protected createWs(): void {
    if (this.disposed) return;
    if (this.ws) return; // never open two sockets for one adapter
    const gen = ++this.wsGeneration;
    let ws: WebSocket;
    try {
      ws = new WebSocket(this.getWsUrl());
    } catch {
      this.recordError("failed to construct WebSocket");
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;
    this.socketOpenedAt = 0;

    // Connect timeout: if the transport never reaches OPEN, drop it & retry.
    const connectTimer = setTimeout(() => {
      if (this.ws === ws && ws.readyState === WebSocket.CONNECTING) {
        this.recordError("connect timeout");
        try {
          ws.close();
        } catch {
          /* ignore */
        }
      }
    }, this.getConnectTimeoutMs());

    ws.onopen = () => {
      clearTimeout(connectTimer);
      if (gen !== this.wsGeneration || this.disposed) {
        try {
          ws.close();
        } catch {
          /* ignore */
        }
        return;
      }
      this.wsOpen = true;
      this.wsEverOpened = true;
      this.socketOpenedAt = Date.now();
      this.lastPong = Date.now();
      this.lastError = "";
      this.subscription = "pending";
      this.markReconnect(this.lastDisconnectAt > 0 ? Date.now() - this.lastDisconnectAt : 0);
      // Resubscribe every requested symbol on (re)connect.
      for (const symbol of this.subscribedSymbols) {
        this.send(this.getSubscribeMsg(symbol));
      }
      this.startWatchdog();
      this.startPing();
    };

    ws.onmessage = (event) => {
      if (gen !== this.wsGeneration || this.disposed) {
        // Clear the connect timeout for a stale frame too.
        clearTimeout(connectTimer);
        return;
      }
      this.lastPong = Date.now();
      const { data } = event;
      // Fast path: string frames (the common case, incl. the HTX inflate proxy)
      // parse and dispatch synchronously — no `await`/microtask hop that would
      // add per-frame latency and let messages batch up behind slow frames.
      if (typeof data === "string") {
        this.dispatchFrame(() => JSON.parse(data));
        return;
      }
      // Blob/ArrayBuffer/view frames (e.g. Upbit binary) need async decode;
      // each is still independent so one slow decode never blocks the others.
      void this.dispatchAsyncFrame(data);
    };

    ws.onerror = (event) => {
      if (gen !== this.wsGeneration || this.disposed) return;
      const msg =
        (event as { message?: string })?.message ||
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (event as any)?.error ||
        "WebSocket error";
      this.recordError(`WS error: ${msg}`);
    };

    ws.onclose = (event) => {
      clearTimeout(connectTimer);
      if (gen !== this.wsGeneration || this.disposed) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const code = (event as any)?.code;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const reason = (event as any)?.reason;
      const reasonText = typeof reason === "string" && reason ? ` (${reason})` : "";
      const codeText = code != null ? ` code=${code}` : "";
      this.recordError(`connection closed${codeText}${reasonText}`);
      this.wsOpen = false;
      this.lastDisconnectAt = Date.now();
      if (this.ws === ws) this.ws = null;
      this.stopPing();
      this.stopWatchdog();
      this.scheduleReconnect();
    };

    this.ws = ws;
  }

  /** Decode+dispatch a frame whose parse is synchronous (fast path). */
  private dispatchFrame(parse: () => unknown): void {
    try {
      this.handleMessage(parse());
    } catch {
      // Malformed / non-JSON / unsupported frame — ignore.
    }
    this.recordMessage();
  }

  /** Decode+dispatch an async frame (Blob/ArrayBuffer/view). Independent per frame. */
  private async dispatchAsyncFrame(data: unknown): Promise<void> {
    try {
      this.handleMessage(await decodeFrame(data));
    } catch {
      // Malformed / non-JSON / unsupported frame — ignore.
    }
    this.recordMessage();
  }

  protected send(msg: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  protected startPing(): void {
    this.stopPing();
    const interval = this.getPingIntervalMs();
    if (interval > 0) {
      this.pingInterval = setInterval(() => {
        const msg = this.getPingMsg();
        if (msg) this.send(msg);
        if (Date.now() - this.lastPong > interval * 3) {
          this.ws?.close();
        }
      }, interval);
    }
  }

  protected stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Liveness watchdog: if NO inbound message of any kind arrives within
   * MESSAGE_TIMEOUT_MS, drop the socket so the (reconnect + resubscribe) path
   * can recover a silently-dead link. Runs for every adapter regardless of the
   * feed's ping configuration, so stale/quiet upstreams are always detected.
   */
  protected startWatchdog(): void {
    this.stopWatchdog();
    this.watchdogInterval = setInterval(() => {
      if (this.disposed) return;
      if (Date.now() - this.lastPong > this.getMessageTimeoutMs()) {
        if (this.ws) this.recordError("no messages received; forcing reconnect");
        this.ws?.close();
      }
    }, this.getWatchdogIntervalMs());
  }

  protected stopWatchdog(): void {
    if (this.watchdogInterval) {
      clearInterval(this.watchdogInterval);
      this.watchdogInterval = null;
    }
  }

  protected scheduleReconnect(): void {
    if (this.disposed) return;
    if (this.reconnectTimeout) return; // never stack duplicate reconnect timers
    this.reconnectCount++;
    // Exponential backoff with jitter (0.5x–1x) so multiple adapters that drop
    // together don't all reconnect in a synchronized thundering herd.
    const base = Math.min(
      1000 * Math.pow(2, this.reconnectCount - 1),
      this.getMaxReconnectDelayMs(),
    );
    const delay = Math.round(base * (0.5 + Math.random() * 0.5));
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.createWs();
    }, delay);
  }

  protected clearTimers(): void {
    this.stopPing();
    this.stopWatchdog();
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  /** Emit a trade through the ingest callback only if it is canonically valid. */
  protected emitTrade(trade: NormalizedTrade): void {
    if (!BaseExchangeAdapter.isValidTrade(trade)) return;
    // A valid trade after (re)connect means we are healthy again; reset the
    // reconnect counter so diagnostics don't accumulate stale hits forever.
    this.reconnectCount = 0;
    this.onTrade?.(trade);
  }

  /**
   * Canonical numeric sanity check shared by every adapter (routed through
   * emitTrade). Enforces price>0, bounded price, quantity>=0, finite notional,
   * a valid side and finite/positive timestamps so a single bad field can
   * never inject NaN/Infinity/negative-price garbage into the flow engine.
   */
  static isValidTrade(t: NormalizedTrade): boolean {
    if (!t || typeof t !== "object") return false;
    if (!Number.isFinite(t.price) || !(t.price > 0)) return false;
    // Guard against absurd tick sizes / data glitches (e.g. price 1e-9 or 1e12).
    if (t.price < 1e-9 || t.price > 1e12) return false;
    if (t.quantity == null || !Number.isFinite(t.quantity) || t.quantity < 0) return false;
    if (!Number.isFinite(t.notional) || t.notional < 0) return false;
    if (t.side !== "buy" && t.side !== "sell") return false;
    if (!Number.isFinite(t.timestamp) || t.timestamp <= 0) return false;
    if (!Number.isFinite(t.receivedAt) || t.receivedAt <= 0) return false;
    if (!Number.isFinite(t.exchange) && typeof t.exchange !== "string") return false;
    return true;
  }
}
