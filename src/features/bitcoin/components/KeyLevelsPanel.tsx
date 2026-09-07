"use client";

import { selectKeyLevels } from "../intelligence";
import type { MarketState, TechnicalIndicators } from "../types";
import type { SupportResistanceResult } from "../analysis";
import { formatPercent, formatPrice } from "../utils";
import { Badge, Card, Progress } from "@/components/ui/index";

function LevelRow({ level }: { level: { id: string; price: number; distancePercent: number; strength: number; tests: number; isNearest: boolean; kind: "support" | "resistance" } }) {
  const tone = level.kind === "support" ? "up" : "down";
  return (
    <div className="flex items-center justify-between gap-2 rounded-panel bg-surface-2/30 px-3 py-2">
      <div className="flex items-center gap-2">
        {level.isNearest && (
          <Badge tone={tone as "up" | "down"}>الأقرب</Badge>
        )}
        <div className="min-w-0">
          <p className="text-sm font-bold text-zinc-100" dir="ltr">
            {formatPrice(level.price)}
          </p>
          <p className="text-2xs text-muted">
            {level.tests} اختبار · القوة {level.strength}/100
          </p>
        </div>
      </div>
      <div className="w-28">
        <Progress
          pct={Math.min(level.strength, 100)}
          tone={level.strength >= 60 ? tone : level.strength >= 30 ? "warn" : "neutral"}
        />
        <p className="mt-0.5 text-right text-2xs text-muted" dir="ltr">
          {formatPercent(level.distancePercent)}
        </p>
      </div>
    </div>
  );
}

export function KeyLevelsPanel({
  analysis,
  indicators,
  marketState,
}: {
  analysis: SupportResistanceResult | null;
  indicators: TechnicalIndicators | null;
  marketState: MarketState | null;
}) {
  const { support, resistance } = selectKeyLevels(analysis);
  const vwap = indicators?.vwap.value ?? null;
  const price = marketState?.price ?? analysis?.currentPrice ?? null;
  const vwapDev =
    price != null && vwap != null && vwap > 0
      ? ((price / vwap) - 1) * 100
      : null;

  if (!analysis) {
    return (
      <Card className="py-10 text-center text-2xs text-muted">
        المستويات الرئيسية غير متاحة بعد
      </Card>
    );
  }

  return (
    <Card
      title="المستويات الرئيسية (Key Levels)"
      actions={<span className="text-2xs text-muted">{analysis.candleCount} شمعة (30 دقيقة)</span>}
    >
      <div className="mb-3 flex items-center justify-between rounded-panel border border-line bg-surface-2/30 px-3 py-2">
        <span className="text-2xs text-muted">السعر الحالي</span>
        <span className="text-base font-bold text-zinc-100" dir="ltr">
          {formatPrice(analysis.currentPrice)}
        </span>
        {vwap != null && (
          <span className="inline-flex items-center gap-1 text-2xs">
            <span className="text-muted">VWAP</span>
            <span className="font-semibold text-cyan-300" dir="ltr">
              {formatPrice(vwap)}
            </span>
            {vwapDev != null && (
              <span className={vwapDev >= 0 ? "font-semibold text-up-fg" : "font-semibold text-down-fg"} dir="ltr">
                ({vwapDev >= 0 ? "+" : ""}
                {vwapDev.toFixed(2)}%)
              </span>
            )}
          </span>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-2xs font-semibold text-zinc-400">الدعم</p>
          <div className="space-y-2">
            {support.length === 0 ? (
              <p className="text-2xs text-muted">لا توجد مستويات دعم قوية</p>
            ) : (
              support.map((l) => <LevelRow key={l.id} level={l} />)
            )}
          </div>
        </div>
        <div>
          <p className="mb-2 text-2xs font-semibold text-zinc-400">المقاومة</p>
          <div className="space-y-2">
            {resistance.length === 0 ? (
              <p className="text-2xs text-muted">لا توجد مستويات مقاومة قوية</p>
            ) : (
              resistance.map((l) => <LevelRow key={l.id} level={l} />)
            )}
          </div>
        </div>
      </div>

      <p className="mt-3 text-2xs text-muted">
        مستويات إحصائية مبنية على البيانات — ليست تنبؤاً مؤكداً. المسافة نسبة من السعر الحالي.
      </p>
    </Card>
  );
}