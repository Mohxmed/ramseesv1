"use client";

import type { PredictionResult, PredictionWindow } from "../types";
import { formatPercent, formatPrice, timeLabel } from "../utils";

function ProbabilityBar({
  up,
  down,
}: {
  up: number;
  down: number;
}) {
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-xs font-medium">
        <span className="text-emerald-400">صعود {up.toFixed(1)}%</span>
        <span className="text-red-400">هبوط {down.toFixed(1)}%</span>
      </div>
      <div className="mt-1 flex h-2 w-full overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full bg-emerald-500 transition-all"
          style={{ width: `${up}%` }}
        />
        <div
          className="h-full bg-red-500 transition-all"
          style={{ width: `${down}%` }}
        />
      </div>
    </div>
  );
}

function WindowCard({
  title,
  window,
  lastPrice,
}: {
  title: string;
  window: PredictionWindow;
  lastPrice: number;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-200">{title}</h3>
        <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-[11px] text-zinc-400">
          ثقة {window.confidence.toFixed(0)}%
        </span>
      </div>

      <div className="mt-4 flex items-baseline justify-between">
        <span className="text-xs text-zinc-500">السعر المتوقع</span>
        <span className="text-lg font-bold text-zinc-50">
          {formatPrice(window.expectedPrice)}
          <span className="ml-1 align-middle text-xs font-semibold text-zinc-400">
            {formatPercent(window.expectedReturn)}
          </span>
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between rounded-lg bg-zinc-900/60 px-3 py-2 text-xs">
        <span className="text-zinc-500">نطاق متوقع (80%)</span>
        <span className="text-zinc-200">
          {formatPrice(window.lowerBound)} ← {formatPrice(window.upperBound)}
        </span>
      </div>

      <ProbabilityBar up={window.probabilityUp} down={window.probabilityDown} />
      <p className="mt-3 text-[11px] text-zinc-500">
        بناءً على {window.sampleSize} عينة دقيقة. السعر الحالي: {formatPrice(lastPrice)}
      </p>
    </div>
  );
}

export function PredictionPanel({
  prediction,
}: {
  prediction: PredictionResult | null;
}) {
  if (!prediction) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 text-center text-zinc-500">
        التوقعات الإحصائية غير متاحة حالياً
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-zinc-200">
          التوقع الإحصائي قصير المدى (بيانات حقيقية)
        </h2>
        <span className="text-[11px] text-zinc-500">
          أُنشئت عند {timeLabel(prediction.generatedAt)}
        </span>
      </div>
      <p className="mb-5 text-xs text-zinc-500">
        احتماليات ونطاقات متوقعة مشتقة إحصائياً من تحركات الدقيقة الأخيرة — وليست
        أسعاراً مضمونة. لأغراض تحليلية فقط.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <WindowCard
          title="خلال 30 دقيقة"
          window={prediction.p30}
          lastPrice={prediction.lastPrice}
        />
        <WindowCard
          title="خلال 60 دقيقة"
          window={prediction.p60}
          lastPrice={prediction.lastPrice}
        />
      </div>
    </section>
  );
}
