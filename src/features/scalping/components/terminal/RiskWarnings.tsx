"use client";

import type { ScalpingExecution, ScalpingSignal } from "../../types";
import { Section, Tag, Dot } from "./TradingPrimitives";

const ENTRY_TONE: Record<ScalpingExecution["entryQuality"], { label: string; tone: "good" | "warn" | "quiet" }> = {
  high: { label: "عالية", tone: "good" },
  medium: { label: "متوسطة", tone: "warn" },
  low: { label: "منخفضة", tone: "warn" },
  none: { label: "لا يوجد", tone: "quiet" },
};

export function RiskWarnings({
  signal,
  execution,
}: {
  signal: ScalpingSignal | null;
  execution: ScalpingExecution | null;
}) {
  const warnings = signal?.warnings ?? [];
  const barriers = execution?.barriers ?? [];
  const hasRisk = warnings.length > 0 || barriers.length > 0;
  const entry = execution ? ENTRY_TONE[execution.entryQuality] : null;

  return (
    <Section
      title="المخاطر والتحذيرات"
      eyebrow="07 · Risk"
      actions={
        entry ? (
          <Tag tone={entry.tone}>جودة الدخول: {entry.label}</Tag>
        ) : (
          <Tag tone="quiet">جودة الدخول: —</Tag>
        )
      }
    >
      {!hasRisk ? (
        <div className="flex items-center gap-2 rounded-panel border border-good/30 bg-good/10 px-3 py-2.5">
          <Dot tone="good" />
          <span className="text-2xs text-good">لا تحذيرات بارزة أو شروط إبطال حالياً.</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {warnings.length > 0 && (
            <div className="rounded-panel border border-warn/40 bg-warn/10 p-3">
              <div className="mb-2 flex items-center gap-1.5 text-2xs font-bold text-warn-fg">
                <Dot tone="warn" /> تحذيرات
              </div>
              <ul className="space-y-1.5">
                {warnings.map((w, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-2xs leading-relaxed text-warn-fg">
                    <span className="mt-1 text-warn-fg">▲</span>
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {barriers.length > 0 && (
            <div className="rounded-panel border border-down/40 bg-down/10 p-3">
              <div className="mb-2 flex items-center gap-1.5 text-2xs font-bold text-down-fg">
                <Dot tone="short" /> شروط تُبطل الإشارة الحالية ({barriers.length})
              </div>
              <ul className="space-y-1.5">
                {barriers.map((b, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-2xs leading-relaxed text-down-fg">
                    <span className="mt-1 text-down-fg">✕</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {execution && (execution.state === "ACTIVE" || execution.state === "WEAKENING" || execution.state === "INVALIDATED") && (
        <div className="mt-3 flex items-center justify-between rounded-panel border border-line bg-surface-2/40 px-3 py-2">
          <span className="text-2xs text-muted">حالة الإشارة</span>
          <Tag tone={execution.state === "ACTIVE" ? "good" : execution.state === "WEAKENING" ? "warn" : "short"}>
            {execution.state === "ACTIVE" ? "نشطة" : execution.state === "WEAKENING" ? "تتراجع" : "مُبطلة"}
          </Tag>
        </div>
      )}
    </Section>
  );
}
