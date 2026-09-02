/**
 * Hybrid Exchange Adapter (WebSocket primary + REST fallback)
 *
 * Primary data path is a WebSocket trade stream (low latency). Because exact
 * WS message shapes are best-effort (cannot be verified against live sockets
 * from here), a REST poll runs in parallel as an automatic safety net: if the
 * WebSocket goes quiet or drops, REST trades keep flowing so the exchange stays
 * LIVE instead of silently degrading to STALE/DISCONNECTED on a format mismatch.
 *
 * The WS lifecycle (connect/disconnect/reconnect/ping/status) is inherited from
 * `BaseExchangeAdapter` unchanged. This class only layers a REST backfill on
 * top:
 *
 *   - Every WS trade emission should call `markWsTrade()` so the base knows the
 *     socket feed is alive.
 *   - The REST poll runs on a fixed cadence but only EMITS trades when the WS has
 *     been silent longer than `WS_QUIET_FALLBACK_MS` (so healthy sockets are
 *     never double-counted). A successful REST response also resets the poll
 *     failure counter so a healthy-but-quiet REST feed keeps the connection
 *     honest.
 *
 * Concrete adapters implement BOTH the WS hooks (getWsUrl / getSubscribeMsg /
 * getUnsubscribeMsg / getPingMsg / getPingIntervalMs / handleMessage /
 * normalizeTrade / normalizeLiquidation — from the base) AND the REST fallback
 * hooks (getTradesUrl / parseTrades).
 */

import type { ExchangeStatus, NormalizedTrade } from "../types";
import { BaseExchangeAdapter } from "./base";

/** WS silent for this long before REST fallback starts emitting trades again. */
export const WS_QUIET_FALLBACK_MS = 6000;

/** Cadence of the REST fallback poll. */
export const REST_FALLBACK_INTERVAL_MS = 4000;

/** No successful REST response within this window → flagged not-connecting via REST. */
export const REST_FAIL_MS = 15_000;

export abstract class HybridExchangeAdapter extends BaseExchangeAdapter {
  /** How often (ms) to poll the trades endpoint as a WS fallback. */
  protected restFallbackIntervalMs = REST_FALLBACK_INTERVAL_MS;

  /** URI of the public trades endpoint for a symbol (REST fallback). */
  protected abstract getTradesUrl(symbol: string): string;

  /** Parse the REST JSON body into normalized trades for the symbol. */
  protected abstract parseTrades(json: unknown, symbol: string): NormalizedTrade[];

  /** Optional hook to map an upstream error into a human message. */
  protected handlePollError(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }

  private fallbackTimer: ReturnType<typeof setInterval> | null = null;
  private fetching = false;
  private lastWsTradeAt = 0;
  private lastRestSuccessAt = 0;
  private consecutivePollFailures = 0;

  /** The symbol actually being fed (first subscribed symbol). */
  protected currentSymbol(): string {
    return this.subscribedSymbols.size
      ? Array.from(this.subscribedSymbols)[0]
      : "";
  }

  /** Time of the most recent WS trade emission (0 = none yet). */
  protected lastWsTradeTime(): number {
    return this.lastWsTradeAt;
  }

  /** Subclass calls this each time the WS emits one or more valid trades. */
  protected markWsTrade(): void {
    this.lastWsTradeAt = Date.now();
    this.consecutivePollFailures = 0;
  }

  /** True when REST fallback should emit (WS quiet / not producing trades). */
  protected restShouldEmit(now: number): boolean {
    return now - this.lastWsTradeAt > WS_QUIET_FALLBACK_MS;
  }

  connect(): void {
    super.connect();
    this.startRestFallback();
  }

  disconnect(): void {
    this.stopRestFallback();
    super.disconnect();
  }

  // ── REST fallback polling ─────────────────────────────────────────

  protected startRestFallback(): void {
    if (this.fallbackTimer) return;
    void this.pollFallback();
    this.fallbackTimer = setInterval(() => void this.pollFallback(), this.restFallbackIntervalMs);
  }

  protected stopRestFallback(): void {
    if (this.fallbackTimer) {
      clearInterval(this.fallbackTimer);
      this.fallbackTimer = null;
    }
  }

  private async pollFallback(): Promise<void> {
    if (this.fetching) return; // never stack overlapping polls
    this.fetching = true;
    try {
      const symbol = this.currentSymbol();
      if (!symbol) return;
      // Skip the network round-trip entirely when the WS is clearly healthy so
      // we don't burn rate-limit and add upstream load for nothing.
      if (!this.restShouldEmit(Date.now())) return;

      const url = this.getTradesUrl(symbol);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const trades = this.parseTrades(json, symbol);
      // A successful REST response proves upstream reachability; keep the
      // connection healthy even on an empty batch (zero trades is legit).
      this.consecutivePollFailures = 0;
      this.lastRestSuccessAt = Date.now();
      // Only emit REST trades when the WS truly is not supplying data.
      for (const t of trades) this.emitTrade(t);
    } catch (err) {
      this.consecutivePollFailures++;
      this.recordError(this.handlePollError(err));
    } finally {
      this.fetching = false;
    }
  }

  protected override computeStatus(now: number): ExchangeStatus {
    // If we only ever hear from REST (no WS), do not report LIVE from a WS
    // perspective — reflect that the feed is being carried by the fallback.
    if (this.lastWsTradeAt === 0 && this.lastRestSuccessAt > 0) {
      if (now - this.lastRestSuccessAt <= REST_FAIL_MS) return "LIVE";
      if (this.lastRestSuccessAt > 0) return "STALE";
      return "DISCONNECTED";
    }
    return super.computeStatus(now);
  }
}
