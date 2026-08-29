"use client";

import type { ScalpingFeature } from "../types";
import { Panel } from "./ui";

function Fresh({ ms }: { ms: number | null }) {
  if (ms == null) return <span className="text-[10px] text-zinc-600">—</span>;
  const s = (ms / 1000).toFixed(0);
  const fresh = ms < 15_000;
  return (
    <span className={`font-mono text-[10px] ${fresh ? "text-zinc-400" : "text-amber-400"}`} dir="ltr">
      {s}s
    </span>
  );
}

function DirChip({ dir }: { dir: ScalpingFeature["direction"] }) {
  const cls =
    dir === "bullish"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
      : dir === "bearish"
      ? "border-red-500/40 bg-red-500/10 text-red-300"
      : "border-zinc-600 bg-zinc-800/40 text-zinc-400";
  const label = dir === "bullish" ? "صاعد" : dir === "bearish" ? "هابط" : "محايد";
  return <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${cls}`}>{label}</span>;
}

function StateChip({ state }: { state: ScalpingFeature["state"] }) {
  const cls =
    state === "strong"
      ? "text-emerald-300"
      : state === "moderate"
      ? "text-amber-300"
      : state === "unknown"
      ? "text-zinc-500"
      : "text-zinc-400";
  const label =
    state === "strong" ? "قوي" : state === "moderate" ? "متوسط" : state === "weak" ? "ضعيف" : "غير معروف";
  return <span className={`text-[10px] font-bold ${cls}`}>{label}</span>;
}

function fmtRaw(f: ScalpingFeature): string {
  if (f.raw == null) return "—";
  const v = Number.isInteger(f.raw) ? f.raw.toFixed(0) : f.raw.toFixed(2);
  return `${v}${f.unit ? " " + f.unit : ""}`;
}

export function FeatureTable({ features, stale }: { features: ScalpingFeature[]; stale: boolean }) {
  return (
    <Panel
      title="أهم 10 متغيرات — المضاربة"
      actions={
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] text-zinc-500 sm:flex sm:gap-3">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-400" /> صاعد</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-400" /> هابط</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-zinc-500" /> محايد</span>
        </div>
      }
    >
      {stale && (
        <div className="mb-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2 text-[11px] text-amber-200/90">
          البيانات قديمة — المتغيرات أدناه من آخر لقطة، ولا يُعتمد عليها لإشارة جديدة.
        </div>
      )}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {features.map((f) => (
          <div key={f.key} className={`rounded-xl border p-3 ${f.stale ? "border-amber-500/20 opacity-70" : "border-zinc-800 bg-zinc-950/40"}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[11px] font-semibold text-zinc-200">{f.label}</span>
              <Fresh ms={f.freshnessMs} />
            </div>
            <div className="mt-1.5 flex items-baseline justify-between gap-2">
              <span className="font-mono text-lg font-bold text-zinc-50" dir="ltr">
                {fmtRaw(f)}
              </span>
              <DirChip dir={f.direction} />
            </div>
            <div className="mt-1 flex items-center justify-between gap-2">
              <StateChip state={f.state} />
              <span className="text-[10px] text-zinc-500" dir="ltr">
                السكور {f.score}
              </span>
            </div>
            <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-zinc-800">
              <div
                className={`h-full rounded-full ${
                  f.direction === "bullish"
                    ? "bg-emerald-500"
                    : f.direction === "bearish"
                    ? "bg-red-500"
                    : "bg-zinc-600"
                }`}
                style={{ width: `${f.score}%` }}
              />
            </div>
            <div className="mt-1 truncate text-[10px] text-zinc-500" title={f.description}>
              {f.description}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
