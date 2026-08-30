"use client";

import type { MarketOverview } from "../types";
import {
  formatCompact,
  formatPercent,
  formatPrice,
  formatSigned,
} from "../utils";
import { Card, DataRow } from "@/components/ui/index";

export function MarketDataCard({ overview }: { overview: MarketOverview | null }) {
  if (!overview) {
    return (
      <Card className="py-10 text-center text-2xs text-muted">
        بيانات السوق غير متاحة
      </Card>
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
    <Card title="بيانات السوق التفصيلية">
      <div className="grid gap-6 md:grid-cols-3">
        <div>
          <p className="mb-2 text-2xs font-medium text-zinc-400">المغامرة اللحظية</p>
          <DataRow label="السعر الحالي" value={formatPrice(overview.price)} tone="neutral" />
          <DataRow label="التغير (24 ساعة)" value={formatSigned(overview.change24h ?? 0) + "%"} tone="neutral" />
          <DataRow label="أعلى سعر" value={formatPrice(overview.high24h)} tone="neutral" />
          <DataRow label="أدنى سعر" value={formatPrice(overview.low24h)} tone="neutral" />
          <DataRow label="حجم التداول" value={`$${formatCompact(overview.volume24h)}`} tone="neutral" />
        </div>

        <div>
          <p className="mb-2 text-2xs font-medium text-zinc-400">المشتقات والعقود</p>
          <DataRow label="معدل التمويل" value={formatPercent(overview.fundRate, 4)} tone="neutral" />
          <DataRow
            label="العقود المفتوحة"
            value={
              overview.openInterest != null
                ? `${formatCompact(overview.openInterest)} BTC`
                : "غير متاح"
            }
            tone="neutral"
          />
          <DataRow
            label="نسبة الطويل/القصير"
            value={
              overview.longShortRatio != null
                ? overview.longShortRatio.toFixed(3)
                : "غير متاح"
            }
            tone="neutral"
          />
          <DataRow label="أساس العقود" value={formatPercent(overview.basis, 3)} tone="neutral" />
          <DataRow
            label="حجم العقود الآجلة"
            value={
              overview.futuresVolume != null
                ? `$${formatCompact(overview.futuresVolume)}`
                : "غير متاح"
            }
            tone="neutral"
          />
        </div>

        <div>
          <p className="mb-2 text-2xs font-medium text-zinc-400">الإمداد والسوق</p>
          <DataRow label="القيمة السوقية" value={`$${formatCompact(overview.marketCap)}`} tone="neutral" />
          <DataRow label="هيمنة بيتكوين" value={formatPercent(overview.btcDominance)} tone="neutral" />
          {supplyRows.map((r) => (
            <DataRow key={r.label} label={r.label} value={r.value} tone="neutral" />
          ))}
        </div>
      </div>
    </Card>
  );
}