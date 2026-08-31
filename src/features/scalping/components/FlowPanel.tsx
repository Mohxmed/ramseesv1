"use client";

import { useState, type ReactNode } from "react";
import type {
  FlowSnapshot,
  FlowWindow,
  NormalizedTrade,
} from "../flow/types";
import { TONE_TEXT, TONE_BAR, Dot, Tag, Tone } from "./terminal/TradingPrimitives";
import { num } from "@/components/ui/design-tokens";
import { Tip } from "./terminal/TerminalTip";
import { ADAPTER_LABELS } from "../flow/exchanges";

/**
 * Real-Time AGGR Flow Window — vertical left panel.
 *
 * Section order (per the spec):
 *   LIVE FLOW → Connection/Coverage/Latency → BUY/SELL PRESSURE →
 *   NET FLOW/FLOW PER SEC → LIVE TRADE TAPE (largest) → LARGE TRADES →
 *   LIQUIDATIONS → CVD → FLOW EVENTS → FLOW × PRICE
 *
 * Every number is rendered directly from the engine snapshot. No duplicate
 * across sections; no mock data; real multi-exchange flow only.
 */

// ─── Formatting helpers ──────────────────────────────────────────────

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

function compactUsd(v: number | null | undefined): string {
  return usd(v);
}

function barPct(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, (part / total) * 100));
}

/** Belt tone for a signed flow reading. */
function flowTone(net: number): Tone {
  if (net > 0) return "long";
  if (net < 0) return "short";
  return "neutral";
}

function hhmmss(ts: number): string {
  const d = new Date(ts);
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  const s = d.getSeconds().toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

// ─── Section wrapper ─────────────────────────────────────────────────

function FlowSection({
  title,
  eyebrow,
  children,
  right,
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <section className="rounded-panel border border-line/80 bg-surface-1/40 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <span className="text-3xs font-semibold uppercase tracking-[0.18em] text-muted">
            {title}
          </span>
          {eyebrow && <span className="text-3xs text-muted/70">{eyebrow}</span>}
        </div>
        {right}
      </div>
      <div className="mt-2">{children}</div>
    </section>
  );
}

// ─── Live Flow header ────────────────────────────────────────────────

function LiveFlowHeader({ snap }: { snap: FlowSnapshot }) {
  const { state, connections } = snap;
  const level = state.quality.level;
  const [minimized, setMinimized] = useState(false);

  const levelTone: Record<string, Tone> = {
    full: "good",
    partial: "neutral",
    degraded: "warn",
    stale: "short",
  };
  const levelLabel: Record<string, string> = {
    full: "كامل",
    partial: "جزئي",
    degraded: "متدهور",
    stale: "قديم",
  };

  // Average latency only over LIVE exchanges with a valid latency.
  const liveLat = connections.filter((c) => c.status === "LIVE" && c.latency >= 0).map((c) => c.latency);
  const avgLatency = liveLat.length > 0 ? Math.round(liveLat.reduce((a, b) => a + b, 0) / liveLat.length) : null;

  const statusTone: Record<string, Tone> = {
    LIVE: "good",
    STALE: "warn",
    CONNECTING: "warn",
    DISCONNECTED: "quiet",
    ERROR: "warn",
  };

  return (
    <FlowSection
      title="التدفق المباشر"
      eyebrow={minimized ? undefined : "01 · Live Flow"}
      right={
        <div className="flex items-center gap-2">
          {minimized && (
            <span className="flex items-center gap-1.5 text-2xs text-muted/80">
              {liveLat.length > 0 && <Dot tone="good" pulse />}
              <span dir="ltr">
                {connections.filter((c) => c.status === "LIVE").length}/{connections.length}
              </span>
            </span>
          )}
          <button
            type="button"
            onClick={() => setMinimized((v) => !v)}
            className="rounded-chip border border-line/70 bg-surface-2/50 px-1.5 py-0.5 text-2xs text-muted hover:text-zinc-100"
            aria-expanded={!minimized}
            aria-label={minimized ? "توسيع حالة البيانات" : "تصغير حالة البيانات"}
          >
            {minimized ? "+" : "−"}
          </button>
        </div>
      }
    >
      {minimized ? (
        <div>
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-3xs text-muted">الغطاء</div>
              <div className={`${num} text-sm font-extrabold leading-none text-zinc-50`} dir="ltr">
                {state.quality.coverage}
                <span className="ml-1 text-2xs font-medium text-emerald-400">
                  {liveLat.length > 0 ? "LIVE" : ""}
                </span>
              </div>
            </div>
            <div className="text-left">
              <div className="text-3xs text-muted">الكمون</div>
              <div className={`${num} text-sm font-bold leading-none text-zinc-200`} dir="ltr">
                {avgLatency !== null ? `${avgLatency}ms` : "N/A"}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-3xs text-muted">الغطاء · الاعتماد</div>
              <div className={`${num} mt-0.5 text-lg font-extrabold leading-none text-zinc-50`} dir="ltr">
                {state.quality.coverage}
                <span className="ml-1 text-2xs font-medium text-emerald-400">{liveLat.length > 0 ? "LIVE" : ""}</span>
              </div>
            </div>
            <div className="text-left">
              <div className="text-3xs text-muted">حالة البيانات</div>
              <Tag tone={levelTone[level] ?? "neutral"}>{levelLabel[level] ?? level}</Tag>
            </div>
            <div className="text-left">
              <div className="text-3xs text-muted">الكمون</div>
              <div className={`${num} mt-0.5 text-base font-bold leading-none text-zinc-200`} dir="ltr">
                {avgLatency !== null ? `${avgLatency}ms` : "N/A"}
              </div>
            </div>
          </div>

          {/* per-exchange connection chips */}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {connections.map((c) => {
              const tone: Tone = statusTone[c.status] ?? "quiet";
              const prefix = c.status === "LIVE" ? "●" : "○";
              const latTxt = c.status === "LIVE" && c.latency >= 0 ? `${Math.round(c.latency)}ms` : "N/A";
              return (
                <Tip
                  key={c.exchange}
                  title={`${c.exchange} · ${c.status}${c.lastError ? " · " + c.lastError : ""} · ${c.eventCount} events`}
                >
                  <span
                    className={`inline-flex items-center gap-1 rounded-chip border px-1.5 py-0.5 text-2xs ${TONE_BAR[tone]} bg-surface-2/30`}
                    dir="ltr"
                  >
                    <Dot tone={tone} />
                    <span className="font-semibold">{ADAPTER_LABELS[c.exchange] ?? c.exchange}</span>
                    <span className="opacity-70">{prefix}</span>
                    <span className="opacity-80">{c.status === "LIVE" ? c.status : latTxt}</span>
                    {c.status === "LIVE" && <span className="font-medium">{latTxt}</span>}
                  </span>
                </Tip>
              );
            })}
          </div>
        </>
      )}
    </FlowSection>
  );
}

// ─── Buy / Sell pressure ─────────────────────────────────────────────

function PressurePanel({ snap }: { snap: FlowSnapshot }) {
  const w = windowOf(snap, 60);
  if (!w) {
    return <FlowSection title="الضغط" eyebrow="02 · Buy/Sell">غير متاح</FlowSection>;
  }
  const buy = w.buyNotional;
  const sell = w.sellNotional;
  const total = buy + sell;
  const buyPct = barPct(buy, total);
  const sellPct = barPct(sell, total);

  return (
    <FlowSection title="الضغط" eyebrow="02 · Buy/Sell" right={<span className="text-2xs text-muted/70">1د</span>}>
      {/* buy/sell bar */}
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-line" dir="ltr">
        <div className="h-full bg-up-fg/80" style={{ width: `${buyPct}%` }} />
        <div className="h-full bg-down-fg/80" style={{ width: `${sellPct}%` }} />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="rounded-panel border border-line bg-surface-1/30 px-2 py-1.5">
          <div className="flex items-center justify-between">
            <span className="text-3xs text-muted">شراء</span>
            <span className={`${num} text-2xs font-semibold ${TONE_TEXT.long}`} dir="ltr">
              {buyPct.toFixed(0)}%
            </span>
          </div>
          <div className={`${num} mt-0.5 text-base font-extrabold leading-none ${TONE_TEXT.long}`} dir="ltr">
            {usd(buy)}
          </div>
        </div>
        <div className="rounded-panel border border-line bg-surface-1/30 px-2 py-1.5">
          <div className="flex items-center justify-between">
            <span className="text-3xs text-muted">بيع</span>
            <span className={`${num} text-2xs font-semibold ${TONE_TEXT.short}`} dir="ltr">
              {sellPct.toFixed(0)}%
            </span>
          </div>
          <div className={`${num} mt-0.5 text-base font-extrabold leading-none ${TONE_TEXT.short}`} dir="ltr">
            {usd(sell)}
          </div>
        </div>
      </div>
    </FlowSection>
  );
}

// ─── Net flow / per sec ──────────────────────────────────────────────

function NetFlowPanel({ snap }: { snap: FlowSnapshot }) {
  const { state } = snap;
  const w1s = windowOf(snap, 1);
  const netPerSec = w1s?.netFlow ?? 0;
  const accel = state.velocity.flowAcceleration;
  const net = w1s?.netFlow ?? 0;
  const accelTone: Tone = accel > 0 ? "long" : accel < 0 ? "short" : "neutral";

  return (
    <FlowSection title="التدفق الصافي" eyebrow="03 · Net / Sec">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-panel border border-line bg-surface-1/30 px-2 py-1.5">
          <div className="text-3xs text-muted">صافي / ثانية</div>
          <div className={`${num} mt-0.5 text-base font-extrabold leading-none ${TONE_TEXT[flowTone(netPerSec)]}`} dir="ltr">
            {signedUsd(netPerSec)}
          </div>
        </div>
        <div className="rounded-panel border border-line bg-surface-1/30 px-2 py-1.5">
          <div className="text-3xs text-muted">تسارع</div>
          <div className={`${num} mt-0.5 text-base font-extrabold leading-none ${TONE_TEXT[accelTone]}`} dir="ltr">
            {signedUsd(accel)}
          </div>
        </div>
      </div>
      <div className="mt-2 flex h-1.5 w-full overflow-hidden rounded-full bg-line" dir="ltr">
        <div
          className={`h-full rounded-full transition-all duration-300 ${TONE_BAR[flowTone(net)]}`}
          style={{ width: `${Math.min(100, Math.abs(net) / 2000)}%` }}
        />
      </div>
    </FlowSection>
  );
}

// ─── Live trade tape (largest section) ───────────────────────────────

function TradeTape({ snap }: { snap: FlowSnapshot }) {
  const trades = snap.recentTrades;

  return (
    <FlowSection
      title="شريط الصفقات"
      eyebrow="04 · Tape"
      right={
        <span className="flex items-center gap-1.5 text-2xs text-muted/70">
          <Dot tone="good" pulse />
          مباشر
        </span>
      }
    >
      {trades.length === 0 ? (
        <div className="py-3 text-center text-2xs text-muted">بانتظار الصفقات المباشرة…</div>
      ) : (
        <div className="space-y-0.5">
          {/* apply max height with scroll for the largest section */}
          <div className="max-h-[320px] space-y-0.5 overflow-y-auto pr-1">
            {[...trades].reverse().map((t, i) => (
              <TapeRow key={`${t.exchange}_${t.tradeId ?? i}_${i}`} trade={t} />
            ))}
          </div>
        </div>
      )}
    </FlowSection>
  );
}

function TapeRow({ trade }: { trade: NormalizedTrade }) {
  const side = trade.side;
  const tone: Tone = side === "buy" ? "long" : "short";
  const size = notionalSize(trade.notional);
  return (
    <div className="flex items-center justify-between gap-2 rounded bg-surface-2/20 px-1.5 py-0.5">
      <span className={`${num} text-2xs text-muted`}>{hhmmss(trade.timestamp)}</span>
      <span className="w-10 text-2xs font-semibold text-muted">{ADAPTER_LABELS[trade.exchange] ?? trade.exchange}</span>
      <span className={`text-2xs font-extrabold ${TONE_TEXT[tone]}`}>{side === "buy" ? "BUY" : "SELL"}</span>
      <span className={`${num} flex-1 text-right text-2xs font-semibold text-zinc-200`} dir="ltr">
        {size}
      </span>
      {trade.liquidation ? (
        <span className="rounded-chip border border-warn/40 bg-warn/10 px-1 text-2xs text-warn-fg">LIQ</span>
      ) : null}
    </div>
  );
}

function notionalSize(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(abs / 1_000).toFixed(0)}K`;
  return `$${abs.toFixed(0)}`;
}

// ─── Large trades ────────────────────────────────────────────────────

function LargeTrades({ snap }: { snap: FlowSnapshot }) {
  const { state } = snap;
  const buys = state.largeBuys.slice(-6);
  const sells = state.largeSells.slice(-6);
  const all = [
    ...buys.map((t) => ({ ...t, side: "buy" as const })),
    ...sells.map((t) => ({ ...t, side: "sell" as const })),
  ]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 8);

  if (all.length === 0) {
    return (
      <FlowSection title="الصفقات الكبيرة" eyebrow="05 · Large">
        <div className="py-1 text-2xs text-muted">لا صفقات كبيرة مؤخراً</div>
      </FlowSection>
    );
  }

  return (
    <FlowSection title="الصفقات الكبيرة" eyebrow="05 · Large">
      <div className="space-y-0.5">
        {all.map((t, i) => {
          const tone: Tone = t.side === "buy" ? "long" : "short";
          return (
            <div key={`${t.exchange}_${t.timestamp}_${i}`} className="flex items-center justify-between gap-2 rounded bg-surface-2/20 px-1.5 py-0.5">
              <span className={`${num} text-2xs text-muted`}>{hhmmss(t.timestamp)}</span>
              <span className="w-10 text-2xs font-semibold text-muted">{ADAPTER_LABELS[t.exchange] ?? t.exchange}</span>
              <span className={`text-2xs font-extrabold ${TONE_TEXT[tone]}`}>
                {t.side === "buy" ? "BUY" : "SELL"}
              </span>
              <span className={`${num} flex-1 text-right text-2xs font-bold text-zinc-200`} dir="ltr">
                {compactUsd(t.notional)}
              </span>
            </div>
          );
        })}
      </div>
    </FlowSection>
  );
}

// ─── Liquidations ────────────────────────────────────────────────────

function Liquidations({ snap }: { snap: FlowSnapshot }) {
  const liq = snap.state.liquidations;
  const total = liq.totalVolume;
  if (total === 0) {
    return (
      <FlowSection title="التصفية" eyebrow="06 · Liq">
        <div className="py-1 text-2xs text-muted">لا تصفيات مباشرة</div>
      </FlowSection>
    );
  }

  const longPct = barPct(liq.longVolume, total);
  const shortPct = barPct(liq.shortVolume, total);
  const burstTone: Tone = liq.burst ? "short" : "neutral";

  return (
    <FlowSection
      title="التصفية"
      eyebrow="06 · Liq"
      right={liq.burst ? <Tag tone={burstTone}>انفجار</Tag> : undefined}
    >
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-panel border border-line bg-surface-1/30 px-2 py-1.5">
          <div className="flex items-center justify-between">
            <span className="text-3xs text-muted">تصفية لونج</span>
            <span className={`${num} text-2xs font-semibold ${TONE_TEXT.short}`} dir="ltr">{longPct.toFixed(0)}%</span>
          </div>
          <div className={`${num} mt-0.5 text-sm font-extrabold leading-none ${TONE_TEXT.short}`} dir="ltr">
            {usd(liq.longVolume)}
          </div>
        </div>
        <div className="rounded-panel border border-line bg-surface-1/30 px-2 py-1.5">
          <div className="flex items-center justify-between">
            <span className="text-3xs text-muted">تصفية شورت</span>
            <span className={`${num} text-2xs font-semibold ${TONE_TEXT.long}`} dir="ltr">{shortPct.toFixed(0)}%</span>
          </div>
          <div className={`${num} mt-0.5 text-sm font-extrabold leading-none ${TONE_TEXT.long}`} dir="ltr">
            {usd(liq.shortVolume)}
          </div>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between text-2xs text-muted">
        <span>السرعة</span>
        <span className={`${num} font-semibold ${TONE_TEXT[burstTone]}`} dir="ltr">{usd(liq.velocity)}/s</span>
      </div>
    </FlowSection>
  );
}

// ─── CVD ─────────────────────────────────────────────────────────────

function CvdPanel({ snap }: { snap: FlowSnapshot }) {
  const cvd = snap.state.cvd;
  const { cvdDelta1s, cvdDelta5s, cvdDelta30s, cvdDelta1m } = cvd;
  return (
    <FlowSection title="دلتا الحجم التراكمي" eyebrow="07 · CVD">
      <div className="grid grid-cols-2 gap-2">
        <CvdCell label="1ث" value={cvdDelta1s} tone={flowTone(cvdDelta1s)} />
        <CvdCell label="5ث" value={cvdDelta5s} tone={flowTone(cvdDelta5s)} />
        <CvdCell label="30ث" value={cvdDelta30s} tone={flowTone(cvdDelta30s)} />
        <CvdCell label="1د" value={cvdDelta1m} tone={flowTone(cvdDelta1m)} />
      </div>
    </FlowSection>
  );
}

function CvdCell({ label, value, tone }: { label: string; value: number; tone: Tone }) {
  return (
    <div className="rounded-panel border border-line bg-surface-1/30 px-2 py-1.5">
      <div className="text-3xs text-muted">{label}</div>
      <div className={`${num} mt-0.5 text-sm font-extrabold leading-none ${TONE_TEXT[tone]}`} dir="ltr">
        {signedUsd(value)}
      </div>
    </div>
  );
}

// ─── Flow events / windows ──────────────────────────────────────────

function FlowEvents({ snap }: { snap: FlowSnapshot }) {
  const windows = snap.state.windows.filter((w) => [1, 5, 30, 60].includes(w.seconds));
  return (
    <FlowSection title="النوافذ" eyebrow="08 · Events">
      <div className="space-y-1">
        {windows.map((w) => (
          <WindowRow key={w.seconds} w={w} />
        ))}
      </div>
    </FlowSection>
  );
}

function WindowRow({ w }: { w: FlowWindow }) {
  const tone: Tone = flowTone(w.netFlow);
  const total = w.buyNotional + w.sellNotional;
  const buyPct = barPct(w.buyNotional, total);
  return (
    <div className="rounded bg-surface-2/20 px-1.5 py-1">
      <div className="flex items-center justify-between">
        <span className="text-2xs text-muted">{w.seconds}ث</span>
        <span className={`${num} text-2xs font-extrabold ${TONE_TEXT[tone]}`} dir="ltr">
          {signedUsd(w.netFlow)}
        </span>
        <span className={`${num} text-2xs text-muted`}>{w.tradeCount} ص</span>
      </div>
      <div className="mt-1 flex h-1 w-full overflow-hidden rounded-full bg-line" dir="ltr">
        <div className="h-full bg-up-fg/80" style={{ width: `${buyPct}%` }} />
      </div>
    </div>
  );
}

// ─── Flow × Price ────────────────────────────────────────────────────

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

  const absorbLabel: Record<string, string> = {
    none: "—",
    buy_absorption: "امتصاص شراء",
    sell_absorption: "امتصاص بيع",
  };
  const absorbTone: Tone =
    a.absorption === "buy_absorption" ? "short" : a.absorption === "sell_absorption" ? "long" : "neutral";

  const divergeLabel: Record<string, string> = {
    none: "—",
    bullish_divergence: "تباعد صاعد",
    bearish_divergence: "تباعد هابط",
  };
  const divergeTone: Tone =
    a.divergence === "bullish_divergence" ? "long" : a.divergence === "bearish_divergence" ? "short" : "neutral";

  const cascadeLabel: Record<string, string> = {
    none: "منخفض",
    low: "منخفض",
    medium: "متوسط",
    high: "مرتفع",
  };
  const cascadeTone: Tone = a.cascadeRisk === "high" ? "short" : a.cascadeRisk === "medium" ? "warn" : "neutral";

  return (
    <FlowSection title="التدفق مقابل السعر" eyebrow="09 · Flow×Price">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-2xs text-muted">استجابة السعر</span>
          <Tag tone={responseTone}>{responseLabel[a.priceResponse] ?? a.priceResponse}</Tag>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-2xs text-muted">امتصاص</span>
          <Tag tone={absorbTone}>{absorbLabel[a.absorption] ?? a.absorption}</Tag>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-2xs text-muted">تباعد</span>
          <Tag tone={divergeTone}>{divergeLabel[a.divergence] ?? a.divergence}</Tag>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-2xs text-muted">خطر الانجراف</span>
          <Tag tone={cascadeTone}>{cascadeLabel[a.cascadeRisk] ?? a.cascadeRisk}</Tag>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-2xs text-muted">تغيّر السعر 5ث</span>
          <span className={`${num} text-2xs font-extrabold ${TONE_TEXT[responseTone]}`} dir="ltr">
            {a.priceDelta >= 0 ? "+" : ""}
            {a.priceDelta.toFixed(3)}%
          </span>
        </div>
      </div>
    </FlowSection>
  );
}

// ─── Composite panel ─────────────────────────────────────────────────

function windowOf(snap: FlowSnapshot, seconds: number): FlowWindow | null {
  return snap.state.windows.find((w) => w.seconds === seconds) ?? null;
}

export function FlowPanel({ snap }: { snap: FlowSnapshot | null | undefined }) {
  if (!snap) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-panel border border-line/80 bg-surface-1/40 p-6 text-center text-2xs text-muted">
        <Dot tone="warn" pulse />
        <span className="mt-2">جارٍ الاتصال بمصادر التدفق المباشر…</span>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <LiveFlowHeader snap={snap} />
      <PressurePanel snap={snap} />
      <NetFlowPanel snap={snap} />
      <TradeTape snap={snap} />
      <LargeTrades snap={snap} />
      <Liquidations snap={snap} />
      <CvdPanel snap={snap} />
      <FlowEvents snap={snap} />
      <FlowPricePanel snap={snap} />
    </div>
  );
}
