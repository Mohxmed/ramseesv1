"use client";

import { useState } from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

import type { FlowSnapshot, FlowWindow, NormalizedTrade } from "../flow/types";
import { ADAPTER_LABELS } from "../flow/exchanges";
import {
  Section,
  Tag,
  Dot,
  StatRow,
  Collapse,
  TONE_TEXT,
  TONE_BG,
  type Tone,
} from "./terminal/TradingPrimitives";
import { ThemeGate } from "@/components/ui/mui-theme";

/**
 * Real-Time AGGR Flow Window — matches the terminal's shared presentation
 * system (`Section` / `Tag` / `Dot` / `Stat` / `DataRow` / `Collapse` +
 * semantic design tokens), the same language as every other scalping panel.
 *
 * Layout-stability rules (no ugly reflow when values tick):
 *  - Every number renders tabular-nums (`num`) with fixed column widths.
 *  - The exchange rail is a single non-wrapping, horizontally scrollable row
 *    of fixed-min-width chips, so status text changes never wrap.
 *  - Heavy secondary panels fold into native-`<details>` `Collapse`s.
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

// ─── Shared bits ────────────────────────────────────────────────────

/** A labelled value "tile" — the canonical metric block of the terminal. */
function Tile({ label, value, tone = "neutral", sub }: { label: string; value: string; tone?: Tone; sub?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-3xs font-semibold uppercase tracking-[0.14em] text-muted">{label}</div>
      <div className={`mt-1 text-lg font-extrabold leading-none ${TONE_TEXT[tone]}`} dir="ltr" style={{ fontVariantNumeric: "tabular-nums", fontFamily: "var(--font-mono), ui-monospace, monospace" }}>
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

// ─── 01 · Live aggregation header ───────────────────────────────────

const STATUS_META: Record<string, { label: string; tone: Tone }> = {
  LIVE: { label: "مباشر", tone: "good" },
  STALE: { label: "متأخر", tone: "warn" },
  CONNECTING: { label: "يتصل", tone: "warn" },
  DISCONNECTED: { label: "مقطوع", tone: "quiet" },
  ERROR: { label: "خطأ", tone: "warn" },
};

function StatusChip({ exchange, status }: { exchange: string; status: string }) {
  const meta = STATUS_META[status] ?? { label: status, tone: "quiet" as Tone };
  const isLive = status === "LIVE";
  return (
    <Tag tone={meta.tone} className="min-w-[88px] justify-center">
      <Dot tone={meta.tone} pulse={isLive} />
      <span className="truncate">{ADAPTER_LABELS[exchange] ?? exchange}</span>
    </Tag>
  );
}

function LiveFlowHeader({ snap, minimized, onToggle }: { snap: FlowSnapshot; minimized: boolean; onToggle: () => void }) {
  const { connections, state } = snap;
  const live = connections.filter((c) => c.status === "LIVE");
  const liveLat = live.filter((c) => c.latency >= 0);
  const avgLatency = liveLat.length > 0 ? Math.round(liveLat.reduce((a, b) => a + b.latency, 0) / liveLat.length) : null;
  const overallTone: Tone = live.length > 0 ? "good" : "warn";

  return (
    <Section
      title="التدفق المباشر"
      eyebrow="01 · Live Aggregation"
      actions={
        <button
          onClick={onToggle}
          className="rounded-chip border border-line px-1.5 py-0.5 text-2xs font-bold text-muted transition-colors hover:border-zinc-600 hover:text-zinc-200"
        >
          {minimized ? "فتح ▾" : "طيّ ▴"}
        </button>
      }
    >
      {/* Summary — one aligned strip */}
      <div className="grid grid-cols-3 gap-2">
        <Tile label="الغطاء" value={`${state.quality.coverage}%`} tone={overallTone} sub={`${live.length}/${connections.length} متصل`} />
        <Tile label="الكمون" value={avgLatency !== null ? `${avgLatency}ms` : "N/A"} tone={live.length > 0 ? "good" : "neutral"} sub="متوسط الوصول" />
        <Tile label="أحداث/ث" value={`${state.quality.eventRate}`} tone="neutral" sub="معدل الأحداث" />
      </div>

      {/* Exchange rail — single non-wrapping scrollable line (no layout shift) */}
      <div className="mt-3 overflow-x-auto pb-1" dir="ltr">
        <div className="flex w-max items-center gap-1.5">
          {connections.map((c) => (
            <StatusChip key={c.exchange} exchange={c.exchange} status={c.status} />
          ))}
        </div>
      </div>
    </Section>
  );
}

// ─── 02 · Buy / Sell pressure ───────────────────────────────────────

function PressurePanel({ snap }: { snap: FlowSnapshot }) {
  const w = snap.state.windows.find((x) => x.seconds === 60);
  if (!w) return null;
  const buy = w.buyNotional;
  const sell = w.sellNotional;
  const total = buy + sell;
  const buyP = total > 0 ? pct(buy, total) : 0;
  return (
    <Section title="ضغط الشراء / البيع" eyebrow="02 · Order-Flow Imbalance" actions={<Tag tone="neutral">60 ثانية</Tag>}>
      <SplitBar buy={buy} sell={sell} />
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="rounded-panel border border-line bg-surface-1/30 px-2 py-1.5">
          <div className="flex items-center justify-between">
            <span className="text-3xs text-muted">شراء</span>
            <Dot tone="long" />
          </div>
          <div className="text-base font-extrabold leading-none text-up-fg" dir="ltr" style={{ fontVariantNumeric: "tabular-nums", fontFamily: "var(--font-mono), ui-monospace, monospace" }}>{usd(buy)}</div>
          <div className="text-3xs text-up-fg" dir="ltr" style={{ fontVariantNumeric: "tabular-nums", fontFamily: "var(--font-mono), ui-monospace, monospace" }}>{buyP.toFixed(0)}%</div>
        </div>
        <div className="rounded-panel border border-line bg-surface-1/30 px-2 py-1.5">
          <div className="flex items-center justify-between">
            <span className="text-3xs text-muted">بيع</span>
            <Dot tone="short" />
          </div>
          <div className="text-base font-extrabold leading-none text-down-fg" dir="ltr" style={{ fontVariantNumeric: "tabular-nums", fontFamily: "var(--font-mono), ui-monospace, monospace" }}>{usd(sell)}</div>
          <div className="text-3xs text-down-fg" dir="ltr" style={{ fontVariantNumeric: "tabular-nums", fontFamily: "var(--font-mono), ui-monospace, monospace" }}>{(100 - buyP).toFixed(0)}%</div>
        </div>
      </div>
    </Section>
  );
}

// ─── 03 · Net flow ──────────────────────────────────────────────────

function NetFlowPanel({ snap }: { snap: FlowSnapshot }) {
  const { state } = snap;
  const w1s = state.windows.find((x) => x.seconds === 1);
  const net = w1s?.netFlow ?? 0;
  const accel = state.velocity.flowAcceleration;
  const data = netFlowSeries(snap.recentTrades);
  const netTone = flowTone(net);
  const stroke = netTone === "long" ? "#34d399" : netTone === "short" ? "#f87171" : "#a1a1aa";
  return (
    <Section title="التدفق الصافي" eyebrow="03 · Net / Sec" actions={<Tag tone={netTone}>{signedUsd(net)} / ثانية</Tag>}>
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

// ─── 04 · Trade tape ────────────────────────────────────────────────

function TapeRow({ trade }: { trade: NormalizedTrade }) {
  const tone: Tone = trade.side === "buy" ? "long" : "short";
  return (
    <div className={`${row} rounded-chip px-1.5 py-1 ${TONE_BG[tone]}`}>
      <span className="w-[46px] shrink-0 text-2xs text-muted" dir="ltr" style={{ fontVariantNumeric: "tabular-nums", fontFamily: "var(--font-mono), ui-monospace, monospace" }}>{hhmmss(trade.timestamp)}</span>
      <span className="w-[34px] shrink-0 truncate text-2xs text-zinc-400">{ADAPTER_LABELS[trade.exchange] ?? trade.exchange}</span>
      <span className={`w-[26px] shrink-0 text-2xs font-bold ${TONE_TEXT[tone]}`}>{trade.side === "buy" ? "B" : "S"}</span>
      {trade.liquidation ? <span className="shrink-0 rounded-sm bg-warn/15 px-1 text-2xs font-extrabold text-warn-fg">LIQ</span> : null}
      <span className={`ml-auto text-xs font-bold ${TONE_TEXT[tone]}`} dir="ltr" style={{ fontVariantNumeric: "tabular-nums", fontFamily: "var(--font-mono), ui-monospace, monospace" }}>{usd(trade.notional)}</span>
    </div>
  );
}

function TapePanel({ snap }: { snap: FlowSnapshot }) {
  const trades = snap.recentTrades;
  const liveCount = snap.connections.filter((c) => c.status === "LIVE").length;
  return (
    <Section
      title="شريط الصفقات"
      eyebrow="04 · Aggregated Tape"
      actions={
        <Tag tone={liveCount > 0 ? "good" : "warn"}>
          <Dot tone={liveCount > 0 ? "good" : "warn"} pulse={liveCount > 0} />
          {liveCount > 0 ? "مباشر" : "مقطوع"}
        </Tag>
      }
      bodyClassName="p-2"
    >
      {trades.length === 0 ? (
        <div className="py-6 text-center text-2xs text-muted">بانتظار الصفقات المباشرة…</div>
      ) : (
        <div className="max-h-56 space-y-1 overflow-y-auto pr-0.5">
          {[...trades].reverse().map((t, i) => (
            <TapeRow key={`${t.exchange}_${t.tradeId ?? i}_${i}`} trade={t} />
          ))}
        </div>
      )}
    </Section>
  );
}

// ─── 05 · Large trades + 06 · Liquidations + 07 · CVD ───────────────

function LargeTrades({ snap }: { snap: FlowSnapshot }) {
  const { state } = snap;
  const buys = state.largeBuys.slice(-5).map((t) => ({ ...t, side: "buy" as const }));
  const sells = state.largeSells.slice(-5).map((t) => ({ ...t, side: "sell" as const }));
  const all = [...buys, ...sells].sort((a, b) => b.timestamp - a.timestamp).slice(0, 7);
  if (all.length === 0) {
    return (
      <Section title="الصفقات الكبيرة" eyebrow="05 · Large">
        <span className="text-2xs text-muted">لا صفقات كبيرة مؤخراً</span>
      </Section>
    );
  }
  return (
    <Section title="الصفقات الكبيرة" eyebrow="05 · Large">
      <div className="space-y-1">
        {all.map((t, i) => {
          const tone: Tone = t.side === "buy" ? "long" : "short";
          return (
            <div key={`${t.exchange}_${t.timestamp}_${i}`} className={row}>
              <span className="w-[46px] shrink-0 text-2xs text-muted" dir="ltr" style={{ fontVariantNumeric: "tabular-nums", fontFamily: "var(--font-mono), ui-monospace, monospace" }}>{hhmmss(t.timestamp)}</span>
              <span className="w-[30px] shrink-0 truncate text-2xs text-zinc-400">{ADAPTER_LABELS[t.exchange] ?? t.exchange}</span>
              <span className={`text-2xs font-bold ${TONE_TEXT[tone]}`}>{t.side === "buy" ? "B" : "S"}</span>
              <span className={`ml-auto text-xs font-bold ${TONE_TEXT[tone]}`} dir="ltr" style={{ fontVariantNumeric: "tabular-nums", fontFamily: "var(--font-mono), ui-monospace, monospace" }}>{usd(t.notional)}</span>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function Liquidations({ snap }: { snap: FlowSnapshot }) {
  const liq = snap.state.liquidations;
  const total = liq.totalVolume;
  const tone: Tone = liq.burst ? "warn" : "neutral";
  return (
    <Section
      title="التصفية"
      eyebrow="06 · Liquidations"
      actions={liq.burst ? <Tag tone="warn">انفجار</Tag> : <Tag tone={total > 0 ? "neutral" : "quiet"}>{total > 0 ? "نشط" : "لا تصفيات"}</Tag>}
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

function CvdPanel({ snap }: { snap: FlowSnapshot }) {
  const cvd = snap.state.cvd;
  const cells = [
    { label: "1 ث", v: cvd.cvdDelta1s },
    { label: "5 ث", v: cvd.cvdDelta5s },
    { label: "30 ث", v: cvd.cvdDelta30s },
    { label: "1 د", v: cvd.cvdDelta1m },
  ];
  return (
    <Section title="دلتا الحجم التراكمي" eyebrow="07 · CVD">
      <div className="grid grid-cols-4 gap-1">
        {cells.map((c) => (
          <div key={c.label} className="min-w-0 text-center">
            <div className="text-3xs text-muted">{c.label}</div>
            <div className={`mt-0.5 truncate text-[11px] font-bold leading-none ${TONE_TEXT[flowTone(c.v)]}`} dir="ltr" style={{ fontVariantNumeric: "tabular-nums", fontFamily: "var(--font-mono), ui-monospace, monospace" }}>
              {signedUsd(c.v)}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ─── 08 · Windows + 09 · Flow × Price (folded in Collapse) ──────────

function WindowRow({ w }: { w: FlowWindow }) {
  return (
    <div className="space-y-1">
      <div className={row}>
        <span className="text-2xs text-muted">{w.seconds} ثواني</span>
        <span className={`text-xs font-bold ${TONE_TEXT[flowTone(w.netFlow)]}`} dir="ltr" style={{ fontVariantNumeric: "tabular-nums", fontFamily: "var(--font-mono), ui-monospace, monospace" }}>{signedUsd(w.netFlow)}</span>
        <span className="text-2xs text-muted" style={{ fontVariantNumeric: "tabular-nums", fontFamily: "var(--font-mono), ui-monospace, monospace" }}>{w.tradeCount} صفقة</span>
      </div>
      <SplitBar buy={w.buyNotional} sell={w.sellNotional} heightClass="h-1" />
    </div>
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
    <Section title="التدفق مقابل السعر" eyebrow="09 · Flow × Price">
      <div className="space-y-0.5">
        {rows.map((r) => (
          <StatRow key={r.label} label={r.label} value={r.value} tone={r.tone} />
        ))}
      </div>
      <div className={`${row} mt-2 border-t border-line/60 pt-2`}>
        <span className="text-2xs text-muted">تغيّر السعر خلال النافذة</span>
        <span className={`text-sm font-bold ${TONE_TEXT[responseTone]}`} dir="ltr" style={{ fontVariantNumeric: "tabular-nums", fontFamily: "var(--font-mono), ui-monospace, monospace" }}>
          {a.priceDelta >= 0 ? "+" : ""}
          {a.priceDelta.toFixed(3)}%
        </span>
      </div>
    </Section>
  );
}

// ─── Composite ──────────────────────────────────────────────────────

export function FlowPanel({ snap }: { snap: FlowSnapshot | null | undefined }) {
  const [minimized, setMinimized] = useState(false);

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
      <div className="space-y-3">
        {/* Header is always visible; the rest collapse to a single summary line. */}
        <LiveFlowHeader snap={snap} minimized={minimized} onToggle={() => setMinimized((v) => !v)} />

        {minimized ? (
          <Collapse summary="عرض بقية بيانات التدفق" open={false}>
            <InnerPanels snap={snap} />
          </Collapse>
        ) : (
          <InnerPanels snap={snap} />
        )}
      </div>
    </ThemeGate>
  );
}

function InnerPanels({ snap }: { snap: FlowSnapshot }) {
  return (
    <div className="space-y-3">
      <PressurePanel snap={snap} />
      <NetFlowPanel snap={snap} />
      <TapePanel snap={snap} />
      <LargeTrades snap={snap} />
      <Liquidations snap={snap} />
      <CvdPanel snap={snap} />
      <FlowPricePanel snap={snap} />

      <Collapse summary={`النوافذ الزمنية (${snap.state.windows.length})`} open={false}>
        <div className="space-y-2">
          {snap.state.windows
            .filter((w) => [1, 5, 30, 60].includes(w.seconds))
            .map((w) => (
              <WindowRow key={w.seconds} w={w} />
            ))}
        </div>
      </Collapse>
    </div>
  );
}
