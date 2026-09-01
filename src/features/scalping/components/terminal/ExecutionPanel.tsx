"use client";

import type { ScalpingSnapshot } from "../../types";
import { Section, Tag, Dot } from "./TradingPrimitives";
import { num } from "@/components/ui/design-tokens";
import { Tip } from "./TerminalTip";

function fmtPct(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return "غير متاح";
  return `${v.toFixed(3)}%`;
}
function fmtBps(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return "غير متاح";
  return `${v.toFixed(1)} bps`;
}
function fmtDur(ms: number | null | undefined): string {
  if (ms == null || !isFinite(ms)) return "غير متاح";
  const s = ms / 1000;
  if (s < 60) return `${Math.round(s)}ث`;
  return `${Math.floor(s / 60)}د ${Math.round(s % 60)}ث`;
}

export function ExecutionPanel({ snap }: { snap: ScalpingSnapshot }) {
  const ms = snap.decision?.marketState;
  const cost = snap.decision?.costBps ?? null;
  const execution = snap.execution;
  const ageMs = execution?.signalAgeMs ?? snap.signal?.ageMs ?? null;
  const lat = snap.futuresFeed?.latency ?? null;

  const spread = ms?.spreadPct ?? null;
  const imbalance = ms?.bookImbalance ?? null;
  const slippage = cost?.slippage ?? null;

  // Suitability verdict — a presentational synthesis of the real execution
  // inputs above, NOT a new engine computation.
  let verdict: { label: string; tone: "good" | "warn" | "short"; reason: string };
  const spreadH = spread != null && spread * 10000 > 2; // > ~2bps spread
  const slipH = slippage != null && slippage > 2; // > 2bps slippage
  const ageH = ageMs != null && ageMs > 60_000; // signal older than 1m
  if (execution?.entryQuality === "none" || snap.decision?.direction === "NO_TRADE") {
    verdict = { label: "غير مناسب", tone: "short", reason: "لا توجد صفقة قابلة للتنفيذ حالياً." };
  } else if (spreadH || slipH) {
    verdict = { label: "حذر", tone: "warn", reason: "السبريد أو الانزلاق مرتفع — قد تأكل التكلفة جزءاً من المكسب." };
  } else if (ageH) {
    verdict = { label: "حذر", tone: "warn", reason: "عمر الإشارة تجاوز دقيقة — قد تكون البيانات قد تغيّرت." };
  } else {
    verdict = { label: "مناسب", tone: "good", reason: "سبريد منخفض، تكلفة مقبولة، وإشارة حديثة." };
  }

  return (
    <Section
      title="السيولة والتنفيذ"
      eyebrow="05 · Execution"
      collapsible
      snippet={
        <div className="flex items-center justify-between gap-3">
          <span className="text-2xs text-muted">الحكم على التنفيذ</span>
          <Tag tone={verdict.tone}>
            <Dot tone={verdict.tone} />
            {verdict.label}
          </Tag>
        </div>
      }
      actions={
        <Tip title={verdict.reason}>
          <Tag tone={verdict.tone}>
            <Dot tone={verdict.tone} />
            التنفيذ الآن: {verdict.label}
          </Tag>
        </Tip>
      }
    >
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
        <Metric label="السبريد" value={fmtPct(spread)} tone={spread != null && spread * 10000 > 2 ? "short" : "neutral"} />
        <Metric label="اخلال الشراء/البيع" value={imbalance != null ? imbalance.toFixed(2) : "غير متاح"} tone={imbalance != null && Math.abs(imbalance) > 0.3 ? "warn" : "neutral"} />
        <Metric label="الانزلاق المتوقع" value={fmtBps(slippage)} tone={slipH ? "short" : "neutral"} />
        <Metric label="جودة التنفيذ" value={entryLabel(execution?.entryQuality)} tone={entryTone(execution?.entryQuality)} />
        <Metric label="عمر الإشارة" value={fmtDur(ageMs)} tone={ageH ? "warn" : "neutral"} />
        <Metric label="زمن الاستجابة (Latency)" value={lat != null ? `${lat.toFixed(0)}ms` : "غير متاح"} tone="neutral" />
      </div>

      <p className="mt-3 text-2xs leading-relaxed text-muted">{verdict.reason}</p>
    </Section>
  );
}

const ENTRY_LABEL: Record<string, string> = { high: "عالية", medium: "متوسطة", low: "منخفضة", none: "لا يوجد" };
const ENTRY_TONE: Record<string, "good" | "warn" | "neutral" | "short"> = {
  high: "good",
  medium: "warn",
  low: "warn",
  none: "short",
};

function entryLabel(q: string | undefined): string {
  return q ? ENTRY_LABEL[q] ?? q : "غير متاح";
}
function entryTone(q: string | undefined): "good" | "warn" | "neutral" | "short" {
  return q ? ENTRY_TONE[q] ?? "neutral" : "neutral";
}

function Metric({ label, value, tone }: { label: string; value: string; tone: "good" | "warn" | "neutral" | "short" }) {
  const t = tone === "good" ? "text-good" : tone === "warn" ? "text-warn-fg" : tone === "short" ? "text-down-fg" : "text-zinc-300";
  return (
    <div className="flex items-center justify-between border-b border-line/50 py-1.5">
      <span className="text-2xs text-muted">{label}</span>
      <span dir="ltr" className={`text-xs font-semibold ${t} ${num}`}>{value}</span>
    </div>
  );
}
