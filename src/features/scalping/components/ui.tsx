"use client";

import type { ReactNode } from "react";

export function Panel({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-zinc-200">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function Chip({
  children,
  className = "",
  dir = "auto",
}: {
  children: ReactNode;
  className?: string;
  dir?: "auto" | "ltr" | "rtl";
}) {
  return (
    <span
      dir={dir}
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${className}`}
    >
      {children}
    </span>
  );
}
