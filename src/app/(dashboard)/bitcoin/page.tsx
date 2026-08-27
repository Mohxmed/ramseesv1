"use client";

import { useBitcoin } from "@/features/bitcoin/hooks/useBitcoin";
import { MarketOverviewCard } from "@/features/bitcoin/components/MarketOverview";
import { BtcChart } from "@/features/bitcoin/components/BtcChart";
import { TechnicalIndicatorsCard } from "@/features/bitcoin/components/TechnicalIndicators";
import { PredictionPanel } from "@/features/bitcoin/components/PredictionPanel";
import { HistoricalStatsCard } from "@/features/bitcoin/components/HistoricalStats";
import { MarketDataCard } from "@/features/bitcoin/components/MarketData";
import { GoldenTargetCard } from "@/features/bitcoin/components/GoldenTargetCard";

export default function BitcoinPage() {
  const {
    data,
    timeframe,
    setTimeframe,
    overview,
    chartCandles,
    indicators,
    prediction,
    refresh,
  } = useBitcoin();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-zinc-50">
            مركز قيادة بيتكوين
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
            بيانات سوق حية + توقع إحصائي قصير المدى (30/60 دقيقة) للبيتكوين.
            بيانات حقيقية من CoinGecko وبينانس، وتُحدَّث تلقائياً.
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={data.status === "loading"}
          className="rounded-md border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100 disabled:opacity-50"
        >
          {data.status === "loading" ? "جارٍ التحديث..." : "تحديث البيانات"}
        </button>
      </div>

      {data.status === "error" && (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-5 text-center text-sm text-red-300">
          {data.message} — تحقق من اتصال الإنترنت وحاول تحديث البيانات.
        </div>
      )}

      {data.status === "loading" && !overview && (
        <div className="flex h-40 items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-zinc-700 border-t-zinc-100" />
        </div>
      )}

      {(data.status === "ready" || overview) && (
        <>
          <MarketOverviewCard overview={overview} />

          <BtcChart
            candles={chartCandles}
            timeframe={timeframe}
            onTimeframeChange={setTimeframe}
          />

          <div className="grid gap-6 lg:grid-cols-2">
            <PredictionPanel prediction={prediction} />
            {prediction && (
              <HistoricalStatsCard h30={prediction.h30} h60={prediction.h60} />
            )}
          </div>

          <TechnicalIndicatorsCard indicators={indicators} />

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <MarketDataCard overview={overview} />
            </div>
            <GoldenTargetCard />
          </div>
        </>
      )}
    </div>
  );
}
