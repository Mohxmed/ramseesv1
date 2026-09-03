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

export abstract class BaseExchangeAdapter implements ExchangeAdapter {
  abstract readonly id: string;
  abstract readonly label: string;
  abstract readonly market: "spot" | "perpetual" | "futures";

  protected ws: WebSocket | null = null;
  protected wsOpen = false;
  protected reconnectCount = 0;
  protected subscribedSymbols = new Set<string>();
  protected pingInterval: ReturnType<typeof setInterval> | null = null;
  protected reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  protected lastPong = 0;

  // Diagnostics / health
  protected lastValidAt = 0; // receivedAt of last valid trade (0 = none)
  protected lastEventTs = 0; // exchange timestamp of last valid trade (0 = none)
  protected eventCount = 0;
  protected latency = -1; // -1 = N/A
  protected subscription: SubscriptionStatus = "pending";
  protected lastError = "";
  protected wsEverOpened = false;

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

  // ── Lifecycle ──────────────────────────────────────────────────────

  connect(): void {
    if (this.ws) return;
    this.createWs();
  }

  disconnect(): void {
    this.clearTimers();
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.close();
      this.ws = null;
    }
    this.wsOpen = false;
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

  /**
   * Called by the engine for every non-duplicate, valid real trade. Updates the
   * last-valid-event clock (source of STALE/LIVE) and stores latency ONLY when
   * it is finite and non-negative (a future/invalid timestamp is never shown).
   */
  markTradeValid(trade: NormalizedTrade): void {
    const received = Number.isFinite(trade.receivedAt) ? trade.receivedAt : Date.now();
    this.eventCount++;
    this.lastEventTs = trade.timestamp;
    this.lastValidAt = received;
    this.lastError = "";

    if (Number.isFinite(trade.timestamp) && trade.timestamp > 0) {
      // Estimate clock skew: the most-ahead (timestamp - receivedAt) sample
      // approximates how far the exchange clock leads this host's clock.
      this.skewSamples.push(trade.timestamp - received);
      if (this.skewSamples.length > BaseExchangeAdapter.SKEW_WINDOW) {
        this.skewSamples = this.skewSamples.slice(-BaseExchangeAdapter.SKEW_WINDOW);
      }
      let maxSkew = this.skewSamples[0];
      for (let i = 1; i < this.skewSamples.length; i++) {
        if (this.skewSamples[i] > maxSkew) maxSkew = this.skewSamples[i];
      }
      this.skewOffset = maxSkew;

      // Corrected network latency = (receivedAt - timestamp) + skewOffset.
      // Floor to a whole millisecond so the displayed latency reads clean.
      const latency = Math.floor(received - trade.timestamp + this.skewOffset);
      if (Number.isFinite(latency) && latency >= 0) {
        this.latency = latency;
      }
    }
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
      lastEvent: this.lastEventTs,
      receivedAt: this.lastValidAt,
      eventCount: this.eventCount,
      subscription: this.subscription,
      wsOpen: this.wsOpen,
      reconnectCount: this.reconnectCount,
      lastError: this.lastError,
      subscribedSymbols: Array.from(this.subscribedSymbols),
    };
  }

  protected computeStatus(now: number): ExchangeStatus {
    if (!this.wsOpen) {
      // Connection lost — a real trade may still be recent enough to show STALE.
      if (this.lastValidAt > 0 && now - this.lastValidAt <= STALE_EVENT_THRESHOLD_MS) {
        return "STALE";
      }
      return "DISCONNECTED";
    }

    // Socket is open.
    if (this.lastValidAt > 0 && now - this.lastValidAt > STALE_EVENT_THRESHOLD_MS) {
      return "STALE";
    }
    if (this.lastValidAt > 0 && this.subscription !== "failed") {
      return "LIVE";
    }
    return "CONNECTING";
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
    const url = this.getWsUrl();
    const ws = new WebSocket(url);

    ws.onopen = () => {
      this.wsOpen = true;
      this.wsEverOpened = true;
      this.lastPong = Date.now();
      for (const symbol of this.subscribedSymbols) {
        this.send(this.getSubscribeMsg(symbol));
      }
      this.startPing();
    };

    ws.onmessage = (event) => {
      this.lastPong = Date.now();
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        this.handleMessage(data);
      } catch {
        // Binary or unparseable — ignore
      }
    };

    ws.onerror = (event) => {
      const msg = (event as { message?: string })?.message || "WebSocket error";
      this.recordError(msg);
    };

    ws.onclose = () => {
      this.wsOpen = false;
      this.ws = null;
      this.stopPing();
      this.scheduleReconnect();
    };

    this.ws = ws;
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

  protected scheduleReconnect(): void {
    this.reconnectCount++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectCount), 30_000);
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.createWs();
    }, delay);
  }

  protected clearTimers(): void {
    this.stopPing();
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
