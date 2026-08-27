"use client";

import { useMemo } from "react";
import type { DecisionMarketDeps } from "./types-props";
import { Card } from "./ui";
import { formatPrice, formatPercent } from "../../bitcoin/utils";

function Tone({ label, tone, value }: { label: string; value?: string; tone: "up" | "down" | "neutral" }) {
  const color =
    tone === "up" ? "text-emerald-400" : tone === "down" ? "text-red-400" : "text-zinc-400";
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className={`mt-0.5 text-sm font-bold ${color}`} dir="ltr">
        {value ?? "N/A"}
      </div>
    </div>
  );
}

/**
 * Live market snapshot straight from the Command Center.
 * Only real data is shown; missing values render N/A.
 */
export function MarketSnapshot({ deps }: { deps: DecisionMarketDeps }) {
  const { overview, marketState, forecast, liquidity, analysis } = deps;

  const data = useMemo(() => {
    const price = overview?.price ?? marketState?.price ?? null;
    const change = overview?.change24hPercent;
    const trend = marketState?.trend;
    const structure = analysis?.structure;
    const bias = marketState?.overallBias;
    const biasScore = marketState?.biasScore;
    const volatility = marketState?.volatility;
    const prob30 = forecast?.horizons?.find((h) => h.minutes === 30)?.probabilityUp ?? null;
    const statBias =
      prob30 == null ? null : prob30 >= 55 ? "BULLISH" : prob30 <= 45 ? "BEARISH" : "NEUTRAL";
    const imbalance = liquidity?.buyWallImbalance ?? null;
    const liquidityState =
      imbalance == null ? null : imbalance >= 0.1 ? "BUY-SIDE" : imbalance <= -0.1 ? "SELL-SIDE" : "NEUTRAL";
    return {
      price,
      change,
      trend,
      structure,
      bias,
      biasScore,
      volatility,
      prob30,
      statBias,
      liquidityState,
    };
  }, [overview, marketState, forecast, liquidity, analysis]);

  const trendTone = data.trend === "bullish" ? "up" : data.trend === "bearish" ? "down" : "neutral";
  const structTone = data.structure === "bullish" ? "up" : data.structure === "bearish" ? "down" : "neutral";
  const biasTone = data.bias === "bullish" ? "up" : data.bias === "bearish" ? "down" : "neutral";
  const statTone = data.statBias === "BULLISH" ? "up" : data.statBias === "BEARISH" ? "down" : "neutral";

  return (
    <Card title="Market Snapshot — ملخص السوق" className="col-span-full">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        <Tone
          label="Price"
          value={data.price != null ? formatPrice(data.price) : "N/A"}
          tone={data.change != null && data.change >= 0 ? "up" : data.change != null ? "down" : "neutral"}
        />
        <Tone
          label="24H Change"
          value={data.change != null ? formatPercent(data.change) : "N/A"}
          tone={data.change != null && data.change >= 0 ? "up" : data.change != null ? "down" : "neutral"}
        />
        <Tone
          label="Trend (Aggregate)"
          value={data.trend ? data.trend.toUpperCase() : "N/A"}
          tone={trendTone}
        />
        <Tone
          label="Market Structure"
          value={data.structure ? data.structure.toUpperCase() : "N/A"}
          tone={structTone}
        />
        <Tone
          label="Overall Bias"
          value={data.bias ? data.bias.toUpperCase() : "N/A"}
          tone={biasTone}
        />
        <Tone
          label="Bias Score"
          value={data.biasScore != null ? data.biasScore.toFixed(0) : "N/A"}
          tone={biasTone}
        />
        <Tone
          label="Volatility"
          value={data.volatility ? data.volatility.toUpperCase() : "N/A"}
          tone={data.volatility === "high" ? "down" : "neutral"}
        />
        <Tone
          label="Probability (30m)"
          value={data.prob30 != null ? `${data.prob30.toFixed(1)}%` : "N/A"}
          tone={data.prob30 != null && data.prob30 >= 55 ? "up" : data.prob30 != null ? "down" : "neutral"}
        />
        <Tone
          label="Statistical Bias"
          value={data.statBias ?? "N/A"}
          tone={statTone}
        />
        <Tone
          label="Liquidity State"
          value={data.liquidityState ?? "N/A"}
          tone={data.liquidityState === "BUY-SIDE" ? "up" : data.liquidityState === "SELL-SIDE" ? "down" : "neutral"}
        />
      </div>
    </Card>
  );
}
