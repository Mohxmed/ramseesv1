"use client";

import type { MarketOverview } from "../types";
import {
  formatCompact,
  formatPercent,
  formatPrice,
  formatSigned,
  isUp,
  timeLabel,
} from "../utils";
import { Card, MetricCard } from "@/components/ui/index";

export function MarketOverviewCard({ overview }: { overview: MarketOverview | null }) {
  if (!overview) {
    return (
      <Card className="py-10 text-center text-2xs text-muted">
        بيانات السوق غير متاحة حالياً
      </Card>
    );
  }

  const up24h = isUp(overview.change24hPercent);

  return (
    <Card bodyClassName="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-2xs text-muted">سعر البيتكوين الفوري</p>
          <p className="mt-1 text-3xl font-extrabold text-zinc-50">
            {formatPrice(overview.price)}
          </p>
          <p
            className={`mt-1.5 inline-flex items-center gap-1 text-sm font-semibold ${
              up24h ? "text-up-fg" : "text-down-fg"
            }`}
          >
            {formatPercent(overview.change24hPercent)} (24 ساعة)
          </p>
        </div>
        <div className="text-left text-2xs text-muted">
          <p>آخر تحديث: {timeLabel(overview.updatedAt)}</p>
          <p className="mt-1">المصدر: {overview.sources.join(" + ")}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="أعلى سعر (24 ساعة)"
          value={formatPrice(overview.high24h)}
        />
        <MetricCard
          label="أدنى سعر (24 ساعة)"
          value={formatPrice(overview.low24h)}
        />
        <MetricCard
          label="حجم التداول (24 ساعة)"
          value={formatUsdCompact(overview.volume24h)}
        />
        <MetricCard label="القيمة السوقية" value={formatUsdCompact(overview.marketCap)} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="هيمنة بيتكوين" value={formatPercent(overview.btcDominance, 2)} />
        <MetricCard
          label="المعروض المتداول"
          value={`${formatCompact(overview.circulatingSupply)} BTC`}
        />
        <MetricCard
          label="معدل التمويل"
          value={formatPercent(overview.fundRate, 4)}
        />
        <MetricCard
          label="العقود المفتوحة (OI)"
          value={overview.openInterest != null ? `${formatCompact(overview.openInterest)} BTC` : "غير متاح"}
          hint={overview.openInterestChange != null ? formatSigned(overview.openInterestChange) + "%" : undefined}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="نسبة الطويل / القصير"
          value={
            overview.longShortRatio != null
              ? overview.longShortRatio.toFixed(3)
              : "غير متاح"
          }
          hint={
            overview.longAccount != null
              ? `طويل ${overview.longAccount.toFixed(0)}% / قصير ${overview.shortAccount?.toFixed(0)}%`
              : undefined
          }
        />
        <MetricCard
          label="أساس العقود الآجلة"
          value={formatPercent(overview.basis, 3)}
        />
        <MetricCard
          label="حجم العقود الآجلة"
          value={formatUsdCompact(overview.futuresVolume)}
        />
        <MetricCard label="التصفيات" value="غير متاح" hint="غير متوفرة عبر المصدر الحالي" />
      </div>
    </Card>
  );
}

function formatUsdCompact(value: number | null | undefined): string {
  if (value == null || !isFinite(value)) return "غير متاح";
  return `$${formatCompact(value)}`;
}