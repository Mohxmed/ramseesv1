"use client";

import type { MarketState } from "../types";
import { formatPrice, timeLabel } from "../utils";
import { Card, Status } from "@/components/ui/index";

const READING_TONE: Record<string, string> = {
  صاعد: "text-up-fg",
  هابط: "text-down-fg",
  مرتفع: "text-warn-fg",
  متوسط: "text-warn-fg",
  منخفض: "text-up-fg",
  عالي: "text-warn-fg",
  طبيعي: "text-zinc-300",
  ضعيف: "text-muted",
  قوي: "text-up-fg",
  شراء: "text-up-fg",
  بيع: "text-down-fg",
  متوازن: "text-zinc-300",
};

function toneFor(reading: string): string {
  for (const [k, v] of Object.entries(READING_TONE)) {
    if (reading.includes(k)) return v;
  }
  return "text-zinc-200";
}

export function LiveMarketStateCard({
  state,
  updatedAt,
  live,
}: {
  state: MarketState | null;
  updatedAt: number;
  live?: boolean;
}) {
  if (!state) {
    return (
      <Card className="py-10 text-center text-2xs text-muted">
        حالة السوق غير متاحة بعد
      </Card>
    );
  }

  const score = Math.max(-100, Math.min(100, state.biasScore));
  const upPct = 50 + score / 2; // 0..100 (score -100 => 0% up force)
  const bullComps = state.components.filter((c) => c.healthy);
  const bearComps = state.components.filter((c) => !c.healthy);
  const biasCls =
    state.overallBias === "bullish"
      ? "bg-up/15 text-up-fg border-up/50"
      : state.overallBias === "bearish"
      ? "bg-down/15 text-down-fg border-down/50"
      : "bg-zinc-600/30 text-zinc-300 border-zinc-600/50";
  const biasText =
    state.overallBias === "bullish" ? "صاعد" : state.overallBias === "bearish" ? "هابط" : "متقارب";

  return (
    <Card
      title="حالة سوق BTC اللحظية"
      actions={
        <Status
          label={`${live ? "مباشر" : "منتظر"} · ${timeLabel(updatedAt)}`}
          tone={live ? "good" : "quiet"}
          pulse={live}
        />
      }
      className="flex h-full flex-col"
      bodyClassName="flex flex-1 flex-col"
    >
      {/* Bull vs Bear balance meter */}
      <div className="rounded-panel border border-line bg-surface-1/40 p-4">
        <div className="text-center">
          <span className={`inline-block rounded-panel border px-3 py-0.5 text-sm font-bold ${biasCls}`}>
            صراع الاتجاه: {biasText}
          </span>
          <p className="mt-1 text-2xs text-muted">درجة الانحياز {score >= 0 ? "+" : ""}{score.toFixed(0)}</p>
        </div>

        <div className="relative mt-4 h-3 w-full overflow-hidden rounded-full bg-line">
          <div className="absolute inset-y-0 left-0 bg-up/50" style={{ width: `${upPct}%` }} />
          <div className="absolute inset-y-0 right-0 bg-down/50" style={{ width: `${100 - upPct}%` }} />
          <div
            className="absolute inset-y-0 w-0.5 bg-white"
            style={{ left: `${upPct}%` }}
          />
        </div>
        <div className="mt-1 flex items-center justify-between text-2xs font-semibold">
          <span className="text-up-fg">قوى الصعود {upPct.toFixed(0)}%</span>
          <span className="text-down-fg">قوى الهبوط {(100 - upPct).toFixed(0)}%</span>
        </div>
        <div className="mt-2 rounded-panel bg-surface-2/30 px-3 py-2 text-center text-sm">
          <span className="text-muted">السعر </span>
          <span className="font-bold text-zinc-100">{formatPrice(state.price)}</span>
        </div>
      </div>

      {/* Forces columns */}
      <div className="mt-3 grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-panel border border-up/20 bg-up/5 p-3">
          <p className="text-2xs font-semibold text-up-fg">محفزات الصعود</p>
          <ul className="mt-2 space-y-1.5">
            {bullComps.length === 0 && <li className="text-2xs text-muted">لا يوجد</li>}
            {bullComps.map((c) => (
              <li key={c.label} className="flex items-center justify-between text-2xs">
                <span className="text-zinc-400">{c.label}</span>
                <span className={`font-semibold ${toneFor(c.reading)}`}>{c.reading}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-panel border border-down/20 bg-down/5 p-3">
          <p className="text-2xs font-semibold text-down-fg">ضغوط الهبوط</p>
          <ul className="mt-2 space-y-1.5">
            {bearComps.length === 0 && <li className="text-2xs text-muted">لا يوجد</li>}
            {bearComps.map((c) => (
              <li key={c.label} className="flex items-center justify-between text-2xs">
                <span className="text-zinc-400">{c.label}</span>
                <span className={`font-semibold ${toneFor(c.reading)}`}>{c.reading}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  );
}