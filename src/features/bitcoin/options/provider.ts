/**
 * Deribit Options Provider (polled REST)
 *
 * Consumes Deribit's public JSON-RPC endpoints on a cadence and emits raw,
 * already-normalized options data (per-expiry legs + market-wide volumes +
 * index price). The `buildOptionsState` pure function downstream turns this raw
 * snapshot into the unified `OptionsState`.
 *
 *   - public/get_book_summary_by_currency?currency=BTC&kind=option
 *       -> [ { instrument_name, open_interest, mark_iv, mark_price,
 *              underlying_price, volume, bid_price, ask_price, last } ]
 *   - public/get_trade_volumes
 *       -> [ { currency, calls_volume, puts_volume, futures_volume, spot_volume } ]
 *   - public/ticker?instrument_name=BTC-PERPETUAL
 *       -> { index_price, open_interest, ... }
 *
 * STATUS HONESTY: an empty/failed response yields nulls (N/A), never a mocked
 * 0. The provider tracks liveness for `buildOptionsState`.
 */

import type { OptionLeg } from "./types";

export type OptionsRawSnapshot = {
  receivedAt: number;
  indexPrice: number | null;
  legs: OptionLeg[];
  callVolume24h: number | null;
  putVolume24h: number | null;
};

const DERIBIT_BASE = "https://www.deribit.com/api/v2";

/** Deribit instrument name → e.g. "BTC-29SEP26-105000-C". */
function parseInstrument(name: string): {
  base: string;
  expiry: number | null;
  strike: number | null;
  kind: "call" | "put" | null;
} {
  const m = name.match(/^([A-Z]+)-(\d{2}[A-Z]{3}\d{2})-(\d+)-([CP])$/i);
  if (!m) {
    return { base: name.split("-")[0] ?? "", expiry: null, strike: null, kind: null };
  }
  const [, base, expiryStr, strikeStr, kindStr] = m;
  const expiry = parseExpiry(expiryStr);
  return {
    base,
    expiry,
    strike: Number.isFinite(Number(strikeStr)) ? Number(strikeStr) : null,
    kind: kindStr.toUpperCase() === "C" ? "call" : "put",
  };
}

/** "29SEP26" → ms epoch (Deribit convention: DDMMMYY). */
function parseExpiry(s: string): number | null {
  const m = s.match(/^(\d{1,2})([A-Z]{3})(\d{2})$/);
  if (!m) return null;
  const day = Number(m[1]);
  const mon = m[2].toUpperCase();
  const year = 2000 + Number(m[3]);
  const months: Record<string, number> = {
    JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
    JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
  };
  const mo = months[mon];
  if (mo === undefined || day < 1 || day > 31) return null;
  const dt = new Date(year, mo, day, 8, 0, 0, 0); // Deribit settles ~08:00 UTC
  return dt.getTime();
}

export class DeribitOptionsProvider {
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private cb: ((snap: OptionsRawSnapshot) => void) | null = null;

  /** Poll cadence (ms). Options data changes slowly; 10s is ample. */
  pollIntervalMs = 10_000;

  onSnapshot(cb: (snap: OptionsRawSnapshot) => void): void {
    this.cb = cb;
  }

  start(): void {
    if (this.timer) return;
    this.running = true;
    void this.poll();
    this.timer = setInterval(() => void this.poll(), this.pollIntervalMs);
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async poll(): Promise<void> {
    if (!this.cb) return;
    const receivedAt = Date.now();
    try {
      const [bookRaw, volumesRaw, tickerRaw] = await Promise.allSettled([
        this.getBookSummary(),
        this.getTradeVolumes(),
        this.getTicker(),
      ]);

      const legs = this.normalizeBook(bookRaw.status === "fulfilled" ? bookRaw.value : null);
      const { callVolume24h, putVolume24h } = this.normalizeVolumes(
        volumesRaw.status === "fulfilled" ? volumesRaw.value : null
      );
      const indexPrice = this.normalizeIndex(tickerRaw.status === "fulfilled" ? tickerRaw.value : null);

      // A wholly-degraded fetch still emits a snapshot with N/A values; the
      // downstream build marks status STALE/DISCONNECTED by freshness.
      this.cb({ receivedAt, indexPrice, legs, callVolume24h, putVolume24h });
    } catch {
      // ignore — next poll retries
    }
  }

  private async get(endpoint: string): Promise<unknown> {
    const res = await fetch(`${DERIBIT_BASE}/${endpoint}`);
    if (!res.ok) throw new Error(`Deribit HTTP ${res.status}`);
    return res.json();
  }

  private getBookSummary(): Promise<unknown> {
    return this.get("public/get_book_summary_by_currency?currency=BTC&kind=option");
  }

  private getTradeVolumes(): Promise<unknown> {
    return this.get("public/get_trade_volumes");
  }

  private getTicker(): Promise<unknown> {
    return this.get("public/ticker?instrument_name=BTC-PERPETUAL");
  }

  private normalizeBook(json: unknown): OptionLeg[] {
    const body = json as { result?: Record<string, unknown>[] };
    const list = body?.result ?? [];
    const legs: OptionLeg[] = [];
    for (const raw of list) {
      const r = raw as {
        instrument_name?: string;
        open_interest?: number | null;
        mark_iv?: number | null;
        mark_price?: number | null;
        underlying_price?: number | null;
        volume?: number | null;
        bid_price?: number | null;
        ask_price?: number | null;
        last?: number | null;
      };
      const name = r.instrument_name ?? "";
      const meta = parseInstrument(name);
      const isOption = meta.kind !== null && meta.expiry != null && meta.strike != null;
      const hasData = r.open_interest != null || r.mark_iv != null || r.bid_price != null;
      if (!isOption || !hasData) continue;
      const kind = meta.kind as "call" | "put";
      const bid = r.bid_price != null && Number.isFinite(r.bid_price) ? r.bid_price : null;
      const ask = r.ask_price != null && Number.isFinite(r.ask_price) ? r.ask_price : null;
      const mid = bid != null && ask != null ? (bid + ask) / 2 : null;
      legs.push({
        instrumentName: name,
        kind,
        strike: meta.strike as number,
        expiry: meta.expiry as number,
        openInterest:
          r.open_interest != null && Number.isFinite(r.open_interest) && r.open_interest >= 0
            ? r.open_interest
            : null,
        markIv: r.mark_iv != null && Number.isFinite(r.mark_iv) ? r.mark_iv : null,
        bidPrice: bid,
        askPrice: ask,
        midPrice: mid,
        volume: r.volume != null && Number.isFinite(r.volume) ? r.volume : null,
        lastPrice: r.last != null && Number.isFinite(r.last) ? r.last : null,
      });
    }
    return legs;
  }

  private normalizeVolumes(json: unknown): {
    callVolume24h: number | null;
    putVolume24h: number | null;
  } {
    const body = json as { result?: { currency?: string; calls_volume?: number; puts_volume?: number }[] };
    const row = (body?.result ?? []).find((r) => r.currency === "BTC");
    if (!row) return { callVolume24h: null, putVolume24h: null };
    return {
      callVolume24h:
        row.calls_volume != null && Number.isFinite(row.calls_volume) ? row.calls_volume : null,
      putVolume24h:
        row.puts_volume != null && Number.isFinite(row.puts_volume) ? row.puts_volume : null,
    };
  }

  private normalizeIndex(json: unknown): number | null {
    const body = json as { result?: { index_price?: number | null } };
    const v = body?.result?.index_price;
    return v != null && Number.isFinite(v) && v > 0 ? v : null;
  }
}
