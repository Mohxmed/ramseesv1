"use client";

import type { TechnicalIndicators } from "../types";
import { formatPrice, formatSigned } from "../utils";
import { Card } from "@/components/ui/index";

const signalMeta: Record<
  string,
  { label: string; class: string }
> = {
  bullish: { label: "إيجابي", class: "text-up-fg" },
  bearish: { label: "سلبي", class: "text-down-fg" },
  neutral: { label: "محايد", class: "text-muted" },
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
      <Card className="py-10 text-center text-2xs text-muted">
        المؤشرات الفنية غير متاحة حالياً
      </Card>
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
    <Card title="المؤشرات الفنية">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map(({ key }) => {
          const item = indicators[key];
          const meta = signalMeta[item.signal];
          return (
            <div
              key={key}
              className="flex items-center justify-between rounded-panel border border-line bg-surface-2/30 px-3 py-2.5"
            >
              <div>
                <p className="text-2xs text-muted">{item.label}</p>
                <p className="mt-0.5 text-sm font-semibold text-zinc-100">
                  {formatIndicator(item.label, item.value)}
                </p>
              </div>
              <span className={`text-2xs font-semibold ${meta.class}`}>
                {meta.label}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}