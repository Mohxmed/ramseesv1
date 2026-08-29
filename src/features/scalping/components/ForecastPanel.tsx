"use client";

import type { ScalpingForecast, ScalpDirection } from "../types";
import { Panel } from "./ui";

const DIR_META: Record<ScalpDirection, { text: string; cls: string; bar: string }> = {
  LONG: { text: "LONG", cls: "text-emerald-300", bar: "bg-emerald-500" },
  SHORT: { text: "SHORT", cls: "text-red-300", bar: "bg-red-500" },
  NEUTRAL: { text: "NEUTRAL", cls: "text-zinc-400", bar: "bg-zinc-600" },
};

export function ForecastPanel({ forecast }: { forecast: ScalpingForecast | null }) {
  if (!forecast) {
    return (
      <Panel title="التوقعات قصيرة الأمد (وليس تنبؤًا مضمونًا)">
        <div className="text-center text-xs text-zinc-500">لا توجد بيانات كافية بعد.</div>
      </Panel>
    );
  }

  return (
    <Panel
      title="التوقعات قصيرة الأمد — الضغط اللحظي"
      actions={
        <span className="rounded-md border border-indigo-500/40 bg-indigo-500/10 px-2 py-1 text-[11px] font-bold text-indigo-300" dir="ltr">
          Directional Alignment: {forecast.alignment}/{forecast.alignmentTotal}
        </span>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {forecast.horizons.map((h) => {
          const dm = DIR_META[h.direction];
          return (
            <div key={h.key} className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-300">{h.label}</span>
                <span className={`rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] font-bold ${dm.cls}`} dir="ltr">
                  {dm.text}
                </span>
              </div>
              <div className="mt-2 text-2xl font-extrabold text-zinc-50" dir="ltr">
                {h.score}
                <span className="text-xs font-normal text-zinc-500"> / 100</span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                <div className={`h-full rounded-full ${dm.bar}`} style={{ width: `${h.score}%` }} />
              </div>
              <div className="mt-2 text-[10px] text-zinc-500" dir="ltr">
                الثقة {h.confidence}%
              </div>
              {h.supporting.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {h.supporting.map((s) => (
                    <span key={s} className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
