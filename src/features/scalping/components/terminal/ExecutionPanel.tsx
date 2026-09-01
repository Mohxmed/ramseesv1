"use client";

import type { ScalpingSnapshot } from "../../types";
import { Section, Tag, Dot } from "./TradingPrimitives";
import { num } from "@/components/ui/design-tokens";
import { Tip } from "./TerminalTip";

function fmtPct(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return "ط؛ظٹط± ظ…طھط§ط­";
  return `${v.toFixed(3)}%`;
}
function fmtBps(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return "ط؛ظٹط± ظ…طھط§ط­";
  return `${v.toFixed(1)} bps`;
}
function fmtDur(ms: number | null | undefined): string {
  if (ms == null || !isFinite(ms)) return "ط؛ظٹط± ظ…طھط§ط­";
  const s = ms / 1000;
  if (s < 60) return `${Math.round(s)}ط«`;
  return `${Math.floor(s / 60)}ط¯ ${Math.round(s % 60)}ط«`;
}

export function ExecutionPanel({ snap }: { snap: ScalpingSnapshot }) {
  const ms = snap.decision?.marketState;
  const cost = snap.decision?.costBps ?? null;
  const execution = snap.execution;
  const ageMs = execution?.signalAgeMs ?? snap.signal?.ageMs ?? null;
  const lat = snap.futuresFeed?.latency ?? null;

  const spread = ms?.spreadPct ?? null;
  const imbalance = ms?.bookImbalance ?? null;
  const slippage = cost?.slippage ?? null;

  // Suitability verdict â€” a presentational synthesis of the real execution
  // inputs above, NOT a new engine computation.
  let verdict: { label: string; tone: "good" | "warn" | "short"; reason: string };
  const spreadH = spread != null && spread * 10000 > 2; // > ~2bps spread
  const slipH = slippage != null && slippage > 2; // > 2bps slippage
  const ageH = ageMs != null && ageMs > 60_000; // signal older than 1m
  if (execution?.entryQuality === "none" || snap.decision?.direction === "NO_TRADE") {
    verdict = { label: "ط؛ظٹط± ظ…ظ†ط§ط³ط¨", tone: "short", reason: "ظ„ط§ طھظˆط¬ط¯ طµظپظ‚ط© ظ‚ط§ط¨ظ„ط© ظ„ظ„طھظ†ظپظٹط° ط­ط§ظ„ظٹط§ظ‹." };
  } else if (spreadH || slipH) {
    verdict = { label: "ط­ط°ط±", tone: "warn", reason: "ط§ظ„ط³ط¨ط±ظٹط¯ ط£ظˆ ط§ظ„ط§ظ†ط²ظ„ط§ظ‚ ظ…ط±طھظپط¹ â€” ظ‚ط¯ طھط£ظƒظ„ ط§ظ„طھظƒظ„ظپط© ط¬ط²ط،ط§ظ‹ ظ…ظ† ط§ظ„ظ…ظƒط³ط¨." };
  } else if (ageH) {
    verdict = { label: "ط­ط°ط±", tone: "warn", reason: "ط¹ظ…ط± ط§ظ„ط¥ط´ط§ط±ط© طھط¬ط§ظˆط² ط¯ظ‚ظٹظ‚ط© â€” ظ‚ط¯ طھظƒظˆظ† ط§ظ„ط¨ظٹط§ظ†ط§طھ ظ‚ط¯ طھط؛ظٹظ‘ط±طھ." };
  } else {
    verdict = { label: "ظ…ظ†ط§ط³ط¨", tone: "good", reason: "ط³ط¨ط±ظٹط¯ ظ…ظ†ط®ظپط¶طŒ طھظƒظ„ظپط© ظ…ظ‚ط¨ظˆظ„ط©طŒ ظˆط¥ط´ط§ط±ط© ط­ط¯ظٹط«ط©." };
  }

  return (
    <Section
      title="ط§ظ„ط³ظٹظˆظ„ط© ظˆط§ظ„طھظ†ظپظٹط°"
     
      collapsible
      snippet={
        <div className="flex items-center justify-between gap-3">
          <span className="text-2xs text-muted">ط§ظ„ط­ظƒظ… ط¹ظ„ظ‰ ط§ظ„طھظ†ظپظٹط°</span>
          <Tag tone={verdict.tone}>
            <Dot tone={verdict.tone} />
            {verdict.label}
          </Tag>
        </div>
      }
      actions={
        <Tip title={verdict.reason}>
          <Tag tone={verdict.tone}>
            <Dot tone={verdict.tone} />
            ط§ظ„طھظ†ظپظٹط° ط§ظ„ط¢ظ†: {verdict.label}
          </Tag>
        </Tip>
      }
    >
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
        <Metric label="ط§ظ„ط³ط¨ط±ظٹط¯" value={fmtPct(spread)} tone={spread != null && spread * 10000 > 2 ? "short" : "neutral"} />
        <Metric label="ط§ط®ظ„ط§ظ„ ط§ظ„ط´ط±ط§ط،/ط§ظ„ط¨ظٹط¹" value={imbalance != null ? imbalance.toFixed(2) : "ط؛ظٹط± ظ…طھط§ط­"} tone={imbalance != null && Math.abs(imbalance) > 0.3 ? "warn" : "neutral"} />
        <Metric label="ط§ظ„ط§ظ†ط²ظ„ط§ظ‚ ط§ظ„ظ…طھظˆظ‚ط¹" value={fmtBps(slippage)} tone={slipH ? "short" : "neutral"} />
        <Metric label="ط¬ظˆط¯ط© ط§ظ„طھظ†ظپظٹط°" value={entryLabel(execution?.entryQuality)} tone={entryTone(execution?.entryQuality)} />
        <Metric label="ط¹ظ…ط± ط§ظ„ط¥ط´ط§ط±ط©" value={fmtDur(ageMs)} tone={ageH ? "warn" : "neutral"} />
        <Metric label="ط²ظ…ظ† ط§ظ„ط§ط³طھط¬ط§ط¨ط© (Latency)" value={lat != null ? `${lat.toFixed(0)}ms` : "ط؛ظٹط± ظ…طھط§ط­"} tone="neutral" />
      </div>

      <p className="mt-3 text-2xs leading-relaxed text-muted">{verdict.reason}</p>
    </Section>
  );
}

const ENTRY_LABEL: Record<string, string> = { high: "ط¹ط§ظ„ظٹط©", medium: "ظ…طھظˆط³ط·ط©", low: "ظ…ظ†ط®ظپط¶ط©", none: "ظ„ط§ ظٹظˆط¬ط¯" };
const ENTRY_TONE: Record<string, "good" | "warn" | "neutral" | "short"> = {
  high: "good",
  medium: "warn",
  low: "warn",
  none: "short",
};

function entryLabel(q: string | undefined): string {
  return q ? ENTRY_LABEL[q] ?? q : "ط؛ظٹط± ظ…طھط§ط­";
}
function entryTone(q: string | undefined): "good" | "warn" | "neutral" | "short" {
  return q ? ENTRY_TONE[q] ?? "neutral" : "neutral";
}

function Metric({ label, value, tone }: { label: string; value: string; tone: "good" | "warn" | "neutral" | "short" }) {
  const t = tone === "good" ? "text-good" : tone === "warn" ? "text-warn-fg" : tone === "short" ? "text-down-fg" : "text-zinc-300";
  return (
    <div className="flex items-center justify-between border-b border-line/50 py-1.5">
      <span className="text-2xs text-muted">{label}</span>
      <span dir="ltr" className={`text-xs font-semibold ${t} ${num}`}>{value}</span>
    </div>
  );
}
