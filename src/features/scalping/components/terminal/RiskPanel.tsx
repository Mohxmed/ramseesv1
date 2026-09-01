"use client";

import type { ScalpingSnapshot } from "../../types";
import { Section, Tag, Dot } from "./TradingPrimitives";
import { num } from "@/components/ui/design-tokens";
import { Tip } from "./TerminalTip";

const LIQ_TONE: Record<string, "good" | "warn" | "short"> = {
  NONE: "good",
  LOW: "good",
  MODERATE: "warn",
  HIGH: "short",
  EXTREME: "short",
};
const LIQ_LABEL: Record<string, string> = {
  NONE: "لا تصفية بارزة",
  LOW: "منخفض",
  MODERATE: "متوسط",
  HIGH: "مرتفع",
  EXTREME: "شديد",
};

export function RiskPanel({ snap }: { snap: ScalpingSnapshot }) {
  const atr = snap.series?.atr;
  const cost = snap.decision?.costBps ?? null;
  const futures = snap.futuresState;
  const liqIntensity = futures?.liquidations?.intensity ?? null;
  const liqPressure = futures?.liquidations?.cascade?.active ? "نشطة (سلسلة تصفية)" : LIQ_LABEL[liqIntensity ?? ""];

  const reason = snap.decision?.reasonNote ?? null;
  const noTrade = snap.decision?.direction === "NO_TRADE";

  // ATR-based estimate of stop/target — clearly labelled as an estimate built on
  // the REAL ATR value, not a fabricated or hardcoded number.
  const atrV = atr?.value ?? null;
  const stop = atrV != null ? atrV : null; // stop ≈ 1×ATR
  const target = atrV != null ? atrV * 2 : null; // target ≈ 2×ATR
  const rr = stop != null && stop > 0 ? 2 : null;

  return (
    <Section
      title="المخاطر"
     
      collapsible
      snippet={
        <div className="flex items-center justify-between gap-3">
          <span className="text-2xs text-muted">خطر التصفية</span>
          <Tag tone={liqIntensity ? LIQ_TONE[liqIntensity] ?? "warn" : "neutral"}>
            <Dot tone={liqIntensity ? LIQ_TONE[liqIntensity] ?? "warn" : "neutral"} />
            {liqPressure ?? "غير متاح"}
          </Tag>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
        <Metric label="المسافة للوقف" value={atrV != null ? `$${stop!.toFixed(0)} (1×ATR)` : "غير متاح"} hint="تقدير مبني على ATR" tone="warn" ltr />
        <Metric label="المسافة للهدف" value={atrV != null ? `$${target!.toFixed(0)} (2×ATR)` : "غير متاح"} hint="تقدير مبني على ATR" tone="good" ltr />
        <Metric label="نسبة العائد للمخاطرة" value={rr != null ? `${rr}:1` : "غير متاح"} hint="هدف ÷ وقف" tone={rr != null && rr >= 2 ? "good" : "warn"} />
        <Metric label="خطر الانزلاق" value={cost?.slippage != null ? `${cost.slippage.toFixed(1)} bps` : "غير متاح"} tone={cost?.slippage != null && cost.slippage > 2 ? "short" : "neutral"} ltr />
      </div>

      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between rounded-panel border border-line bg-surface-2/40 px-3 py-2">
          <Tip title="شدة التصفية القسرية في العقود الآجلة حالياً.">
            <span className="text-2xs text-muted">خطر التصفية</span>
          </Tip>
          <Tag tone={liqIntensity ? LIQ_TONE[liqIntensity] ?? "warn" : "neutral"}>
            <Dot tone={liqIntensity ? LIQ_TONE[liqIntensity] ?? "warn" : "neutral"} />
            {liqPressure ?? "غير متاح"}
          </Tag>
        </div>
        <div className="flex items-center justify-between rounded-panel border border-line bg-surface-2/40 px-3 py-2">
          <span className="text-2xs text-muted">حالة السوق</span>
          <span className="text-2xs font-bold text-zinc-200">{snap.marketState}</span>
        </div>
      </div>

      {reason ? (
        <div className="mt-3 flex items-start gap-2 rounded-panel border border-down/40 bg-down/10 px-3 py-2">
          <span className="mt-0.5 text-down-fg">✕</span>
          <span className="text-2xs leading-relaxed text-down-fg">{reason}</span>
        </div>
      ) : noTrade ? (
        <div className="mt-3 flex items-start gap-2 rounded-panel border border-down/40 bg-down/10 px-3 py-2">
          <span className="mt-0.5 text-down-fg">✕</span>
          <span className="text-2xs leading-relaxed text-down-fg">لا صفقة قابلة للتنفيذ حالياً.</span>
        </div>
      ) : null}
    </Section>
  );
}

function Metric({
  label,
  value,
  hint,
  tone,
  ltr = false,
}: {
  label: string;
  value: string;
  hint?: string;
  tone: "good" | "warn" | "short" | "neutral";
  ltr?: boolean;
}) {
  const t = tone === "good" ? "text-good" : tone === "warn" ? "text-warn-fg" : tone === "short" ? "text-down-fg" : "text-zinc-300";
  return (
    <div className="flex items-center justify-between border-b border-line/50 py-1.5">
      <div>
        <div className="text-2xs text-muted">{label}</div>
        {hint ? <div className="text-3xs text-muted/70">{hint}</div> : null}
      </div>
      <span dir={ltr ? "ltr" : "auto"} className={`text-xs font-semibold ${t} ${ltr ? num : ""}`}>{value}</span>
    </div>
  );
}
