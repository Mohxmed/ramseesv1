"use client";

import type {
  CrossMarketState,
  MarketInfluenceFactor,
  SeriesPoint,
} from "@/features/market-influence/intelligence";
import { Badge, DataRow, Progress } from "@/components/ui/index";
import { assetStatusMeta, fmtNum, fmtPct } from "../format";
import { Sparkline } from "../Sparkline";

/** Liquidity-related monitored factors, in display order. */
const LIQ_IDS = ["liquidity", "m2", "reverse-repo", "tga", "nfci", "stablecoin-supply"];

function liqTone(state: CrossMarketState): { label: string; tone: "up" | "down" | "neutral" } {
  switch (state.regime.liquidity) {
    case "EXPANSION":
      return { label: "توسّع نقدي", tone: "up" };
    case "CONTRACTION":
      return { label: "انكماش نقدي", tone: "down" };
    default:
      return { label: "محايد", tone: "neutral" };
  }
}

/** 24h or (for periodic series) 7d change — honest label. */
function changeOf(f: MarketInfluenceFactor): { value: number | null; label: string } {
  if (f.change24hPct != null) return { value: f.change24hPct, label: "24س" };
  const r7 = f.roc["7d"];
  if (r7 != null) return { value: r7, label: "7د" };
  return { value: null, label: "24س" };
}

function LiquidityCard({
  f,
  spark,
  nowMs,
}: {
  f: MarketInfluenceFactor;
  spark: SeriesPoint[];
  nowMs: number;
}) {
  const st = assetStatusMeta(f, nowMs);
  const chg = changeOf(f);
  const imp = f.impactScore;

  return (
    <div className="rounded-card border border-line/70 bg-surface-1/40 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-xs font-bold text-zinc-100">{f.nameAr}</div>
          <div className="text-2xs text-muted" dir="ltr">
            {f.nameEn}
          </div>
        </div>
        <Badge tone={st.tone}>{st.label}</Badge>
      </div>
      <div className="mt-3 flex items-baseline justify-between gap-2">
        <span className="font-mono text-lg font-black tabular-nums text-zinc-100" dir="ltr">
          {f.price != null ? fmtNum(f.price) : "—"}
        </span>
        {chg.value != null ? (
          <span
            className={`font-mono text-2xs font-bold tabular-nums ${
              chg.value >= 0 ? "text-up-fg" : "text-down-fg"
            }`}
            dir="ltr"
          >
            {chg.value >= 0 ? "+" : ""}
            {fmtPct(chg.value)}
            <span className="ms-1 text-muted">({chg.label})</span>
          </span>
        ) : null}
      </div>
      <div className="mt-2 flex items-center justify-between text-2xs text-muted">
        <span>الأثر الصافي</span>
        <span className={`font-mono tabular-nums ${imp != null && imp > 0 ? "text-up-fg" : imp != null && imp < 0 ? "text-down-fg" : ""}`} dir="ltr">
          {imp != null ? `${imp >= 0 ? "+" : ""}${imp.toFixed(0)}` : "—"}
        </span>
      </div>
      <div className="mt-2 h-8">
        {spark.length > 1 ? <Sparkline points={spark} height={30} /> : null}
      </div>
      <Progress
        pct={imp != null ? Math.min(100, Math.abs(imp) * 1.4) : 0}
        tone={imp != null && imp > 0 ? "good" : imp != null && imp < 0 ? "warn" : "neutral"}
      />
    </div>
  );
}

/**
 * Spec #8 — Global Liquidity section: the liquidity factors that drive BTC's
 * cost of carry and capital-flow direction.
 */
export function LiquidityPanel({
  state,
  factors,
  sparklines,
  nowMs,
}: {
  state: CrossMarketState;
  factors: Record<string, MarketInfluenceFactor>;
  sparklines: Record<string, SeriesPoint[]>;
  nowMs: number;
}) {
  const liq = liqTone(state);
  const cards = LIQ_IDS.map((id) => factors[id]).filter(Boolean);

  return (
    <div className="rounded-card border border-line bg-surface-1/40 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-3xs font-semibold uppercase tracking-[0.18em] text-muted">
          السيولة العالمية
        </div>
        <Badge tone={liq.tone}>الوضع: {liq.label}</Badge>
      </div>
      <p className="mt-2 text-2xs leading-relaxed text-muted">
        اتجاه السيولة النقدية العالمية يحدد شهية الأصول الخطرة عموماً — توسعها
        يساند BTC وانكماشها يضغط عليه.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((f) => (
          <LiquidityCard key={f.id} f={f} spark={sparklines[f.id] ?? []} nowMs={nowMs} />
        ))}
      </div>

      <div className="mt-4 grid gap-x-6 gap-y-1 border-t border-line/70 pt-3 sm:grid-cols-2">
        <DataRow label="توسّع نقدي (Fed balance sheet)" value={state.regime.liquidity} />
        <DataRow label="الدولار" value={state.regime.dollar} />
        <DataRow label="شهية المخاطرة" value={state.regime.risk} />
        <DataRow label="التقلب" value={state.regime.volatility} />
      </div>
    </div>
  );
}