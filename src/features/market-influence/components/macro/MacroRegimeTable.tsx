"use client";

import type {
  MarketInfluenceFactor,
  SeriesPoint,
} from "@/features/market-influence/intelligence";
import { Badge } from "@/components/ui/index";
import { corrLabel, fmtNum, fmtPct, statusMeta } from "../format";
import { corrKind, dirLabel, factorReason } from "./format";
import { Sparkline } from "../Sparkline";

/** Regime-table row order: the headline "live market" instruments. */
const TABLE_IDS = [
  "nasdaq",
  "sp500",
  "dxy",
  "us10y",
  "vix",
  "gold",
  "oil",
  "us30y",
  "us2y",
  "spread",
];

function Row({
  f,
  spark,
}: {
  f: MarketInfluenceFactor;
  spark: SeriesPoint[];
}) {
  const dir = dirLabel(f.direction);
  const cs = corrKind(f.corr["24h"]);
  const st = statusMeta(f.status);
  const impact = f.impactScore;

  return (
    <div className="grid grid-cols-[minmax(120px,1.4fr)_repeat(6,minmax(84px,1fr))] items-center gap-2 border-b border-line/60 px-3 py-2 last:border-b-0">
      <div className="min-w-0">
        <div className="truncate text-xs font-bold text-zinc-100">{f.nameAr}</div>
        <div className="text-2xs text-muted" dir="ltr">
          {f.nameEn}
        </div>
      </div>
      <div className="font-mono text-xs tabular-nums text-zinc-200" dir="ltr">
        {f.price != null ? fmtNum(f.price) : "—"}
      </div>
      <div
        className={`font-mono text-xs tabular-nums ${
          f.change24hPct != null
            ? f.change24hPct >= 0
              ? "text-up-fg"
              : "text-down-fg"
            : "text-zinc-500"
        }`}
        dir="ltr"
      >
        {fmtPct(f.change24hPct)}
      </div>
      <div>
        <Badge tone={dir.tone}>{dir.label}</Badge>
      </div>
      <div className="flex flex-col">
        <span
          className={`font-mono text-xs font-bold tabular-nums ${
            cs.tone === "good"
              ? "text-good"
              : cs.tone === "warn"
              ? "text-warn-fg"
              : "text-zinc-500"
          }`}
          dir="ltr"
        >
          {corrLabel(f.corr["24h"])}
        </span>
        <span className="text-2xs text-muted">{cs.label}</span>
      </div>
      <div className="flex flex-col gap-0.5">
        <Badge tone={st.tone}>{st.label}</Badge>
      </div>
      <div className="flex flex-col gap-0.5">
        {impact != null ? (
          <Badge tone={impact > 0 ? "up" : impact < 0 ? "down" : "neutral"}>
            {impact > 0 ? "+" : ""}
            {impact.toFixed(0)}
          </Badge>
        ) : (
          <Badge tone="quiet">—</Badge>
        )}
      </div>
      <div className="hidden max-w-[220px] lg:block">
        <p className="truncate text-2xs leading-snug text-muted" title={factorReason(f)}>
          {factorReason(f)}
        </p>
        <div className="mt-1 h-6 w-24 opacity-80">
          {spark.length > 1 ? (
            <Sparkline
              points={spark}
              height={24}
              tone={
                f.direction === "up"
                  ? "up"
                  : f.direction === "down"
                  ? "down"
                  : "neutral"
              }
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * Spec #1 — Global Market Regime table: instrument readout with price, 24h
 * change, momentum, BTC correlation, freshness, impact and the "cause of
 * change" derived per factor.
 */
export function MacroRegimeTable({
  factors,
  sparklines,
}: {
  factors: Record<string, MarketInfluenceFactor>;
  sparklines: Record<string, SeriesPoint[]>;
}) {
  const rows = TABLE_IDS.map((id) => factors[id]).filter(Boolean);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[820px]">
        <div className="grid grid-cols-[minmax(120px,1.4fr)_repeat(6,minmax(84px,1fr))] gap-2 border-b border-line px-3 pb-2 text-2xs font-semibold uppercase tracking-wider text-muted">
          <span>المؤشر</span>
          <span>السعر</span>
          <span>تغيّر 24س</span>
          <span>الاتجاه</span>
          <span>ارتباط 24س</span>
          <span>الحالة</span>
          <span>الأثر</span>
          <span className="hidden lg:block">سبب التغير</span>
        </div>
        {rows.map((f) => (
          <Row key={f.id} f={f} spark={sparklines[f.id] ?? []} />
        ))}
      </div>
    </div>
  );
}