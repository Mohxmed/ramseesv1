"use client";

import Link from "next/link";
import { Status } from "@/components/ui/index";

export function Header({
  liveConnected,
  updatedAt,
  status,
  onEvaluate,
}: {
  liveConnected: boolean | null;
  updatedAt: number;
  status: string;
  onEvaluate: () => void;
}) {
  return (
    <section className="rounded-card border border-line bg-surface-1/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-panel border border-line bg-surface-2/60">
            <span className="text-xl">🧭</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-zinc-100">مركز القرارات</h1>
            <p className="text-2xs text-muted">مركز القرارات — تحويل البيانات إلى شروط قابلة للتقييم</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-2xs text-muted" dir="ltr">
          <span className="rounded-chip border border-line bg-surface-2/60 px-2 py-1 font-mono">BTC/USDT</span>
          <Status
            tone={liveConnected ? "good" : liveConnected === false ? "warn" : "quiet"}
            label={liveConnected ? "LIVE" : liveConnected === false ? "WS OFF" : "N/A"}
          />
          <span className="rounded-chip border border-line bg-surface-2/60 px-2 py-1">{status}</span>
          <span className="rounded-chip border border-line bg-surface-2/60 px-2 py-1">
            تم التحديث {new Date(updatedAt).toLocaleTimeString("ar", { hour12: false })}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/strategies"
            className="rounded-md border border-line bg-surface-2/60 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:border-zinc-500"
          >
            إدارة الاستراتيجيات
          </Link>
          <button
            type="button"
            onClick={onEvaluate}
            className="rounded-md bg-up/80 px-3 py-1.5 text-xs font-bold text-background hover:bg-up-fg"
          >
            تقييم الآن
          </button>
        </div>
      </div>
    </section>
  );
}