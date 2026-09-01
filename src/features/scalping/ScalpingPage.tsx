"use client";

import { useEffect, useRef, useState } from "react";
import { useScalping } from "./hooks/useScalping";
import { TerminalHeader } from "./components/terminal/TerminalHeader";
import { DecisionCall } from "./components/terminal/DecisionCall";
import { PriceMovePanel } from "./components/terminal/PriceMovePanel";
import { MarketStrengthPanel } from "./components/terminal/MarketStrengthPanel";
import { ExecutionPanel } from "./components/terminal/ExecutionPanel";
import { ForecastPanel } from "./components/terminal/ForecastPanel";
import { ReasonsPanel } from "./components/terminal/ReasonsPanel";
import { RiskPanel } from "./components/terminal/RiskPanel";
import { StatisticalEdge } from "./components/terminal/StatisticalEdge";
import { DiagnosticsContent } from "./components/terminal/DiagnosticsPanel";
import { SystemHealthBar } from "./components/terminal/SystemHealthBar";
import { Section, Collapse } from "./components/terminal/TradingPrimitives";
import { FlowPanel } from "./components/FlowPanel";
import type { FlowSnapshot } from "./flow/types";

/**
 * Fast React boundary for the real-time flow tape.
 *
 * The flow engine publishes the newest snapshot into a module-level ref
 * (`snap.flowLatest`) as soon as it is produced (no render coupling). This
 * wrapper polls that ref on a fast cadence (~80-100ms) into a small local state
 * so ONLY the flow panel re-renders per update â€” the heavy scalping terminal
 * keeps its 1s cadence and no render fires per individual trade.
 */
const FLOW_TAPE_INTERVAL_MS = 64;

function LiveFlowView({ latest }: { latest?: { readonly current: FlowSnapshot | null } | null }) {
  const [flow, setFlow] = useState<FlowSnapshot | null>(() => latest?.current ?? null);
  const lastPublishRef = useRef(0);

  useEffect(() => {
    if (!latest) return;
    const tick = () => {
      const next = latest.current;
      const ts = next?.state?.timestamp ?? 0;
      if (ts !== lastPublishRef.current) {
        lastPublishRef.current = ts;
        setFlow(next);
      }
    };
    tick();
    const timer = setInterval(tick, FLOW_TAPE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [latest]);

  return <FlowPanel snap={flow} />;
}

/**
 * Premium Trading Terminal â€” the scalping page.
 *
 * Information hierarchy (single source of truth per metric):
 *   â•‘ 01 Header (market state monitor)          â€” the "3-second" zone
 *   â•‘ 02-03 Decision + Price Move               â€” one compact row (ATR sub-panel inside Decision)
 *   â•‘ 04-05 Strength / Execution                â€” context + feasibility
 *   â•‘ 07 Forecast / Reasons / Risk              â€” the supporting detail
 *   â•‘ 10 System (compact)
 *
 * Decision-first on mobile: sections stack in DOM order, so the primary call
 * and its direction always lead. No metric is shown twice; every value is
 * rendered directly from the engine snapshot (never recomputed here).
 */
export function ScalpingPage() {
  const snap = useScalping();

  if (snap.health.status === "loading") {
    return (
      <div className="space-y-4">
        <TerminalHeader snap={snap} />
        <div className="rounded-card border border-line bg-surface-1/40 p-10 text-center text-2xs text-muted">
          ط¬ط§ط±ظچ طھط¬ظ‡ظٹط² ط¨ظٹط§ظ†ط§طھ ط§ظ„ط³ظˆظ‚ ط§ظ„ظ…ط¨ط§ط´ط±ط©â€¦
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <TerminalHeader snap={snap} />

      {/* Real-Time AGGR Flow Window â€” vertical LEFT panel + main terminal */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
        {/* left vertical flow panel */}
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <LiveFlowView latest={snap.flowLatest} />
        </aside>

        {/* main terminal content */}
        <div className="space-y-4">
          {/* 02-03 آ· Decision + Price Move â€” compact decision row (ATR sub-panel inside Decision) */}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <DecisionCall decision={snap.decision ?? null} signal={snap.signal} atr={snap.series?.atr ?? null} />
            <PriceMovePanel snap={snap} />
          </div>

          {/* Context: strength + execution */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <MarketStrengthPanel snap={snap} />
            </div>
            <div className="lg:col-span-2 lg:col-start-2">
              <ExecutionPanel snap={snap} />
            </div>
          </div>

          {/* Supporting detail: forecast / reasons / risk */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <ForecastPanel forecast={snap.forecast} />
            </div>
            <div className="lg:col-span-1">
              <ReasonsPanel snap={snap} />
            </div>
            <div className="lg:col-span-1">
              <RiskPanel snap={snap} />
            </div>
          </div>

          {/* Integrity note (kept from the original) */}
          <div className="rounded-card border border-line/70 bg-surface-1/20 p-3 text-2xs leading-relaxed text-muted">
            <strong className="font-semibold text-zinc-400">ط¨ظٹط§ظ†ط§طھ ظˆظ†ط²ط§ظ‡ط©:</strong> ظƒظ„ ط§ظ„ظ‚ظٹظ… ظ…ط£ط®ظˆط°ط© ظ…ظ† ط³ظˆظ‚ ط§ظ„ط¨ظٹطھظƒظˆظٹظ† ظ…ط¨ط§ط´ط±ط©
            (ظ„ط§ ط¨ظٹط§ظ†ط§طھ ط­ط³ط§ط¨). ط§ظ„ظ€ Score ظˆط§ظ„ط«ظ‚ط© ظˆط§ظ„طھظˆظ‚ط¹ط§طھ ظ‡ظٹ <strong className="font-semibold text-zinc-400">ظ‚ط±ط§ط،ط§طھ طھظˆط§ظپظ‚ ط¹ظ„ظ‰
            ط§ظ„ط¶ط؛ط· ط§ظ„ط­ط§ظ„ظٹ</strong>طŒ ظˆظ„ط§ طھظ…ط«ظ„ ط§ط­طھظ…ط§ظ„ط§طھ ظ†ط¬ط§ط­ ظ…ط¶ظ…ظˆظ†ط©ط› ط§ظ„ط§ط­طھظ…ط§ظ„ ط§ظ„ظ…ط¹ط±ظˆط¶ ظ‡ظˆ طھظ‚ط¯ظٹط± طھظˆط§ظپظ‚ ظ…ط§ ظ„ظ… ظٹظڈط´ط±
            ط¥ظ„ظٹظ‡ ظƒظˆظ†ظ‡ آ«ظ…ط­ط³ظˆط¨ط§ظ‹ ظ…ظ† ط§ظ„ظ†طھط§ط¦ط¬آ». آ«ط§ظ„ظ…ط³ط§ظپط© ظ„ظ„ظˆظ‚ظپ/ط§ظ„ظ‡ط¯ظپآ» طھظ‚ط¯ظٹط± ظ…ط¨ظ†ظٹ ط¹ظ„ظ‰ ATR ط§ظ„ط­ظ‚ظٹظ‚ظٹ ظˆظ„ظٹط³طھ ط£ظ…ط±ط§ظ‹ ظپط¹ظ„ظٹط§ظ‹.
            ظ‚ط±ط§ط± NO TRADE ظٹط¸ظ‡ط± ط¹ظ†ط¯ظ…ط§ طھطھط¬ط§ظˆط² ط§ظ„طھظƒظ„ظپط© (ط±ط³ظˆظ…/ط³ط¨ط±ظٹط¯/ط§ظ†ط²ظ„ط§ظ‚) ط§ظ„ط­ط±ظƒط© ط§ظ„ظ…طھظˆظ‚ط¹ط©. ط¹ظ†ط¯ طھط¨ط§ط·ط¤ ط£ظˆ ط§ظ†ظ‚ط·ط§ط¹
            ط§ظ„ط¨ظٹط§ظ†ط§طھ طھطھظˆظ‚ظپ ط§ظ„ط¥ط´ط§ط±ط© ظ„ظ„ط­ظپط§ط¸ ط¹ظ„ظ‰ ط§ظ„ظ†ط²ط§ظ‡ط©.
          </div>

          {/* Advanced layer â€” preserves the reporter/self-eval + full detail (kept from the original) */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <StatisticalEdge decision={snap.decision ?? null} recorder={snap.recorder ?? null} />
            <Section title="ط§ظ„طھظپط§طµظٹظ„ ط§ظ„ظƒط§ظ…ظ„ط©" collapsible snippet={<span className="text-2xs text-muted">ط¹ط±ط¶ ط¬ط¯ظˆظ„ ط§ظ„ظ…طھط؛ظٹط±ط§طھ ظˆط§ظ„ظ…ط±ط§ظƒط² ظ‚ط§ط¨ظ„ط© ظ„ظ„ط·ظٹ</span>}>
              <Collapse summary={<span className="font-semibold">ط¹ط±ط¶ طھظپط§طµظٹظ„ ط§ظ„ظ…طھط؛ظٹط±ط§طھ ظˆط§ظ„ظ…ط±ط§ظƒط²</span>} open={false}>
                <div className="pt-1">
                  <DiagnosticsContent
                    features={snap.features}
                    recorder={snap.recorder ?? null}
                    futuresState={snap.futuresState ?? null}
                  />
                </div>
              </Collapse>
            </Section>
          </div>

          {/* 10 آ· System â€” compact */}
          <SystemHealthBar snap={snap} />
        </div>
      </div>
    </div>
  );
}
