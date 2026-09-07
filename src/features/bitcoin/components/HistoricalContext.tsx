"use client";

import { buildContextStats } from "../intelligence";
import type { BtcCandle, FuturesContext } from "../types";
import { Badge, Card, Progress } from "@/components/ui/index";

export function HistoricalContext({
  candles,
  futures,
}: {
  candles: BtcCandle[];
  futures: FuturesContext | null;
}) {
  const stats = buildContextStats({
    candles,
    candlesTf: "30 دقيقة",
    futures,
  });

  return (
    <Card
      title="السياق التاريخي (ضمن البيانات المتاحة)"
      actions={<Badge tone="quiet">نافذة قصيرة</Badge>}
      className="h-full"
    >
      <div className="space-y-3">
        {stats.map((s) => (
          <div key={s.id} className="rounded-panel border border-line bg-surface-2/30 px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-2xs text-zinc-400">{s.label}</p>
              <p dir="ltr" className="text-sm font-bold tabular-nums text-zinc-100">
                {s.value}
              </p>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <Progress pct={s.percentile ?? 0} tone="neutral" className="flex-1" />
              <span dir="ltr" className="w-9 text-2xs tabular-nums text-zinc-400">
                {s.percentile != null ? `${Math.round(s.percentile)}%` : "—"}
              </span>
            </div>
            <p className="mt-1 text-2xs text-muted">
              {s.note} {s.n > 0 ? `(${s.n} قراءة)` : ""}
            </p>
          </div>
        ))}
      </div>

      <p className="mt-3 text-2xs leading-relaxed text-muted">
        الفترة المتاحة حاليًا قصيرة (شموع حديثة فقط)؛ نُشير دائمًا لعدد القراءات بدل ادعاء تغطية تاريخية طويلة.
      </p>
    </Card>
  );
}