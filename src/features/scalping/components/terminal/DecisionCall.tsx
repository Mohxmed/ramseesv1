"use client";

import type { ScalpDecisionView, ScalpPriceSeries, ScalpingSignal } from "../../types";
import { TONE_BORDER, TONE_TEXT, TONE_BAR, Dot, Tag, Section, Tone } from "./TradingPrimitives";
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
  LONG: "ط´ط±ط§ط،",
  SHORT: "ط¨ظٹط¹",
  NEUTRAL: "ط§ظ†طھط¸ط§ط±",
  NO_TRADE: "ط§ظ†طھط¸ط§ط±",
};

type VolLevel = "low" | "normal" | "high" | "severe";

const LEVEL_META: Record<VolLevel, { label: string; tone: Tone }> = {
  low: { label: "ظ…ظ†ط®ظپط¶", tone: "good" },
  normal: { label: "ط·ط¨ظٹط¹ظٹ", tone: "neutral" },
  high: { label: "ظ…ط±طھظپط¹", tone: "warn" },
  severe: { label: "ط´ط¯ظٹط¯", tone: "short" },
};

const VALUE_TONE: Record<VolLevel, string> = {
  low: "text-up-fg",
  normal: "text-zinc-300",
  high: "text-warn-fg",
  severe: "text-down-fg",
};

/**
 * Presentational banding of ATR (as % of price) into a relative scalp-volatility
 * label. The ATR number itself is real (from the 1m candle series); only this
 * human label is a relative classification, explained in the tooltip.
 */
function classifyAtr(atrPct: number | null): VolLevel {
  if (atrPct == null) return "normal";
  const p = Math.abs(atrPct);
  if (p >= 0.35) return "severe";
  if (p >= 0.18) return "high";
  if (p <= 0.05) return "low";
  return "normal";
}

function strength(score: number | null, dir: ScalpDecisionView["direction"]): {
  label: string;
  tone: CallTone;
} {
  if (dir === "NO_TRADE" || dir === "NEUTRAL") return { label: "ظ„ط§ ط¥ط´ط§ط±ط©", tone: "neutral" };
  if (score == null) return { label: "â€”", tone: "neutral" };
  if (score >= 70) return { label: "ظ‚ظˆظٹط© ط¬ط¯ط§ظ‹", tone: dir === "LONG" ? "long" : "short" };
  if (score >= 50) return { label: "ظ‚ظˆظٹط©", tone: dir === "LONG" ? "long" : "short" };
  if (score >= 30) return { label: "ظ…طھظˆط³ط·ط©", tone: "warn" };
  return { label: "ط¶ط¹ظٹظپط©", tone: "neutral" };
}

/** Compact ATR sub-panel â€” embedded below the decision instead of a standalone card. */
function AtrStrip({ atr }: { atr: ScalpPriceSeries["atr"] }) {
  const level = classifyAtr(atr?.pct ?? null);
  const meta = LEVEL_META[level];

  return (
    <div className="mt-2.5 rounded-md border border-line/80 bg-surface-2/30 px-2.5 py-2">
      {/* header: label + status */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-3xs font-semibold uppercase tracking-[0.18em] text-muted">
          ط§ظ„طھط°ط¨ط°ط¨ (ATR 1ظ…)
        </span>
        <Tip title="ظ…ط¯ظ‰ ط§ظ„ط­ط±ظƒط© ط§ظ„ظ†ظ…ظˆط°ط¬ظٹ ظ„ط´ظ…ط¹ط© ط§ظ„ط¯ظ‚ظٹظ‚ط© (ظ…طھظˆط³ط· ط§ظ„ظ…ط¯ظ‰ ط§ظ„ط­ظ‚ظٹظ‚ظٹ) â€” ط§ظ„ظ…ط³طھظˆظ‰ طھطµظ†ظٹظپ ظ†ط³ط¨ظٹ ظ„ظ…ط¶ط§ط±ط¨ط© ط§ظ„ط¯ظ‚ط§ط¦ظ‚.">
          <Tag tone={meta.tone}>{meta.label}</Tag>
        </Tip>
      </div>

      {/* ATR absolute + as % of price */}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="rounded-panel border border-line bg-surface-1/30 px-2 py-1.5">
          <div className="text-3xs text-muted">ATR ط§ظ„ط­ط§ظ„ظٹ</div>
          <div className={`${num} mt-0.5 text-base font-extrabold leading-none text-zinc-50`} dir="ltr">
            {atr?.value != null ? `$${atr.value.toFixed(2)}` : "ط؛ظٹط± ظ…طھط§ط­"}
          </div>
          <div className="mt-1 text-3xs text-muted">ظ„ظƒظ„ ط´ظ…ط¹ط© {atr?.frameLabel ?? "â€”"}</div>
        </div>
        <div className="rounded-panel border border-line bg-surface-1/30 px-2 py-1.5">
          <div className="text-3xs text-muted">ظ†ط³ط¨ط© ظ…ظ† ط§ظ„ط³ط¹ط±</div>
          <div className={`${num} mt-0.5 text-base font-extrabold leading-none ${VALUE_TONE[level]}`} dir="ltr">
            {atr?.pct != null ? `${atr.pct.toFixed(3)}%` : "ط؛ظٹط± ظ…طھط§ط­"}
          </div>
          <div className="mt-1 text-3xs text-muted">ط¹ظ„ظ‰ {atr?.period ?? 0} ط´ظ…ط¹ط©</div>
        </div>
      </div>
    </div>
  );
}

export function DecisionCall({
  decision,
  signal,
  atr,
}: {
  decision: ScalpDecisionView | null;
  signal: ScalpingSignal | null;
  atr: ScalpPriceSeries["atr"];
}) {
  if (!decision) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-panel border border-line/80 bg-surface-1/40 p-3 text-center text-2xs text-muted">
        ط¨ط§ظ†طھط¸ط§ط± ط¨ظٹط§ظ†ط§طھ ط§ظ„ط³ظˆظ‚ ظ„طھظƒظˆظٹظ† ط§ظ„ظ‚ط±ط§ط±â€¦
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
    <Section
      title="ظ‚ط±ط§ط± ط§ظ„ظ…ط¶ط§ط±ط¨ط©"
     
      collapsible
      className={`h-full flex flex-col ${TONE_BORDER[dirTone]}`}
      snippet={
        <div className="flex items-center justify-between gap-3">
          <span className="text-2xs text-muted">ط§ظ„ظ‚ط±ط§ط±</span>
          <span className={`text-xs font-bold ${TONE_TEXT[dirTone]}`}>
            {CALL_TEXT[decision.direction]}
            {score != null ? <span className="font-mono text-zinc-300"> آ· {score.toFixed(0)}/100</span> : null}
          </span>
        </div>
      }
      actions={
        <Tag tone={sig.tone}>
          <Dot tone={sig.tone} />
          ظ‚ظˆط© ط§ظ„ط¥ط´ط§ط±ط©: {sig.label}
        </Tag>
      }
      bodyClassName="flex-1 flex flex-col"
    >
      {/* call + compact metrics */}
      <div className="mt-2.5 flex items-end justify-between gap-3">
        <span className={`text-2xl font-extrabold leading-none tracking-tight ${TONE_TEXT[dirTone]}`}>
          {CALL_TEXT[decision.direction]}
        </span>
        <div className="flex items-end gap-4 text-left">
          <Tip title="ط¯ط±ط¬ط© طھظˆط§ظپظ‚ ط§ظ„ط¹ظˆط§ظ…ظ„ ط¹ظ„ظ‰ ظ‡ط°ط§ ط§ظ„ط§طھط¬ط§ظ‡ ظ…ظ† 100 â€” ظ„ظٹط³طھ ظ†ط³ط¨ط© ظ†ط¬ط§ط­ طµظپظ‚ط©.">
            <div className="flex flex-col items-end">
              <span className="text-3xs text-muted">ط¯ط±ط¬ط© ط§ظ„ظ‚ط±ط§ط±</span>
              <span
                className={`${num} mt-0.5 text-lg font-extrabold leading-none ${TONE_TEXT[dirTone]}`}
                dir="ltr"
              >
                {score != null ? score.toFixed(0) : "â€”"}
                <span className="text-2xs font-normal text-muted">/100</span>
              </span>
            </div>
          </Tip>
          {prob != null && decision.direction !== "NO_TRADE" && decision.direction !== "NEUTRAL" ? (
            <Tip title="ظ†ط³ط¨ط© طھظˆط§ظپظ‚ ط§ظ„ط¹ظˆط§ظ…ظ„ ط§ظ„ط­ط§ظ„ظٹط© â€” ظ‚ط±ط§ط،ط© ط¶ط؛ط·طŒ ظˆظ„ظٹط³طھ ط§ط­طھظ…ط§ظ„ ظ†ط¬ط§ط­ ظ…ط¶ظ…ظˆظ†.">
              <div className="flex flex-col items-end">
                <span className="text-3xs text-muted">ط§ظ„طھظˆط§ظپظ‚</span>
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

      {/* short reason â€” one line, truncate */}
      {note ? (
        <p
          className={`mt-2 truncate text-2xs leading-relaxed ${noteTone}`}
          title={typeof note === "string" ? note : undefined}
        >
          {note}
        </p>
      ) : null}

      {/* ATR sub-panel â€” current 1m volatility under the decision */}
      <div className="mt-auto pt-2.5">
        <AtrStrip atr={atr} />
      </div>
    </Section>
  );
}