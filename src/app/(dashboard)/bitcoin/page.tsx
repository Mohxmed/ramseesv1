"use client";

import { useMarketData } from "@/features/bitcoin/store/market-context";
import { BtcChart } from "@/features/bitcoin/components/BtcChart";
import { TechnicalIndicatorsCard } from "@/features/bitcoin/components/TechnicalIndicators";
import { PredictionPanel } from "@/features/bitcoin/components/PredictionPanel";
import { MarketDataCard } from "@/features/bitcoin/components/MarketData";
import { AnalysisPanel } from "@/features/bitcoin/components/AnalysisPanel";
import { LiveMarketStateCard } from "@/features/bitcoin/components/LiveMarketStateCard";
import { ForecastCards } from "@/features/bitcoin/components/ForecastCards";
import { OrderFlowCard } from "@/features/bitcoin/components/OrderFlowCard";
import { FuturesCard } from "@/features/bitcoin/components/FuturesCard";
import { StructureWavesCard } from "@/features/bitcoin/components/StructureWavesCard";
import { InstantPriceBar } from "@/features/bitcoin/components/InstantPriceBar";

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
  } = useMarketData();

  const ready = data.status === "ready" || !!overview;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-zinc-50">
            مركز قيادة بيتكوين
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">
            مركز استخبارات سوق BTC الحية: بيانات فورية (سبوت + عقود آجلة) +
            تحليل متعدد الأطر + توقع احتمالي قصير المدى (30م / ساعة / ساعتان)
            مدعوم بمقارنة الحالات التاريخية. بيانات حقيقية من CoinGecko وبينانس.
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
          {/* Chart — hero, full width, right after title/description */}
          <BtcChart
            candles={chartCandles}
            timeframe={timeframe}
            onTimeframeChange={setTimeframe}
            analysis={analysis30m}
            liquidity={liquidity}
            structure={structure}
            waves={waves}
          />

          {/* Live instant spot price data */}
          <InstantPriceBar
            overview={overview}
            futures={futures}
            marketState={marketState}
            orderBook={orderBook}
            live={liveConnected === true}
          />

          {/* Market state (half screen) + market structure/waves (half screen) */}
          <div className="grid gap-6 lg:grid-cols-2">
            <LiveMarketStateCard
              state={marketState}
              updatedAt={marketState?.timestamp ?? Date.now()}
              live={liveConnected === true}
            />
            <div className="grid gap-6">
              <StructureWavesCard structure={structure} waves={waves ?? []} />
              <OrderFlowCard
                orderBook={orderBook}
                orderFlow={orderFlow}
                liquidity={liquidity}
                marketState={marketState}
                live={liveConnected === true}
              />
            </div>
          </div>

          {/* Forecast — most important, full prominence */}
          <ForecastCards forecast={forecast} />

          {/* Futures + technical + analysis */}
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <FuturesCard futures={futures} />
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:col-span-2">
              <PredictionPanel prediction={prediction} />
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <AnalysisPanel analysis={analysis30m} />
            </div>
            <div className="lg:col-span-2">
              <TechnicalIndicatorsCard indicators={indicators} />
            </div>
          </div>

          <MarketDataCard overview={overview} />
        </>
      )}
    </div>
  );
}
