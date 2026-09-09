"use client";

import { snapshotTimeframes, tfLabel } from "../intelligence";
import type { BtcCandle, BtcTimeframe } from "../types";
import { Card } from "@/components/ui/index";

function trendCls(trend: string): string {
  if (trend === "bullish") return "bg-up/15 text-up-fg";
  if (trend === "bearish") return "bg-down/15 text-down-fg";
  return "bg-zinc-600/30 text-zinc-300";
}

function numCls(v: number | null, invert = false): string {
  if (v == null) return "text-muted";
  if (v > (invert ? -1.5 : 1.5)) return "text-up-fg";
  if (v < (invert ? 1.5 : -1.5)) return "text-down-fg";
  return "text-zinc-300";
}

function momCls(v: number): string {
  if (Math.abs(v) >= 0.35) return v > 0 ? "text-up-fg" : "text-down-fg";
  if (Math.abs(v) >= 0.08) return v > 0 ? "text-up-fg/80" : "text-down-fg/80";
  return "text-zinc-300";
}

function volCls(v: number): string {
  if (v > 1.6) return "text-warn-fg";
  if (v > 0.8) return "text-amber-300/80";
  return "text-zinc-300";
}

const COLS = ["الإطار", "الاتجاه", "الزخم", "RSI", "التقلب (ATR%)", "الحجم (z)", "التدفق", "العائد 20"];

export function MultiTimeframeMatrix({
  multiTF,
}: {
  multiTF: Partial<Record<BtcTimeframe, BtcCandle[]>>;
}) {
  const snapshots = snapshotTimeframes(multiTF);
  const shortTfs = snapshots
    .filter((s) => s.available && s.candles > 0)
    .map((s) => s.tf)
    .join("، ");

  return (
    <Card title="مصفوفة الأطر الزمنية (Multi-Timeframe)"
      actions={<span className="text-2xs text-muted">محسوب من شموع Binance (خلال {shortTfs})</span>}
    >
      <div className="overflow-x-auto">
        <div className="min-w-[720px]">
          <div className="grid grid-cols-8 items-center gap-px rounded-t-panel bg-line px-2 py-2 text-2xs font-semibold text-zinc-400">
            {COLS.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>
          {snapshots
            .filter((s) => s.available && s.candles > 0)
            .map((s) => (
              <div
                key={s.tf}
                className="grid grid-cols-8 items-center gap-px border-t border-line/60 bg-surface-1/40 px-2 py-2.5 text-2xs"
              >
                <span className="font-semibold text-zinc-200">
                  {tfLabel(s.tf)}
                  <span className="mr-1 text-muted">{s.candles}شمعة</span>
                </span>
                <span>
                  <span className={`inline-block rounded-chip px-2 py-0.5 font-semibold ${trendCls(s.trend)}`}>
                    {s.trend === "bullish" ? "صاعد" : s.trend === "bearish" ? "هابط" : "جانبي"}
                  </span>
                </span>
                <span className={`font-semibold ${momCls(s.momentum)}`}>
                  {s.momentumLabel}
                  <span className="mr-1 text-muted" dir="ltr">
                    {s.momentum.toFixed(2)}
                  </span>
                </span>
                <span dir="ltr" className={`font-mono tabular-nums ${s.rsi != null && s.rsi > 70 ? "text-down-fg" : s.rsi != null && s.rsi < 30 ? "text-up-fg" : "text-zinc-300"}`}>
                  {s.rsi != null ? s.rsi.toFixed(1) : "—"}
                </span>
                <span className={volCls(s.volatility)}>
                  {s.volatility > 0 ? `${s.volatility.toFixed(2)}%` : "—"}
                </span>
                <span dir="ltr" className={`font-mono tabular-nums ${numCls(s.volumeZ)}`}>
                  {s.volumeZ !== 0 ? (s.volumeZ > 0 ? "+" : "") + s.volumeZ.toFixed(2) : "0.00"}
                </span>
                <span className="font-mono tabular-nums text-zinc-300" dir="ltr">
                  {(s.takerRatio * 100).toFixed(0)}%
                </span>
                <span dir="ltr" className={`font-mono tabular-nums ${s.returnPct != null ? numCls(s.returnPct / 2) : "text-muted"}`}>
                  {s.returnPct != null ? `${s.returnPct >= 0 ? "+" : ""}${s.returnPct.toFixed(2)}%` : "—"}
                </span>
              </div>
            ))}
        </div>
      </div>

      <p className="mt-3 text-2xs text-muted">
        قراءات إحصائية مُشتقة من شموع كل إطار — سياق سوق للمقارنة بين الأطر، وليست توصية.
      </p>
    </Card>
  );
}