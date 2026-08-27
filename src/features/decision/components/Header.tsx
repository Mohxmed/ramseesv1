"use client";

import type { ReactNode } from "react";

export function Header({
  liveConnected,
  updatedAt,
  status,
  onReset,
  onEvaluate,
  onCreate,
  onSave,
  children,
}: {
  liveConnected: boolean | null;
  updatedAt: number;
  status: string;
  onReset: () => void;
  onEvaluate: () => void;
  onCreate: () => void;
  onSave: () => void;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800/60">
            <span className="text-xl">🧭</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-zinc-50">Decision Center</h1>
            <p className="text-[11px] text-zinc-500">مركز القرارات — تحويل البيانات إلى شروط قابلة للتقييم</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-400" dir="ltr">
          <span className="rounded-md border border-zinc-700 bg-zinc-800/60 px-2 py-1 font-mono">BTC/USDT</span>
          <span
            className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 font-semibold ${
              liveConnected
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                : liveConnected === false
                ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                : "border-zinc-700 bg-zinc-800/60 text-zinc-400"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${liveConnected ? "bg-emerald-400" : liveConnected === false ? "bg-amber-400" : "bg-zinc-500"}`} />
            {liveConnected ? "LIVE" : liveConnected === false ? "WS OFF" : "N/A"}
          </span>
          <span className="rounded-md border border-zinc-700 bg-zinc-800/60 px-2 py-1">{status}</span>
          <span className="rounded-md border border-zinc-700 bg-zinc-800/60 px-2 py-1">
            Updated {new Date(updatedAt).toLocaleTimeString("ar", { hour12: false })}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onCreate}
            className="rounded-md border border-zinc-700 bg-zinc-800/60 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:border-zinc-500"
          >
            + Create Strategy
          </button>
          <button
            type="button"
            onClick={onSave}
            className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20"
          >
            Save Strategy
          </button>
          <button
            type="button"
            onClick={onReset}
            className="rounded-md border border-zinc-700 bg-zinc-800/60 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:border-red-500/40"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={onEvaluate}
            className="rounded-md bg-emerald-500/80 px-3 py-1.5 text-xs font-bold text-zinc-950 hover:bg-emerald-400"
          >
            Evaluate Now
          </button>
        </div>
      </div>
      {children}
    </section>
  );
}
