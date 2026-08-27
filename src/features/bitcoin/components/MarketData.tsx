"use client";

import type { MarketOverview } from "../types";
import {
  formatCompact,
  formatPercent,
  formatPrice,
  formatSigned,
} from "../utils";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-zinc-800/60 py-2 last:border-0">
      <span className="text-xs text-zinc-500">{label}</span>
      <span className="text-sm font-medium text-zinc-100" dir="ltr">
        {value}
      </span>
    </div>
  );
}

export function MarketDataCard({ overview }: { overview: MarketOverview | null }) {
  if (!overview) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 text-center text-zinc-500">
        بيانات السوق غير متاحة
      </div>
    );
  }

  const supplyRows = [
    { label: "المعروض المتداول", value: `${formatCompact(overview.circulatingSupply)} BTC` },
    {
      label: "إجمالي المعروض",
      value:
        overview.totalSupply != null
          ? `${formatCompact(overview.totalSupply)} BTC`
          : "غير متاح",
    },
    {
      label: "أقصى معروض",
      value:
        overview.maxSupply != null
          ? `${formatCompact(overview.maxSupply)} BTC`
          : "غير متاح",
    },
  ];

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
      <h2 className="mb-4 text-sm font-semibold text-zinc-200">
        بيانات السوق التفصيلية
      </h2>
      <div className="grid gap-6 md:grid-cols-3">
        <div>
          <p className="mb-2 text-xs font-medium text-zinc-400">المغامرة اللحظية</p>
          <Row label="السعر الحالي" value={formatPrice(overview.price)} />
          <Row label="التغير (24 ساعة)" value={formatSigned(overview.change24h ?? 0) + "%"} />
          <Row label="أعلى سعر" value={formatPrice(overview.high24h)} />
          <Row label="أدنى سعر" value={formatPrice(overview.low24h)} />
          <Row label="حجم التداول" value={`$${formatCompact(overview.volume24h)}`} />
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-zinc-400">المشتقات والعقود</p>
          <Row label="معدل التمويل" value={formatPercent(overview.fundRate, 4)} />
          <Row
            label="العقود المفتوحة"
            value={
              overview.openInterest != null
                ? `${formatCompact(overview.openInterest)} BTC`
                : "غير متاح"
            }
          />
          <Row
            label="نسبة الطويل/القصير"
            value={
              overview.longShortRatio != null
                ? overview.longShortRatio.toFixed(3)
                : "غير متاح"
            }
          />
          <Row label="أساس العقود" value={formatPercent(overview.basis, 3)} />
          <Row
            label="حجم العقود الآجلة"
            value={
              overview.futuresVolume != null
                ? `$${formatCompact(overview.futuresVolume)}`
                : "غير متاح"
            }
          />
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-zinc-400">الإمداد والسوق</p>
          <Row label="القيمة السوقية" value={`$${formatCompact(overview.marketCap)}`} />
          <Row label="هيمنة بيتكوين" value={formatPercent(overview.btcDominance)} />
          {supplyRows.map((r) => (
            <Row key={r.label} label={r.label} value={r.value} />
          ))}
        </div>
      </div>
    </section>
  );
}
