"use client";

import { useState } from "react";
import type {
  MarketInfluenceFactor,
  SeriesPoint,
} from "@/features/market-influence/intelligence";
import { Badge, Tabs } from "@/components/ui/index";
import { ArrowDownRightIcon, ArrowUpRightIcon } from "@/components/icons/icons";
import { corrLabel, corrTone, fmtNum, fmtPct, statusMeta } from "../format";
import { Sparkline } from "../Sparkline";
import { FactorDetailModal } from "../FactorDetailModal";

export type MapTab = "ALL" | "EQUITIES" | "RATES" | "FX" | "COMMODITIES" | "LIQUIDITY" | "CRYPTO";

const TAB_ITEMS: { value: MapTab; label: string }[] = [
  { value: "ALL", label: "الكل" },
  { value: "EQUITIES", label: "الأسهم" },
  { value: "RATES", label: "العوائد" },
  { value: "FX", label: "العملات" },
  { value: "COMMODITIES", label: "السلع" },
  { value: "LIQUIDITY", label: "السيولة" },
  { value: "CRYPTO", label: "كريبتو" },
];

/** Display order: headline instruments first, then the rest. */
const MAP_ORDER = [
  "nasdaq",
  "sp500",
  "dxy",
  "us10y",
  "vix",
  "gold",
  "oil",
  "rut2000",
  "us2y",
  "spread",
  "us30y",
  "real-yield",
  "eurusd",
  "usdjpy",
  "liquidity",
  "m2",
  "reverse-repo",
  "tga",
  "nfci",
  "stablecoin-supply",
  "etf-flows",
];

const CAT_GROUP: Record<string, MapTab> = {
  equities: "EQUITIES",
  volatility: "EQUITIES",
  rates: "RATES",
  dollar: "FX",
  fx: "FX",
  commodities: "COMMODITIES",
  liquidity: "LIQUIDITY",
};

const CRYPTO_IDS = ["stablecoin-supply", "etf-flows"];

function MapCard({
  f,
  spark,
  onOpen,
}: {
  f: MarketInfluenceFactor;
  spark: SeriesPoint[];
  onOpen: (id: string) => void;
}) {
  const st = statusMeta(f.status);
  const chg = f.change24hPct;
  const corrToneCls = corrTone(f.corr["24h"]);
  const imp = f.impactScore;

  return (
    <button
      type="button"
      onClick={() => onOpen(f.id)}
      className="group rounded-card border border-line/70 bg-surface-1/40 p-4 text-start transition-colors hover:border-zinc-600"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-xs font-bold text-zinc-100 group-hover:text-zinc-50">
            {f.nameAr}
          </div>
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
        {chg != null ? (
          <span
            className={`flex items-center gap-0.5 font-mono text-xs font-bold tabular-nums ${
              chg >= 0 ? "text-up-fg" : "text-down-fg"
            }`}
            dir="ltr"
          >
            {chg >= 0 ? <ArrowUpRightIcon className="h-3 w-3" /> : <ArrowDownRightIcon className="h-3 w-3" />}
            {chg >= 0 ? "+" : ""}
            {fmtPct(chg)}
          </span>
        ) : null}
      </div>

      <div className="mt-3 h-9">
        {spark.length > 1 ? <Sparkline points={spark} height={34} /> : null}
      </div>

      <div className="mt-2 flex items-center justify-between text-2xs">
        <span className="text-muted">ارتباط 24س</span>
        <span
          className={`font-mono font-bold tabular-nums ${
            corrToneCls === "good" ? "text-good" : corrToneCls === "warn" ? "text-warn-fg" : "text-zinc-400"
          }`}
          dir="ltr"
        >
          {corrLabel(f.corr["24h"])}
        </span>
      </div>
      <div className="mt-1 flex items-center justify-between text-2xs">
        <span className="text-muted">الأثر</span>
        <Badge tone={imp != null ? (imp > 0 ? "up" : imp < 0 ? "down" : "neutral") : "quiet"}>
          {imp != null ? `${imp >= 0 ? "+" : ""}${imp.toFixed(0)}` : "—"}
        </Badge>
      </div>
    </button>
  );
}

/**
 * Spec #0 — Tabbed Macro Market Map (ALL / EQUITIES / RATES / FX /
 * COMMODITIES / LIQUIDITY / CRYPTO). Clicking a card opens the full per-asset
 * detail (price → trend → momentum → BTC correlation → impact → history).
 */
export function MarketMapPanel({
  factors,
  sparklines,
  nowMs,
}: {
  factors: Record<string, MarketInfluenceFactor>;
  sparklines: Record<string, SeriesPoint[]>;
  nowMs: number;
}) {
  const [tab, setTab] = useState<MapTab>("ALL");
  const [openId, setOpenId] = useState<string | null>(null);

  const rows = MAP_ORDER.map((id) => factors[id]).filter(Boolean).filter((f) => {
    if (tab === "ALL") return true;
    if (tab === "CRYPTO") return CRYPTO_IDS.includes(f.id);
    return CAT_GROUP[f.category] === tab;
  });

  const openFactor = openId ? factors[openId] ?? null : null;

  return (
    <section className="space-y-2">
      <Tabs<MapTab> value={tab} onChange={setTab} items={TAB_ITEMS} slim />

      {rows.length === 0 ? (
        <div className="rounded-card border border-line bg-surface-1/40 p-6 text-center text-2xs text-muted">
          لا عوامل في هذه المجموعة حاليًا.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {rows.map((f) => (
            <MapCard key={f.id} f={f} spark={sparklines[f.id] ?? []} onOpen={setOpenId} />
          ))}
        </div>
      )}

      <FactorDetailModal
        factor={openFactor}
        nowMs={nowMs}
        onClose={() => setOpenId(null)}
      />
    </section>
  );
}