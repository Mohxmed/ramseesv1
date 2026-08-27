"use client";

import type { HistoricalStats } from "../types";
import { formatPercent, formatSigned } from "../utils";

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-zinc-500">{label}</span>
      <span className="text-sm font-semibold text-zinc-100">{value}</span>
    </div>
  );
}

function StatsCard({ title, stats }: { title: string; stats: HistoricalStats }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-5">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-200">{title}</h3>
        <span className="text-[11px] text-zinc-500">
          {stats.sampleSize} عينة
        </span>
      </div>
      <div className="divide-y divide-zinc-800/60">
        <StatRow label="متوسط العائد" value={formatPercent(stats.avgReturn)} />
        <StatRow label="الوسيط" value={formatPercent(stats.medianReturn)} />
        <StatRow label="نسبة الفوز" value={`${stats.winRate.toFixed(1)}%`} />
        <StatRow
          label="تكرار الهبوط"
          value={`${stats.downsideFrequency.toFixed(1)}%`}
        />
        <StatRow
          label="التقلب"
          value={formatPercent(stats.volatility)}
        />
        <StatRow
          label="أقصى ربح"
          value={formatSigned(stats.maxFavorable)}
        />
        <StatRow
          label="أقصى خسارة"
          value={`-${formatSigned(stats.maxAdverse)}`}
        />
      </div>
    </div>
  );
}

export function HistoricalStatsCard({
  h30,
  h60,
}: {
  h30: HistoricalStats;
  h60: HistoricalStats;
}) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
      <h2 className="mb-4 text-sm font-semibold text-zinc-200">
        الإحصائيات التاريخية (آخر 30/60 دقيقة)
      </h2>
      <div className="grid gap-4 md:grid-cols-2">
        <StatsCard title="آخر 30 دقيقة" stats={h30} />
        <StatsCard title="آخر 60 دقيقة" stats={h60} />
      </div>
    </section>
  );
}
