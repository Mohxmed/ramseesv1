"use client";

import type { ScalpDecisionView, ScalpingSignal } from "../../types";
import { TONE_BORDER, TONE_TEXT, TONE_BAR, Dot, Tag } from "./TradingPrimitives";
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
      <div className="flex h-full flex-col items-center justify-center rounded-panel border border-line/80 bg-surface-1/40 p-3 text-center text-2xs text-muted">
        بانتظار بيانات السوق لتكوين القرار…
      </div>
    );
  }

  const dirTone = DIR_TONE[decision.direction] ?? "neutral";
  const score = signal?.score ?? null;
  const sig = strength(score, decision.direction);
  const prob = decision.primaryProbability ?? null;
  const reasons = (signal?.reasons ?? []).slice(0, 3);
  const note = reasons[0] ?? decision.reasonNote;
  const noteTone = reasons.length > 0 ? "text-zinc-300" : "text-warn-fg";

  return (
    <div
      className={`flex h-full flex-col rounded-panel border p-3 ${TONE_BORDER[dirTone]} bg-surface-1/40`}
    >
      {/* header */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-3xs font-semibold uppercase tracking-[0.18em] text-muted">
          قرار المضاربة
        </span>
        <Tag tone={sig.tone}>
          <Dot tone={sig.tone} />
          قوة الإشارة: {sig.label}
        </Tag>
      </div>

      {/* call + compact metrics */}
      <div className="mt-2.5 flex items-end justify-between gap-3">
        <span className={`text-2xl font-extrabold leading-none tracking-tight ${TONE_TEXT[dirTone]}`}>
          {CALL_TEXT[decision.direction]}
        </span>
        <div className="flex items-end gap-4 text-left">
          <Tip title="درجة توافق العوامل على هذا الاتجاه من 100 — ليست نسبة نجاح صفقة.">
            <div className="flex flex-col items-end">
              <span className="text-3xs text-muted">درجة القرار</span>
              <span
                className={`${num} mt-0.5 text-lg font-extrabold leading-none ${TONE_TEXT[dirTone]}`}
                dir="ltr"
              >
                {score != null ? score.toFixed(0) : "—"}
                <span className="text-2xs font-normal text-muted">/100</span>
              </span>
            </div>
          </Tip>
          {prob != null && decision.direction !== "NO_TRADE" && decision.direction !== "NEUTRAL" ? (
            <Tip title="نسبة توافق العوامل الحالية — قراءة ضغط، وليست احتمال نجاح مضمون.">
              <div className="flex flex-col items-end">
                <span className="text-3xs text-muted">التوافق</span>
                <span
                  className={`${num} mt-0.5 text-lg font-extrabold leading-none ${TONE_TEXT[dirTone]}`}
                  dir="ltr"
                >
                  {(prob * 100).toFixed(0)}
                  <span className="text-2xs font-normal text-muted">%</span>
                </span>
              </div>
            </Tip>
          ) : null}
        </div>
      </div>

      {/* width of the vote */}
      <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-line" dir="ltr">
        <div
          className={`h-full rounded-full transition-all duration-500 ${TONE_BAR[dirTone]}`}
          style={{ width: `${score ?? 0}%` }}
        />
      </div>

      {/* short reason — one line, truncate */}
      {note ? (
        <p
          className={`mt-2 truncate text-2xs leading-relaxed ${noteTone}`}
          title={typeof note === "string" ? note : undefined}
        >
          {note}
        </p>
      ) : null}
    </div>
  );
}