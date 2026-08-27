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

function Stat({
  label,
  value,
  tone,
  sub,
}: {
  label: string;
  value: string;
  tone?: "up" | "down" | "neutral";
  sub?: string;
}) {
  const toneClass =
    tone === "up"
      ? "text-emerald-400"
      : tone === "down"
      ? "text-red-400"
      : "text-zinc-50";
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <p className={`mt-1.5 text-lg font-bold ${toneClass}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-zinc-500">{sub}</p>}
    </div>
  );
}

export function MarketOverviewCard({ overview }: { overview: MarketOverview | null }) {
  if (!overview) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 text-center text-zinc-500">
        بيانات السوق غير متاحة حالياً
      </div>
    );
  }

  const up24h = isUp(overview.change24hPercent);

  return (
    <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-zinc-500">سعر البيتكوين الفوري</p>
          <p className="mt-1 text-3xl font-extrabold text-zinc-50">
            {formatPrice(overview.price)}
          </p>
          <p
            className={`mt-1.5 inline-flex items-center gap-1 text-sm font-semibold ${
              up24h ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {formatPercent(overview.change24hPercent)} (24 ساعة)
          </p>
        </div>
        <div className="text-left text-xs text-zinc-500">
          <p>آخر تحديث: {timeLabel(overview.updatedAt)}</p>
          <p className="mt-1">المصدر: {overview.sources.join(" + ")}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="أعلى سعر (24 ساعة)"
          value={formatPrice(overview.high24h)}
        />
        <Stat
          label="أدنى سعر (24 ساعة)"
          value={formatPrice(overview.low24h)}
        />
        <Stat
          label="حجم التداول (24 ساعة)"
          value={formatUsdCompact(overview.volume24h)}
        />
        <Stat label="القيمة السوقية" value={formatUsdCompact(overview.marketCap)} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="هيمنة بيتكوين" value={formatPercent(overview.btcDominance, 2)} />
        <Stat
          label="المعروض المتداول"
          value={`${formatCompact(overview.circulatingSupply)} BTC`}
        />
        <Stat
          label="معدل التمويل"
          value={formatPercent(overview.fundRate, 4)}
        />
        <Stat
          label="العقود المفتوحة (OI)"
          value={overview.openInterest != null ? `${formatCompact(overview.openInterest)} BTC` : "غير متاح"}
          sub={overview.openInterestChange != null ? formatSigned(overview.openInterestChange) + "%" : undefined}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="نسبة الطويل / القصير"
          value={
            overview.longShortRatio != null
              ? overview.longShortRatio.toFixed(3)
              : "غير متاح"
          }
          sub={
            overview.longAccount != null
              ? `طويل ${overview.longAccount.toFixed(0)}% / قصير ${overview.shortAccount?.toFixed(0)}%`
              : undefined
          }
        />
        <Stat
          label="أساس العقود الآجلة"
          value={formatPercent(overview.basis, 3)}
        />
        <Stat
          label="حجم العقود الآجلة"
          value={formatUsdCompact(overview.futuresVolume)}
        />
        <Stat label="التصفيات" value="غير متاح" sub="غير متوفرة عبر المصدر الحالي" />
      </div>
    </section>
  );
}

function formatUsdCompact(value: number | null | undefined): string {
  if (value == null || !isFinite(value)) return "غير متاح";
  return `$${formatCompact(value)}`;
}
