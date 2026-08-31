"use client";

import type { ScalpingForecast, ScalpDirection } from "../../types";
import { Section, Tag, Bar, TONE_TEXT } from "./TradingPrimitives";
import { num } from "@/components/ui/design-tokens";
import { Tip } from "./TerminalTip";

const DIR: Record<ScalpDirection, { text: string; tone: "long" | "short" | "neutral" }> = {
  LONG: { text: "صاعد", tone: "long" },
  SHORT: { text: "هابط", tone: "short" },
  NEUTRAL: { text: "محايد", tone: "neutral" },
};

export function ForecastPanel({ forecast }: { forecast: ScalpingForecast | null }) {
  if (!forecast || forecast.horizons.length === 0) {
    return (
      <Section title="التوقع" eyebrow="06 · Forecast">
        <p className="py-6 text-center text-xs text-muted">لا توقع بعد.</p>
      </Section>
    );
  }

  const dominant = DIR[forecast.dominant];

  return (
    <Section
      title="التوقع"
      eyebrow="06 · Forecast"
      actions={
        <Tip title="عدد الآفاق المتفقة مع الاتجاه السائد من الإجمالي.">
          <Tag tone={dominant.tone}>توافق {forecast.alignment}/{forecast.alignmentTotal}</Tag>
        </Tip>
      }
    >
      <div className="grid grid-cols-3 gap-2">
        {forecast.horizons.map((h) => {
          const dm = DIR[h.direction];
          return (
            <div key={h.key} className="rounded-panel border border-line bg-surface-2/40 p-2.5">
              <div className="flex items-center justify-between">
                <span className="text-2xs text-muted">{h.label}</span>
                <span className={`text-xs font-bold ${TONE_TEXT[dm.tone]}`}>{dm.text}</span>
              </div>
              <div className="mt-2">
                <Bar pct={h.confidence} tone={dm.tone} />
              </div>
              <div className="mt-1.5 flex items-center justify-between">
                <Tip title="درجة توافق العوامل المؤدية لهذا الأفق — قراءة ضغط، وليست احتمال نجاح مضمون.">
                  <span className="text-2xs text-muted">الثقة (توافق)</span>
                </Tip>
                <span className={`font-mono text-xs font-bold ${TONE_TEXT[dm.tone]} ${num}`} dir="ltr">
                  {h.confidence}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-2xs leading-relaxed text-muted">
        كل أفق يتوقع استمرار الضغط اللحظي الحالي فقط — وليست حركة سعر مضمونة. «الثقة» درجة توافق
        العوامل وليست نسبة نجاح.
      </p>
    </Section>
  );
}
