"use client";

import type { MarketOverview, FuturesContext, OrderBookSnapshot } from "../types";
import type { MarketState } from "../types";
import {
  formatCompact,
  formatPercent,
  formatPrice,
  isUp,
  timeLabel,
} from "../utils";
import { Card, Status } from "@/components/ui/index";

function Tile({
  label,
  value,
  tone,
  sub,
}: {
  label: string;
  value: string;
  tone?: "up" | "down" | "neutral" | "warn";
  sub?: string;
}) {
  const toneClass =
    tone === "up"
      ? "text-up-fg"
      : tone === "down"
      ? "text-down-fg"
      : tone === "warn"
      ? "text-warn-fg"
      : "text-zinc-100";
  return (
    <div className="rounded-panel border border-line bg-surface-2/30 px-3 py-2.5">
      <p className="text-2xs text-muted">{label}</p>
      <p className={`mt-0.5 text-sm font-bold leading-tight ${toneClass}`} dir="ltr">
        {value}
      </p>
      {sub && <p className="mt-0.5 text-2xs text-muted">{sub}</p>}
    </div>
  );
}

const TREND_LABEL: Record<string, { text: string; cls: string }> = {
  bullish: { text: "صاعد", cls: "bg-up/15 text-up-fg" },
  bearish: { text: "هابط", cls: "bg-down/15 text-down-fg" },
  neutral: { text: "عرضي", cls: "bg-zinc-600/30 text-zinc-300" },
};

export function InstantPriceBar({
  overview,
  futures,
  marketState,
  orderBook,
  live,
  liveUpdatedAt,
}: {
  overview: MarketOverview | null;
  futures: FuturesContext | null;
  marketState: MarketState | null;
  orderBook: OrderBookSnapshot | null;
  live?: boolean;
  liveUpdatedAt?: number | null;
}) {
  if (!overview) {
    return (
      <Card className="py-10 text-center text-2xs text-muted">
        بيانات سعر البيتكوين الفوري غير متاحة حالياً
      </Card>
    );
  }

  const up24h = isUp(overview.change24hPercent);
  const trend = marketState?.trend ?? "neutral";
  const trendInfo = TREND_LABEL[trend] ?? TREND_LABEL.neutral;
  const futVol = overview.futuresVolume ?? futures?.futuresVolume ?? null;
  const oiUsd =
    futures?.openInterest && futures.markPrice
      ? futures.openInterest * futures.markPrice
      : overview.openInterest != null
      ? overview.openInterest * overview.price
      : null;

  return (
    <Card
      title="سعر البيتكوين الفوري"
      actions={
        live !== undefined ? (
          <Status
            label={live ? "مباشر" : "منتظر"}
            tone={live ? "good" : "quiet"}
            pulse={live}
          />
        ) : undefined
      }
      bodyClassName="space-y-3"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-2xs text-muted">
            آخر تحديث {timeLabel(overview.updatedAt)} · {overview.sources.join(" + ")}
          </p>
          {live && liveUpdatedAt != null && (
            <p className="mt-0.5 inline-flex items-center gap-1 text-2xs font-medium text-up-fg/90">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-up-fg" />
              تحديث مباشر {timeLabel(liveUpdatedAt)}
            </p>
          )}
        </div>
        <div className="flex items-end gap-4">
          <div className="text-right">
            <p className="text-3xl font-extrabold text-zinc-50" dir="ltr">
              {formatPrice(overview.price)}
            </p>
            <p
              className={`text-right text-sm font-semibold ${
                up24h ? "text-up-fg" : "text-down-fg"
              }`}
            >
              {formatPercent(overview.change24hPercent)} (24س)
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        <Tile label="أعلى سعر (24س)" value={formatPrice(overview.high24h)} tone="up" />
        <Tile label="أدنى سعر (24س)" value={formatPrice(overview.low24h)} tone="down" />
        <Tile
          label="حجم التداول (24س)"
          value={overview.volume24h ? `$${formatCompact(overview.volume24h)}` : "—"}
          sub="سوق فوري"
        />
        <Tile
          label="القيمة السوقية"
          value={overview.marketCap ? `$${formatCompact(overview.marketCap)}` : "—"}
        />
        <Tile
          label="هيمنة بيتكوين على السوق"
          value={overview.btcDominance != null ? formatPercent(overview.btcDominance, 2) : "—"}
          sub="حصة من كامل سوق الكريبتو"
        />
        <Tile
          label="معدل التمويل"
          value={futures?.fundingRate != null ? formatPercent(futures.fundingRate, 4) : overview.fundRate != null ? formatPercent(overview.fundRate, 4) : "—"}
          tone={futures?.fundingRate != null && futures.fundingRate > 0 ? "warn" : futures?.fundingRate != null && futures.fundingRate < 0 ? "up" : "neutral"}
          sub={futures?.fundingChange != null ? `التغيّر ${formatPercent(futures.fundingChange, 4)}` : undefined}
        />
        <Tile
          label="العقود المفتوحة (OI)"
          value={oiUsd ? `$${formatCompact(oiUsd)}` : "—"}
          sub={
            futures?.oiChange1h != null
              ? `تغيّر 1س ${formatPercent(futures.oiChange1h)}`
              : overview.openInterestChange != null
              ? `تغيّر ${formatPercent(overview.openInterestChange)}`
              : undefined
          }
        />
        <Tile
          label="نسبة الطويل إلى القصير"
          value={
            futures?.longShortRatio != null
              ? `${futures.longShortRatio.toFixed(2)}`
              : overview.longShortRatio != null
              ? overview.longShortRatio.toFixed(2)
              : "—"
          }
          sub={
            futures?.longAccountShare != null
              ? `طويل ${(futures.longAccountShare * 100).toFixed(0)}%`
              : overview.longAccount != null
              ? `طويل ${overview.longAccount.toFixed(0)}%`
              : undefined
          }
        />
        <Tile
          label="حجم العقود الآجلة"
          value={futVol ? `$${formatCompact(futVol)}` : "—"}
          sub="سوق عقود آجلة"
        />
        <div className="rounded-panel border border-line bg-surface-2/30 px-3 py-2.5">
          <p className="text-2xs text-muted">الترند الحالي</p>
          <span
            className={`mt-1 inline-block rounded-chip px-2 py-0.5 text-sm font-bold ${trendInfo.cls}`}
          >
            {trendInfo.text}
          </span>
          {marketState && <p className="mt-1 text-2xs text-muted">توجه {trend}</p>}
        </div>
        <Tile
          label="التصفيات"
          value="غير متاح"
          tone="neutral"
          sub={
            marketState
              ? `ضغط ${marketState.liquidationPressure === "high" ? "مرتفع" : marketState.liquidationPressure === "moderate" ? "متوسط" : "منخفض"}`
              : undefined
          }
        />
        <Tile
          label="فرق عرض/طلب (Spread)"
          value={orderBook ? `${orderBook.spread.toFixed(2)} (${orderBook.spreadPercent.toFixed(3)}%)` : "—"}
          sub={orderBook ? `${formatPrice(orderBook.bestBid)} / ${formatPrice(orderBook.bestAsk)}` : undefined}
        />
      </div>
    </Card>
  );
}