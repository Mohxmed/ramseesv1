"use client";

import { Badge, DataRow, ScoreBar, Progress } from "../ui/primitives";
import { BarChart, type ChartDatum } from "../charts/ChartContainer";
import { num } from "../ui/design-tokens";
import type { ExecutionData, FlowData, LiquidityData, PredictionData } from "./types";

const fmt = (v: number | null | undefined, d = "-"): string =>
  v == null || !isFinite(v) ? d : v.toFixed(2);

/* ------------------------------------------------------------------ */
/* FlowPanel                                                           */
/* ------------------------------------------------------------------ */

export function FlowPanel({ data }: { data: FlowData }) {
  const chart: ChartDatum[] = [
    { key: "شراء", buy: data.buyVolume, sell: 0 },
    { key: "بيع", buy: 0, sell: data.sellVolume },
  ];
  const net = data.buyVolume - data.sellVolume >= 0;
  return (
    <div className="rounded-card border border-line bg-surface-1/40 p-4">
      <div className="flex items-center justify-between">
        <span className="text-2xs font-semibold uppercase tracking-[0.18em] text-muted">تدفق الأوامر</span>
        <Badge tone={net ? "up" : "down"}>{net ? "صافي شراء" : "صافي بيع"}</Badge>
      </div>

      <div className="mt-3 h-36">
        <BarChart
          data={chart}
          xKey="key"
          series={[
            { key: "buy", name: "شراء", color: "#10b981" },
            { key: "sell", name: "بيع", color: "#ef4444" },
          ]}
          valueFormatter={(v) => fmt(Number(v))}
        />
      </div>

      <div className="mt-3 space-y-0.5">
        <DataRow label="حجم الشراء" value={fmt(data.buyVolume, "0")} ltr tone="up" />
        <DataRow label="حجم البيع" value={fmt(data.sellVolume, "0")} ltr tone="down" />
        <DataRow label="الصافي" value={fmt(data.delta)} ltr />
        <DataRow label="النسبة" value={data.ratio != null ? data.ratio.toFixed(2) : "—"} ltr />
        {data.takerBuyRatio != null ? (
          <DataRow label="نسبة المشتري" value={`${(data.takerBuyRatio * 100).toFixed(1)}%`} ltr />
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* LiquidityPanel                                                      */
/* ------------------------------------------------------------------ */

export function LiquidityPanel({ data }: { data: LiquidityData }) {
  const len = (data.bestBid + data.bestAsk).toString().length;
  return (
    <div className="rounded-card border border-line bg-surface-1/40 p-4">
      <div className="flex items-center justify-between">
        <span className="text-2xs font-semibold uppercase tracking-[0.18em] text-muted">السيولة</span>
        <Badge tone={data.depthImbalance >= 0 ? "up" : "down"}>
          {Math.abs(data.depthImbalance * 100).toFixed(1)}% انحياز
        </Badge>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <div className="text-2xs text-up-fg">أفضل شراء</div>
          <div className={`${num} mt-1 text-lg font-bold text-up-fg`} dir="ltr">
            {data.bestBid.toFixed(Math.min(2, len - 2))}
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xs text-down-fg">أفضل بيع</div>
          <div className={`${num} mt-1 text-lg font-bold text-down-fg`} dir="ltr">
            {data.bestAsk.toFixed(Math.min(2, len - 2))}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <ScoreBar value={data.depthImbalance} showValue />
      </div>

      <div className="mt-3 space-y-0.5">
        <DataRow label="الفارق" value={data.spread.toFixed(2)} ltr />
        <DataRow label="الفارق %" value={data.spreadPct != null ? `${data.spreadPct.toFixed(3)}%` : "—"} ltr />
        <DataRow label="عمق الشراء" value={fmt(data.bidDepth)} ltr />
        <DataRow label="عمق البيع" value={fmt(data.askDepth)} ltr />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ExecutionPanel                                                      */
/* ------------------------------------------------------------------ */

const execTone = { OK: "good", WARN: "warn", BLOCKED: "down", PENDING: "neutral" } as const;

export function ExecutionPanel({ data }: { data: ExecutionData }) {
  return (
    <div className="rounded-card border border-line bg-surface-1/40 p-4">
      <div className="flex items-center justify-between">
        <span className="text-2xs font-semibold uppercase tracking-[0.18em] text-muted">التنفيذ</span>
        {data.status ? <Badge tone={execTone[data.status]}>{data.status}</Badge> : null}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <div>
          <div className="text-2xs text-muted">الدخول (وقف/هدف)</div>
          <div className={`${num} mt-1 text-lg font-bold text-zinc-200`} dir="ltr">
            {fmt(data.entry)}
          </div>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-3">
        <div className="rounded-panel border border-line p-2.5">
          <div className="text-2xs text-muted">وقف الخسارة</div>
          <div className={`${num} mt-1 text-sm font-bold text-down-fg`} dir="ltr">
            {fmt(data.stopLoss)}
          </div>
        </div>
        <div className="rounded-panel border border-line p-2.5">
          <div className="text-2xs text-muted">الهدف</div>
          <div className={`${num} mt-1 text-sm font-bold text-up-fg`} dir="ltr">
            {fmt(data.takeProfit)}
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-0.5">
        <DataRow label="رسوم (نقطة أساس)" value={data.feeBps != null ? data.feeBps.toFixed(1) : "—"} ltr />
        <DataRow label="فارق (نقطة أساس)" value={data.spreadBps != null ? data.spreadBps.toFixed(1) : "—"} ltr />
        <DataRow label="انزلاق (نقطة أساس)" value={data.slippageBps != null ? data.slippageBps.toFixed(1) : "—"} ltr />
        <DataRow
          label="التكلفة الكلية"
          value={data.totalCostBps != null ? `${data.totalCostBps.toFixed(1)} نقطة أساس` : "—"}
          ltr
          strong
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* PredictionPanel                                                    */
/* ------------------------------------------------------------------ */

export function PredictionPanel({ data }: { data: PredictionData }) {
  return (
    <div className="rounded-card border border-line bg-surface-1/40 p-4">
      <div className="flex items-center justify-between">
        <span className="text-2xs font-semibold uppercase tracking-[0.18em] text-muted">التنبؤ</span>
        {data.price != null ? (
          <span className={`${num} text-sm font-bold text-zinc-200`} dir="ltr">
            {fmt(data.price)}
          </span>
        ) : null}
      </div>

      {data.align ? (
        <div className="mt-2">
          <Badge tone="up">محاذاة: {data.align}</Badge>
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {data.horizons.map((h) => (
          <div key={h.minutes} className="rounded-panel border border-line bg-surface-2/30 p-3">
            <div className="text-2xs text-muted">{h.minutes} دقيقة</div>
            <div className={`${num} mt-1 text-xl font-bold ${h.probabilityUp >= 50 ? "text-up-fg" : "text-down-fg"}`} dir="ltr">
              {h.probabilityUp.toFixed(0)}%
            </div>
            <div className="mt-2">
              <Progress pct={h.confidence ?? 0} tone="neutral" />
            </div>
            <div className="mt-2 space-y-0.5">
              <DataRow
                label="اتجاه"
                value={h.probabilityUp >= 50 ? "صاعد" : "هابط"}
                tone={h.probabilityUp >= 50 ? "up" : "down"}
              />
              <DataRow
                label="متوقع"
                value={h.expectedMovePct != null ? `${h.expectedMovePct.toFixed(2)}%` : "—"}
                ltr
              />
              <DataRow label="ثقة" value={h.confidence != null ? `${h.confidence.toFixed(0)}%` : "—"} ltr />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
