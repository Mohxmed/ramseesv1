"use client";

import type { ScalpDecisionView, ScalpingSignal } from "../../types";
import { TONE_BORDER, TONE_BG, TONE_TEXT, TONE_BAR, Dot, Tag } from "./TradingPrimitives";
import { num } from "@/components/ui/design-tokens";
import { Tip } from "./TerminalTip";

type CallTone = "long" | "short" | "neutral" | "warn";

const DIR_TONE: Record<string, CallTone> = {
  LONG: "long",
  SHORT: "short",
  NEUTRAL: "neutral",
  NO_TRADE: "warn",
};

const CALL_TEXT: Record<string, string> = {
  LONG: "شراء",
  SHORT: "بيع",
  NEUTRAL: "انتظار",
  NO_TRADE: "انتظار",
};

function strength(score: number | null, dir: ScalpDecisionView["direction"]): {
  label: string;
  tone: CallTone;
} {
  if (dir === "NO_TRADE" || dir === "NEUTRAL") return { label: "لا إشارة", tone: "neutral" };
  if (score == null) return { label: "—", tone: "neutral" };
  if (score >= 70) return { label: "قوية جداً", tone: dir === "LONG" ? "long" : "short" };
  if (score >= 50) return { label: "قوية", tone: dir === "LONG" ? "long" : "short" };
  if (score >= 30) return { label: "متوسطة", tone: "warn" };
  return { label: "ضعيفة", tone: "neutral" };
}

export function DecisionCall({
  decision,
  signal,
}: {
  decision: ScalpDecisionView | null;
  signal: ScalpingSignal | null;
}) {
  if (!decision) {
    return (
      <div className="rounded-card border border-line bg-surface-1/40 p-6 text-center text-xs text-muted">
        لا قرار بعد — بانتظار بيانات السوق.
      </div>
    );
  }

  const dirTone = DIR_TONE[decision.direction] ?? "neutral";
  const score = signal?.score ?? null;
  const sig = strength(score, decision.direction);
  const prob = decision.primaryProbability ?? null;
  const why = (signal?.reasons ?? []).slice(0, 3);

  return (
    <div className={`rounded-card border p-4 ${TONE_BORDER[dirTone]} ${TONE_BG[dirTone]}`}>
      <div className="flex flex-wrap items-center gap-4">
        {/* The call */}
        <div className="min-w-[150px]">
          <div className="text-3xs font-semibold uppercase tracking-[0.2em] text-muted">قرار المضاربة</div>
          <div className={`mt-1 text-4xl font-extrabold leading-none tracking-tight ${TONE_TEXT[dirTone]}`}>
            {CALL_TEXT[decision.direction]}
          </div>
          <div className="mt-2">
            <Tag tone={sig.tone}>
              <Dot tone={sig.tone} />
              قوة الإشارة: {sig.label}
            </Tag>
          </div>
        </div>

        {/* Score */}
        <div className="min-w-[120px]">
          <Tip title="درجة توافق العوامل على هذا الاتجاه من 100 — ليست نسبة نجاح صفقة.">
            <div className="text-3xs font-semibold uppercase tracking-[0.18em] text-muted">درجة القرار</div>
          </Tip>
          <div className={`mt-1 text-5xl font-extrabold leading-none ${TONE_TEXT[dirTone]} ${num}`} dir="ltr">
            {score != null ? score.toFixed(0) : "—"}
          </div>
          <div className="text-2xs text-muted">من 100</div>
        </div>

        {/* Probability (only as agreement — never labelled as hit-rate) */}
        {prob != null && decision.direction !== "NO_TRADE" && decision.direction !== "NEUTRAL" ? (
          <div className="min-w-[110px]">
            <Tip title="نسبة توافق العوامل الحالية — قراءة ضغط، وليست احتمال نجاح مضمون.">
              <div className="text-3xs font-semibold uppercase tracking-[0.18em] text-muted">التوافق</div>
            </Tip>
            <div className={`mt-1 text-3xl font-extrabold leading-none ${TONE_TEXT[dirTone]} ${num}`} dir="ltr">
              {(prob * 100).toFixed(0)}%
            </div>
          </div>
        ) : null}
      </div>

      {/* degree bar */}
      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-line" dir="ltr">
        <div
          className={`h-full rounded-full transition-all duration-500 ${TONE_BAR[dirTone]}`}
          style={{ width: `${score ?? 0}%` }}
        />
      </div>

      {/* short reason */}
      {why.length > 0 ? (
        <div className="mt-3 border-t border-line/70 pt-3">
          <div className="text-3xs font-semibold uppercase tracking-[0.18em] text-muted">السبب المختصر</div>
          <ul className="mt-1.5 space-y-1">
            {why.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-2xs leading-relaxed text-zinc-300">
                <span className={`mt-1.5 h-1 w-1 shrink-0 rounded-full ${TONE_BAR[dirTone]}`} />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {decision.reasonNote ? (
        <p className="mt-3 text-2xs leading-relaxed text-warn-fg">{decision.reasonNote}</p>
      ) : null}
    </div>
  );
}
