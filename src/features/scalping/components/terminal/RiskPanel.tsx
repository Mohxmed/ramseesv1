"use client";

import type { ScalpingSnapshot } from "../../types";
import { Section, Tag, Dot } from "./TradingPrimitives";
import { num } from "@/components/ui/design-tokens";
import { Tip } from "./TerminalTip";

const LIQ_TONE: Record<string, "good" | "warn" | "short"> = {
  NONE: "good",
  LOW: "good",
  MODERATE: "warn",
  HIGH: "short",
  EXTREME: "short",
};
const LIQ_LABEL: Record<string, string> = {
  NONE: "ظ„ط§ طھطµظپظٹط© ط¨ط§ط±ط²ط©",
  LOW: "ظ…ظ†ط®ظپط¶",
  MODERATE: "ظ…طھظˆط³ط·",
  HIGH: "ظ…ط±طھظپط¹",
  EXTREME: "ط´ط¯ظٹط¯",
};

export function RiskPanel({ snap }: { snap: ScalpingSnapshot }) {
  const atr = snap.series?.atr;
  const cost = snap.decision?.costBps ?? null;
  const futures = snap.futuresState;
  const liqIntensity = futures?.liquidations?.intensity ?? null;
  const liqPressure = futures?.liquidations?.cascade?.active ? "ظ†ط´ط·ط© (ط³ظ„ط³ظ„ط© طھطµظپظٹط©)" : LIQ_LABEL[liqIntensity ?? ""];

  const reason = snap.decision?.reasonNote ?? null;
  const noTrade = snap.decision?.direction === "NO_TRADE";

  // ATR-based estimate of stop/target â€” clearly labelled as an estimate built on
  // the REAL ATR value, not a fabricated or hardcoded number.
  const atrV = atr?.value ?? null;
  const stop = atrV != null ? atrV : null; // stop â‰ˆ 1أ—ATR
  const target = atrV != null ? atrV * 2 : null; // target â‰ˆ 2أ—ATR
  const rr = stop != null && stop > 0 ? 2 : null;

  return (
    <Section
      title="ط§ظ„ظ…ط®ط§ط·ط±"
     
      collapsible
      snippet={
        <div className="flex items-center justify-between gap-3">
          <span className="text-2xs text-muted">ط®ط·ط± ط§ظ„طھطµظپظٹط©</span>
          <Tag tone={liqIntensity ? LIQ_TONE[liqIntensity] ?? "warn" : "neutral"}>
            <Dot tone={liqIntensity ? LIQ_TONE[liqIntensity] ?? "warn" : "neutral"} />
            {liqPressure ?? "ط؛ظٹط± ظ…طھط§ط­"}
          </Tag>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
        <Metric label="ط§ظ„ظ…ط³ط§ظپط© ظ„ظ„ظˆظ‚ظپ" value={atrV != null ? `$${stop!.toFixed(0)} (1أ—ATR)` : "ط؛ظٹط± ظ…طھط§ط­"} hint="طھظ‚ط¯ظٹط± ظ…ط¨ظ†ظٹ ط¹ظ„ظ‰ ATR" tone="warn" ltr />
        <Metric label="ط§ظ„ظ…ط³ط§ظپط© ظ„ظ„ظ‡ط¯ظپ" value={atrV != null ? `$${target!.toFixed(0)} (2أ—ATR)` : "ط؛ظٹط± ظ…طھط§ط­"} hint="طھظ‚ط¯ظٹط± ظ…ط¨ظ†ظٹ ط¹ظ„ظ‰ ATR" tone="good" ltr />
        <Metric label="ظ†ط³ط¨ط© ط§ظ„ط¹ط§ط¦ط¯ ظ„ظ„ظ…ط®ط§ط·ط±ط©" value={rr != null ? `${rr}:1` : "ط؛ظٹط± ظ…طھط§ط­"} hint="ظ‡ط¯ظپ أ· ظˆظ‚ظپ" tone={rr != null && rr >= 2 ? "good" : "warn"} />
        <Metric label="ط®ط·ط± ط§ظ„ط§ظ†ط²ظ„ط§ظ‚" value={cost?.slippage != null ? `${cost.slippage.toFixed(1)} bps` : "ط؛ظٹط± ظ…طھط§ط­"} tone={cost?.slippage != null && cost.slippage > 2 ? "short" : "neutral"} ltr />
      </div>

      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between rounded-panel border border-line bg-surface-2/40 px-3 py-2">
          <Tip title="ط´ط¯ط© ط§ظ„طھطµظپظٹط© ط§ظ„ظ‚ط³ط±ظٹط© ظپظٹ ط§ظ„ط¹ظ‚ظˆط¯ ط§ظ„ط¢ط¬ظ„ط© ط­ط§ظ„ظٹط§ظ‹.">
            <span className="text-2xs text-muted">ط®ط·ط± ط§ظ„طھطµظپظٹط©</span>
          </Tip>
          <Tag tone={liqIntensity ? LIQ_TONE[liqIntensity] ?? "warn" : "neutral"}>
            <Dot tone={liqIntensity ? LIQ_TONE[liqIntensity] ?? "warn" : "neutral"} />
            {liqPressure ?? "ط؛ظٹط± ظ…طھط§ط­"}
          </Tag>
        </div>
        <div className="flex items-center justify-between rounded-panel border border-line bg-surface-2/40 px-3 py-2">
          <span className="text-2xs text-muted">ط­ط§ظ„ط© ط§ظ„ط³ظˆظ‚</span>
          <span className="text-2xs font-bold text-zinc-200">{snap.marketState}</span>
        </div>
      </div>

      {reason ? (
        <div className="mt-3 flex items-start gap-2 rounded-panel border border-down/40 bg-down/10 px-3 py-2">
          <span className="mt-0.5 text-down-fg">âœ•</span>
          <span className="text-2xs leading-relaxed text-down-fg">{reason}</span>
        </div>
      ) : noTrade ? (
        <div className="mt-3 flex items-start gap-2 rounded-panel border border-down/40 bg-down/10 px-3 py-2">
          <span className="mt-0.5 text-down-fg">âœ•</span>
          <span className="text-2xs leading-relaxed text-down-fg">ظ„ط§ طµظپظ‚ط© ظ‚ط§ط¨ظ„ط© ظ„ظ„طھظ†ظپظٹط° ط­ط§ظ„ظٹط§ظ‹.</span>
        </div>
      ) : null}
    </Section>
  );
}

function Metric({
  label,
  value,
  hint,
  tone,
  ltr = false,
}: {
  label: string;
  value: string;
  hint?: string;
  tone: "good" | "warn" | "short" | "neutral";
  ltr?: boolean;
}) {
  const t = tone === "good" ? "text-good" : tone === "warn" ? "text-warn-fg" : tone === "short" ? "text-down-fg" : "text-zinc-300";
  return (
    <div className="flex items-center justify-between border-b border-line/50 py-1.5">
      <div>
        <div className="text-2xs text-muted">{label}</div>
        {hint ? <div className="text-3xs text-muted/70">{hint}</div> : null}
      </div>
      <span dir={ltr ? "ltr" : "auto"} className={`text-xs font-semibold ${t} ${ltr ? num : ""}`}>{value}</span>
    </div>
  );
}
