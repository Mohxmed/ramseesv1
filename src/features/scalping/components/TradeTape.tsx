"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

import type { FlowLatestRef } from "../hooks/useFlowLatest";
import type { NormalizedTrade } from "../flow/types";
import { ADAPTER_LABELS } from "../flow/exchanges";
import { Section, Tag, Dot } from "./terminal/TradingPrimitives";

/**
 * Real-time trade tape (تدفق الصفقات المباشر) — AGGR.TRADE-style, buffered.
 *
 * Every row is a coloured block: the BACKGROUND carries the signal, so direction
 * and size are readable at a glance without reading the number.
 *   · background tint = side (green=buy, red=sell)
 *   · background intensity = size (bigger notional = hotter fill)
 *   · ≥500K rows get a glowing ring — the "influential" trades stand out.
 *   · size filter (أكبر من) scopes the tape to the sizes you care about.
 *
 * Buffering: instead of vanishing with the engine's 5s rolling window, trades are
 * locally accumulated and kept visible for a full minute, then FADE OUT gradually
 * (older = dimmer). Fresh trades slide in, so large moves stay readable.
 */

const mono: CSSProperties = {
  fontVariantNumeric: "tabular-nums",
  fontFamily: "var(--font-mono), ui-monospace, monospace",
};

/* ─── Buffering state ─────────────────────────────────────────────── */

const TAPE_WINDOW_MS = 60_000; // keep trades readable for 60s before fading fully
const TAPE_CAP = 240; // hard cap so the list stays bounded
const TAPE_POLL_MS = 64; // merge cadence (ticks with the fast flow islands)
const TAPE_FADE_TICK_MS = 250; // min interval between pure-aging re-renders
const TAPE_FLASH_MS = 1_500; // a freshly buffered trade keeps its entrance flash

function dedupeKey(t: NormalizedTrade): string {
  return t.tradeId ?? `${t.receivedAt}_${t.exchange}_${t.side}_${t.price}_${t.quantity}`;
}

function liveCountOf(list: { status: string }[] | undefined): number {
  return (list ?? []).filter((c) => c.status === "LIVE").length;
}

export type TradeBuffer = {
  trades: NormalizedTrade[]; // chronological — render reversed (newest on top)
  now: number; // last aging clock (0 before the first tick → full opacity)
  live: boolean;
  liveCount: number;
  lastReceive: number; // receivedAt of the most recently buffered trade
};

export function useTradeBuffer(latest?: FlowLatestRef | null): TradeBuffer {
  const [buf, setBuf] = useState<TradeBuffer>({
    trades: [], // start empty — only trades arriving after mount show up
    now: 0, // 0 pre-first-tick → full opacity
    live: false,
    liveCount: 0,
    lastReceive: 0,
  });
  const seenRef = useRef<Set<string>>(new Set());
  const fadeTickRef = useRef(0);

  useEffect(() => {
    if (!latest) return;
    const tick = () => {
      const next = latest.current;
      if (!next) return;
      const now = Date.now();
      setBuf((prev) => {
        // Merge only genuinely new trades (deduped) — keeps push-then-expire.
        const seen = (seenRef.current ??= new Set(prev.trades.map(dedupeKey)));
        const fresh: NormalizedTrade[] = [];
        for (const t of next.recentTrades) {
          const k = dedupeKey(t);
          if (!seen.has(k)) {
            seen.add(k);
            fresh.push(t);
          }
        }
        const fadeDue = now - fadeTickRef.current >= TAPE_FADE_TICK_MS;
        if (!fresh.length && !fadeDue) return prev; // nothing changed → no re-render
        if (fadeDue) fadeTickRef.current = now;
        const cutoff = now - TAPE_WINDOW_MS;
        const pruned = [...prev.trades, ...fresh].filter((t) => t.receivedAt > cutoff).slice(-TAPE_CAP);
        seenRef.current = new Set(pruned.map(dedupeKey)); // keep the set bounded
        return {
          trades: pruned,
          now,
          live: liveCountOf(next.connections) > 0,
          liveCount: liveCountOf(next.connections),
          lastReceive: fresh.length ? Math.max(fresh[fresh.length - 1].receivedAt, prev.lastReceive) : prev.lastReceive,
        };
      });
    };
    tick();
    const timer = setInterval(tick, TAPE_POLL_MS);
    return () => clearInterval(timer);
  }, [latest]);

  return buf;
}

/* ─── Size filter (أكبر من) ───────────────────────────────────────── */

const SIZE_FILTERS: { label: string; value: number | null }[] = [
  { label: "الكل", value: null },
  { label: "10K", value: 10_000 },
  { label: "50K", value: 50_000 },
  { label: "100K", value: 100_000 },
  { label: "500K", value: 500_000 },
  { label: "1M", value: 1_000_000 },
];

function SizeFilter({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="text-3xs font-semibold uppercase tracking-wider text-muted">أكبر من</span>
      {SIZE_FILTERS.map((f) => {
        const active = f.value === value;
        return (
          <button
            key={f.label}
            type="button"
            onClick={() => onChange(f.value)}
            className={`rounded-chip border px-2 py-0.5 text-[11px] font-bold transition-colors ${
              active
                ? "border-accent bg-accent/20 text-accent-fg"
                : "border-line bg-surface-1/40 text-muted hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        );
      })}
    </div>
  );
}

/* ─── Heat background — direction + size from colour only ─────────── */

type HeatLevel = 0 | 1 | 2 | 3 | 4 | 5;

function heatOf(notional: number): HeatLevel {
  if (notional >= 1_000_000) return 5;
  if (notional >= 500_000) return 4;
  if (notional >= 100_000) return 3;
  if (notional >= 50_000) return 2;
  if (notional >= 10_000) return 1;
  return 0;
}

const ROW_BG: Record<"buy" | "sell", Record<HeatLevel, string>> = {
  buy: {
    0: "bg-up/10",
    1: "bg-up/20",
    2: "bg-up/30",
    3: "bg-up/45",
    4: "bg-up/60 ring-1 ring-up-fg/40 shadow-[0_0_10px_rgba(52,211,153,0.25)]",
    5: "bg-up/80 ring-1 ring-up-fg/60 shadow-[0_0_14px_rgba(52,211,153,0.45)]",
  },
  sell: {
    0: "bg-down/10",
    1: "bg-down/20",
    2: "bg-down/30",
    3: "bg-down/45",
    4: "bg-down/60 ring-1 ring-down-fg/40 shadow-[0_0_10px_rgba(248,113,113,0.25)]",
    5: "bg-down/80 ring-1 ring-down-fg/60 shadow-[0_0_14px_rgba(248,113,113,0.45)]",
  },
};

/* ─── Formatters ──────────────────────────────────────────────────── */

function usd(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const a = Math.abs(v);
  const s = a >= 1_000_000 ? `${(a / 1_000_000).toFixed(2)}M` : a >= 1_000 ? `${(a / 1_000).toFixed(1)}K` : a.toFixed(0);
  return (v < 0 ? "−" : "") + "$" + s;
}

function hhmmss(d: Date | number): string {
  const x = typeof d === "number" ? new Date(d) : d;
  const p = (n: number) => n.toString().padStart(2, "0");
  return `${p(x.getHours())}:${p(x.getMinutes())}:${p(x.getSeconds())}`;
}

/* ─── Row ─────────────────────────────────────────────────────────── */

function fadeOpacity(ageMs: number): number {
  if (ageMs <= 0) return 1;
  const eased = Math.min(1, ageMs / TAPE_WINDOW_MS);
  return Math.max(0.3, 1 - eased * 0.7);
}

function TapeRow({ trade, now, flash }: { trade: NormalizedTrade; now: number; flash: boolean }) {
  const buy = trade.side === "buy";
  const heat = heatOf(trade.notional);
  const bg = buy ? ROW_BG.buy[heat] : ROW_BG.sell[heat];
  const influential = heat >= 4;
  const venue = (ADAPTER_LABELS as Record<string, string | undefined>)[trade.exchange] ?? trade.exchange;

  return (
    <div
      className={`flex items-center gap-1.5 rounded-md border border-line/40 px-1.5 py-1 transition-opacity duration-200 ${bg}${
        flash ? " animate-fade-in-up" : ""
      }`}
      style={{ opacity: fadeOpacity(now ? now - trade.receivedAt : 0) }}
      title={`${venue} · ${buy ? "شراء" : "بيع"} · ${usd(trade.notional)} · ${hhmmss(trade.receivedAt)}${
        influential ? " · صفقة كبيرة مؤثرة" : ""
      }${trade.liquidation ? " · تصفية" : ""}`}
    >
      <span className="w-[46px] shrink-0 text-2xs text-zinc-400" dir="ltr" style={mono}>
        {hhmmss(trade.receivedAt)}
      </span>
      <span className="w-[34px] shrink-0 truncate text-2xs text-zinc-300">{venue}</span>
      <span className={`w-[20px] shrink-0 text-2xs font-black ${buy ? "text-up-fg" : "text-down-fg"}`}>
        {buy ? "B" : "S"}
      </span>
      {trade.liquidation ? (
        <span className="shrink-0 rounded-sm bg-warn/20 px-1 text-2xs font-extrabold text-warn-fg">LIQ</span>
      ) : null}
      <span
        className={`ml-auto truncate leading-none ${influential ? "text-[13px] font-black text-zinc-50" : "text-xs font-extrabold text-zinc-200"}`}
        dir="ltr"
        style={mono}
      >
        {usd(trade.notional)}
      </span>
    </div>
  );
}

/* ─── Panel ───────────────────────────────────────────────────────── */

export function TradeTapePanel({ latest }: { latest?: FlowLatestRef | null }) {
  const [minSize, setMinSize] = useState<number | null>(null);
  const { trades, now, live, lastReceive } = useTradeBuffer(latest);
  const filtered = minSize == null ? trades : trades.filter((t) => t.notional >= (minSize as number));
  const latestRow = filtered[filtered.length - 1];
  const total = filtered.reduce((s, t) => s + t.notional, 0);

  return (
    <Section
      title="تدفق الصفقات المباشر"
      collapsible
      bodyClassName="p-2 flex flex-col"
      snippet={
        latestRow ? (
          <div className="flex items-center justify-between gap-3">
            <span className="text-2xs text-muted">آخر صفقة</span>
            <span className="text-xs font-bold text-zinc-100" dir="ltr" style={mono}>
              {usd(latestRow.notional)} · {ADAPTER_LABELS[latestRow.exchange] ?? latestRow.exchange}
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <span className="text-2xs text-muted">شريط الصفقات</span>
            <span className="text-xs text-muted">بانتظار الصفقات</span>
          </div>
        )
      }
      actions={
        <Tag tone={live ? "good" : "warn"}>
          <Dot tone={live ? "good" : "warn"} pulse={live} />
          {live ? "مباشر" : "مقطوع"}
        </Tag>
      }
    >
      <SizeFilter value={minSize} onChange={setMinSize} />

      <div className="mt-2 max-h-[320px] min-h-0 flex-1 space-y-1 overflow-y-auto pr-0.5">
        {trades.length === 0 ? (
          <div className="py-6 text-center text-2xs text-muted">بانتظار الصفقات المباشرة…</div>
        ) : filtered.length === 0 ? (
          <div className="py-6 text-center text-2xs text-muted">لا صفقات بهذا الحجم حالياً — جرّب فلترة أخف</div>
        ) : (
          [...filtered].reverse().map((t) => (
            <TapeRow
              key={dedupeKey(t)}
              trade={t}
              now={now}
              flash={lastReceive > 0 && t.receivedAt >= lastReceive - TAPE_FLASH_MS}
            />
          ))
        )}
      </div>

      <div className="mt-2 flex items-center justify-between border-t border-line/70 pt-1.5 text-3xs text-muted">
        <span>{filtered.length} صفقة</span>
        <span dir="ltr" style={mono}>
          إجمالي {usd(total)}
        </span>
        <span className="text-muted/70">احتفاظ {TAPE_WINDOW_MS / 1000}ث</span>
      </div>
    </Section>
  );
}