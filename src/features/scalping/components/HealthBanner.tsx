"use client";

import type { ScalpDataHealth } from "../types";

const META: Record<
  ScalpDataHealth["status"],
  { label: string; cls: string; dot: string }
> = {
  ready: { label: "مباشر", cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300", dot: "bg-emerald-400" },
  stale: { label: "بيانات قديمة (STALE)", cls: "border-amber-500/40 bg-amber-500/10 text-amber-300", dot: "bg-amber-400" },
  disconnected: { label: "غير متصل (DISCONNECTED)", cls: "border-red-500/40 bg-red-500/10 text-red-300", dot: "bg-red-400" },
  loading: { label: "جارٍ التحميل…", cls: "border-zinc-700 bg-zinc-800/40 text-zinc-300", dot: "bg-zinc-400 animate-pulse" },
  error: { label: "خطأ", cls: "border-red-500/40 bg-red-500/10 text-red-300", dot: "bg-red-400" },
};

export function HealthBanner({ health }: { health: ScalpDataHealth }) {
  const m = META[health.status];
  return (
    <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${m.cls}`}>
      <span className={`h-2 w-2 rounded-full ${m.dot}`} />
      <span>
        {health.status === "error" && "message" in health ? "خطأ" : m.label}
      </span>
      {health.status === "stale" && (
        <span className="font-normal opacity-80">— لا تُنتج إشارة جديدة على بيانات قديمة.</span>
      )}
      {health.status === "disconnected" && (
        <span className="font-normal opacity-80">— إعادة الاتصال جارية، لا عرض ثقة زائفة.</span>
      )}
    </div>
  );
}
