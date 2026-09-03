"use client";

import { useState, type ReactNode } from "react";
import type { CSSProperties } from "react";

import type {
  FlowSnapshot,
  PressureDirection,
  PressureStrength,
  PressureDivergence,
  TfPressure,
} from "../flow/types";
import { setPressureTimeframe } from "../flow/engine";
import { ADAPTER_LABELS } from "../flow/exchanges";
import {
  Section,
  Tag,
  Dot,
  TONE_TEXT,
  type Tone,
} from "./terminal/TradingPrimitives";
import { Tip } from "./terminal/TerminalTip";

/**
 * Buy / Sell Pressure Command Center.
 *
 * Answers in <1s:
 *   WHO is pressing?  HOW STRONG?  IS IT ACCELERATING?
 *   WHICH TIMEFRAMES agree?  WHICH EXCHANGES confirm?
 *   IS PRICE confirming or diverging?
 *
 * Pure presentation over the engine's `pressure` model — everything shown is a
 * REAL value from the live trade streams (aggressive flow, volume delta, CVD,
 * trade velocity, liquidations, per-exchange breakdown). Components the engine
 * cannot source (order book, OI, funding) are rendered as genuine N/A, never
 * fabricated. The timeframe filter changes the hero + breakdown by selecting
 * an already-computed per-timeframe row, so every number tracks the filter.
 */

const TF_OPTIONS: { seconds: number; label: string }[] = [
  { seconds: 5, label: "5s" },
  { seconds: 30, label: "30s" },
  { seconds: 60, label: "1m" },
  { seconds: 300, label: "5m" },
  { seconds: 600, label: "10m" },
  { seconds: 1800, label: "30m" },
  { seconds: 3600, label: "1h" },
  { seconds: 14400, label: "4h" },
];

const mono: CSSProperties = { fontVariantNumeric: "tabular-nums", fontFamily: "var(--font-mono), ui-monospace, monospace" };

// ─── Small formatting helpers ───────────────────────────────────────

function usd(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const a = Math.abs(v);
  const s = a >= 1_000_000 ? `${(a / 1_000_000).toFixed(2)}M` : a >= 1_000 ? `${(a / 1_000).toFixed(1)}K` : a.toFixed(0);
  return (v < 0 ? "−" : "") + "$" + s;
}
function signedUsd(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const p = v > 0 ? "+" : v < 0 ? "−" : "";
  return p + usd(Math.abs(v));
}
function signedScore(v: number): string {
  return (v > 0 ? "+" : "") + v.toFixed(0);
}

const STRENGTH_LABEL: Record<PressureStrength, string> = {
  strong: "قوي",
  moderate: "متوسط",
  weak: "ضعيف",
  balanced: "متوازن",
};
const DIRECTION_LABEL: Record<PressureDirection, string> = {
  BUY: "شراء مهيمن",
  SELL: "بيع مهيمن",
  BALANCED: "متوازن",
};
const DIRECTION_EN: Record<PressureDirection, string> = { BUY: "BUY", SELL: "SELL", BALANCED: "BALANCED" };

function directionTone(d: PressureDirection): Tone {
  return d === "BUY" ? "long" : d === "SELL" ? "short" : "neutral";
}
function dirOfScore(score: number): PressureDirection {
  if (score > 8) return "BUY";
  if (score < -8) return "SELL";
  return "BALANCED";
}
function strengthOf(score: number): PressureStrength {
  const a = Math.abs(score);
  if (a < 8) return "weak";
  if (a < 22) return "moderate";
  return "strong";
}

function StrengthTag({ strength }: { strength: PressureStrength }) {
  const tone: Tone =
    strength === "strong" ? "warn" : strength === "moderate" ? "good" : "neutral";
  return <Tag tone={tone}>{STRENGTH_LABEL[strength]}</Tag>;
}

/** Split buy/sell pressure bar (buy fill left, RTL-aware rendering). */
function SplitPressureBar({ buyPct, sellPct, h = "h-2.5" }: { buyPct: number; sellPct: number; h?: string }) {
  return (
    <div className={`flex w-full overflow-hidden rounded-full ${h}`} dir="ltr">
      <div className="bg-up transition-all duration-300" style={{ width: `${buyPct}%` }} />
      <div className="bg-down transition-all duration-300" style={{ width: `${sellPct}%` }} />
    </div>
  );
}

/** A tiny labelled metric cell (compact, dense). */
function Cell({
  label,
  value,
  tone = "neutral",
  sub,
  tip,
}: {
  label: ReactNode;
  value: ReactNode;
  tone?: Tone;
  sub?: ReactNode;
  tip?: ReactNode;
}) {
  const inner = (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-panel border border-line bg-surface-1/30 px-2 py-1.5">
      <span className="text-3xs font-semibold uppercase tracking-wider text-muted">{label}</span>
      <span className={`truncate text-sm font-extrabold leading-tight ${TONE_TEXT[tone]}`} dir="ltr" style={mono}>
        {value}
      </span>
      {sub ? <span className="truncate text-3xs text-muted" dir="ltr">{sub}</span> : null}
    </div>
  );
  return tip ? <Tip title={tip}>{inner}</Tip> : inner;
}

// ─── Timeframe Filter ───────────────────────────────────────────────

function TfFilter({ value, onChange }: { value: number; onChange: (seconds: number) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1" dir="ltr">
      {TF_OPTIONS.map((o) => {
        const active = o.seconds === value;
        return (
          <button
            key={o.seconds}
            onClick={() => onChange(o.seconds)}
            className={`rounded-chip border px-2 py-0.5 text-[11px] font-bold transition-colors ${
              active ? "border-accent bg-accent/20 text-accent-fg" : "border-line bg-surface-1/40 text-muted hover:text-foreground"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Hero Pressure Meter ────────────────────────────────────────────

function HeroMeter({
  tfm,
  momentum,
  acceleration,
  confidence,
}: {
  tfm: TfPressure;
  momentum: "increasing" | "decreasing" | "stable";
  acceleration: number;
  confidence: number;
}) {
  const dominant = dirOfScore(tfm.score);
  const tone = directionTone(dominant);
  const buyPct = Math.round(tfm.buyPct);
  const sellPct = 100 - buyPct;
  const strength = strengthOf(tfm.score);
  const momentumLabel = momentum === "increasing" ? "متزايد" : momentum === "decreasing" ? "يتلاشى" : "مستقر";
  const momentumTone: Tone = momentum === "increasing" ? "good" : momentum === "decreasing" ? "warn" : "neutral";

  return (
    <Section title="الضغط" collapsible
      actions={<Tag tone={tone}><Dot tone={tone} pulse />{DIRECTION_EN[dominant]}</Tag>}
      snippet={
        <div className="flex items-center gap-2">
          <span className={`text-sm font-extrabold ${TONE_TEXT[tone]}`} dir="ltr" style={mono}>
            {DIRECTION_EN[dominant]}
          </span>
          <span className={`text-sm font-bold ${TONE_TEXT[tone]}`} dir="ltr" style={mono}>
            {signedScore(tfm.score)}
          </span>
        </div>
      }
    >
      {/* Who dominates + how strong — the single glanceable answer. */}
      <div className={`flex items-center justify-between rounded-panel border ${tone === "long" ? "border-up/30 bg-up/5" : tone === "short" ? "border-down/30 bg-down/5" : "border-line"} px-3 py-2.5`}>
        <div className="leading-tight">
          <div className={`text-2xl font-black ${TONE_TEXT[tone]}`} dir="ltr">
            {DIRECTION_EN[dominant]}
          </div>
          <div className="text-sm text-muted">{DIRECTION_LABEL[dominant]}</div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-black text-foreground" dir="ltr" style={mono}>
            {signedScore(tfm.score)}
          </div>
          <div className="text-2xs text-muted">Pressure Score</div>
        </div>
      </div>

      {/* BUY / SELL split meter */}
      <div className="mt-2 space-y-1">
        <div className="flex items-center justify-between text-2xs">
          <span className="flex items-center gap-1 font-bold text-up-fg"><Dot tone="long" />BUY PRESSURE</span>
          <span className="font-extrabold text-up-fg" dir="ltr" style={mono}>{buyPct}%</span>
        </div>
        <SplitPressureBar buyPct={buyPct} sellPct={sellPct} h="h-3" />
        <div className="flex items-center justify-between text-2xs">
          <span className="flex items-center gap-1 font-bold text-down-fg"><Dot tone="short" />SELL PRESSURE</span>
          <span className="font-extrabold text-down-fg" dir="ltr" style={mono}>{sellPct}%</span>
        </div>
      </div>

      {/* Strength / momentum / acceleration / confidence */}
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        <Cell label="القوة" value={<StrengthTag strength={strength} />} />
        <Cell label="الزخم" value={momentumLabel} tone={momentumTone} />
        <Cell label="العجلة" value={signedScore(acceleration)} tip="تسارع ضغط السعر (الفرق الثاني بين النوافذ) — يميّز الضغط الثابت عن الضغط المتسارع" />
      </div>
      <div className="mt-1.5">
        <Cell label="توافق الأطر الزمنية" value={`${confidence}%`} sub="اتفاق الأطر مع الاتجاه المهيمن (بيانات حقيقية، دون مبالغة)" />
      </div>
    </Section>
  );
}

// ─── Pressure Breakdown ─────────────────────────────────────────────

function Row({ label, value, tone = "neutral", tip }: { label: ReactNode; value: ReactNode; tone?: Tone; tip?: ReactNode }) {
  const inner = (
    <div className="flex items-center justify-between gap-2 py-0.5">
      <span className="text-2xs text-muted">{label}</span>
      <span className={`text-xs font-bold ${TONE_TEXT[tone]}`} dir="ltr" style={mono}>{value}</span>
    </div>
  );
  return tip ? <Tip title={tip}>{inner}</Tip> : inner;
}

function BreakdownSection({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Section title={title} collapsible actions={actions}>
      <div className="divide-y divide-line/40">{children}</div>
    </Section>
  );
}

function Breakdown({ snap, tfm }: { snap: FlowSnapshot; tfm: TfPressure }) {
  const liq = snap.state.pressure.breakdown.liquidations;
  const ratio = tfm.sellVolume > 0 ? tfm.buyVolume / Math.max(0.0001, tfm.sellVolume) : 0;

  return (
    <div className="grid grid-cols-1 gap-1.5 lg:grid-cols-2">
      {/* Aggressive Flow */}
      <BreakdownSection
        title="Aggressive Flow (تنفيذ فوري)"
        actions={<Tag tone="neutral">صفقات</Tag>}
      >
        <Row label="حجم الشراء السوقي" value={usd(tfm.buyVolume)} tone="long"
          tip={(<span dir="rtl">إجمالي قيمة الصفقات المنفَّذة فوراً على جانب الشراء ضمن الفترة المختارة ({tfm.label}) — بيانات حقيقية من بثّ الصفقات</span>)} />
        <Row label="حجم البيع السوقي" value={usd(tfm.sellVolume)} tone="short" />
        <Row label="نسبة شراء/بيع" value={`${ratio.toFixed(1)}x`} tone={ratio >= 1 ? "long" : "short"} />
        <Row label="صافي الحجم (Delta)" value={signedUsd(tfm.delta)} tone={tfm.delta > 0 ? "long" : tfm.delta < 0 ? "short" : "neutral"} />
        {/* CVD delta is TF-level real */}
        <Row label="CVD Δ" value={tfm.cvdDelta != null ? signedUsd(tfm.cvdDelta) : "N/A"}
          tone={tfm.cvdDelta != null ? (tfm.cvdDelta > 0 ? "long" : "short") : "neutral"} />
      </BreakdownSection>

      {/* Trade Activity */}
      <BreakdownSection
        title="Trade Activity (نشاط التداول)"
        actions={<Tag tone="neutral">{tfm.tradeCount} صفقة</Tag>}
      >
        <Row label="صفقات/ث" value={tfm.tradesPerSec.toFixed(1)} />
        <Row label="شراء/ث" value={tfm.buyTradesPerSec.toFixed(1)} tone="long" />
        <Row label="بيع/ث" value={tfm.sellTradesPerSec.toFixed(1)} tone="short" />
        <Row label="متوسط حجم الصفقة" value={usd(tfm.avgTradeSize)} />
        <Row label="صفقات كبيرة (شراء)" value={String(tfm.largeBuys)} tone="long" />
        <Row label="صفقات كبيرة (بيع)" value={String(tfm.largeSells)} tone="short" />
      </BreakdownSection>

      {/* Liquidations (real) */}
      <BreakdownSection
        title="Futures / تصفيات"
        actions={<Tag tone={liq.burst ? "warn" : "neutral"}>{liq.burst ? "انفجار" : "هادئ"}</Tag>}
      >
        <Row label="تصفية لونج (10ث)" value={usd(liq.longNotional10s)} tone="short" />
        <Row label="تصفية شورت (10ث)" value={usd(liq.shortNotional10s)} tone="long" />
        <Row label="سرعة التصفية" value={`${usd(liq.velocity)}/ث`} />
        <Row label="OI / ΔOI" value="N/A"
          tip="مفتوح غير متوفر عبر بثّ الصفقات العام — يتطلب بثّ OI مستقل" />
        <Row label="الفاندينغ" value="N/A"
          tip="الفاندينغ غير متوفر عبر بثّ الصفقات العام — يتطلب بثّ Funding مستقل" />
      </BreakdownSection>

      {/* Order Book (genuinely unavailable) */}
      <BreakdownSection title="Order Book" actions={<Tag tone="quiet">N/A</Tag>}>
        <div className="py-1 text-2xs text-muted">
          {snap.state.pressure.breakdown.orderBook.note}
          <div className="mt-1 flex items-center justify-between text-2xs">
            <span>Bid / Ask Imbalance</span>
            <span className="font-bold text-zinc-500">N/A</span>
          </div>
          <div className="flex items-center justify-between text-2xs">
            <span>Book Pressure / Absorption</span>
            <span className="font-bold text-zinc-500">N/A</span>
          </div>
        </div>
      </BreakdownSection>
    </div>
  );
}

// ─── Pressure Timeline ──────────────────────────────────────────────

function timelineRow(t: TfPressure) {
  const d = dirOfScore(t.score);
  const tone = directionTone(d);
  return (
    <div key={t.seconds} className="flex items-center gap-2 py-1">
      <span className="w-10 shrink-0 text-2xs font-bold text-muted" dir="ltr">{t.label}</span>
      <span className={`w-12 shrink-0 text-xs font-extrabold ${TONE_TEXT[tone]}`} dir="ltr">{dirOfScore(t.score) === "BUY" ? "BUY" : dirOfScore(t.score) === "SELL" ? "SELL" : "—"}</span>
      <span className={`w-12 shrink-0 text-xs font-extrabold ${TONE_TEXT[tone]}`} dir="ltr">{signedScore(t.score)}</span>
      <div className="min-w-0 flex-1">
        <SplitPressureBar buyPct={t.buyPct} sellPct={t.sellPct} h="h-1.5" />
      </div>
      <span className="w-12 shrink-0 text-right"><StrengthTag strength={t.strength} /></span>
    </div>
  );
}

// ─── Pressure Matrix (visual heat grid) ─────────────────────────────

function t3(color: "up" | "down" | "neutral") {
  return color === "up" ? "bg-up/15 text-up-fg" : color === "down" ? "bg-down/15 text-down-fg" : "bg-surface-2/40 text-muted";
}

function Matrix({ timeframes }: { timeframes: TfPressure[] }) {
  return (
    <Section title="Pressure Matrix" collapsible
      snippet={<Tag tone="neutral">{timeframes.length} أطر</Tag>}>
      <div className="grid grid-cols-2 gap-1 sm:grid-cols-4" dir="ltr">
        {timeframes.map((t) => {
          const d = dirOfScore(t.score);
          const color = d === "BUY" ? "up" : d === "SELL" ? "down" : "neutral";
          const buyPct = Math.round(t.buyPct);
          return (
            <div key={t.seconds} className={`rounded-panel border border-line p-2 ${t3(color)}`}>
              <div className="flex items-center justify-between">
                <span className="text-2xs font-bold">{t.label}</span>
                <span className={`text-xs font-extrabold ${TONE_TEXT[directionTone(d)]}`}>{signedScore(t.score)}</span>
              </div>
              <div className="mt-1 text-[13px] font-black" style={mono}>{buyPct}% / {100 - buyPct}%</div>
              <SplitPressureBar buyPct={t.buyPct} sellPct={t.sellPct} h="h-1" />
              <div className="mt-1 flex justify-between text-2xs">
                <span className="text-up-fg/80">شراء {buyPct}%</span>
                <span className="text-down-fg/80">بيع {100 - buyPct}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

// ─── Multi-Exchange Pressure ────────────────────────────────────────

function ExchangePressureSection({ snap }: { snap: FlowSnapshot }) {
  const p = snap.state.pressure;
  return (
    <Section
      title="Multi-Exchange Pressure"
      collapsible
      actions={
        <Tag tone={p.globalLiveCount > 0 ? "good" : "warn"}>
          <Dot tone={p.globalLiveCount > 0 ? "good" : "warn"} pulse={p.globalLiveCount > 0} />
          {p.globalLiveCount}/{p.totalCount} LIVE
        </Tag>
      }
      snippet={<Tag tone="good">GLOBAL {DIRECTION_EN[p.dominant]}</Tag>}
    >
      <div className="space-y-1">
        {p.exchanges.map((e) => {
          const live = e.status === "LIVE";
          const tone = directionTone(dirOfScore(e.buyPct - e.sellPct));
          const statusLabel =
            e.status === "LIVE" ? "مباشر"
            : e.status === "CONNECTED" || e.status === "SUBSCRIBING" ? "يتصل"
            : e.status === "STALE" || e.status === "DEGRADED" ? "متأخر"
            : e.status === "ERROR" ? "خطأ" : "مقطوع";
          const statusTone: Tone = e.status === "LIVE" ? "good" : e.status === "ERROR" ? "warn" : "neutral";
          return (
            <div key={e.exchange} className={`flex items-center gap-2 rounded-chip px-1.5 py-1 ${live ? "" : "opacity-55"}`}>
              <span className="w-16 shrink-0 truncate text-2xs text-zinc-300">{ADAPTER_LABELS[e.exchange] ?? e.exchange}</span>
              <span className={`w-12 shrink-0 text-xs font-extrabold ${TONE_TEXT[tone]}`} dir="ltr">
                {Math.round(e.buyPct)}% / {Math.round(e.sellPct)}%
              </span>
              <div className="min-w-0 flex-1">
                <SplitPressureBar buyPct={e.buyPct} sellPct={e.sellPct} h="h-1" />
              </div>
              <span className="hidden w-16 shrink-0 text-right text-2xs text-muted sm:block" dir="ltr" style={mono}>
                {usd(e.delta)}
              </span>
              <span className="w-10 shrink-0 text-right text-2xs text-muted" dir="ltr" style={mono}>
                {e.eventsPerSec.toFixed(0)}/ث
              </span>
              <span className="w-8 shrink-0 text-right text-2xs text-muted" dir="ltr" style={mono}>
                {e.dataAge >= 0 ? `${e.dataAge}ms` : "—"}
              </span>
              <Tag tone={statusTone}>{statusLabel}</Tag>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

// ─── Divergence Detection ───────────────────────────────────────────

function DivergenceRow({ d }: { d: PressureDivergence }) {
  const tone: Tone = d.bullish === true ? "good" : d.bullish === false ? "warn" : "neutral";
  const sevTone: Tone = d.severity === "strong" ? "warn" : d.severity === "moderate" ? "good" : "neutral";
  return (
    <div className="flex items-start justify-between gap-2 py-1.5">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <Dot tone={tone} pulse={d.severity === "strong"} />
          <span className={`text-xs font-extrabold ${TONE_TEXT[tone]}`}>{d.title}</span>
        </div>
        <p className="mt-0.5 text-2xs leading-snug text-muted" dir="ltr">{d.detail}</p>
      </div>
      <Tag tone={sevTone}>{d.severity === "none" ? "—" : d.severity}</Tag>
    </div>
  );
}

function DivergenceSection({ divergences }: { divergences: PressureDivergence[] }) {
  return (
    <Section
      title="PRESSURE DIVERGENCES"
      collapsible
      actions={<Tag tone={divergences.length > 0 ? "warn" : "good"}>{divergences.length > 0 ? `${divergences.length} إشارة` : "لا تباعد"}</Tag>}
    >
      {divergences.length === 0 ? (
        <p className="text-2xs text-muted">لا تباعد حالي بين الضغط والسعر — الاتجاهات متوافقة. (إشارات OI/Funding غير متاحة — تتطلب بثّ مستقل.)</p>
      ) : (
        <div className="divide-y divide-line/40">
          {divergences.map((d) => <DivergenceRow key={d.id} d={d} />)}
        </div>
      )}
    </Section>
  );
}

// ─── Panel root ─────────────────────────────────────────────────────

export function PressurePanel({ snap }: { snap: FlowSnapshot }) {
  const pressure = snap.state.pressure;
  const timeframes = pressure.timeframes;
  const [tf, setTf] = useState<number>(pressure.primarySeconds);

  const idx = timeframes.findIndex((t) => t.seconds === tf);
  const tfm = idx >= 0 ? timeframes[idx] : timeframes[1] ?? timeframes[0];
  const prev = idx > 0 ? timeframes[idx - 1] : null;
  const prev2 = idx > 1 ? timeframes[idx - 2] : null;

  // All hero extras are PURE derived values from the per-timeframe rows, so
  // they track the filter instantly with no extra state/effect round-trips.
  const change = (tfm?.score ?? 0) - (prev?.score ?? tfm?.score ?? 0);
  const accel = prev && prev2 ? change - (prev.score - prev2.score) : change;
  const momentum: "increasing" | "decreasing" | "stable" =
    change > 1 ? "increasing" : change < -1 ? "decreasing" : "stable";
  const dominant = dirOfScore(tfm?.score ?? 0);
  let agree = 0;
  for (const t of timeframes) {
    if (dominant === "BUY" && t.score > 0) agree++;
    else if (dominant === "SELL" && t.score < 0) agree++;
    else if (dominant === "BALANCED" && t.score === 0) agree++;
  }
  const confidence = timeframes.length > 0 ? Math.round((agree / timeframes.length) * 100) : 0;

  // Tell the engine which timeframe to spotlight for the breakdown model.
  const applyTf = (seconds: number) => {
    setTf(seconds);
    setPressureTimeframe(seconds);
  };

  return (
    <div className="space-y-3">
      <Section title="الفترة الزمنية" collapsible
        actions={<Tag tone="neutral">يعيد حساب كل مؤشر للفترة المختارة</Tag>}>
        <TfFilter value={tf} onChange={applyTf} />
      </Section>

      <HeroMeter tfm={tfm} momentum={momentum} acceleration={accel} confidence={confidence} />

      <Breakdown snap={snap} tfm={tfm} />

      <Section title="Pressure Timeline" collapsible
        actions={<Tag tone="neutral">ضغط قصير داخل ضغط طويل</Tag>}>
        {timeframes.map(timelineRow)}
      </Section>

      <Matrix timeframes={timeframes} />

      <ExchangePressureSection snap={snap} />

      <DivergenceSection divergences={pressure.divergences} />
    </div>
  );
}
