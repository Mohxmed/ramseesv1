"use client";

import type { OrderBookSnapshot, OrderFlowData } from "../types";
import type { LiquidityAnalysis } from "../analysis";
import { formatBtc, formatPercent, formatPrice } from "../utils";

export function OrderFlowCard({
  orderBook,
  orderFlow,
  liquidity,
  live,
}: {
  orderBook: OrderBookSnapshot | null;
  orderFlow: OrderFlowData | null;
  liquidity: LiquidityAnalysis | null;
  live?: boolean;
}) {
  const flowReading =
    !orderFlow || orderFlow.takerBuyRatio >= 0.5 + 0.05
      ? "شراء"
      : orderFlow && orderFlow.takerBuyRatio <= 0.5 - 0.05
      ? "بيع"
      : "متوازن";

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-100">
          تدفق الأوامر والسيولة
        </h2>
        {live !== undefined && (
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
              live ? "bg-emerald-500/15 text-emerald-300" : "bg-zinc-700/40 text-zinc-400"
            }`}
          >
            {live ? "مباشر" : "عبر REST"}
          </span>
        )}
      </div>

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
        <p className="text-[11px] text-zinc-500">القراءة</p>
        <p className={`text-sm font-bold ${flowReading === "بيع" ? "text-red-400" : flowReading === "شراء" ? "text-emerald-400" : "text-zinc-300"}`}>
          {flowReading === "بيع" ? "ضغط بيع" : flowReading === "شراء" ? "ضغط شراء" : "متوازن"}
        </p>
      </div>

      <div className="mt-4">
        <p className="mb-2 text-[11px] text-zinc-500">ضغط التصفية</p>
        <PressureBadge level={liquidity?.liquidationPressure ?? "low"} />
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-zinc-950/40 px-3 py-2">
      <p className="text-[10px] text-zinc-500">{label}</p>
      <p className="mt-0.5 text-xs font-semibold text-zinc-200" dir="ltr">
        {value}
      </p>
    </div>
  );
}

function PressureBadge({ level }: { level: string }) {
  const style =
    level === "high"
      ? "bg-red-500/15 text-red-300"
      : level === "moderate"
      ? "bg-amber-500/15 text-amber-300"
      : "bg-emerald-500/15 text-emerald-300";
  return (
    <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-semibold ${style}`}>
      {level === "high" ? "مرتفع" : level === "moderate" ? "متوسط" : "منخفض"}
    </span>
  );
}
