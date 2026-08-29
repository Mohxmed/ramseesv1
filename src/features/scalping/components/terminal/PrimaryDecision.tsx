"use client";

import type { ScalpDecisionView, ScalpingSignal } from "../../types";
import { Section, Tag, TONE_BORDER, TONE_TEXT, TONE_BG, Dot } from "./TradingPrimitives";

type CallTone = "long" | "short" | "neutral" | "warn";

const DIR_TONE: Record<string, CallTone> = {
  LONG: "long",
  SHORT: "short",
  NEUTRAL: "neutral",
  NO_TRADE: "warn",
};

const CALL_TEXT: Record<string, string> = {
  LONG: "شراء (LONG)",
  SHORT: "بيع (SHORT)",
  NEUTRAL: "محايد",
  NO_TRADE: "لا صفقة (NO TRADE)",
};

/**
 * State of the primary call — a human action label derived from the engine
 * decision (direction + gate). Never a computed value: it is presentation of
 * the decision engine's own output.
 */
function callState(d: ScalpDecisionView): { text: string; tone: CallTone } {
  if (d.direction === "NO_TRADE") return { text: "NO TRADE", tone: "warn" };
  if (d.direction === "NEUTRAL" || d.gate === "data-stale")
    return { text: "WAIT · انتظار", tone: "neutral" };
  return { text: "TRADE · جاهز", tone: d.direction === "LONG" ? "long" : "short" };
}

export function PrimaryDecision({
  decision,
  signal,
}: {
  decision: ScalpDecisionView | null;
  signal: ScalpingSignal | null;
}) {
  if (!decision) {
    return (
      <Section title="القرار الأساسي" eyebrow="01 · Decision">
        <div className="py-6 text-center text-xs text-zinc-500">لا قرار بعد — بانتظار بيانات السوق.</div>
      </Section>
    );
  }

  const dirTone = DIR_TONE[decision.direction] ?? "neutral";
  const state = callState(decision);
  const why = (signal?.reasons ?? []).slice(0, 5);

  return (
    <Section
      title="القرار الأساسي"
      eyebrow="01 · Decision"
      actions={
        <Tag tone={state.tone}>
          <Dot tone={state.tone} />
          {state.text}
        </Tag>
      }
    >
      <div className="flex flex-col gap-4">
        {/* The headline call */}
        <div
          className={`rounded-xl border p-4 ${TONE_BORDER[dirTone]} ${TONE_BG[dirTone]}`}
        >
          <div className="flex items-center justify-between gap-3">
            <span className={`text-2xl font-extrabold tracking-tight ${TONE_TEXT[dirTone]}`} dir="ltr">
              {CALL_TEXT[decision.direction]}
            </span>
            {(decision.longProbability != null || decision.probabilityDirection) && (
              <div className="text-right">
                <div className="text-[9px] text-zinc-500">الاحتمال</div>
                <div className={`font-mono text-xl font-bold ${TONE_TEXT[dirTone]}`} dir="ltr">
                  {decision.primaryProbability != null
                    ? `${(decision.primaryProbability * 100).toFixed(0)}%`
                    : "—"}
                </div>
              </div>
            )}
          </div>

          {decision.reasonNote && (
            <p className="mt-2 text-[11px] leading-relaxed text-zinc-400">{decision.reasonNote}</p>
          )}
        </div>

        {/* WHY — the supporting factors behind the call */}
        <div>
          <div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
            لماذا هذا الاتجاه؟
          </div>
          {why.length ? (
            <ul className="space-y-1.5">
              {why.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-[11px] leading-relaxed text-zinc-300">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-zinc-500" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[11px] text-zinc-500">
              لا عوامل داعمة كافية — الضغط متوازن أو البيانات غير كافية.
            </p>
          )}
        </div>
      </div>
    </Section>
  );
}
