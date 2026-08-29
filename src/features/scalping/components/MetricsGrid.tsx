"use client";

import type { ScalpingFeature, ScalpingSignal, ScalpDecisionView } from "../types";
import type { FuturesState } from "../../bitcoin/futures/types";
import { MetricCard } from "./MetricCard";

function feat(features: ScalpingFeature[], key: string): ScalpingFeature | undefined {
  return features.find((f) => f.key === key);
}

function win(ms: ScalpDecisionView["marketState"] | undefined, s: number): number | null {
  return ms?.windows?.find((w) => w.windowS === s)?.returnPct ?? null;
}

function fmt(v: number | null | undefined, digits = 2): string {
  return v == null || !isFinite(v) ? "â€”" : v.toFixed(digits);
}

function fmtSigned(v: number | null | undefined, digits = 2): string {
  return v == null || !isFinite(v) ? "â€”" : `${v >= 0 ? "+" : ""}${v.toFixed(digits)}`;
}

function fmtUsd(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return "â€”";
  const abs = Math.abs(v);
  const s = v < 0 ? "-" : "";
  return abs >= 1_000_000 ? `${s}$${(abs / 1_000_000).toFixed(2)}M` : abs >= 1_000 ? `${s}$${(abs / 1_000).toFixed(1)}K` : `${s}$${abs.toFixed(0)}`;
}

/** Top metrics strip fed entirely by real engine output, each with freshness. */
export function MetricsGrid({
  features,
  signal,
  decision,
  futuresState,
}: {
  features: ScalpingFeature[];
  signal: ScalpingSignal | null;
  decision?: ScalpDecisionView | null;
  futuresState?: FuturesState | null;
}) {
  const ms = decision?.marketState;
  const spotAge = ms?.health?.priceAgeMs ?? null;
  const priceNow = ms?.price ?? null;

  const book = feat(features, "book-imbalance");
  const flow = feat(features, "aggressive-flow");
  const volDelta = feat(features, "volume-delta");
  const vol = feat(features, "short-volatility");

  const r5 = win(ms, 5);
  const r30 = win(ms, 30);
  const r120 = win(ms, 120);
  const taker = ms?.takerBuyRatio ?? flow?.raw ?? null;
  const imbalance = ms?.bookImbalance ?? book?.normalized ?? null;
  const spread = ms?.spreadPct ?? null;
  const cvd = ms?.cvd ?? null;

  const oi30 =
    futuresState?.openInterest?.windows?.find((w) => w.windowS === 30)?.pct ?? null;
  const funding = futuresState?.positioning?.fundingRate ?? null;
  const liqNet = futuresState?.liquidations?.net ?? null;
  const poStrength = futuresState?.priceOiRelationship?.strength ?? null;
  const futuresAge = futuresState?.freshnessMs ?? null;

  const score = signal?.score ?? null;
  const scoreAge = signal?.ageMs ?? null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
      <MetricCard
        label="ط¥ط¬ظ…ط§ظ„ظٹ ط§ظ„ط§طھط¬ط§ظ‡ (Score)"
        value={score != null ? `${score.toFixed(0)}/100` : "â€”"}
        sub={signal ? `${signal.direction}` : "ظ„ط§ ط¥ط´ط§ط±ط©"}
        tint={signal?.direction === "LONG" ? "text-emerald-400" : signal?.direction === "SHORT" ? "text-red-400" : ""}
        ageMs={scoreAge}
        note={signal ? "ط§ظ„ط¶ط؛ط· ط§ظ„طµط§ظپظٹ ط¨ط¹ط¯ طھط¬ظ…ظٹط¹ ط§ظ„ط¹ط§ط¦ظ„ط§طھ â€” ظ„ظٹط³ ط§ط­طھظ…ط§ظ„ ظ†ط¬ط§ط­" : undefined}
      />
      <MetricCard
        label="ط²ط®ظ… 5ط«"
        value={r5 != null ? `${fmtSigned(r5, 3)}%` : "â€”"}
        sub={priceNow != null ? `ط§ظ„ط³ط¹ط± ${priceNow.toFixed(0)}` : undefined}
        tint={r5 != null ? (r5 >= 0 ? "text-emerald-400" : "text-red-400") : ""}
        ageMs={spotAge}
      />
      <MetricCard
        label="ط²ط®ظ… 120ط«"
        value={r120 != null ? `${fmtSigned(r120, 3)}%` : "â€”"}
        sub={r30 != null ? `30ط« ${fmtSigned(r30, 3)}%` : undefined}
        tint={r120 != null ? (r120 >= 0 ? "text-emerald-400" : "text-red-400") : ""}
        ageMs={spotAge}
      />
      <MetricCard
        label="ط­ط¬ظ… ط§ظ„طھط¯ط§ظˆظ„ (خ”)"
        value={volDelta?.raw != null ? fmt(volDelta.raw, volDelta.unit ? 0 : 2) : "â€”"}
        sub={volDelta?.unit ? volDelta.unit : undefined}
        tint={volDelta?.direction === "bullish" ? "text-emerald-400" : volDelta?.direction === "bearish" ? "text-red-400" : ""}
        ageMs={volDelta?.freshnessMs ?? spotAge}
      />
      <MetricCard
        label="ط§ظ„ط¶ط؛ط· aggressor (ط´ط±ط§ط،)"
        value={taker != null ? `${(taker * 100).toFixed(1)}%` : "â€”"}
        sub="ط­طµط© ط§ظ„طھظٹظƒ ط§ظ„ظ…ط´طھط±ط§ط©"
        tint={taker != null ? (taker >= 0.5 ? "text-emerald-400" : "text-red-400") : ""}
        ageMs={flow?.freshnessMs ?? spotAge}
      />
      <MetricCard
        label="طھظˆط§ط²ظ† ط¯ظپطھط± ط§ظ„ط£ظˆط§ظ…ط±"
        value={imbalance != null ? fmtSigned((imbalance as number) * 100, 1) : "â€”"}
        sub="ط¹ظ…ظ‚ ط´ط±ط§ط،+ / ط¨ظٹط¹âˆ’"
        tint={imbalance != null ? ((imbalance as number) >= 0 ? "text-emerald-400" : "text-red-400") : ""}
        ageMs={book?.freshnessMs ?? spotAge}
      />
      <MetricCard
        label="ط§ظ„ط³ط¨ط±ظٹط¯"
        value={spread != null ? `${fmt(spread, 3)}%` : "â€”"}
        sub={cvd != null ? `CVD ${fmtUsd(cvd)}` : undefined}
        tint={spread != null && spread > 0.02 ? "text-amber-400" : ""}
        ageMs={spotAge}
      />
      <MetricCard
        label="طھط؛ظٹظ‘ط± ط§ظ„ط¹ظ‚ظˆط¯ 30ط«"
        value={oi30 != null ? `${fmtSigned(oi30, 3)}%` : "â€”"}
        sub={futuresState?.openInterest?.state ? `ط­ط§ظ„ط© ${futuresState.openInterest.state}` : undefined}
        tint={oi30 != null ? (oi30 >= 0 ? "text-zinc-100" : "text-zinc-100") : ""}
        ageMs={futuresAge}
      />
      <MetricCard
        label="ط§ظ„ظپط§ظ†ط¯ظٹظ†ط؛"
        value={funding != null ? `${fmt(funding, 4)}%` : "â€”"}
        sub={futuresState?.positioning?.globalLongShortRatio != null ? `ظ„/ط´ ${fmt(futuresState.positioning.globalLongShortRatio, 3)}` : undefined}
        tint={funding != null ? (funding > 0 ? "text-emerald-400" : funding < 0 ? "text-red-400" : "") : ""}
        ageMs={futuresAge}
      />
      <MetricCard
        label="طµط§ظپظٹ ط§ظ„طھطµظپظٹط© 30ط«"
        value={liqNet != null ? fmtUsd(liqNet) : "â€”"}
        sub={futuresState?.liquidations?.intensity ? `ظƒط«ط§ظپط© ${futuresState.liquidations.intensity}` : undefined}
        tint={liqNet != null ? (liqNet > 0 ? "text-rose-400" : liqNet < 0 ? "text-emerald-400" : "") : ""}
        ageMs={futuresState?.dataHealth?.liquidationStatus === "LIVE" ? futuresAge : null}
      />
      <MetricCard
        label="ظ‚ظˆط© ط³ط¹ط±â†”ط¹ظ‚ظˆط¯"
        value={poStrength != null ? fmt(poStrength, 2) : "â€”"}
        sub={futuresState?.priceOiRelationship?.quadrant?.replaceAll("-", " آ· ") ?? undefined}
        tint={poStrength != null && poStrength > 0.5 ? "text-emerald-400" : ""}
        ageMs={futuresAge}
      />
      <MetricCard
        label="ط§ظ„طھظ‚ظ„ط¨ ظ‚طµظٹط± ط§ظ„ط£ظ…ط¯"
        value={vol?.raw != null ? fmt(vol.raw, 2) : "â€”"}
        sub={vol?.unit ? vol.unit : undefined}
        tint={vol?.state === "strong" ? "text-amber-400" : ""}
        ageMs={vol?.freshnessMs ?? spotAge}
      />
    </div>
  );
}
