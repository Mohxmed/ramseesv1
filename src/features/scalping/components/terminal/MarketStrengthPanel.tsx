"use client";

import type { ScalpingSnapshot } from "../../types";
import { Section } from "./TradingPrimitives";
import { num } from "@/components/ui/design-tokens";
import { Tip } from "./TerminalTip";

function feature(snap: ScalpingSnapshot, key: string) {
  return snap.features?.find((f) => f.key === key);
}

function readingTone(direction: string | undefined, state: string | undefined): "long" | "short" | "neutral" | "warn" {
  if (direction === "bullish") return "long";
  if (direction === "bearish") return "short";
  if (state === "strong" || state === "moderate") return "warn";
  return "neutral";
}

function readingLabel(direction: string | undefined, state: string | undefined): string {
  if (direction === "bullish") return "صاعد";
  if (direction === "bearish") return "هابط";
  if (state === "strong") return "قوي";
  if (state === "moderate") return "متوسط";
  if (state === "weak") return "ضعيف";
  return "محايد";
}

const TONE_TXT: Record<"long" | "short" | "neutral" | "warn", string> = {
  long: "text-up-fg",
  short: "text-down-fg",
  neutral: "text-zinc-300",
  warn: "text-warn-fg",
};

function Row({
  label,
  tooltip,
  value,
  tone,
  ltr = false,
}: {
  label: string;
  tooltip?: string;
  value: string;
  tone: "long" | "short" | "neutral" | "warn";
  ltr?: boolean;
}) {
  const inner = <span className="text-2xs text-muted">{label}</span>;
  return (
    <div className="flex items-center justify-between rounded-panel border border-line bg-surface-2/40 px-3 py-2">
      {tooltip ? <Tip title={tooltip}>{inner}</Tip> : inner}
      <span dir={ltr ? "ltr" : "auto"} className={`text-2xs font-bold ${TONE_TXT[tone]} ${ltr ? num : ""}`}>
        {value}
      </span>
    </div>
  );
}

export function MarketStrengthPanel({ snap }: { snap: ScalpingSnapshot }) {
  const ms = snap.decision?.marketState;
  const futures = snap.futuresState;

  const trend = feature(snap, "market-regime");
  const momentum = feature(snap, "micro-momentum");
  const volume = feature(snap, "volume-delta");

  const cvd = ms?.cvd ?? null;
  const takerBuy = ms?.takerBuyRatio ?? null;

  const liqLong = futures?.liquidations?.long?.notional ?? null;
  const liqShort = futures?.liquidations?.short?.notional ?? null;

  return (
    <Section
      title="قوة السوق"
      eyebrow="04 · Strength"
      collapsible
      snippet={
        <div className="flex items-center justify-between gap-3">
          <span className="text-2xs text-muted">اتجاه السوق</span>
          <span className={`text-2xs font-bold ${TONE_TXT[readingTone(trend?.direction, trend?.state)]}`}>
            {trend ? readingLabel(trend.direction, trend.state) : "غير متاح"}
          </span>
        </div>
      }
    >
      <div className="space-y-2">
        <Row
          label="اتجاه السوق"
          tooltip="الاتجاه العام بناءً على قراءة نظام السوق."
          value={trend ? readingLabel(trend.direction, trend.state) : "غير متاح"}
          tone={readingTone(trend?.direction, trend?.state)}
        />
        <Row
          label="الزخم"
          tooltip="قوة الدفع اللحظية للسعر."
          value={momentum ? readingLabel(momentum.direction, momentum.state) : "غير متاح"}
          tone={readingTone(momentum?.direction, momentum?.state)}
        />
        <Row
          label="حجم التداول"
          tooltip="مستوى حجم التداول مقارنةً بالمعتاد."
          value={volume ? readingLabel(volume.direction, volume.state) : "غير متاح"}
          tone={readingTone(volume?.direction, volume?.state)}
        />
        <Row
          label="تدفق الشراء/البيع"
          tooltip="نسبة حصة المشترين النشطين من إجمالي الحجم (فوق 50% = ميل شرائي)."
          value={takerBuy != null ? `${(takerBuy * 100).toFixed(0)}% شراء` : "غير متاح"}
          tone={takerBuy != null && takerBuy > 0.5 ? "long" : takerBuy != null ? "short" : "neutral"}
          ltr
        />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="rounded-panel border border-line bg-surface-2/40 px-3 py-2">
          <Tip title="CVD = صافي الحجم التراكمي للصفقات النشطة (شراء - بيع) في النافذة.">
            <div className="text-2xs text-muted">CVD (صافي التدفق)</div>
          </Tip>
          <div className={`mt-1 text-lg font-extrabold ${num} ${cvd != null && cvd > 0 ? "text-up-fg" : cvd != null ? "text-down-fg" : "text-muted"}`} dir="ltr">
            {cvd != null ? `${cvd >= 0 ? "+" : ""}${cvd.toFixed(0)}` : "غير متاح"}
          </div>
        </div>
        <div className="rounded-panel border border-line bg-surface-2/40 px-3 py-2">
          <Tip title="قيمة التصفية القسرية في العقود الآجلة: Long تُصفّى مراكز الشراء، Short تُصفّى مراكز البيع.">
            <div className="text-2xs text-muted">التصفية (Long / Short)</div>
          </Tip>
          <div className="mt-1 flex items-baseline gap-2">
            <span className={`text-sm font-extrabold ${num} ${liqLong != null && liqLong > 0 ? "text-up-fg" : "text-muted"}`} dir="ltr">
              {liqLong != null ? compact(liqLong) : "—"}
            </span>
            <span className="text-2xs text-muted">/</span>
            <span className={`text-sm font-extrabold ${num} ${liqShort != null && liqShort > 0 ? "text-down-fg" : "text-muted"}`} dir="ltr">
              {liqShort != null ? compact(liqShort) : "—"}
            </span>
          </div>
        </div>
      </div>
    </Section>
  );
}

function compact(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return "—";
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(v);
}
