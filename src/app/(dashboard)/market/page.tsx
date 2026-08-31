"use client";

import { useMarketData } from "@/features/bitcoin/store/market-context";
import { MarketIcon } from "@/components/icons/icons";
import {
  PageHeader,
  Card,
  MetricCard,
  Stat,
  Badge,
  Status,
  Progress,
  ScoreBar,
} from "@/components/ui/index";
import {
  MarketHeader,
  FlowPanel,
  LiquidityPanel,
  ExecutionPanel,
  PredictionPanel,
  SignalPanel,
  ScalpScore,
} from "@/components/trading/index";

const fmtPct = (v: number | null | undefined, d = "—"): string =>
  v == null || !isFinite(v) ? d : `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;

const toFreshness = (live?: boolean): "LIVE" | "RECENT" =>
  live === true ? "LIVE" : "RECENT";

export default function MarketPage() {
  const {
    data,
    overview,
    orderBook,
    orderFlow,
    marketState,
    futures,
    forecast,
    liveUpdatedAt,
    liveConnected,
    refresh,
  } = useMarketData();

  const ready =
    data.status === "ready" ||
    !!overview || !!orderBook || !!forecast || !!marketState;

  const biasScore = marketState?.biasScore ?? overview?.change24hPercent ?? 0;
  const direction = biasScore >= 0 ? "LONG" : "SHORT";
  const biasUp = (Math.min(100, Math.max(-100, biasScore)) + 100) / 2;

  const horizons = (forecast?.horizons ?? []).map((h) => ({
    minutes: h.minutes,
    probabilityUp: h.probabilityUp,
    expectedMovePct: h.drift,
    confidence: h.confidence,
  }));

  const families =
    marketState?.components?.map((c) => ({
      key: c.label,
      label: c.label,
      vote:
        c.reading === "bullish" || c.reading === "buy" || c.reading === "high"
          ? 0.5
          : c.reading === "bearish" || c.reading === "sell" || c.reading === "low"
            ? -0.5
            : 0,
      magnitude: c.healthy ? 0.7 : 0.4,
    })) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Market Overview"
        icon={<MarketIcon className="h-5 w-5 text-muted" />}
        title="الحالة العامة للسوق"
        description="نظرة موحّدة على حالة BTC الحية: تدفق الأوامر، السيولة، التنبؤ والنظام العام — من مصدر بيانات واحد."
        right={
          <>
            <Status
              label={liveConnected === true ? "مباشر" : "متأخر"}
              tone={liveConnected === true ? "good" : "warn"}
              pulse={liveConnected === true}
            />
            <button
              type="button"
              onClick={refresh}
              disabled={data.status === "loading"}
              className="rounded-md border border-zinc-700 px-4 py-2 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100 disabled:opacity-50"
            >
              {data.status === "loading" ? "جارٍ التحديث..." : "تحديث البيانات"}
            </button>
          </>
        }
      />

      {!ready ? (
        <Card className="py-10 text-center text-xs text-muted">
          {data.status === "error" ? data.message : "جارٍ تحميل بيانات السوق..."}
        </Card>
      ) : (
        <>
          <MarketHeader
            data={{
              symbol: "BTCUSDT",
              price: overview?.price ?? marketState?.price ?? null,
              change24hPct: overview?.change24hPercent ?? null,
              session: "الرئيسية",
              regime: marketState?.trend ?? "neutral",
              regimeConfidence: Math.abs(biasScore),
              freshness: toFreshness(liveConnected === true),
              bias: biasUp,
            }}
          />

          <div className="grid gap-4 lg:grid-cols-3">
            <FlowPanel
              data={{
                buyVolume: orderFlow?.buyVolume ?? 0,
                sellVolume: orderFlow?.sellVolume ?? 0,
                delta: orderFlow?.buySellDelta ?? 0,
                ratio: orderFlow?.buySellRatio ?? null,
                largeBuyVolume: orderFlow?.largeBuyVolume,
                largeSellVolume: orderFlow?.largeSellVolume,
                takerBuyRatio: orderFlow?.takerBuyRatio ?? null,
                sampleSeconds: orderFlow?.sampleSeconds,
                timestamp: orderFlow?.timestamp,
              }}
            />
            <LiquidityPanel
              data={
                orderBook
                  ? {
                      bestBid: orderBook.bestBid,
                      bestAsk: orderBook.bestAsk,
                      spread: orderBook.spread,
                      spreadPct: orderBook.spreadPercent,
                      bidDepth: orderBook.bidDepth,
                      askDepth: orderBook.askDepth,
                      depthImbalance: orderBook.depthImbalance,
                    }
                  : {
                      bestBid: overview?.price ?? 0,
                      bestAsk: overview?.price ?? 0,
                      spread: 0,
                      spreadPct: null,
                      bidDepth: 0,
                      askDepth: 0,
                      depthImbalance: 0,
                    }
              }
            />
            <PredictionPanel
              data={{
                price: overview?.price ?? forecast?.price ?? null,
                generatedAt: forecast?.generatedAt ?? liveUpdatedAt ?? undefined,
                align: marketState
                  ? `توجه ${marketState.trend} / تدفق ${marketState.orderFlow}`
                  : null,
                horizons:
                  horizons.length > 0
                    ? horizons
                    : [
                        { minutes: 30, probabilityUp: 50, expectedMovePct: null, confidence: null },
                        { minutes: 60, probabilityUp: 50, expectedMovePct: null, confidence: null },
                        { minutes: 120, probabilityUp: 50, expectedMovePct: null, confidence: null },
                      ],
              }}
            />
          </div>

          {marketState ? (
            <div className="grid gap-4 lg:grid-cols-3">
              <ScalpScore
                data={{
                  score: biasUp,
                  direction: direction as "LONG" | "SHORT",
                  families,
                }}
              />
              <SignalPanel
                data={{
                  direction: direction as "LONG" | "SHORT",
                  strength: Math.abs(biasScore) > 30 ? "strong" : "moderate",
                  confidence: Math.abs(biasScore),
                  reason:
                    marketState?.components
                      ?.filter((c) => c.healthy)
                      .slice(0, 3)
                      .map((c) => `${c.label}: ${c.reading}`)
                      .join(" · ") ?? "—",
                  factors: marketState?.components?.map((c) => ({
                    label: c.label,
                    note: c.reading,
                  })),
                }}
              />
              <Card title="النظام العام" eyebrow="Regime" actions={<Badge tone={biasScore >= 0 ? "up" : "down"}>{direction}</Badge>}>
                <div className="space-y-3">
                  <div>
                    <div className="mb-1 text-2xs text-muted">انحياز السوق</div>
                    <ScoreBar value={biasScore / 100} showValue />
                  </div>
                  {marketState?.components?.map((c) => (
                    <div key={c.label} className="space-y-1">
                      <div className="flex items-baseline justify-between">
                        <span className="text-2xs text-muted">{c.label}</span>
                        <Badge tone={c.healthy ? "up" : "warn"}>{c.reading}</Badge>
                      </div>
                      <Progress pct={c.healthy ? 100 : 40} tone={c.healthy ? "good" : "warn"} />
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          ) : null}

          {overview ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              <MetricCard label="الحجم 24س" value={fmt24h(overview.volume24h)} hint={`${overview.sources.length} مصادر`} />
              <MetricCard label="التغيير 24س" value={fmtPct(overview.change24hPercent)} tone={overview.change24hPercent !== null && overview.change24hPercent >= 0 ? "up" : "down"} />
              <MetricCard label="أعلى 24س" value={fmtPrice(overview.high24h)} />
              <MetricCard label="أدنى 24س" value={fmtPrice(overview.low24h)} />
              <MetricCard label="التمويل سنوي" value={futures ? fmtPct(futures.fundingRate * 100) : fmtPct(overview.fundRate !== null ? overview.fundRate : null)} />
              <MetricCard label="الرهانات الطويلة" value={overview.longAccount != null ? `${(overview.longAccount * 100).toFixed(1)}%` : "—"} tone="neutral" />
            </div>
          ) : null}

          {futures ? (
            <Card title="العقود الآجلة — السياق" eyebrow="Futures" actions={<Badge tone="quiet">{futures.priceOiContext}</Badge>}>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                <Stat label="الرافعة الطويلة/القصيرة" value={futures.longShortRatio.toFixed(3)} />
                <Stat label="سيولة مفتوحة" value={fmt24h(futures.openInterest)} />
                <Stat label="التمويل" value={fmtPct(futures.fundingRate * 100)} tone={futures.fundingRegime === "strongNegative" ? "up" : "down"} />
                <Stat label="سعر السوق" value={fmtPrice(futures.markPrice)} />
                <Stat label="السعر الأساس" value={futures.basisBps != null ? `${futures.basisBps.toFixed(1)} ب.أ` : "—"} />
                <Stat label="التصفية التراكمية" value={futures.cumulativeLiquidations != null ? formatCompact(futures.cumulativeLiquidations) : "—"} />
              </div>
            </Card>
          ) : null}

          <ExecutionPanel
            data={{
              entry: overview?.price ?? null,
              stopLoss: null,
              takeProfit: null,
              feeBps: null,
              spreadBps: orderBook?.spreadPercent != null ? orderBook.spreadPercent * 100 : null,
              slippageBps: null,
              totalCostBps: null,
              status: orderBook && orderBook.spreadPercent > 0.005 ? "WARN" : "OK",
            }}
          />
        </>
      )}
    </div>
  );
}

function fmtPrice(v: number | null | undefined): string {
  return v == null || !isFinite(v) ? "—" : v.toLocaleString("ar-EG", { maximumFractionDigits: 2 });
}

function fmt24h(v: number | null | undefined): string {
  return v == null || !isFinite(v)
    ? "—"
    : v >= 1e9
      ? `${(v / 1e9).toFixed(1)}B`
      : v >= 1e6
        ? `${(v / 1e6).toFixed(1)}M`
        : v >= 1e3
          ? `${(v / 1e3).toFixed(1)}K`
          : v.toFixed(0);
}

function formatCompact(v: number): string {
  return v >= 1e9 ? `${(v / 1e9).toFixed(1)}B` : v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(1)}K` : v.toFixed(0);
}