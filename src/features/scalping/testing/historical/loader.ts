"use client";

import type { BtcCandle } from "../../../bitcoin/types";
import { normalizeKlines } from "../../../bitcoin/data/normalize";

/**
 * Historical market data loader.
 *
 * Uses ONLY Binance public (unauthenticated) endpoints — no user account data.
 * Fetches 1m spot klines for BTCUSDT over a date range, paginated in 1000-row
 * chunks (Binance hard limit). The candle tuples are normalised with the same
 * `normalizeKlines` used by the live pipeline, so a replay candle is byte-for-
 * byte the same shape the live feature engine consumes.
 */

const SPOT_KLINES = "https://api.binance.com/api/v3/klines";
const SYMBOL = "BTCUSDT";
const INTERVAL = "1m";
const PAGE = 1000; // Max rows Binance returns per klines call.

type KlineTuple = [
  number, // open time ms
  string, // open
  string, // high
  string, // low
  string, // close
  string, // volume
  number, // close time ms
  string, // quote volume
  number, // number of trades
  string, // taker buy base volume
  string, // taker buy quote volume
  string // ignore
];

async function fetchKlinePage(
  startTimeMs: number,
  endTimeMs: number
): Promise<KlineTuple[]> {
  const url =
    `${SPOT_KLINES}?symbol=${SYMBOL}&interval=${INTERVAL}` +
    `&startTime=${startTimeMs}&endTime=${endTimeMs}&limit=${PAGE}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Binance klines HTTP ${res.status}`);
  }
  return (await res.json()) as KlineTuple[];
}

/**
 * Fetch all 1m candles in [startMs, endMs] (inclusive), paginating backwards
 * so the returned series is strictly ascending and complete. Returns an empty
 * array when the range is invalid or empty.
 */
export async function fetchHistoricalCandles(
  startMs: number,
  endMs: number
): Promise<BtcCandle[]> {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs > endMs) {
    return [];
  }

  // floor start to a whole minute, ceil end to a whole minute.
  const startFloor = Math.floor(startMs / 60_000) * 60_000;
  const endFloor = Math.floor(endMs / 60_000) * 60_000;

  const rawTuples: KlineTuple[] = [];
  let cursor = startFloor;

  // Bound to ~2h of pages to avoid an accidental unbounded loop.
  let guard = 0;
  const MAX_PAGES = 200;
  while (cursor <= endFloor && guard < MAX_PAGES) {
    guard++;
    const page = await fetchKlinePage(cursor, endFloor);
    if (page.length === 0) break;
    for (const row of page) rawTuples.push(row);
    const lastOpen = page[page.length - 1][0];
    const next = lastOpen + 60_000;
    if (next <= cursor) break; // no forward progress → stop
    cursor = next;
  }

  // De-duplicate by open time (physically impossible, but safe) and sort.
  const byTime = new Map<number, KlineTuple>();
  for (const row of rawTuples) byTime.set(row[0], row);
  const rows = [...byTime.values()].sort((a, b) => a[0] - b[0]);

  return normalizeKlines(rows as unknown as unknown[][]);
}

/** Convert an epoch-ms to the local 1m-candle open time used in replay. */
export function minuteFloor(ms: number): number {
  return Math.floor(ms / 60_000) * 60_000;
}
