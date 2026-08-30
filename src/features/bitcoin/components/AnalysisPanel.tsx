"use client";

import type { SupportResistanceResult, Zone } from "../analysis";
import { formatPrice, formatPercent } from "../utils";
import { Badge, Card, Progress } from "@/components/ui/index";

function ZoneRow({ zone }: { zone: Zone }) {
  return (
    <div className="flex items-center justify-between rounded-panel bg-surface-2/30 px-3 py-2">
      <div className="flex items-center gap-3">
        <Badge
          tone={zone.kind === "support" ? "up" : "down"}
        >
          {zone.kind === "support" ? "دعم" : "مقاومة"}
        </Badge>
        <div>
          <p className="text-sm font-semibold text-zinc-100">
            {formatPrice(zone.center)}
          </p>
          <p className="text-2xs text-muted">
            {zone.tests} اختبار · على بعد {formatPercent(zone.distancePercent)}
          </p>
        </div>
      </div>
      <div className="text-left">
        <div className="flex items-center gap-2">
          <span className="text-2xs text-muted">القوة</span>
          <span className="text-sm font-bold text-zinc-100">
            {zone.strength}/100
          </span>
        </div>
        <Progress
          pct={Math.min(zone.strength, 100)}
          tone={
            zone.strength >= 60
              ? "up"
              : zone.strength >= 30
              ? "warn"
              : "down"
          }
          className="mt-1 w-24"
        />
      </div>
    </div>
  );
}

function Nearest({
  title,
  zone,
  tone,
}: {
  title: string;
  zone: Zone | null;
  tone: "support" | "resistance";
}) {
  const toneText = tone === "support" ? "text-up-fg" : "text-down-fg";
  return (
    <div className="rounded-panel border border-line bg-surface-2/30 p-4 text-center">
      <p className="text-2xs text-muted">{title}</p>
      <p className={`mt-1.5 text-xl font-bold ${zone ? toneText : "text-zinc-600"}`}>
        {zone ? formatPrice(zone.center) : "غير متاح"}
      </p>
      <p className="mt-1 text-2xs text-muted">
        {zone ? (
          <>
            القوة: <span className="font-semibold text-zinc-300">{zone.strength}/100</span>
            {" · "}
            {zone.tests} اختبار
          </>
        ) : (
          "لم يتم اكتشاف مستوى"
        )}
      </p>
    </div>
  );
}

const structureMeta: Record<string, { label: string; class: string }> = {
  bullish: { label: "صاعد (Bullish)", class: "text-up-fg" },
  bearish: { label: "هابط (Bearish)", class: "text-down-fg" },
  neutral: { label: "محايد (Neutral)", class: "text-zinc-300" },
};

export function AnalysisPanel({
  analysis,
}: {
  analysis: SupportResistanceResult | null;
}) {
  if (!analysis) {
    return (
      <Card className="py-10 text-center text-2xs text-muted">
        التحليل الفني (30m) غير متاح حتى الآن
      </Card>
    );
  }

  const meta = structureMeta[analysis.structure];

  const strongest = analysis.zones
    .filter((z) => z.strength >= 25)
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 6);

  return (
    <Card
      title="التحليل الفني (30m)"
      actions={
        <span className="text-2xs text-muted">
          {analysis.candleCount} شمعة
        </span>
      }
    >
      <p className="mb-4 text-2xs text-muted">
        مستويات إحصائية احتمالية مبنية على البيانات — ليست تنبؤاً مؤكداً.
      </p>

      <div className="mb-5 flex items-center justify-between rounded-panel border border-line bg-surface-2/30 px-4 py-3">
        <span className="text-2xs text-muted">بنية السوق</span>
        <span className={`text-sm font-bold ${meta.class}`}>{meta.label}</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Nearest title="أقرب مقاومة" zone={analysis.nearestResistance} tone="resistance" />
        <Nearest title="أقرب دعم" zone={analysis.nearestSupport} tone="support" />
      </div>

      <div className="mt-3 rounded-panel border border-line bg-surface-2/30 px-4 py-3 text-center">
        <span className="text-2xs text-muted">السعر الحالي</span>
        <p className="mt-1 text-xl font-bold text-zinc-100">
          {formatPrice(analysis.currentPrice, 0)}
        </p>
      </div>

      <h3 className="mb-2 mt-6 text-2xs font-semibold text-zinc-400">
        أقوى مناطق الدعم والمقاومة
      </h3>
      {strongest.length === 0 ? (
        <p className="text-2xs text-muted">لا توجد مناطق قوية كافية حالياً</p>
      ) : (
        <div className="space-y-2">
          {strongest.map((z) => (
            <ZoneRow key={z.id} zone={z} />
          ))}
        </div>
      )}
    </Card>
  );
}