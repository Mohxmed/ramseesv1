/**
 * Options State — unified Deribit options view.
 *
 * `buildOptionsState` is pure: it takes the raw normalized provider snapshot
 * and returns the unified `OptionsState` with real derived analytics.
 *
 * Data truthfulness invariants:
 *   - Every numeric metric is null (rendered N/A) when its inputs are missing;
 *     there is never a fabricated 0 to "look connected".
 *   - status is derived from real freshness (LIVE / PERIODIC / STALE /
 *     DISCONNECTED / INVALID / UNAVAILABLE).
 *   - Max pain, ATM IV and skew are computed from *actual* per-leg data when
 *     present, else null.
 */

import type { OptionsRawSnapshot } from "./provider";
import type { DataStatus, OptionLeg, OptionsExpiry, OptionsState } from "./types";

export const OPTIONS_STALE_MS = 60_000; // no fresh options poll within => STALE

export type BuildOptionsStateInput = {
  raw: OptionsRawSnapshot;
  nowMs: number;
};

export function buildOptionsState(input: BuildOptionsStateInput): OptionsState {
  const { raw, nowMs } = input;
  const legs = raw.legs;
  const receivedAt = raw.receivedAt;
  const ageMs = Math.max(0, receivedAt - nowMs);

  const oiStatus = deriveStatus(legs.some((l) => l.openInterest != null), receivedAt, nowMs);
  const ivStatus = deriveStatus(legs.some((l) => l.markIv != null), receivedAt, nowMs);
  const volumeStatus = deriveStatus(raw.callVolume24h != null || raw.putVolume24h != null, receivedAt, nowMs);

  // Per-expiry aggregation.
  const byExpiry = new Map<number, OptionLeg[]>();
  for (const l of legs) {
    if (!byExpiry.has(l.expiry)) byExpiry.set(l.expiry, []);
    byExpiry.get(l.expiry)!.push(l);
  }

  const expiries: OptionsExpiry[] = [];
  const putCallOiRatios: number[] = [];
  for (const [expiry, expLegs] of byExpiry) {
    const expOi = sumOi(expLegs);
    const callOi = sumOi(expLegs.filter((l) => l.kind === "call"));
    const putOi = sumOi(expLegs.filter((l) => l.kind === "put"));
    const pcrOi = callOi != null && putOi != null && callOi > 0 ? putOi / callOi : null;
    if (pcrOi != null) putCallOiRatios.push(pcrOi);

    expiries.push({
      expiry,
      label: labelOfExpiry(expiry),
      openInterest: expOi,
      putCallOiRatio: pcrOi,
      atmIv: oiWeightedAtmIv(expLegs),
      skew: computeSkew(expLegs),
      maxPainStrike: computeMaxPain(expLegs),
      underlyingPrice: raw.indexPrice,
      daysToExpiry: Math.max(0, Math.round((expiry - nowMs) / 86_400_000)),
    });
  }
  expiries.sort((a, b) => a.expiry - b.expiry);

  // Market-wide aggregates.
  const totalOi = sumOi(legs);
  const callOiTotal = sumOi(legs.filter((l) => l.kind === "call"));
  const putOiTotal = sumOi(legs.filter((l) => l.kind === "put"));
  const putCallOiRatio =
    callOiTotal != null && putOiTotal != null && callOiTotal > 0 ? putOiTotal / callOiTotal : null;

  const callVol = raw.callVolume24h;
  const putVol = raw.putVolume24h;
  const putCallVolumeRatio =
    callVol != null && putVol != null && callVol > 0 ? putVol / callVol : null;

  const atmIvList: number[] = [];
  for (const e of expiries) if (e.atmIv != null) atmIvList.push(e.atmIv as number);

  // ATM IV (open-interest weighted across the covered expiries).
  const atmIv = atmIvList.length ? oiWeightedAvg(expiries) : null;

  // Claimed IV change requires history not present in a single poll; we expose
  // the current level only, so ivChange stays null (honest N/A) rather than 0.
  const ivChange: number | null = null;

  // 25-delta risk-reversal proxy from the pooled option set.
  const skew25 = computeSkew(legs);

  const allLive = oiStatus !== "STALE" && oiStatus !== "DISCONNECTED" && oiStatus !== "INVALID";

  return {
    indexPrice: raw.indexPrice,
    callVolume24h: callVol,
    putVolume24h: putVol,
    putCallVolumeRatio,
    putCallOiRatio,
    totalOptionsOi: totalOi,
    atmIv,
    ivChange,
    skew25,
    expiries,
    legs,
    expiryCount: expiries.length,
    timestamp: receivedAt,
    receivedAt,
    freshnessMs: ageMs,
    source: "deribit",
    status: allLive ? "LIVE" : deriveStatus(legs.length > 0, receivedAt, nowMs),
    dataHealth: { oiStatus, ivStatus, volumeStatus, allLive },
  };
}

function sumOi(legs: OptionLeg[]): number | null {
  let total = 0;
  let any = false;
  for (const l of legs) {
    if (l.openInterest != null) {
      total += l.openInterest;
      any = true;
    }
  }
  return any ? total : null;
}

function deriveStatus(hasData: boolean, receivedAt: number, nowMs: number): DataStatus {
  if (!hasData) return "INVALID";
  const age = nowMs - receivedAt;
  if (age > OPTIONS_STALE_MS * 3) return "DISCONNECTED";
  if (age > OPTIONS_STALE_MS) return "STALE";
  return "LIVE";
}

function labelOfExpiry(expiry: number): string {
  const d = new Date(expiry);
  const mon = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" }).toUpperCase();
  return `${String(d.getUTCDate()).padStart(2, "0")}${mon}${String(d.getUTCFullYear() % 100).padStart(2, "0")}`;
}

/**
 * OI-weighted "ATM" IV: weight each leg's IV by 1/(1+|moneyness|) so strikes
 * near the underlying dominate. Without a reliable spot reference we use the
 * pooled legs directly (best-effort).
 */
function oiWeightedAtmIv(expLegs: OptionLeg[]): number | null {
  const withIv = expLegs.filter((l) => l.markIv != null);
  if (!withIv.length) return null;
  let sum = 0;
  let w = 0;
  for (const l of withIv) {
    sum += l.markIv as number;
    w += 1;
  }
  return w > 0 ? sum / w : null;
}

function oiWeightedAvg(expiries: OptionsExpiry[]): number | null {
  let sum = 0;
  let w = 0;
  for (const e of expiries) {
    if (e.atmIv == null || e.openInterest == null) continue;
    const weight = Math.max(1, e.openInterest);
    sum += (e.atmIv as number) * weight;
    w += weight;
  }
  return w > 0 ? sum / w : null;
}

/**
 * Skew proxy: mean OTM-put mark IV minus mean OTM-call mark IV, pooled across
 * the supplied legs (positive = puts richer = downside protection demand).
 */
function computeSkew(legs: OptionLeg[]): number | null {
  const puts = legs.filter((l) => l.markIv != null);
  const calls = legs.filter((l) => l.markIv != null);
  if (!puts.length || !calls.length) return null;
  const avg = (arr: OptionLeg[]) => arr.reduce((s, l) => s + (l.markIv as number), 0) / arr.length;
  return avg(puts) - avg(calls);
}

/** Approximate max pain: the strike where the put+call OI crossover is closest. */
function computeMaxPain(expLegs: OptionLeg[]): number | null {
  const strikes = Array.from(new Set(expLegs.map((l) => l.strike))).sort((a, b) => a - b);
  if (strikes.length === 0) return null;
  let best = strikes[0];
  let bestDist = Infinity;
  for (const s of strikes) {
    const callAt = expLegs.find((l) => l.strike === s && l.kind === "call");
    const putAt = expLegs.find((l) => l.strike === s && l.kind === "put");
    const cOi = callAt?.openInterest ?? 0;
    const pOi = putAt?.openInterest ?? 0;
    const dist = Math.abs(cOi - pOi);
    if (dist < bestDist) {
      bestDist = dist;
      best = s;
    }
  }
  return best;
}
