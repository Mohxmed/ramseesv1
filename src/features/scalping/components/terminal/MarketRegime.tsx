"use client";

import type { ScalpDecisionView } from "../../types";
import { REGIME_LABELS } from "../../regime";
import { Section, Tag, Bar, Dot, TONE_TEXT } from "./TradingPrimitives";

const REGIME_TONE: Record<string, "long" | "short" | "neutral" | "warn"> = {
  STRONG_UPTREND: "long",
  UPTREND: "long",
  RANGE: "neutral",
  BREAKOUT: "warn",
  HIGH_VOLATILITY: "warn",
  LOW_VOLATILITY: "neutral",
  DOWNTREND: "short",
  STRONG_DOWNTREND: "short",
  LIQUIDATION_CASCADE: "short",
};

export function MarketRegime({ decision }: { decision: ScalpDecisionView | null }) {
  if (!decision) {
    return (
      <Section title="نظام السوق" eyebrow="03 · Context">
        <p className="py-6 text-center text-xs text-muted">لا قراءة نظام بعد.</p>
      </Section>
    );
  }

  const key = decision.regimeKey;
  const label = REGIME_LABELS[key as keyof typeof REGIME_LABELS] ?? key;
  const tone = REGIME_TONE[key] ?? "neutral";
  const conf = decision.regimeConfidence;
  const drivers = decision.regimeDrivers ?? [];

  return (
    <Section
      title="نظام السوق"
      eyebrow="03 · Context"
      actions={
        <span className="font-mono text-xs tabular-nums text-muted" dir="ltr">
          {conf}%
        </span>
      }
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Dot tone={tone} />
          <Tag tone={tone}>{label}</Tag>
        </div>
      </div>
      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-2xs text-muted">
          <span>ثقة المصنّف</span>
          <span className="font-mono tabular-nums" dir="ltr">{conf}%</span>
        </div>
        <Bar pct={conf} tone={tone} />
      </div>

      {drivers.length > 0 && (
        <div className="mt-4">
          <div className="mb-1.5 text-3xs font-semibold uppercase tracking-[0.18em] text-muted">
            القراءات المحدِّدة للنظام
          </div>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {drivers.map((d) => {
              const dTone: "long" | "short" | "neutral" =
                d.direction === "صاعد" || d.direction === "شراء" ? "long"
                : d.direction === "هابط" || d.direction === "بيع" ? "short"
                : "neutral";
              return (
                <div key={d.key} className="rounded-panel border border-line bg-surface-2/40 px-2.5 py-2">
                  <div className="flex items-center justify-between">
                    <span className="text-2xs text-muted">{d.label}</span>
                    <span className={`text-2xs font-semibold ${TONE_TEXT[dTone]}`}>
                      {d.direction}
                    </span>
                  </div>
                  <div className="mt-1.5">
                    <Bar pct={Math.min(100, Math.abs(d.score) * 50)} tone={dTone} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="mt-3 text-2xs leading-relaxed text-muted">
        يُصنَّف النظام قبل أي إشارة لتطبيق أوزان وعتبات مناسبة للحالة. الثقة هنا درجة حسم
        المصنّف — ليست احتمال نجاح صفقة.
      </p>
    </Section>
  );
}
