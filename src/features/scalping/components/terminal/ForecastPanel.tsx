"use client";

import type { ScalpingForecast, ScalpDirection } from "../../types";
import { Section, Tag, Bar, TONE_TEXT } from "./TradingPrimitives";
import { num } from "@/components/ui/design-tokens";
import { Tip } from "./TerminalTip";

const DIR: Record<ScalpDirection, { text: string; tone: "long" | "short" | "neutral" }> = {
  LONG: { text: "طµط§ط¹ط¯", tone: "long" },
  SHORT: { text: "ظ‡ط§ط¨ط·", tone: "short" },
  NEUTRAL: { text: "ظ…ط­ط§ظٹط¯", tone: "neutral" },
};

export function ForecastPanel({ forecast }: { forecast: ScalpingForecast | null }) {
  if (!forecast || forecast.horizons.length === 0) {
    return (
      <Section title="ط§ظ„طھظˆظ‚ط¹" collapsible snippet={<span className="text-2xs text-muted">ظ„ط§ طھظˆظ‚ط¹ ط¨ط¹ط¯.</span>}>
        <p className="py-6 text-center text-xs text-muted">ظ„ط§ طھظˆظ‚ط¹ ط¨ط¹ط¯.</p>
      </Section>
    );
  }

  const dominant = DIR[forecast.dominant];

  return (
    <Section
      title="ط§ظ„طھظˆظ‚ط¹"
     
      collapsible
      snippet={
        <div className="flex items-center justify-between gap-3">
          <span className="text-2xs text-muted">ط§ظ„ط§طھط¬ط§ظ‡ ط§ظ„ط³ط§ط¦ط¯</span>
          <Tag tone={dominant.tone}>
            {dominant.text} آ· طھظˆط§ظپظ‚ {forecast.alignment}/{forecast.alignmentTotal}
          </Tag>
        </div>
      }
      actions={
        <Tip title="ط¹ط¯ط¯ ط§ظ„ط¢ظپط§ظ‚ ط§ظ„ظ…طھظپظ‚ط© ظ…ط¹ ط§ظ„ط§طھط¬ط§ظ‡ ط§ظ„ط³ط§ط¦ط¯ ظ…ظ† ط§ظ„ط¥ط¬ظ…ط§ظ„ظٹ.">
          <Tag tone={dominant.tone}>طھظˆط§ظپظ‚ {forecast.alignment}/{forecast.alignmentTotal}</Tag>
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
                <Tip title="ط¯ط±ط¬ط© طھظˆط§ظپظ‚ ط§ظ„ط¹ظˆط§ظ…ظ„ ط§ظ„ظ…ط¤ط¯ظٹط© ظ„ظ‡ط°ط§ ط§ظ„ط£ظپظ‚ â€” ظ‚ط±ط§ط،ط© ط¶ط؛ط·طŒ ظˆظ„ظٹط³طھ ط§ط­طھظ…ط§ظ„ ظ†ط¬ط§ط­ ظ…ط¶ظ…ظˆظ†.">
                  <span className="text-2xs text-muted">ط§ظ„ط«ظ‚ط© (طھظˆط§ظپظ‚)</span>
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
        ظƒظ„ ط£ظپظ‚ ظٹطھظˆظ‚ط¹ ط§ط³طھظ…ط±ط§ط± ط§ظ„ط¶ط؛ط· ط§ظ„ظ„ط­ط¸ظٹ ط§ظ„ط­ط§ظ„ظٹ ظپظ‚ط· â€” ظˆظ„ظٹط³طھ ط­ط±ظƒط© ط³ط¹ط± ظ…ط¶ظ…ظˆظ†ط©. آ«ط§ظ„ط«ظ‚ط©آ» ط¯ط±ط¬ط© طھظˆط§ظپظ‚
        ط§ظ„ط¹ظˆط§ظ…ظ„ ظˆظ„ظٹط³طھ ظ†ط³ط¨ط© ظ†ط¬ط§ط­.
      </p>
    </Section>
  );
}
