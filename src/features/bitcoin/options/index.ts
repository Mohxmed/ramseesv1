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
 *   - ATM IV is interpolated between the strikes bracketing the index price;
 *     skew only ever averages OTM strikes within a moneyness band; max pain is
 *     the strike minimizing the chain's total exercise payout — all computed
 *     from *actual* per-leg data when present, else null.
 */

import type { OptionsRawSnapshot } from "./provider";
import type { DataStatus, OptionLeg, OptionsExpiry, OptionsState } from "./types";

export const OPTIONS_STALE_MS = 60_000; // no fresh options poll within => STALE
/** Moneyness band (±) for the OTM-skew calculation. */
export const SKEW_MONEYNESS_BAND = 0.2;

export type BuildOptionsStateInput = {
  raw: OptionsRawSnapshot;
  nowMs: number;
};

export function buildOptionsState(input: BuildOptionsStateInput): OptionsState {
  const { raw, nowMs } = input;
  const legs = raw.legs;
  const receivedAt = raw.receivedAt;
  const ageMs = Math.max(0, nowMs - receivedAt);

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
  for (const [expiry, expLegs] of byExpiry) {
    const expOi = sumOi(expLegs);
    const callOi = sumOi(expLegs.filter((l) => l.kind === "call"));
    const putOi = sumOi(expLegs.filter((l) => l.kind === "put"));
    const pcrOi = callOi != null && putOi != null && callOi > 0 ? putOi / callOi : null;

    expiries.push({
      expiry,
      label: labelOfExpiry(expiry),
      openInterest: expOi,
      putCallOiRatio: pcrOi,
      atmIv: computeAtmIv(expLegs, raw.indexPrice),
      skew: computeSkew(expLegs, raw.indexPrice),
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
  const putCallVolumeRatio = callVol != null && putVol != null && callVol > 0 ? putVol / callVol : null;

  // Market-wide ATM IV and 25Δ-style skew: OI-weighted across the covered expiries.
  const atmIv = oiWeightedAvg(expiries, (e) => e.atmIv);
  const skew25 = oiWeightedAvg(expiries, (e) => e.skew);

  // Claimed IV change requires history not present in a single poll; we expose
  // the current level only, so ivChange stays null (honest N/A) rather than 0.
  const ivChange: number | null = null;

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

/** Per-strike mark IV (mean across the call + put legs at that strike). */
function ivByStrike(expLegs: OptionLeg[]): Record<number, number> {
  const acc: Record<number, { sum: number; n: number }> = {};
  for (const l of expLegs) {
    if (l.markIv == null) continue;
    acc[l.strike] ??= { sum: 0, n: 0 };
    acc[l.strike].sum += l.markIv;
    acc[l.strike].n += 1;
  }
  const out: Record<number, number> = {};
  for (const k of Object.keys(acc)) out[Number(k)] = acc[Number(k)].sum / acc[Number(k)].n;
  return out;
}

/**
 * ATM IV: interpolate the mark-IV between the two strikes bracketing the index
 * price (per-strike IV = mean of call+put mark IV at that strike). Without a
 * usable index price it falls back to the simple mean across strikes (honest
 * N/A would be preferable, but the mean is a documented best-effort).
 */
function computeAtmIv(expLegs: OptionLeg[], underlyingPrice: number | null): number | null {
  const byStrike = ivByStrike(expLegs);
  const strikes = Object.keys(byStrike)
    .map(Number)
    .map((s) => ({ strike: s, iv: byStrike[s] }))
    .sort((a, b) => a.strike - b.strike);
  if (!strikes.length) return null;

  if (underlyingPrice != null && underlyingPrice > 0) {
    const s = underlyingPrice;
    const below = strikes.filter((x) => x.strike <= s);
    const above = strikes.filter((x) => x.strike >= s);
    if (below.length && above.length) {
      const low = below[below.length - 1];
      const high = above[0];
      if (low.strike === high.strike) return low.iv;
      const t = (s - low.strike) / (high.strike - low.strike);
      return low.iv + (high.iv - low.iv) * t;
    }
    if (below.length) return below[below.length - 1].iv;
    if (above.length) return above[0].iv;
  }

  return strikes.reduce((sum, x) => sum + x.iv, 0) / strikes.length;
}

/**
 * 25Δ-style call/put skew: mean mark IV of OTM puts minus mean mark IV of OTM
 * calls, restricted to a ±SKEW_MONEYNESS_BAND moneyness window around the index
 * price (positive = puts richer = downside-protection demand). Requires both an
 * index price and at least one OTM put + one OTM call with IVs, else null.
 */
function computeSkew(legs: OptionLeg[], underlyingPrice: number | null): number | null {
  if (underlyingPrice == null || underlyingPrice <= 0) return null;
  const band = SKEW_MONEYNESS_BAND;
  const putIv: number[] = [];
  const callIv: number[] = [];
  for (const l of legs) {
    if (l.markIv == null) continue;
    const m = l.strike / underlyingPrice;
    if (m < 1 && m >= 1 - band) putIv.push(l.markIv); // OTM put (K < S)
    else if (m > 1 && m <= 1 + band) callIv.push(l.markIv); // OTM call (K > S)
  }
  if (!putIv.length || !callIv.length) return null;
  const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
  return mean(putIv) - mean(callIv);
}

/**
 * Max pain: the strike that minimizes the total exercise payout across the
 * chain at expiration —
 *   cost(K) = Σ_i [ putOi_i · max(S_i − K, 0) + callOi_i · max(K − S_i, 0) ]
 * over every listed strike (calls below K pay K−S, puts above K pay S−K; the
 * strike's own legs are worth zero at settlement). Ties break to the lower
 * strike. Null when no leg carries open interest.
 */
function computeMaxPain(expLegs: OptionLeg[]): number | null {
  const oiAt = new Map<number, { call: number; put: number }>();
  for (const l of expLegs) {
    if (l.openInterest == null) continue;
    const cur = oiAt.get(l.strike) ?? { call: 0, put: 0 };
    if (l.kind === "call") cur.call += l.openInterest;
    else cur.put += l.openInterest;
    oiAt.set(l.strike, cur);
  }
  const list = Array.from(oiAt.entries()).sort((a, b) => a[0] - b[0]);
  if (!list.length) return null;

  let best = list[0][0];
  let bestCost = Infinity;
  for (const [k] of list) {
    let cost = 0;
    for (const [s, oi] of list) {
      if (s < k) cost += oi.call * (k - s);
      else if (s > k) cost += oi.put * (s - k);
    }
    if (cost < bestCost) {
      bestCost = cost;
      best = k;
    }
  }
  return best;
}

/** OI-weighted average of a per-expiry metric (≥1 OI floor for stability). */
function oiWeightedAvg(
  expiries: OptionsExpiry[],
  pick: (e: OptionsExpiry) => number | null
): number | null {
  let sum = 0;
  let w = 0;
  for (const e of expiries) {
    const v = pick(e);
    if (v == null || e.openInterest == null) continue;
    const weight = Math.max(1, e.openInterest);
    sum += v * weight;
    w += weight;
  }
  return w > 0 ? sum / w : null;
}