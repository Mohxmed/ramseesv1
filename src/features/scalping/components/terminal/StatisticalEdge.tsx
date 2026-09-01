"use client";

import type { ScalpDecisionView, ScalpRecorderView } from "../../types";
import { Section, Tag, StatRow, Dot, TONE_TEXT } from "./TradingPrimitives";

export function StatisticalEdge({
  decision,
  recorder,
}: {
  decision: ScalpDecisionView | null;
  recorder: ScalpRecorderView | null;
}) {
  const prob = decision?.primaryProbability ?? null;
  const probDir = decision?.probabilityDirection ?? null;
  const probTone: "long" | "short" | "neutral" =
    probDir === "LONG" ? "long" : probDir === "SHORT" ? "short" : "neutral";

  const cost = decision?.costBps ?? null;
  const expMove = decision?.expectedNetMovePct ?? null;

  return (
    <Section
      title="ط§ظ„ط­ط§ظپط© ط§ظ„ط¥ط­طµط§ط¦ظٹط©"
     
      collapsible
      snippet={
        <div className="flex items-center justify-between gap-3">
          <span className="text-2xs text-muted">ط§ظ„ط§ط­طھظ…ط§ظ„ ط§ظ„ط£ط³ط§ط³ظٹ</span>
          <span className={`font-mono text-sm font-bold ${probTone === "long" ? "text-up-fg" : probTone === "short" ? "text-down-fg" : "text-zinc-300"}`} dir="ltr">
            {prob != null ? `${(prob * 100).toFixed(0)}%` : "â€”"}
            {probDir ? <span className="text-muted"> آ· {probDir}</span> : null}
          </span>
        </div>
      }
      actions={
        decision?.probabilityCalibrated ? (
          <Tag tone="good">ظ…ط­ط³ظˆط¨ط© ظ…ظ† ط§ظ„ظ†طھط§ط¦ط¬</Tag>
        ) : (
          <Tag tone="quiet">طھظ‚ط¯ظٹط± طھظˆط§ظپظ‚ (ط؛ظٹط± ظ…ط­ط³ظˆط¨ط©)</Tag>
        )
      }
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Probability + expected edge */}
        <div className="space-y-3">
          <div className="rounded-panel border border-line bg-surface-2/40 p-3">
            <div className="flex items-center justify-between">
              <span className="text-2xs text-muted">ط§ظ„ط§ط­طھظ…ط§ظ„ ط§ظ„ط§طھط¬ط§ظ‡ظٹ ط§ظ„ط£ط³ط§ط³ظٹ</span>
              <Dot tone={probTone} />
            </div>
            <div className="mt-1 font-mono text-3xl font-extrabold text-zinc-50" dir="ltr">
              {prob != null ? `${(prob * 100).toFixed(0)}%` : "â€”"}
              <span className="text-sm text-muted"> آ· {probDir ?? "â€”"}</span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-2xs">
              <div>
                <span className="text-muted">ط´ط±ط§ط،: </span>
                <span className="font-mono tabular-nums text-up-fg" dir="ltr">
                  {`${((decision?.longProbability ?? 0) * 100).toFixed(0)}%`}
                </span>
              </div>
              <div>
                <span className="text-muted">ط¨ظٹط¹: </span>
                <span className="font-mono tabular-nums text-down-fg" dir="ltr">
                  {`${((decision?.shortProbability ?? 0) * 100).toFixed(0)}%`}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-panel border border-line bg-surface-2/40 p-3">
            <div className="text-2xs text-muted">ط§ظ„ط­ط±ظƒط© ط§ظ„ظ…طھظˆظ‚ط¹ط© ظ…ظ‚ط§ط¨ظ„ ط§ظ„طھظƒظ„ظپط©</div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xs text-muted">طµط§ظپظٹ ط§ظ„ط­ط±ظƒط© ط§ظ„ظ…طھظˆظ‚ط¹ط©</span>
              <span
                className={`font-mono text-lg font-bold ${expMove != null && expMove >= 0 ? "text-up-fg" : expMove != null ? "text-down-fg" : "text-muted"}`}
                dir="ltr"
              >
                {expMove != null ? `${expMove.toFixed(3)}%` : "â€”"}
              </span>
            </div>
            {cost ? (
              <div className="mt-2 border-t border-line pt-2 text-2xs">
                <StatRow label="ط§ظ„ط±ط³ظˆظ…" value={`${cost.fee.toFixed(1)} bps`} />
                <StatRow label="ط§ظ„ط³ط¨ط±ظٹط¯" value={`${cost.spread.toFixed(1)} bps`} />
                <StatRow label="ط§ظ„ط§ظ†ط²ظ„ط§ظ‚" value={`${cost.slippage.toFixed(1)} bps`} />
                <StatRow label="ط¥ط¬ظ…ط§ظ„ظٹ ط§ظ„طھظƒظ„ظپط©" value={`${cost.total.toFixed(1)} bps`} strong tone="warn" />
              </div>
            ) : (
              <div className="mt-2 text-2xs text-muted">ظ„ط§ ظ†ظ…ظˆط°ط¬ طھظƒظ„ظپط© ط¨ط¹ط¯.</div>
            )}
          </div>
        </div>

        {/* Recorder self-eval */}
        <div className="rounded-panel border border-line bg-surface-2/40 p-3">
          <div className="mb-2 text-3xs font-semibold uppercase tracking-[0.18em] text-muted">
            ط§ظ„طھظ‚ظٹظٹظ… ط§ظ„ط°ط§طھظٹ (ظ†ط§ظپط°ط© ط§ظ„ط¬ظ„ط³ط©)
          </div>
          {recorder ? (
            <>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                <StatRow label="ط§ظ„ظ‚ط±ط§ط±ط§طھ" value={recorder.count} strong />
                <StatRow label="ط§ظ„ظ…ط­ط³ظˆظ…ط©" value={recorder.resolved} />
                <StatRow label="ط§طھط¬ط§ظ‡ظٹط©" value={recorder.directional} />
                <StatRow label="NO TRADE" value={recorder.noTrade} />
                <StatRow
                  label="ظ…ط¹ط¯ظ„ ط§ظ„ط¥طµط§ط¨ط§طھ"
                  value={recorder.hitRate != null ? `${(recorder.hitRate * 100).toFixed(0)}%` : "â€”"}
                  strong
                />
                <StatRow label="ط®ط·ط£ ط§ظ„طھظ†ط§ط³ط¨" value={recorder.calibrationError != null ? recorder.calibrationError.toFixed(3) : "â€”"} />
                <StatRow label="Brier" value={recorder.brier != null ? recorder.brier.toFixed(3) : "â€”"} />
              </div>
              <div className="mt-3 border-t border-line pt-2">
                <div className="mb-1 text-2xs text-muted">ط­ط³ط¨ ط§ظ„ط§طھط¬ط§ظ‡</div>
                {(["LONG", "SHORT"] as const).map((d) => {
                  const p = recorder.perDirection?.[d];
                  const t: "long" | "short" = d === "LONG" ? "long" : "short";
                  return (
                    <div key={d} className="flex items-center justify-between py-0.5 text-2xs">
                      <span className={`flex items-center gap-1.5 ${TONE_TEXT[t]}`}>
                        <Dot tone={t} /> {d}
                      </span>
                      <span className="font-mono tabular-nums text-zinc-300" dir="ltr">
                        {p?.winRate != null ? `${(p.winRate * 100).toFixed(0)}%` : "â€”"}
                        <span className="text-muted"> ظپظˆط² آ· </span>
                        {p?.meanProbability != null ? `${(p.meanProbability * 100).toFixed(0)}%` : "â€”"}
                        <span className="text-muted"> ط«ظ‚ط© آ· </span>
                        {p?.count ?? 0}
                        <span className="text-muted"> ط¹</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="text-2xs text-muted">ظƒظ…ظٹط© ظƒط§ظپظٹط© ظ…ظ† ط§ظ„ظ‚ط±ط§ط±ط§طھ طھط¸ظ‡ط± ظ‡ظ†ط§ ظ„ط§ط­ظ‚ط§ظ‹.</p>
          )}
        </div>
      </div>

      <p className="mt-3 text-2xs leading-relaxed text-muted">
        ط§ظ„ط§ط­طھظ…ط§ظ„ ط§ظ„ظ…ط¹ط±ظˆط¶ طھظ‚ط¯ظٹط± طھظˆط§ظپظ‚ ط¹ظ„ظ‰ ط§ظ„ط¶ط؛ط· ط§ظ„ط­ط§ظ„ظٹطŒ ظˆظ„ظٹط³ ظ†ط³ط¨ط© ظ†ط¬ط§ط­ ظ…ط¶ظ…ظˆظ†ط©طŒ ظ…ط§ ظ„ظ… ظٹظڈط´ط§ط± ط¥ظ„ظٹظ‡
        ط¨ظˆطµظپظ‡ آ«ظ…ط­ط³ظˆط¨ط§ظ‹ ظ…ظ† ط§ظ„ظ†طھط§ط¦ط¬آ». ظ‚ط±ط§ط± NO TRADE ظٹط¸ظ‡ط± ط­ظٹظ† طھطھط¬ط§ظˆط² ط§ظ„طھظƒظ„ظپط© ط§ظ„ط­ط±ظƒط© ط§ظ„ظ…طھظˆظ‚ط¹ط©.
      </p>
    </Section>
  );
}
