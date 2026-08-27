"use client";

import type { ReactNode } from "react";
import type { TriState } from "../types";
import { STATE_META } from "../constants";

/** TRUE / FALSE / UNKNOWN status badge. */
export function StatusChip({ state, size = "md" }: { state: TriState; size?: "sm" | "md" }) {
  const m = STATE_META[state];
  if (!m) return null;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-md border font-mono font-bold ${
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs"
      } ${m.bg} ${m.color}`}
    >
      <span className="text-[0.9em]">{m.icon}</span>
      {m.label}
    </span>
  );
}

export function Card({ title, actions, children, className = "" }: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 ${className}`}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-zinc-200">{title}</h2>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatCell({ label, value, tone }: {
  label: string;
  value: ReactNode;
  tone?: "up" | "down" | "neutral";
}) {
  const color =
    tone === "up" ? "text-emerald-400" : tone === "down" ? "text-red-400" : "text-zinc-100";
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className={`mt-0.5 text-sm font-bold ${color}`} dir="ltr">
        {value}
      </div>
    </div>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 text-center text-xs text-zinc-500">
      {children}
    </div>
  );
}
