"use client";

import { useMarketData } from "@/features/bitcoin/store/market-context";
import { BtcChart } from "@/features/bitcoin/components/BtcChart";
import { TechnicalIndicatorsCard } from "@/features/bitcoin/components/TechnicalIndicators";
import { OrderFlowCard } from "@/features/bitcoin/components/OrderFlowCard";
import { FuturesCard } from "@/features/bitcoin/components/FuturesCard";
import { StructureWavesCard } from "@/features/bitcoin/components/StructureWavesCard";
import { ForecastCards } from "@/features/bitcoin/components/ForecastCards";
import { TopBar } from "@/features/bitcoin/components/TopBar";
import { MarketTape } from "@/features/bitcoin/components/MarketTape";
import { RegimeHero } from "@/features/bitcoin/components/RegimeHero";
import { MarketScorePanel } from "@/features/bitcoin/components/MarketScorePanel";
import { KeyLevelsPanel } from "@/features/bitcoin/components/KeyLevelsPanel";
import { LiquidationCard } from "@/features/bitcoin/components/LiquidationCard";
import { MultiTimeframeMatrix } from "@/features/bitcoin/components/MultiTimeframeMatrix";
import { MarketAlerts } from "@/features/bitcoin/components/MarketAlerts";
import { HistoricalContext } from "@/features/bitcoin/components/HistoricalContext";
import { DataHealthPanel, SystemStatusBar } from "@/features/bitcoin/components/DataHealth";
import { useNow } from "@/features/bitcoin/hooks/useNow";
import { PageHeader, Status } from "@/components/ui/index";
import { BitcoinIcon } from "@/components/icons/icons";

export default function BitcoinPage() {
  const p = useMarketData();
  const now = useNow(2000);
  const ready = p.data.status === "ready" || !!p.overview;

  // Single price source, in priority order: engine price → live WS → REST overview.
  const price = p.marketState?.price ?? p.livePrice ?? p.overview?.price ?? null;
  const change24h = p.overview?.change24hPercent ?? null;
  const candles30m = p.multiTF["30m"] ?? null;

  const timestamps = [
    p.marketState?.timestamp ?? null,
    p.overview?.updatedAt ?? null,
    p.futures?.timestamp ?? null,
    p.orderBook?.timestamp ?? null,
    p.liveUpdatedAt ?? null,
  ];
  const latestUpdatedAt = timestamps.reduce<number | null>((acc, t) => {
    if (t == null) return acc;
    return acc == null ? t : Math.max(acc, t);
  }, null);
  const availableSources = timestamps.filter((t) => t != null).length;
  const freshSources = timestamps.filter((t) => t != null && now - t <= 120_000).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="BTC Intelligence — Command Center"
        icon={<BitcoinIcon className="h-5 w-5 text-muted" />}
        title="مركز القيادة والتحليل الاستراتيجي للبيتكوين (BTC)"
        description="مصفوفة استخبارات حية للسوق: سعر فوري + نظام سوقي مركّب + درجة مع ثقة + مستويات + تدفق أوامر + مشتقات + تصفيات + مصفوفة أطر زمنية + سيناريوهات احتمالية + تنبيهات وسلامة بيانات. بيانات حقيقية فقط من Binance وCoinGecko وDeribit — لا قيم وهمية."
      />

      {p.data.status === "error" && (
        <div className="rounded-card border border-down/40 bg-down/10 p-5 text-center text-sm text-down-fg">
          {p.data.message} — تحقق من اتصال الإنترنت وحاول تحديث البيانات.
        </div>
      )}

      {p.data.status === "loading" && !ready && (
        <div className="flex h-40 items-center justify-center">
          <Status label="جارٍ تحميل بيانات السوق..." tone="quiet" pulse />
        </div>
      )}

      {ready && (
        <>
          {/* A–B: top command bar — pair, price, live status, session, refresh */}
          <TopBar
            price={price}
            change24h={change24h}
            live={p.liveConnected === true}
            updatedAt={latestUpdatedAt}
            loading={p.data.status === "loading"}
            onRefresh={p.refresh}
          />

          <MarketTape
            overview={p.overview}
            futures={p.futures}
            marketState={p.marketState}
            orderBook={p.orderBook}
            indicators={p.indicators}
          />

          {/* C–D: market regime hero + market score/confidence */}
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <RegimeHero state={p.marketState} />
            </div>
            <MarketScorePanel
              state={p.marketState}
              latestUpdatedAt={latestUpdatedAt}
              freshSources={freshSources}
              availableSources={availableSources}
            />
          </div>

          {/* E: primary price chart */}
          <BtcChart
            candles={p.chartCandles}
            timeframe={p.timeframe}
            onTimeframeChange={p.setTimeframe}
            analysis={p.analysis30m}
            liquidity={p.liquidity}
            structure={p.structure}
          />

          {/* F–G: key levels + historical context */}
          <div className="grid gap-6 lg:grid-cols-2">
            <KeyLevelsPanel
              analysis={p.analysis30m}
              indicators={p.indicators}
              marketState={p.marketState}
            />
            <HistoricalContext candles={candles30m ?? []} futures={p.futures} />
          </div>

          {/* H–J: order flow / derivatives / liquidation */}
          <div className="grid gap-6 lg:grid-cols-3">
            <OrderFlowCard
              orderBook={p.orderBook}
              orderFlow={p.orderFlow}
              liquidity={p.liquidity}
              marketState={p.marketState}
              live={p.liveConnected === true}
            />
            <FuturesCard futures={p.futures} />
            <LiquidationCard futuresState={p.futuresState} marketState={p.marketState} />
          </div>

          {/* I: market structure & waves */}
          <StructureWavesCard structure={p.structure} waves={p.waves ?? []} />

          {/* K: multi-timeframe matrix */}
          <MultiTimeframeMatrix multiTF={p.multiTF} />

          {/* L: technical indicators */}
          <TechnicalIndicatorsCard indicators={p.indicators} />

          {/* M/Q: probability scenarios */}
          <ForecastCards forecast={p.forecast} />

          {/* N–O: alerts + data health */}
          <div className="grid gap-6 lg:grid-cols-2">
            <MarketAlerts
              nowMs={now}
              marketState={p.marketState}
              orderBook={p.orderBook}
              orderFlow={p.orderFlow}
              futures={p.futures}
              indicators={p.indicators}
              candles30m={candles30m}
            />
            <DataHealthPanel
              nowMs={now}
              spotWsConnected={p.liveConnected}
              spotWsUpdatedAt={p.liveUpdatedAt}
              futuresWsLive={p.futuresWsLive}
              futuresWsStale={p.futuresWsStale}
              futuresWsUpdatedAt={p.futuresState?.timestamp ?? null}
              restSpotPresent={p.orderBook != null || p.liveUpdatedAt != null}
              restSpotUpdatedAt={p.orderBook?.timestamp ?? p.liveUpdatedAt ?? null}
              restFuturesPresent={p.futures != null}
              restFuturesUpdatedAt={p.futures?.timestamp ?? null}
              coingeckoPresent={p.overview != null}
              coingeckoUpdatedAt={p.overview?.updatedAt ?? null}
              optionsPresent={p.optionsState != null}
              optionsUpdatedAt={p.optionsState?.timestamp ?? null}
            />
          </div>

          {/* P–T: provenance + system status */}
          <SystemStatusBar
            refreshTrigger={p.refreshTrigger}
            futuresWsLive={p.futuresWsLive === true}
            futuresWsLatency={p.futuresWsLatency}
            optionsState={p.optionsState}
            forecastSource={p.forecast?.source ?? null}
            loading={p.data.status === "loading"}
          />
        </>
      )}
    </div>
  );
}