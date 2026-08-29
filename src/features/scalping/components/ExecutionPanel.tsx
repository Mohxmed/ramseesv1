"use client";

import type { ScalpingExecution, ScalpSignalState } from "../types";
import { Panel, Chip } from "./ui";

const STATE_META: Record<ScalpSignalState, { label: string; cls: string }> = {
  ACTIVE: { label: "ACTIVE", cls: "border-emerald-500/50 bg-emerald-500/10 text-emerald-300" },
  WEAKENING: { label: "WEAKENING", cls: "border-amber-500/50 bg-amber-500/10 text-amber-300" },
  INVALIDATED: { label: "INVALIDATED", cls: "border-red-500/50 bg-red-500/10 text-red-300" },
  NEUTRAL: { label: "NEUTRAL", cls: "border-zinc-600 bg-zinc-800/40 text-zinc-400" },
};

const ENTRY_META: Record<ScalpingExecution["entryQuality"], { label: string; cls: string }> = {
  high: { label: "عالية", cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" },
  medium: { label: "متوسطة", cls: "border-amber-500/40 bg-amber-500/10 text-amber-300" },
  low: { label: "منخفضة", cls: "border-zinc-600 bg-zinc-800/40 text-zinc-400" },
  none: { label: "لا يوجد", cls: "border-zinc-700 bg-zinc-800/30 text-zinc-500" },
};

function secs(ms: number): string {
  if (ms <= 0) return "0s";
  return `${(ms / 1000).toFixed(0)}s`;
}

export function ExecutionPanel({ execution }: { execution: ScalpingExecution | null }) {
  if (!execution) {
    return (
      <Panel title="EXECUTION STATE — حالة التنفيذ">
        <div className="text-xs text-zinc-500">لم تتوفر حالة تنفيذ بعد.</div>
      </Panel>
    );
  }

  const sm = STATE_META[execution.state];
  const em = ENTRY_META[execution.entryQuality];

  return (
    <Panel title="EXECUTION STATE — حالة التنفيذ">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="الحالة" value={<Chip className={sm.cls}>{sm.label}</Chip>} />
        <Stat label="جودة الدخول" value={<Chip className={em.cls}>{em.label}</Chip>} />
        <Stat label="عمر الإشارة" value={<span className="font-mono text-sm font-bold text-zinc-100" dir="ltr">{secs(execution.signalAgeMs)}</span>} />
        <Stat
          label="شروط الإبطال"
          value={
            <span className={`text-sm font-bold ${execution.invalidationCount > 0 ? "text-red-300" : "text-emerald-300"}`} dir="ltr">
              {execution.invalidationCount}
            </span>
          }
        />
      </div>

      {execution.invalidationCount > 0 && (
        <div className="mt-3 space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">شروط تُبطل الإشارة الحالية</div>
          {execution.barriers.map((b, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-red-200/90">
              <span className="mt-1 text-red-400">✕</span>
              <span>{b}</span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3 text-center">
      <div className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 flex justify-center">{value}</div>
    </div>
  );
}
