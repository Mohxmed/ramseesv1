"use client";

import type { ScalpingForecast, ScalpDirection } from "../../types";
import { Section, Tag, Bar } from "./TradingPrimitives";

const DIR: Record<ScalpDirection, { text: string; tone: "long" | "short" | "neutral" }> = {
  LONG: { text: "LONG", tone: "long" },
  SHORT: { text: "SHORT", tone: "short" },
  NEUTRAL: { text: "NEUTRAL", tone: "neutral" },
};

export function MarketForecast({ forecast }: { forecast: ScalpingForecast | null }) {
  if (!forecast) {
    return (
      <Section title="التوقّع قصير الأمد" eyebrow="04 · Forecast">
        <p className="py-6 text-center text-xs text-muted">لا توقّع بعد.</p>
      </Section>
    );
  }

  const dominant = DIR[forecast.dominant];

  return (
    <Section
      title="التوقّع قصير الأمد"
      eyebrow="04 · Forecast"
      actions={
        <Tag tone={dominant.tone}>
          محاذاة {forecast.alignment}/{forecast.alignmentTotal}
        </Tag>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {forecast.horizons.map((h) => {
          const dm = DIR[h.direction];
          return (
            <div key={h.key} className="rounded-panel border border-line bg-surface-2/40 p-3">
              <div className="flex items-center justify-between">
                <span className="text-2xs font-semibold text-zinc-300">{h.label}</span>
                <Tag tone={dm.tone}>{dm.text}</Tag>
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="font-mono text-2xl font-extrabold text-zinc-50" dir="ltr">
                  {h.score}
                </span>
                <span className="text-xs text-muted">/100</span>
              </div>
              <div className="mt-2">
                <Bar pct={h.score} tone={dm.tone} />
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-2xs text-muted">التوافق</span>
                <span className="font-mono text-2xs tabular-nums text-zinc-300" dir="ltr">
                  {h.confidence}%
                </span>
              </div>
              {h.supporting.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {h.supporting.map((s, i) => (
                    <span key={i} className="rounded-chip bg-surface-2 px-1.5 py-0.5 text-3xs text-muted">
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-2xs leading-relaxed text-muted">
        كل أفق يتنبأ باستمرارية الضغط اللحظي فقط — وليس حركة سعر مضمونة. التوافق مؤشر على
        اتفاق العوامل، وليس نسبة نجاح.
      </p>
    </Section>
  );
}
