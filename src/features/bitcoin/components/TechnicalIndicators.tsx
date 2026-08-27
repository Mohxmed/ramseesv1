"use client";

import type { TechnicalIndicators } from "../types";
import { formatPrice, formatSigned } from "../utils";

const signalMeta: Record<
  string,
  { label: string; class: string }
> = {
  bullish: { label: "إيجابي", class: "text-emerald-400" },
  bearish: { label: "سلبي", class: "text-red-400" },
  neutral: { label: "محايد", class: "text-zinc-400" },
};

function formatIndicator(label: string, value: number | null): string {
  if (value == null || !isFinite(value)) return "غير متاح";
  switch (label) {
    case "مؤشر القوة النسبية (RSI)":
    case "نسبة التذبذب":
      return value.toFixed(2);
    case "الزخم (20)":
      return formatSigned(value, 2);
    default:
      return formatPrice(value);
  }
}

export function TechnicalIndicatorsCard({
  indicators,
}: {
  indicators: TechnicalIndicators | null;
}) {
  if (!indicators) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 text-center text-zinc-500">
        المؤشرات الفنية غير متاحة حالياً
      </div>
    );
  }

  const rows: { key: keyof TechnicalIndicators }[] = [
    { key: "rsi" },
    { key: "macd" },
    { key: "ema9" },
    { key: "ema21" },
    { key: "ema50" },
    { key: "sma20" },
    { key: "sma50" },
    { key: "sma200" },
    { key: "bollingerUpper" },
    { key: "bollingerMiddle" },
    { key: "bollingerLower" },
    { key: "atr" },
    { key: "vwap" },
    { key: "momentum" },
    { key: "volatility" },
  ];

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
      <h2 className="mb-4 text-sm font-semibold text-zinc-200">
        المؤشرات الفنية
      </h2>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map(({ key }) => {
          const item = indicators[key];
          const meta = signalMeta[item.signal];
          return (
            <div
              key={key}
              className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2.5"
            >
              <div>
                <p className="text-xs text-zinc-500">{item.label}</p>
                <p className="mt-0.5 text-sm font-semibold text-zinc-100">
                  {formatIndicator(item.label, item.value)}
                </p>
              </div>
              <span className={`text-xs font-semibold ${meta.class}`}>
                {meta.label}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
