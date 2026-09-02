/**
 * Polling REST Exchange Adapter
 *
 * Several of the newly-added exchanges (Gate.io, KuCoin, Kraken, Upbit, HTX,
 * Bitstamp, Bitfinex) expose a public trades REST endpoint but either lack a
 * low-friction public WebSocket trade stream or are best consumed via polling
 * for a full multi-exchange composite. This base class mirrors the WS
 * `BaseExchangeAdapter` lifecycle but replaces the socket with a REST poll on a
 * fixed cadence.
 *
 * Status model is identical to the WS adapters and is derived from the last
 * valid trade:
 *
 *   CONNECTING   — polling timer running but no valid trade yet
 *   LIVE         — poll loop active + fresh valid trade received
 *   STALE        — no valid trade within the stale threshold
 *   DISCONNECTED — poll loop stopped, or far beyond the stale threshold
 *   ERROR        — a latched, unrecovered upstream error
 *
 * Concrete adapters implement getTradesUrl/parseTrades/handlePollError. Every
 * trade is routed through emitTrade (canonical `isValidTrade` guard) exactly
 * like the WS adapters, so no garbage can reach the flow engine.
 *
 * NOTE FOR FUTURE VALIDATION: the exact REST response shapes are implemented
 * against each exchange's documented public API as best-effort. They are
 * structurally defensive (array-first enumeration with types guards) so a
 * changed field name degrades to "no data" rather than a crash, and the status
 * honestly reflects the real data quality (never mocked/zero-filled).
 */

import type { ExchangeStatus, NormalizedTrade } from "../types";
import { BaseExchangeAdapter } from "./base";

export const POLL_STALE_MS = 15_000; // no valid trade within => stale
export const POLL_CONNECTION_FAIL_MS = 30_000; // consecutive failing polls => disconnected

export abstract class PollingExchangeAdapter extends BaseExchangeAdapter {
  /** How often (ms) to poll the trades endpoint. */
  protected pollIntervalMs = 2000;

  /** URI of the public trades endpoint for a symbol. */
  protected abstract getTradesUrl(symbol: string): string;

  /** Parse the REST JSON body into normalized trades for the symbol. */
  protected abstract parseTrades(json: unknown, symbol: string): NormalizedTrade[];

  /** Optional hook to map an upstream error into a human message. */
  protected handlePollError(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }

  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private polling = false;
  private fetching = false;
  private consecutiveFailures = 0;
  private lastPollAt = 0;

  // WS hooks are unused by polling adapters (kept concrete for base compliance).
  protected getWsUrl(): string {
    return "";
  }

  protected getSubscribeMsg(): unknown {
    return null;
  }

  protected getUnsubscribeMsg(): unknown {
    return null;
  }

  protected getPingMsg(): unknown {
    return null;
  }

  protected getPingIntervalMs(): number {
    return 0;
  }

  protected handleMessage(): void {
    /* no WS messages */
  }

  // ── Lifecycle overrides ───────────────────────────────────────────

  connect(): void {
    if (this.pollTimer) return;
    this.polling = true;
    this.wsOpen = true;
    void this.pollNow();
    this.pollTimer = setInterval(() => void this.pollNow(), this.pollIntervalMs);
  }

  disconnect(): void {
    this.stopPolling();
    this.polling = false;
    this.wsOpen = false;
    super.disconnect();
  }

  /** Re-run status using the polling connection semantics. */
  protected override computeStatus(now: number): ExchangeStatus {
    if (!this.polling || !this.wsOpen) {
      if (this.lastValidAt > 0 && now - this.lastValidAt <= POLL_STALE_MS) {
        return "STALE";
      }
      return "DISCONNECTED";
    }
    if (
      this.consecutiveFailures > 0 &&
      this.lastValidAt > 0 &&
      now - this.lastValidAt > POLL_CONNECTION_FAIL_MS
    ) {
      return "DISCONNECTED";
    }
    if (this.lastValidAt > 0 && now - this.lastValidAt > POLL_STALE_MS) {
      return "STALE";
    }
    if (this.lastValidAt > 0 && this.subscription !== "failed") {
      return "LIVE";
    }
    return this.consecutiveFailures >= 3 ? "STALE" : "CONNECTING";
  }

  // ── Polling internals ─────────────────────────────────────────────

  private async pollNow(): Promise<void> {
    if (this.fetching) return; // don't stack overlapping polls
    this.fetching = true;
    this.lastPollAt = Date.now();

    try {
      const symbol = this.subscribedSymbols.size
        ? Array.from(this.subscribedSymbols)[0]
        : "";
      if (!symbol) return;
      const url = this.getTradesUrl(symbol);
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const json = await res.json();
      const trades = this.parseTrades(json, symbol);
      // A successful response proves connectivity to the upstream. We keep the
      // connection healthy even on an empty batch (zero trades in a window is a
      // genuine reading, not a failure).
      this.consecutiveFailures = 0;
      for (const t of trades) this.emitTrade(t);
      // Receipt of fresh trades implies the upstream accepted the request.
      if (trades.length > 0) this.confirmSubscription();
    } catch (err) {
      this.consecutiveFailures++;
      this.recordError(this.handlePollError(err));
    } finally {
      this.fetching = false;
    }
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }
}
