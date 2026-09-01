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
      title="أسباب القرار"
     
      collapsible
      snippet={
        <span className="block truncate text-2xs text-zinc-300">
          {top[0] ?? "لا عوامل داعمة كافية حالياً — الضغط متوازن."}
        </span>
      }
    >
      <ul className="space-y-1.5">
        {top.map((r, i) => (
          <li key={i} className="flex items-start gap-2 text-2xs leading-relaxed text-zinc-300">
            <span className="mt-0.5 text-up-fg font-bold">✓</span>
            <span>{r}</span>
          </li>
        ))}
        {top.length === 0 ? (
          <li className="text-2xs text-muted">لا عوامل داعمة كافية حالياً — الضغط متوازن.</li>
        ) : null}
      </ul>

      {hasDetails ? (
        <Collapse summary={<span className="font-semibold">عرض التفاصيل ({rest.length + warnings.length + invalidation.length})</span>} open={false}>
          <div className="space-y-2 pt-1">
            {rest.length > 0 ? (
              <div>
                <div className="mb-1 text-2xs font-semibold text-muted">عوامل إضافية</div>
                <ul className="space-y-1">
                  {rest.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-2xs text-zinc-300">
                      <span className="mt-0.5 text-up-fg">✓</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {warnings.length > 0 ? (
              <div>
                <div className="mb-1 text-2xs font-semibold text-warn-fg">تحذيرات</div>
                <ul className="space-y-1">
                  {warnings.map((w, i) => (
                    <li key={i} className="flex items-start gap-2 text-2xs text-warn-fg">
                      <span className="mt-0.5 font-bold">▲</span>
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {invalidation.length > 0 ? (
              <div>
                <div className="mb-1 text-2xs font-semibold text-down-fg">شروط تُبطل الإشارة</div>
                <ul className="space-y-1">
                  {invalidation.map((b, i) => (
                    <li key={i} className="flex items-start gap-2 text-2xs text-down-fg">
                      <span className="mt-0.5 font-bold">✕</span>
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
