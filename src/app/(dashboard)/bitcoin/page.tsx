"use client";

import { useBitcoin } from "@/features/bitcoin/hooks/useBitcoin";
import { MarketOverviewCard } from "@/features/bitcoin/components/MarketOverview";
import { BtcChart } from "@/features/bitcoin/components/BtcChart";
import { TechnicalIndicatorsCard } from "@/features/bitcoin/components/TechnicalIndicators";
import { PredictionPanel } from "@/features/bitcoin/components/PredictionPanel";
import { HistoricalStatsCard } from "@/features/bitcoin/components/HistoricalStats";
import { MarketDataCard } from "@/features/bitcoin/components/MarketData";
import { GoldenTargetCard } from "@/features/bitcoin/components/GoldenTargetCard";
import { AnalysisPanel } from "@/features/bitcoin/components/AnalysisPanel";
import { LiveMarketStateCard } from "@/features/bitcoin/components/LiveMarketStateCard";
import { ForecastCards } from "@/features/bitcoin/components/ForecastCards";
import { OrderFlowCard } from "@/features/bitcoin/components/OrderFlowCard";
import { FuturesCard } from "@/features/bitcoin/components/FuturesCard";
import { StructureWavesCard } from "@/features/bitcoin/components/StructureWavesCard";

export default function BitcoinPage() {
  const {
    data,
    timeframe,
    setTimeframe,
    overview,
    chartCandles,
    indicators,
    prediction,
    analysis30m,
    orderBook,
    orderFlow,
    liveConnected,
    futures,
    marketState,
    liquidity,
    structure,
    waves,
    forecast,
    refresh,
  } = useBitcoin();

  const ready = data.status === "ready" || !!overview;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-zinc-50">
            مركز قيادة بيتكوين
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">
            بيانات سوق حية (سبوت + عقود آجلة) + تحليل متعدد الأطر + توقع إحصائي
            قصير المدى (30م / ساعة / ساعتان) مبني على مقارنة الحالات
            التاريخية المشابهة. بيانات حقيقية من CoinGecko وبينانس.
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

      {ready && (
        <>
          <MarketOverviewCard overview={overview} />

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <BtcChart
                candles={chartCandles}
                timeframe={timeframe}
                onTimeframeChange={setTimeframe}
                analysis={analysis30m}
                liquidity={liquidity}
                structure={structure}
                waves={waves}
              />
            </div>
            <div className="grid gap-6 lg:col-span-1">
              <LiveMarketStateCard
                state={marketState}
                updatedAt={marketState?.timestamp ?? Date.now()}
                live={liveConnected === true}
              />
            </div>
          </div>

          <ForecastCards forecast={forecast} />

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <StructureWavesCard structure={structure} waves={waves ?? []} />
            </div>
            <div className="lg:col-span-1">
              <OrderFlowCard
                orderBook={orderBook}
                orderFlow={orderFlow}
                liquidity={liquidity}
                live={liveConnected === true}
              />
            </div>
            <div className="lg:col-span-1">
              <FuturesCard futures={futures} />
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <AnalysisPanel analysis={analysis30m} />
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:col-span-2">
              <PredictionPanel prediction={prediction} />
              {prediction && (
                <HistoricalStatsCard h30={prediction.h30} h60={prediction.h60} />
              )}
            </div>
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
