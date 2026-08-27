"use client";

import type { SupportResistanceResult, Zone } from "../analysis";
import { formatPrice, formatPercent } from "../utils";

function ZoneRow({ zone }: { zone: Zone }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-zinc-950/40 px-3 py-2">
      <div className="flex items-center gap-3">
        <span
          className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold ${
            zone.kind === "support"
              ? "bg-emerald-500/15 text-emerald-300"
              : "bg-red-500/15 text-red-300"
          }`}
        >
          {zone.kind === "support" ? "دعم" : "مقاومة"}
        </span>
        <div>
          <p className="text-sm font-semibold text-zinc-100">
            {formatPrice(zone.center)}
          </p>
          <p className="text-[11px] text-zinc-500">
            {zone.tests} اختبار · على بعد {formatPercent(zone.distancePercent)}
          </p>
        </div>
      </div>
      <div className="text-left">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-zinc-400">القوة</span>
          <span className="text-sm font-bold text-zinc-100">
            {zone.strength}/100
          </span>
        </div>
        <div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-zinc-800">
          <div
            className={`h-full rounded-full ${
              zone.strength >= 60
                ? "bg-emerald-500"
                : zone.strength >= 30
                ? "bg-amber-500"
                : "bg-red-500"
            }`}
            style={{ width: `${Math.min(zone.strength, 100)}%` }}
          />
        </div>
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
  const toneText = tone === "support" ? "text-emerald-300" : "text-red-300";
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 text-center">
      <p className="text-xs font-medium text-zinc-500">{title}</p>
      <p className={`mt-1.5 text-xl font-bold ${zone ? toneText : "text-zinc-600"}`}>
        {zone ? formatPrice(zone.center) : "غير متاح"}
      </p>
      <p className="mt-1 text-xs text-zinc-500">
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
  bullish: { label: "صاعد (Bullish)", class: "text-emerald-400" },
  bearish: { label: "هابط (Bearish)", class: "text-red-400" },
  neutral: { label: "محايد (Neutral)", class: "text-zinc-300" },
};

export function AnalysisPanel({
  analysis,
}: {
  analysis: SupportResistanceResult | null;
}) {
  if (!analysis) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 text-center text-zinc-500">
        التحليل الفني (30m) غير متاح حتى الآن
      </div>
    );
  }

  const meta = structureMeta[analysis.structure];

  const strongest = analysis.zones
    .filter((z) => z.strength >= 25)
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 6);

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-200">
          التحليل الفني (30m)
        </h2>
        <span className="text-[11px] text-zinc-500">
          {analysis.candleCount} شمعة
        </span>
      </div>
      <p className="mb-4 text-[11px] text-zinc-500">
        مستويات إحصائية احتمالية مبنية على البيانات — ليست تنبؤاً مؤكداً.
      </p>

      <div className="mb-5 flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/40 px-4 py-3">
        <span className="text-xs font-medium text-zinc-500">بنية السوق</span>
        <span className={`text-sm font-bold ${meta.class}`}>{meta.label}</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Nearest title="أقرب مقاومة" zone={analysis.nearestResistance} tone="resistance" />
        <Nearest title="أقرب دعم" zone={analysis.nearestSupport} tone="support" />
      </div>

      <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-950/40 px-4 py-3 text-center">
        <span className="text-xs font-medium text-zinc-500">السعر الحالي</span>
        <p className="mt-1 text-xl font-bold text-zinc-50">
          {formatPrice(analysis.currentPrice, 0)}
        </p>
      </div>

      <h3 className="mb-2 mt-6 text-xs font-semibold text-zinc-400">
        أقوى مناطق الدعم والمقاومة
      </h3>
      {strongest.length === 0 ? (
        <p className="text-xs text-zinc-500">لا توجد مناطق قوية كافية حالياً</p>
      ) : (
        <div className="space-y-2">
          {strongest.map((z) => (
            <ZoneRow key={z.id} zone={z} />
          ))}
        </div>
      )}
    </section>
  );
}
