"use client";

import Link from "next/link";
import { PageHeader, Status } from "@/components/ui/index";
import { DecisionIcon } from "@/components/icons/icons";

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
    <PageHeader
      eyebrow="Decision Center"
      icon={<DecisionIcon />}
      title="مركز القرارات"
      description="تحويل البيانات إلى شروط قابلة للتقييم"
      actions={
        <>
          <Link
            href="/strategies"
            className="rounded-md border border-line bg-surface-2/60 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:border-zinc-500"
          >
            إدارة الاستراتيجيات
          </Link>
          <button
            type="button"
            onClick={onEvaluate}
            className="rounded-md bg-gold/90 px-3 py-1.5 text-xs font-bold text-background hover:bg-gold-fg"
          >
            تقييم الآن
          </button>
        </>
      }
      right={
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
      }
    />
  );
}