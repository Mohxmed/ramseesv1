"use client";

import type { FuturesContext } from "../types";
import { formatPercent, formatPrice, formatUsd } from "../utils";

const OI_RELATION_LABEL: Record<string, string> = {
  "price-up-oi-up": "سعر ↑ + عقد مفتوح ↑",
  "price-up-oi-down": "سعر ↑ + عقد مفتوح ↓",
  "price-down-oi-up": "سعر ↓ + عقد مفتوح ↑",
  "price-down-oi-down": "سعر ↓ + عقد مفتوح ↓",
  flat: "محايد",
};

const FUND_STYLE: Record<string, string> = {
  strongPositive: "text-red-300",
  positive: "text-red-400",
  neutral: "text-zinc-300",
  negative: "text-emerald-400",
  strongNegative: "text-emerald-300",
};

export function FuturesCard({ futures }: { futures: FuturesContext | null }) {
  if (!futures) {
    return (
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 text-center text-zinc-500">
        بيانات العقود الآجلة غير متاحة
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
      <h2 className="mb-4 text-sm font-semibold text-zinc-100">
        تحليل العقود الآجلة (سوق، وليس حساب)
      </h2>

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

      <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
        <p className="text-[11px] text-zinc-500">علاقة السعر / OI (سياق سوق)</p>
        <p className="mt-1 text-sm font-semibold text-zinc-100">
          {OI_RELATION_LABEL[futures.priceOiContext] ?? futures.priceOiContext}
        </p>
        <p className="mt-1 text-[10px] leading-4 text-zinc-500">
          تُستخدم كسياق وليست إشارة مؤكدة للاتجاه.
        </p>
      </div>

      {futures.fundingHistory.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-[11px] text-zinc-500">آخر معدلات الفاندينغ</p>
          <div className="flex flex-wrap gap-1.5">
            {futures.fundingHistory.slice(0, 6).map((f, i) => (
              <span
                key={i}
                className="rounded bg-zinc-900/60 px-2 py-0.5 font-mono text-[10px] text-zinc-300"
              >
                {formatPercent(f.rate, 3)}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function Metric({ label, value, tone, customClass }: { label: string; value: string; tone?: string; customClass?: string }) {
  const toneClass =
    tone === "up"
      ? "text-emerald-400"
      : tone === "down"
      ? "text-red-400"
      : "text-zinc-200";
  return (
    <div className="rounded-lg bg-zinc-950/40 px-3 py-2">
      <p className="text-[10px] text-zinc-500">{label}</p>
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
