"use client";

import type { CSSProperties, ReactNode } from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

import type { FlowSnapshot, FlowWindow, NormalizedTrade } from "../flow/types";
import { ADAPTER_LABELS } from "../flow/exchanges";
import {
  Section,
  Tag,
  Dot,
  StatRow,
  TONE_TEXT,
  type Tone,
} from "./terminal/TradingPrimitives";
import { ThemeGate } from "@/components/ui/mui-theme";
import { PressureDetails } from "./PressurePanel";
import { colors } from "@/components/ui/design-tokens";

/**
 * Real-Time AGGR Flow Window — matches the terminal's shared presentation
 * system (Section / Tag / Dot / StatRow + semantic design tokens).
 *
 * Every sub-window below minimizes INDEPENDENTLY: each `Section` carries its
 * own collapse state, and while collapsed it shows a compact highlight of its
 * most important metric. Collapsing one window never affects the others.
 *
 * Layout-stability rules (no ugly reflow when values tick):
 *  - Every number renders monospace tabular-nums with fixed column widths.
 *  - The exchange rail is a single non-wrapping, horizontally scrollable row
 *    of fixed-min-width chips, so status text changes never wrap.
 */

const flowTone = (n: number | null | undefined): Tone =>
  n == null ? "neutral" : n > 0 ? "long" : n < 0 ? "short" : "neutral";

const row = "flex items-center justify-between gap-3";

// ─── Formatting ─────────────────────────────────────────────────────

function usd(v: number | null | undefined): string {
  if (v == null) return "—";
  const abs = Math.abs(v);
  const prefix = v < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${prefix}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${prefix}$${(abs / 1_000).toFixed(1)}K`;
  return `${prefix}$${abs < 10 ? abs.toFixed(2) : abs.toFixed(0)}`;
}

function signedUsd(v: number | null | undefined): string {
  if (v == null) return "—";
  const prefix = v > 0 ? "+" : v < 0 ? "−" : "";
  return prefix + usd(Math.abs(v));
}

function pct(v: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, (v / total) * 100));
}

function hhmmss(d: Date | number): string {
  const x = typeof d === "number" ? new Date(d) : d;
  const p = (n: number) => n.toString().padStart(2, "0");
  return `${p(x.getHours())}:${p(x.getMinutes())}:${p(x.getSeconds())}`;
}

/** Per-second net-flow series from the live tape (for the sparkline). */
function netFlowSeries(trades: NormalizedTrade[]): { t: number; v: number }[] {
  const map = new Map<number, number>();
  for (const t of trades) {
    const key = Math.floor(t.timestamp / 1000);
    const d = t.side === "buy" ? t.notional : -t.notional;
    map.set(key, (map.get(key) ?? 0) + d);
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([t, v]) => ({ t: t * 1000, v }));
}

const mono: CSSProperties = {
  fontVariantNumeric: "tabular-nums",
  fontFamily: "var(--font-mono), ui-monospace, monospace",
};

// ─── Small shared render helpers ────────────────────────────────────

/** Linear label → value line used inside collapsed snippets. */
function SnippetRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-2xs text-muted">{label}</span>
      {children}
    </div>
  );
}

/** A labelled value "tile" — the canonical metric block of the terminal. */
function Tile({ label, value, tone = "neutral", sub }: { label: string; value: string; tone?: Tone; sub?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-3xs font-semibold uppercase tracking-[0.14em] text-muted">{label}</div>
      <div className={`mt-1 text-lg font-extrabold leading-none ${TONE_TEXT[tone]}`} dir="ltr" style={mono}>
        {value}
      </div>
      {sub ? <div className="mt-1 text-3xs text-muted">{sub}</div> : null}
    </div>
  );
}

/** Thin buy/sell split bar — buy share left (RTL-aware), real volumes. */
function SplitBar({ buy, sell, buyPctFill = "bg-up", sellPctFill = "bg-down", heightClass = "h-1.5", center = true }: { buy: number; sell: number; buyPctFill?: string; sellPctFill?: string; heightClass?: string; center?: boolean }) {
  const total = buy + sell;
  const buyPct = total > 0 ? pct(buy, total) : 50;
  return (
    <div className="relative w-full">
      <div className={`flex w-full overflow-hidden rounded-full ${heightClass}`} dir="ltr">
        <div className={`${buyPctFill} transition-all duration-300`} style={{ width: `${buyPct}%` }} />
        <div className={`${sellPctFill} transition-all duration-300`} style={{ width: `${100 - buyPct}%` }} />
      </div>
      {center ? (
        <span className="absolute inset-y-0 w-px bg-background" style={{ left: `${buyPct}%`, transform: "translateX(-50%)" }} />
      ) : null}
    </div>
  );
}

// ─── 02 · Buy / Sell pressure ───────────────────────────────────────
// The primary pressure trio (الضغط / تنفيذ فوري / نشاط التداول) lives in
// ./PressurePanel.tsx and is rendered by the terminal page in its active row;
// the advanced pressure views (liquidations, order book, timeline, matrix,
// multi-exchange, divergences) render below as <PressureDetails/>.
// The live data-gates header (بوابات البيانات) moved to a screen-floating
// modal — see ./DataGatesModal.tsx.

// ─── 03 · Net flow ──────────────────────────────────────────────────

function NetFlowPanel({ snap }: { snap: FlowSnapshot }) {
  const { state } = snap;
  const w1s = state.windows.find((x) => x.seconds === 1);
  const net = w1s?.netFlow ?? 0;
  const accel = state.velocity.flowAcceleration;
  const data = netFlowSeries(snap.recentTrades);
  const netTone = flowTone(net);
  const stroke = netTone === "long" ? colors.up : netTone === "short" ? colors.down : colors.muted;
  return (
    <Section
      title="التدفق الصافي"
     
      collapsible
      snippet={
        <SnippetRow label="صافي / ثانية">
          <span className={`text-xs font-bold ${TONE_TEXT[netTone]}`} dir="ltr" style={mono}>
            {signedUsd(net)}
          </span>
        </SnippetRow>
      }
    >
      <div className="grid grid-cols-2 gap-2">
        <Tile label="صافي / ثانية" value={signedUsd(net)} tone={netTone} />
        <Tile label="التسارع" value={signedUsd(accel)} tone={flowTone(accel)} />
      </div>
      <div className="mt-2 h-9 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="netflowFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={stroke} stopOpacity={0.5} />
                <stop offset="100%" stopColor={stroke} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="v" stroke={stroke} strokeWidth={1.5} fill="url(#netflowFill)" isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Section>
  );
}

// ─── 04 · (trade tape moved to the terminal top row as تدفق الصفقات) ──

// ─── 05 · Large trades ──────────────────────────────────────────────

function LargeTrades({ snap }: { snap: FlowSnapshot }) {
  const { state } = snap;
  const buys = state.largeBuys.slice(-5).map((t) => ({ ...t, side: "buy" as const }));
  const sells = state.largeSells.slice(-5).map((t) => ({ ...t, side: "sell" as const }));
  const all = [...buys, ...sells].sort((a, b) => b.timestamp - a.timestamp).slice(0, 7);
  const buyP = buys.length > 0 ? pct(buys.reduce((s, t) => s + t.notional, 0), buys.reduce((s, t) => s + t.notional, 0) + sells.reduce((s, t) => s + t.notional, 0)) : 0;
  if (all.length === 0) {
    return (
      <Section
        title="الصفقات الكبيرة"
       
        collapsible
        snippet={<SnippetRow label="العدد"><span className="text-xs text-muted">لا صفقات كبيرة مؤخراً</span></SnippetRow>}
      >
        <span className="text-2xs text-muted">لا صفقات كبيرة مؤخراً</span>
      </Section>
    );
  }
  return (
    <Section
      title="الصفقات الكبيرة"
     
      collapsible
      snippet={
        <SnippetRow label={`${all.length} صفقات`}>
          <span className={`text-xs font-bold ${buyP >= 50 ? "text-up-fg" : "text-down-fg"}`} dir="ltr" style={mono}>
            شراء {buyP.toFixed(0)}%
          </span>
        </SnippetRow>
      }
    >
      <div className="space-y-1">
        {all.map((t, i) => {
          const tone: Tone = t.side === "buy" ? "long" : "short";
          return (
            <div key={`${t.exchange}_${t.timestamp}_${i}`} className={row}>
              <span className="w-[46px] shrink-0 text-2xs text-muted" dir="ltr" style={mono}>{hhmmss(t.timestamp)}</span>
              <span className="w-[30px] shrink-0 truncate text-2xs text-zinc-400">{ADAPTER_LABELS[t.exchange] ?? t.exchange}</span>
              <span className={`text-2xs font-bold ${TONE_TEXT[tone]}`}>{t.side === "buy" ? "B" : "S"}</span>
              <span className={`ml-auto text-xs font-bold ${TONE_TEXT[tone]}`} dir="ltr" style={mono}>{usd(t.notional)}</span>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

// ─── 06 · Liquidations ──────────────────────────────────────────────

function Liquidations({ snap }: { snap: FlowSnapshot }) {
  const liq = snap.state.liquidations;
  const total = liq.totalVolume;
  const tone: Tone = liq.burst ? "warn" : "neutral";
  return (
    <Section
      title="التصفية"
     
      collapsible
      actions={liq.burst ? <Tag tone="warn">انفجار</Tag> : <Tag tone={total > 0 ? "neutral" : "quiet"}>{total > 0 ? "نشط" : "لا تصفيات"}</Tag>}
      snippet={
        <SnippetRow label="إجمالي المصفي">
          <span className={`text-xs font-bold ${TONE_TEXT[tone]}`} dir="ltr" style={mono}>
            {usd(total)}{total > 0 ? ` / ${usd(liq.velocity)}/ث` : ""}
          </span>
        </SnippetRow>
      }
    >
      {total === 0 ? (
        <span className="text-2xs text-muted">لا تصفيات مباشرة</span>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-3xs text-muted">لونج مصفّى {pct(liq.longVolume, total).toFixed(0)}%</span>
            <span className="text-3xs text-muted">شورت {pct(liq.shortVolume, total).toFixed(0)}%</span>
          </div>
          <SplitBar buy={liq.shortVolume} sell={liq.longVolume} buyPctFill="bg-up" sellPctFill="bg-down" />
          <StatRow label="إجمالي المصفي" value={usd(total)} tone={tone} />
          <StatRow label="سرعة التصفية" value={`${usd(liq.velocity)}/ث`} tone={liq.burst ? "warn" : "neutral"} />
        </div>
      )}
    </Section>
  );
}

// ─── 07 · CVD ───────────────────────────────────────────────────────

function CvdPanel({ snap }: { snap: FlowSnapshot }) {
  const cvd = snap.state.cvd;
  const cells = [
    { label: "1 ث", v: cvd.cvdDelta1s },
    { label: "5 ث", v: cvd.cvdDelta5s },
    { label: "30 ث", v: cvd.cvdDelta30s },
    { label: "1 د", v: cvd.cvdDelta1m },
  ];
  return (
    <Section
      title="دلتا الحجم التراكمي"
     
      collapsible
      snippet={
        <SnippetRow label="CVD 1د">
          <span className={`text-xs font-bold ${TONE_TEXT[flowTone(cvd.cvdDelta1m)]}`} dir="ltr" style={mono}>
            {signedUsd(cvd.cvdDelta1m)}
          </span>
        </SnippetRow>
      }
    >
      <div className="grid grid-cols-4 gap-1">
        {cells.map((c) => (
          <div key={c.label} className="min-w-0 text-center">
            <div className="text-3xs text-muted">{c.label}</div>
            <div className={`mt-0.5 truncate text-[11px] font-bold leading-none ${TONE_TEXT[flowTone(c.v)]}`} dir="ltr" style={mono}>
              {signedUsd(c.v)}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ─── 08 · Time windows + 09 · Flow × Price ──────────────────────────

function WindowRow({ w }: { w: FlowWindow }) {
  return (
    <div className="space-y-1">
      <div className={row}>
        <span className="text-2xs text-muted">{w.seconds} ثواني</span>
        <span className={`text-xs font-bold ${TONE_TEXT[flowTone(w.netFlow)]}`} dir="ltr" style={mono}>{signedUsd(w.netFlow)}</span>
        <span className="text-2xs text-muted" style={mono}>{w.tradeCount} صفقة</span>
      </div>
      <SplitBar buy={w.buyNotional} sell={w.sellNotional} heightClass="h-1" />
    </div>
  );
}

function WindowsPanel({ snap }: { snap: FlowSnapshot }) {
  const windows = snap.state.windows.filter((w) => [1, 5, 30, 60].includes(w.seconds));
  const w1 = snap.state.windows.find((x) => x.seconds === 1);
  return (
    <Section
      title="النوافذ الزمنية"
     
      collapsible
      snippet={
        <SnippetRow label="صافي 1ث">
          <span className={`text-xs font-bold ${TONE_TEXT[flowTone(w1?.netFlow ?? null)]}`} dir="ltr" style={mono}>
            {signedUsd(w1?.netFlow ?? null)}
          </span>
        </SnippetRow>
      }
    >
      <div className="space-y-2">
        {windows.map((w) => (
          <WindowRow key={w.seconds} w={w} />
        ))}
      </div>
    </Section>
  );
}

function FlowPricePanel({ snap }: { snap: FlowSnapshot }) {
  const a = snap.state.analysis;
  const responseTone: Tone =
    a.priceResponse === "strong_positive" || a.priceResponse === "positive"
      ? "long"
      : a.priceResponse === "strong_negative" || a.priceResponse === "negative"
      ? "short"
      : "neutral";
  const responseLabel: Record<string, string> = {
    strong_positive: "تأكيد شرائي",
    positive: "شرائي",
    neutral: "محايد",
    negative: "بيعي",
    strong_negative: "تأكيد بيعي",
  };
  const absorptionLabel: Record<string, string> = {
    buy_absorption: "امتصاص شراء",
    sell_absorption: "امتصاص بيع",
    none: "—",
  };
  const divergenceLabel: Record<string, string> = {
    bullish_divergence: "تباعد صاعد",
    bearish_divergence: "تباعد هابط",
    none: "—",
  };
  const cascadeLabel: Record<string, string> = {
    high: "مرتفع",
    medium: "متوسط",
    low: "منخفض",
    none: "—",
  };
  const rows: { label: string; value: string; tone: Tone }[] = [
    { label: "استجابة السعر", value: responseLabel[a.priceResponse] ?? a.priceResponse, tone: responseTone },
    { label: "امتصاص", value: absorptionLabel[a.absorption] ?? a.absorption, tone: a.absorption === "buy_absorption" ? "short" : a.absorption === "sell_absorption" ? "long" : "neutral" },
    { label: "التباعد", value: divergenceLabel[a.divergence] ?? a.divergence, tone: a.divergence === "bullish_divergence" ? "long" : a.divergence === "bearish_divergence" ? "short" : "neutral" },
    { label: "خطر الانجراف", value: cascadeLabel[a.cascadeRisk] ?? a.cascadeRisk, tone: a.cascadeRisk === "high" ? "short" : a.cascadeRisk === "medium" ? "warn" : "neutral" },
  ];
  return (
    <Section
      title="التدفق مقابل السعر"
     
      collapsible
      snippet={
        <SnippetRow label="استجابة السعر">
          <span className={`text-xs font-bold ${TONE_TEXT[responseTone]}`}>{responseLabel[a.priceResponse] ?? a.priceResponse}</span>
        </SnippetRow>
      }
    >
      <div className="space-y-0.5">
        {rows.map((r) => (
          <StatRow key={r.label} label={r.label} value={r.value} tone={r.tone} />
        ))}
      </div>
      <div className={`${row} mt-2 border-t border-line/60 pt-2`}>
        <span className="text-2xs text-muted">تغيّر السعر خلال النافذة</span>
        <span className={`text-sm font-bold ${TONE_TEXT[responseTone]}`} dir="ltr" style={mono}>
          {a.priceDelta >= 0 ? "+" : ""}
          {a.priceDelta.toFixed(3)}%
        </span>
      </div>
    </Section>
  );
}

// ─── Composite ──────────────────────────────────────────────────────

export function FlowPanel({ snap }: { snap: FlowSnapshot | null | undefined }) {
  if (!snap) {
    return (
      <ThemeGate>
        <div className="flex flex-col items-center justify-center gap-2 rounded-panel border border-line bg-surface-1/40 py-10 text-center">
          <Dot tone="warn" pulse />
          <span className="text-2xs text-muted">جارٍ الاتصال بمصادر التدفق المباشر…</span>
        </div>
      </ThemeGate>
    );
  }

  return (
    <ThemeGate>
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <div className="xl:col-span-2">
          <PressureDetails snap={snap} />
        </div>
        <NetFlowPanel snap={snap} />
        <WindowsPanel snap={snap} />
        <LargeTrades snap={snap} />
        <Liquidations snap={snap} />
        <CvdPanel snap={snap} />
        <FlowPricePanel snap={snap} />
      </div>
    </ThemeGate>
  );
}
