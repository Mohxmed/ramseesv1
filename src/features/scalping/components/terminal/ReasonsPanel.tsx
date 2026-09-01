"use client";

import type { ScalpingSnapshot } from "../../types";
import { Section, Collapse } from "./TradingPrimitives";

export function ReasonsPanel({ snap }: { snap: ScalpingSnapshot }) {
  const reasons = snap.signal?.reasons ?? [];
  const warnings = snap.signal?.warnings ?? [];
  const invalidation = snap.execution?.barriers ?? [];

  const top = reasons.slice(0, 5);
  const rest = reasons.slice(5);
  const hasDetails = rest.length > 0 || warnings.length > 0 || invalidation.length > 0;

  return (
    <Section
      title="ط£ط³ط¨ط§ط¨ ط§ظ„ظ‚ط±ط§ط±"
     
      collapsible
      snippet={
        <span className="block truncate text-2xs text-zinc-300">
          {top[0] ?? "ظ„ط§ ط¹ظˆط§ظ…ظ„ ط¯ط§ط¹ظ…ط© ظƒط§ظپظٹط© ط­ط§ظ„ظٹط§ظ‹ â€” ط§ظ„ط¶ط؛ط· ظ…طھظˆط§ط²ظ†."}
        </span>
      }
    >
      <ul className="space-y-1.5">
        {top.map((r, i) => (
          <li key={i} className="flex items-start gap-2 text-2xs leading-relaxed text-zinc-300">
            <span className="mt-0.5 text-up-fg font-bold">âœ“</span>
            <span>{r}</span>
          </li>
        ))}
        {top.length === 0 ? (
          <li className="text-2xs text-muted">ظ„ط§ ط¹ظˆط§ظ…ظ„ ط¯ط§ط¹ظ…ط© ظƒط§ظپظٹط© ط­ط§ظ„ظٹط§ظ‹ â€” ط§ظ„ط¶ط؛ط· ظ…طھظˆط§ط²ظ†.</li>
        ) : null}
      </ul>

      {hasDetails ? (
        <Collapse summary={<span className="font-semibold">ط¹ط±ط¶ ط§ظ„طھظپط§طµظٹظ„ ({rest.length + warnings.length + invalidation.length})</span>} open={false}>
          <div className="space-y-2 pt-1">
            {rest.length > 0 ? (
              <div>
                <div className="mb-1 text-2xs font-semibold text-muted">ط¹ظˆط§ظ…ظ„ ط¥ط¶ط§ظپظٹط©</div>
                <ul className="space-y-1">
                  {rest.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-2xs text-zinc-300">
                      <span className="mt-0.5 text-up-fg">âœ“</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {warnings.length > 0 ? (
              <div>
                <div className="mb-1 text-2xs font-semibold text-warn-fg">طھط­ط°ظٹط±ط§طھ</div>
                <ul className="space-y-1">
                  {warnings.map((w, i) => (
                    <li key={i} className="flex items-start gap-2 text-2xs text-warn-fg">
                      <span className="mt-0.5 font-bold">â–²</span>
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {invalidation.length > 0 ? (
              <div>
                <div className="mb-1 text-2xs font-semibold text-down-fg">ط´ط±ظˆط· طھظڈط¨ط·ظ„ ط§ظ„ط¥ط´ط§ط±ط©</div>
                <ul className="space-y-1">
                  {invalidation.map((b, i) => (
                    <li key={i} className="flex items-start gap-2 text-2xs text-down-fg">
                      <span className="mt-0.5 font-bold">âœ•</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </Collapse>
      ) : null}
    </Section>
  );
}
