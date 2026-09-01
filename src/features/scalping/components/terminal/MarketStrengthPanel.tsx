"use client";

import type { ScalpingSnapshot } from "../../types";
import { Section } from "./TradingPrimitives";
import { num } from "@/components/ui/design-tokens";
import { Tip } from "./TerminalTip";

function feature(snap: ScalpingSnapshot, key: string) {
  return snap.features?.find((f) => f.key === key);
}

function readingTone(direction: string | undefined, state: string | undefined): "long" | "short" | "neutral" | "warn" {
  if (direction === "bullish") return "long";
  if (direction === "bearish") return "short";
  if (state === "strong" || state === "moderate") return "warn";
  return "neutral";
}

function readingLabel(direction: string | undefined, state: string | undefined): string {
  if (direction === "bullish") return "طµط§ط¹ط¯";
  if (direction === "bearish") return "ظ‡ط§ط¨ط·";
  if (state === "strong") return "ظ‚ظˆظٹ";
  if (state === "moderate") return "ظ…طھظˆط³ط·";
  if (state === "weak") return "ط¶ط¹ظٹظپ";
  return "ظ…ط­ط§ظٹط¯";
}

const TONE_TXT: Record<"long" | "short" | "neutral" | "warn", string> = {
  long: "text-up-fg",
  short: "text-down-fg",
  neutral: "text-zinc-300",
  warn: "text-warn-fg",
};

function Row({
  label,
  tooltip,
  value,
  tone,
  ltr = false,
}: {
  label: string;
  tooltip?: string;
  value: string;
  tone: "long" | "short" | "neutral" | "warn";
  ltr?: boolean;
}) {
  const inner = <span className="text-2xs text-muted">{label}</span>;
  return (
    <div className="flex items-center justify-between rounded-panel border border-line bg-surface-2/40 px-3 py-2">
      {tooltip ? <Tip title={tooltip}>{inner}</Tip> : inner}
      <span dir={ltr ? "ltr" : "auto"} className={`text-2xs font-bold ${TONE_TXT[tone]} ${ltr ? num : ""}`}>
        {value}
      </span>
    </div>
  );
}

export function MarketStrengthPanel({ snap }: { snap: ScalpingSnapshot }) {
  const ms = snap.decision?.marketState;
  const futures = snap.futuresState;

  const trend = feature(snap, "market-regime");
  const momentum = feature(snap, "micro-momentum");
  const volume = feature(snap, "volume-delta");

  const cvd = ms?.cvd ?? null;
  const takerBuy = ms?.takerBuyRatio ?? null;

  const liqLong = futures?.liquidations?.long?.notional ?? null;
  const liqShort = futures?.liquidations?.short?.notional ?? null;

  return (
    <Section
      title="ظ‚ظˆط© ط§ظ„ط³ظˆظ‚"
     
      collapsible
      snippet={
        <div className="flex items-center justify-between gap-3">
          <span className="text-2xs text-muted">ط§طھط¬ط§ظ‡ ط§ظ„ط³ظˆظ‚</span>
          <span className={`text-2xs font-bold ${TONE_TXT[readingTone(trend?.direction, trend?.state)]}`}>
            {trend ? readingLabel(trend.direction, trend.state) : "ط؛ظٹط± ظ…طھط§ط­"}
          </span>
        </div>
      }
    >
      <div className="space-y-2">
        <Row
          label="ط§طھط¬ط§ظ‡ ط§ظ„ط³ظˆظ‚"
          tooltip="ط§ظ„ط§طھط¬ط§ظ‡ ط§ظ„ط¹ط§ظ… ط¨ظ†ط§ط،ظ‹ ط¹ظ„ظ‰ ظ‚ط±ط§ط،ط© ظ†ط¸ط§ظ… ط§ظ„ط³ظˆظ‚."
          value={trend ? readingLabel(trend.direction, trend.state) : "ط؛ظٹط± ظ…طھط§ط­"}
          tone={readingTone(trend?.direction, trend?.state)}
        />
        <Row
          label="ط§ظ„ط²ط®ظ…"
          tooltip="ظ‚ظˆط© ط§ظ„ط¯ظپط¹ ط§ظ„ظ„ط­ط¸ظٹط© ظ„ظ„ط³ط¹ط±."
          value={momentum ? readingLabel(momentum.direction, momentum.state) : "ط؛ظٹط± ظ…طھط§ط­"}
          tone={readingTone(momentum?.direction, momentum?.state)}
        />
        <Row
          label="ط­ط¬ظ… ط§ظ„طھط¯ط§ظˆظ„"
          tooltip="ظ…ط³طھظˆظ‰ ط­ط¬ظ… ط§ظ„طھط¯ط§ظˆظ„ ظ…ظ‚ط§ط±ظ†ط©ظ‹ ط¨ط§ظ„ظ…ط¹طھط§ط¯."
          value={volume ? readingLabel(volume.direction, volume.state) : "ط؛ظٹط± ظ…طھط§ط­"}
          tone={readingTone(volume?.direction, volume?.state)}
        />
        <Row
          label="طھط¯ظپظ‚ ط§ظ„ط´ط±ط§ط،/ط§ظ„ط¨ظٹط¹"
          tooltip="ظ†ط³ط¨ط© ط­طµط© ط§ظ„ظ…ط´طھط±ظٹظ† ط§ظ„ظ†ط´ط·ظٹظ† ظ…ظ† ط¥ط¬ظ…ط§ظ„ظٹ ط§ظ„ط­ط¬ظ… (ظپظˆظ‚ 50% = ظ…ظٹظ„ ط´ط±ط§ط¦ظٹ)."
          value={takerBuy != null ? `${(takerBuy * 100).toFixed(0)}% ط´ط±ط§ط،` : "ط؛ظٹط± ظ…طھط§ط­"}
          tone={takerBuy != null && takerBuy > 0.5 ? "long" : takerBuy != null ? "short" : "neutral"}
          ltr
        />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="rounded-panel border border-line bg-surface-2/40 px-3 py-2">
          <Tip title="CVD = طµط§ظپظٹ ط§ظ„ط­ط¬ظ… ط§ظ„طھط±ط§ظƒظ…ظٹ ظ„ظ„طµظپظ‚ط§طھ ط§ظ„ظ†ط´ط·ط© (ط´ط±ط§ط، - ط¨ظٹط¹) ظپظٹ ط§ظ„ظ†ط§ظپط°ط©.">
            <div className="text-2xs text-muted">CVD (طµط§ظپظٹ ط§ظ„طھط¯ظپظ‚)</div>
          </Tip>
          <div className={`mt-1 text-lg font-extrabold ${num} ${cvd != null && cvd > 0 ? "text-up-fg" : cvd != null ? "text-down-fg" : "text-muted"}`} dir="ltr">
            {cvd != null ? `${cvd >= 0 ? "+" : ""}${cvd.toFixed(0)}` : "ط؛ظٹط± ظ…طھط§ط­"}
          </div>
        </div>
        <div className="rounded-panel border border-line bg-surface-2/40 px-3 py-2">
          <Tip title="ظ‚ظٹظ…ط© ط§ظ„طھطµظپظٹط© ط§ظ„ظ‚ط³ط±ظٹط© ظپظٹ ط§ظ„ط¹ظ‚ظˆط¯ ط§ظ„ط¢ط¬ظ„ط©: Long طھظڈطµظپظ‘ظ‰ ظ…ط±ط§ظƒط² ط§ظ„ط´ط±ط§ط،طŒ Short طھظڈطµظپظ‘ظ‰ ظ…ط±ط§ظƒط² ط§ظ„ط¨ظٹط¹.">
            <div className="text-2xs text-muted">ط§ظ„طھطµظپظٹط© (Long / Short)</div>
          </Tip>
          <div className="mt-1 flex items-baseline gap-2">
            <span className={`text-sm font-extrabold ${num} ${liqLong != null && liqLong > 0 ? "text-up-fg" : "text-muted"}`} dir="ltr">
              {liqLong != null ? compact(liqLong) : "â€”"}
            </span>
            <span className="text-2xs text-muted">/</span>
            <span className={`text-sm font-extrabold ${num} ${liqShort != null && liqShort > 0 ? "text-down-fg" : "text-muted"}`} dir="ltr">
              {liqShort != null ? compact(liqShort) : "â€”"}
            </span>
          </div>
        </div>
      </div>
    </Section>
  );
}

function compact(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return "â€”";
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(v);
}
