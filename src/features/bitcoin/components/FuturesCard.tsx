"use client";

import type { FuturesContext } from "../types";
import { formatPercent, formatUsd } from "../utils";
import { Card } from "@/components/ui/index";

const OI_RELATION_LABEL: Record<string, string> = {
  "price-up-oi-up": "سعر ↑ + عقد مفتوح ↑",
  "price-up-oi-down": "سعر ↑ + عقد مفتوح ↓",
  "price-down-oi-up": "سعر ↓ + عقد مفتوح ↑",
  "price-down-oi-down": "سعر ↓ + عقد مفتوح ↓",
  flat: "محايد",
};

const FUND_STYLE: Record<string, string> = {
  strongPositive: "text-down-fg",
  positive: "text-down-fg",
  neutral: "text-zinc-300",
  negative: "text-up-fg",
  strongNegative: "text-up-fg",
};

export function FuturesCard({ futures }: { futures: FuturesContext | null }) {
  if (!futures) {
    return (
      <Card className="py-10 text-center text-2xs text-muted">
        بيانات العقود الآجلة غير متاحة
      </Card>
    );
  }

  return (
    <Card title="تحليل العقود الآجلة (سوق، وليس حساب)">
      <div className="grid grid-cols-2 gap-3">
        <Metric label="العقد المفتوح (OI)" value={futures.openInterest ? `${formatUsd(futures.openInterest * futures.markPrice)}` : "—"} />
        <Metric label="تغيّر OI (1س)" value={futures.oiChange1h != null ? formatPercent(futures.oiChange1h) : "—"} tone={futures.oiChange1h != null && futures.oiChange1h > 0 ? "up" : futures.oiChange1h != null && futures.oiChange1h < 0 ? "down" : "flat"} />
        <Metric label="معدل الفاندينغ" value={futures.fundingRate != null ? formatPercent(futures.fundingRate, 4) : "—"} />
        <Metric label="نظام الفاندينغ" value={fundLabel(futures.fundingRegime)} customClass={FUND_STYLE[futures.fundingRegime] ?? ""} />
        <Metric label="Long/Short" value={futures.longShortRatio ? futures.longShortRatio.toFixed(3) : "—"} />
        <Metric label="نسبة الحسابات الطويلة" value={futures.longAccountShare != null ? `${(futures.longAccountShare * 100).toFixed(1)}%` : "—"} />
        <Metric label="الحجم (Futures)" value={futures.futuresVolume ? formatUsd(futures.futuresVolume) : "—"} />
        <Metric label="الأساس (Basis)" value={futures.basis != null ? formatPercent(futures.basis, 3) : "—"} />
      </div>

      <div className="mt-4 rounded-panel border border-line bg-surface-2/30 p-3">
        <p className="text-2xs text-muted">علاقة السعر / OI (سياق سوق)</p>
        <p className="mt-1 text-sm font-semibold text-zinc-100">
          {OI_RELATION_LABEL[futures.priceOiContext] ?? futures.priceOiContext}
        </p>
        <p className="mt-1 text-2xs text-muted">
          تُستخدم كسياق وليست إشارة مؤكدة للاتجاه.
        </p>
      </div>

      {futures.fundingHistory.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-2xs text-muted">آخر معدلات الفاندينغ</p>
          <div className="flex flex-wrap gap-1.5">
            {futures.fundingHistory.slice(0, 6).map((f, i) => (
              <span
                key={i}
                className="rounded-chip bg-surface-1/40 px-2 py-0.5 font-mono text-2xs text-zinc-300"
              >
                {formatPercent(f.rate, 3)}
              </span>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function Metric({ label, value, tone, customClass }: { label: string; value: string; tone?: string; customClass?: string }) {
  const toneClass =
    tone === "up"
      ? "text-up-fg"
      : tone === "down"
      ? "text-down-fg"
      : "text-zinc-200";
  return (
    <div className="rounded-panel bg-surface-2/30 px-3 py-2">
      <p className="text-2xs text-muted">{label}</p>
      <p className={`mt-0.5 text-xs font-semibold ${customClass || toneClass}`} dir="ltr">
        {value}
      </p>
    </div>
  );
}

function fundLabel(r: string): string {
  switch (r) {
    case "strongPositive": return "إيجابي قوي";
    case "positive": return "إيجابي";
    case "neutral": return "محايد";
    case "negative": return "سلبي";
    case "strongNegative": return "سلبي قوي";
    default: return "—";
  }
}