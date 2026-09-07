"use client";

import { useMemo } from "react";
import { Card, Stat, type Tone } from "@/components/ui";
import { fmtMoney, fmtPct } from "../utils";
import type { PortfolioSummary } from "../types";

function tradeTone(v: number): Tone {
  if (v > 0) return "good";
  if (v < 0) return "down";
  return "neutral";
}

export function PortfolioStats({ summary }: { summary: PortfolioSummary }) {
  const { hasTrades, winRate, net } = useMemo(() => {
    const hasTrades = summary.totalTrades > 0;
    const winRate = hasTrades ? (summary.winningTrades / summary.totalTrades) * 100 : null;
    const net = summary.totalProfit - summary.totalLoss;
    return { hasTrades, winRate, net };
  }, [summary]);

  const row = "rounded-panel border border-line/60 bg-surface-2/20 p-2.5";

  const cell = (label: string, value: React.ReactNode, tone: Tone = "neutral") => (
    <div className={row}>
      <Stat label={label} value={value} tone={tone} />
    </div>
  );

  return (
    <Card title="إحصائيات الأداء">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {cell("إجمالي الصفقات", hasTrades ? summary.totalTrades : "—")}
        {cell("الصفقات الرابحة", hasTrades ? summary.winningTrades : "—", "good")}
        {cell("الصفقات الخاسرة", hasTrades ? summary.losingTrades : "—", "down")}
        {cell("معدل الربح", hasTrades ? fmtPct(winRate) : "—", tradeTone(winRate ?? 0))}
        {cell("إجمالي الأرباح", hasTrades && summary.totalProfit > 0 ? <span dir="ltr">{fmtMoney(summary.totalProfit)}</span> : "—", "good")}
        {cell("إجمالي الخسائر", hasTrades && summary.totalLoss > 0 ? <span dir="ltr">{fmtMoney(summary.totalLoss)}</span> : "—", "down")}
        {cell("صافي ربح الصفقات", hasTrades ? <span dir="ltr">{fmtMoney(net, { signed: true })}</span> : "—", tradeTone(net))}
        {cell("متوسط الربح", hasTrades && summary.avgWin != null ? <span dir="ltr">{fmtMoney(summary.avgWin)}</span> : "—", "good")}
        {cell("متوسط الخسارة", hasTrades && summary.avgLoss != null ? <span dir="ltr">{fmtMoney(summary.avgLoss)}</span> : "—", "down")}
        {cell("أفضل صفقة", hasTrades ? <span dir="ltr">{fmtMoney(summary.bestTrade, { signed: true })}</span> : "—", tradeTone(summary.bestTrade))}
        {cell("أسوأ صفقة", hasTrades ? <span dir="ltr">{fmtMoney(summary.worstTrade, { signed: true })}</span> : "—", tradeTone(summary.worstTrade))}
        {cell("عامل الربحية", hasTrades && summary.profitFactor != null ? <span dir="ltr">{summary.profitFactor.toFixed(2)}</span> : "—", summary.profitFactor != null && summary.profitFactor >= 1 ? "good" : "down")}
      </div>
      {!hasTrades ? (
        <p className="mt-3 text-2xs text-muted">سجّل أول صفقة تداول ليتم احتساب هذه المؤشرات من السجل فعلياً.</p>
      ) : null}
    </Card>
  );
}