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
  return v == null || !isFinite(v) ? "—" : v.toFixed(digits);
}

function fmtSigned(v: number | null | undefined, digits = 2): string {
  return v == null || !isFinite(v) ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(digits)}`;
}

function fmtUsd(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return "—";
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
        label="إجمالي الاتجاه (Score)"
        value={score != null ? `${score.toFixed(0)}/100` : "—"}
        sub={signal ? `${signal.direction}` : "لا إشارة"}
        tint={signal?.direction === "LONG" ? "text-emerald-400" : signal?.direction === "SHORT" ? "text-red-400" : ""}
        ageMs={scoreAge}
        note={signal ? "الضغط الصافي بعد تجميع العوامل — ليس احتمال نجاح" : undefined}
      />
      <MetricCard
        label="زخم 5ث"
        value={r5 != null ? `${fmtSigned(r5, 3)}%` : "—"}
        sub={priceNow != null ? `السعر ${priceNow.toFixed(0)}` : undefined}
        tint={r5 != null ? (r5 >= 0 ? "text-emerald-400" : "text-red-400") : ""}
        ageMs={spotAge}
      />
      <MetricCard
        label="زخم 120ث"
        value={r120 != null ? `${fmtSigned(r120, 3)}%` : "—"}
        sub={r30 != null ? `30ث ${fmtSigned(r30, 3)}%` : undefined}
        tint={r120 != null ? (r120 >= 0 ? "text-emerald-400" : "text-red-400") : ""}
        ageMs={spotAge}
      />
      <MetricCard
        label="حجم التداول (Δ)"
        value={volDelta?.raw != null ? fmt(volDelta.raw, volDelta.unit ? 0 : 2) : "—"}
        sub={volDelta?.unit ? volDelta.unit : undefined}
        tint={volDelta?.direction === "bullish" ? "text-emerald-400" : volDelta?.direction === "bearish" ? "text-red-400" : ""}
        ageMs={volDelta?.freshnessMs ?? spotAge}
      />
      <MetricCard
        label="الضغط aggressor (شراء)"
        value={taker != null ? `${(taker * 100).toFixed(1)}%` : "—"}
        sub="حصة التيك المشتراة"
        tint={taker != null ? (taker >= 0.5 ? "text-emerald-400" : "text-red-400") : ""}
        ageMs={flow?.freshnessMs ?? spotAge}
      />
      <MetricCard
        label="توازن دفتر الأوامر"
        value={imbalance != null ? fmtSigned((imbalance as number) * 100, 1) : "—"}
        sub="عمق شراء+ / بيع−"
        tint={imbalance != null ? ((imbalance as number) >= 0 ? "text-emerald-400" : "text-red-400") : ""}
        ageMs={book?.freshnessMs ?? spotAge}
      />
      <MetricCard
        label="السبريد"
        value={spread != null ? `${fmt(spread, 3)}%` : "—"}
        sub={cvd != null ? `CVD ${fmtUsd(cvd)}` : undefined}
        tint={spread != null && spread > 0.02 ? "text-amber-400" : ""}
        ageMs={spotAge}
      />
      <MetricCard
        label="تغيّر العقود 30ث"
        value={oi30 != null ? `${fmtSigned(oi30, 3)}%` : "—"}
        sub={futuresState?.openInterest?.state ? `حالة ${futuresState.openInterest.state}` : undefined}
        tint={oi30 != null ? (oi30 >= 0 ? "text-zinc-100" : "text-zinc-100") : ""}
        ageMs={futuresAge}
      />
      <MetricCard
        label="الفاندينغ"
        value={funding != null ? `${fmt(funding, 4)}%` : "—"}
        sub={futuresState?.positioning?.globalLongShortRatio != null ? `ل/ش ${fmt(futuresState.positioning.globalLongShortRatio, 3)}` : undefined}
        tint={funding != null ? (funding > 0 ? "text-emerald-400" : funding < 0 ? "text-red-400" : "") : ""}
        ageMs={futuresAge}
      />
      <MetricCard
        label="صافي التصفية 30ث"
        value={liqNet != null ? fmtUsd(liqNet) : "—"}
        sub={futuresState?.liquidations?.intensity ? `كثافة ${futuresState.liquidations.intensity}` : undefined}
        tint={liqNet != null ? (liqNet > 0 ? "text-rose-400" : liqNet < 0 ? "text-emerald-400" : "") : ""}
        ageMs={futuresState?.dataHealth?.liquidationStatus === "LIVE" ? futuresAge : null}
      />
      <MetricCard
        label="قوة سعر↔عقود"
        value={poStrength != null ? fmt(poStrength, 2) : "—"}
        sub={futuresState?.priceOiRelationship?.quadrant?.replaceAll("-", " · ") ?? undefined}
        tint={poStrength != null && poStrength > 0.5 ? "text-emerald-400" : ""}
        ageMs={futuresAge}
      />
      <MetricCard
        label="التقلب قصير الأمد"
        value={vol?.raw != null ? fmt(vol.raw, 2) : "—"}
        sub={vol?.unit ? vol.unit : undefined}
        tint={vol?.state === "strong" ? "text-amber-400" : ""}
        ageMs={vol?.freshnessMs ?? spotAge}
      />
    </div>
  );
}
