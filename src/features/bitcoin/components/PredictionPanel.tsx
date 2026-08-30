"use client";

import type { PredictionResult, PredictionWindow } from "../types";
import { formatPercent, formatPrice, timeLabel } from "../utils";
import { Badge, Card } from "@/components/ui/index";

function ProbabilityBar({
  up,
  down,
}: {
  up: number;
  down: number;
}) {
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-2xs font-medium">
        <span className="text-up-fg">صعود {up.toFixed(1)}%</span>
        <span className="text-down-fg">هبوط {down.toFixed(1)}%</span>
      </div>
      <div className="mt-1 flex h-2 w-full overflow-hidden rounded-full bg-line">
        <div
          className="h-full bg-up transition-all"
          style={{ width: `${up}%` }}
        />
        <div
          className="h-full bg-down transition-all"
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
    <div className="rounded-panel border border-line bg-surface-1/40 p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
        <Badge tone="quiet">
          ثقة {window.confidence.toFixed(0)}%
        </Badge>
      </div>

      <div className="mt-4 flex items-baseline justify-between">
        <span className="text-2xs text-muted">السعر المتوقع</span>
        <span className="text-lg font-bold text-zinc-100">
          {formatPrice(window.expectedPrice)}
          <span className="ml-1 align-middle text-xs font-semibold text-muted">
            {formatPercent(window.expectedReturn)}
          </span>
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between rounded-panel bg-surface-2/30 px-3 py-2 text-xs">
        <span className="text-muted">نطاق متوقع (80%)</span>
        <span className="text-zinc-100">
          {formatPrice(window.lowerBound)} ← {formatPrice(window.upperBound)}
        </span>
      </div>

      <ProbabilityBar up={window.probabilityUp} down={window.probabilityDown} />
      <p className="mt-3 text-2xs text-muted">
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
      <Card className="py-10 text-center text-2xs text-muted">
        التوقعات الإحصائية غير متاحة حالياً
      </Card>
    );
  }

  return (
    <Card
      title="التوقع الإحصائي قصير المدى (بيانات حقيقية)"
      actions={
        <span className="text-2xs text-muted">
          أُنشئت عند {timeLabel(prediction.generatedAt)}
        </span>
      }
      className="sm:col-span-2"
    >
      <p className="mb-5 text-2xs text-muted">
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
    </Card>
  );
}