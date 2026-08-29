"use client";

import type { ScalpDecisionView, ScalpingSignal } from "../../types";
import { Section, Tag, Dot, TONE_BAR, TONE_TEXT, TONE_DOT } from "./TradingPrimitives";

type FamilyKey = "price-action" | "flow" | "positioning" | "structure";

const FAMILIES: { key: FamilyKey; label: string }[] = [
  { key: "price-action", label: "حركة السعر" },
  { key: "flow", label: "تدفق" },
  { key: "positioning", label: "مراكز" },
  { key: "structure", label: "بنيان" },
];

export function DirectionalScore({
  signal,
  decision,
}: {
  signal: ScalpingSignal | null;
  decision?: ScalpDecisionView | null;
}) {
  // SINGLE source of truth for the headline magnitude: the engine signal score.
  const score = signal?.score ?? null;
  // Direction is the decision engine's call (LONG/SHORT/NO_TRADE); the magnitude
  // shown is still the signal score, never recomputed.
  const dir = decision?.direction === "NO_TRADE" ? "NEUTRAL" : (decision?.direction ?? signal?.direction ?? "NEUTRAL");
  const tone: "long" | "short" | "neutral" =
    dir === "LONG" ? "long" : dir === "SHORT" ? "short" : "neutral";

  const familyVotes = (signal?.familyVotes ?? {}) as Partial<Record<FamilyKey, number>>;

  return (
    <Section
      title="إجمالي الاتجاه (Score)"
      eyebrow="02 · Direction"
      actions={
        <Tag tone={tone}>
          <Dot tone={tone} />
          {dir === "LONG" ? "LONG" : dir === "SHORT" ? "SHORT" : "NEUTRAL"}
        </Tag>
      }
    >
      <div className="flex items-end gap-4">
        <div className="font-mono text-6xl font-extrabold leading-none tracking-tight text-zinc-50" dir="ltr">
          {score != null ? score.toFixed(0) : "—"}
          <span className="text-2xl text-zinc-500">/100</span>
        </div>
        <div className="pb-1">
          <Tag tone={tone}>{tone === "long" ? "اتجاه صاعد" : tone === "short" ? "اتجاه هابط" : "محايد"}</Tag>
        </div>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-zinc-800" dir="ltr">
        <div
          className={`h-full rounded-full transition-all duration-500 ${TONE_BAR[tone]}`}
          style={{ width: `${score ?? 0}%` }}
        />
      </div>
      <p className="mt-2 text-[10px] leading-relaxed text-zinc-600">
        الدرجة = الضغط الصافي بعد تجميع العوامل على مستوى العائلات — ليست احتمال نجاح،
        وليست إعادة حساب: تعرض نفس ناتج محرّك الإشارة.
      </p>

      {/* Family contributors — how the score decomposes */}
      <div className="mt-4 space-y-2.5">
        <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
          مساهمة العائلات
        </div>
        {FAMILIES.map((f) => {
          const v = familyVotes[f.key] ?? 0;
          const mag = Math.min(100, Math.abs(v) * 100);
          const familyTone: "long" | "short" | "neutral" = v > 0.001 ? "long" : v < -0.001 ? "short" : "neutral";
          return (
            <div key={f.key} className="flex items-center gap-3">
              <span className="w-20 shrink-0 text-[10px] text-zinc-500">{f.label}</span>
              <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800" dir="ltr">
                <div
                  className={`absolute left-1/2 top-0 h-full w-px bg-zinc-700`}
                />
                <div
                  className={`absolute top-0 h-full rounded-full ${TONE_BAR[familyTone]}`}
                  style={{
                    width: `${mag}%`,
                    left: v >= 0 ? "50%" : `${50 - mag}%`,
                  }}
                />
              </div>
              <span className={`w-8 shrink-0 text-left font-mono text-[10px] tabular-nums ${TONE_TEXT[familyTone]}`} dir="ltr">
                {v.toFixed(2)}
              </span>
            </div>
          );
        })}
        <div className="mt-1 flex items-center justify-between text-[9px] text-zinc-600">
          <span className="flex items-center gap-1">
            <span className={`h-1.5 w-1.5 rounded-full ${TONE_DOT.long}`} /> شراء
          </span>
          <span className="flex items-center gap-1">
            <span className={`h-1.5 w-1.5 rounded-full ${TONE_DOT.short}`} /> بيع
          </span>
          <span>النطاق −1…+1</span>
        </div>
      </div>
    </Section>
  );
}
