"use client";

import type { MarketState, OrderBookSnapshot, OrderFlowData } from "../types";
import type { LiquidityAnalysis } from "../analysis";
import { formatBtc, formatPrice } from "../utils";
import { Badge, Card } from "@/components/ui/index";

export function OrderFlowCard({
  orderBook,
  orderFlow,
  liquidity,
  marketState,
  live,
}: {
  orderBook: OrderBookSnapshot | null;
  orderFlow: OrderFlowData | null;
  liquidity: LiquidityAnalysis | null;
  marketState: MarketState | null;
  live?: boolean;
}) {
  // Single-source order-flow reading (MarketState.orderFlow), which already
  // aggregates taker ratio + buy/sell ratio. No threshold is re-derived here.
  const flowReading: "buy" | "sell" | "balanced" =
    marketState?.orderFlow ?? "balanced";

  return (
    <Card
      title="تدفق الأوامر والسيولة"
      actions={
        live !== undefined ? (
          <Badge tone={live ? "up" : "quiet"}>{live ? "مباشر" : "عبر REST"}</Badge>
        ) : undefined
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Metric label="الانتشار (Spread)" value={orderBook ? `${orderBook.spread.toFixed(2)} (${orderBook.spreadPercent.toFixed(3)}%)` : "—"} />
        <Metric label="أفضل عرض/طلب" value={orderBook ? `${formatPrice(orderBook.bestBid)} / ${formatPrice(orderBook.bestAsk)}` : "—"} />
        <Metric label="عرض عمق (Bid)" value={orderBook ? `${formatBtc(orderBook.bidDepth)} BTC` : "—"} />
        <Metric label="طلب عمق (Ask)" value={orderBook ? `${formatBtc(orderBook.askDepth)} BTC` : "—"} />
        <Metric label="خلل العمق" value={orderBook ? orderBook.depthImbalance.toFixed(2) : "—"} />
        <Metric
          label="حجم شراء / بيع"
          value={orderFlow ? `${formatBtc(orderFlow.buyVolume)} / ${formatBtc(orderFlow.sellVolume)}` : "—"}
        />
        <Metric label="نسبة المشتري (Taker)" value={orderFlow ? `${(orderFlow.takerBuyRatio * 100).toFixed(1)}%` : "—"} />
        <Metric label="صفقات كبيرة" value={orderFlow ? `${orderFlow.largeTradeCount} صفقة` : "—"} />
      </div>

      <div className="mt-3">
        <p className="text-2xs text-muted">القراءة</p>
        <p className={`text-sm font-bold ${flowReading === "sell" ? "text-down-fg" : flowReading === "buy" ? "text-up-fg" : "text-zinc-300"}`}>
          {flowReading === "sell" ? "ضغط بيع" : flowReading === "buy" ? "ضغط شراء" : "متوازن"}
        </p>
      </div>

      <div className="mt-4">
        <p className="mb-2 text-2xs text-muted">ضغط التصفية</p>
        <Badge
          tone={
            liquidity?.liquidationPressure === "high"
              ? "down"
              : liquidity?.liquidationPressure === "moderate"
              ? "warn"
              : "good"
          }
        >
          {liquidity?.liquidationPressure === "high" ? "مرتفع" : liquidity?.liquidationPressure === "moderate" ? "متوسط" : "منخفض"}
        </Badge>
      </div>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-panel bg-surface-2/30 px-3 py-2">
      <p className="text-2xs text-muted">{label}</p>
      <p className="mt-0.5 text-xs font-semibold text-zinc-100" dir="ltr">
        {value}
      </p>
    </div>
  );
}