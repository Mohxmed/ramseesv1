"use client";

import {
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  IconButton,
  LinearProgress,
  Tooltip,
  Typography,
} from "@mui/material";
import { Activity, ChevronDown, ChevronUp, Flame, Zap } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import type { ReactNode } from "react";
import { useState } from "react";
import type { FlowSnapshot, FlowWindow, NormalizedTrade } from "../flow/types";
import { ThemeGate } from "@/components/ui/mui-theme";
import { colors, radius, typography } from "@/components/ui/design-tokens";
import { ADAPTER_LABELS } from "../flow/exchanges";
import type { Tone } from "./terminal/TradingPrimitives";

/**
 * Real-Time AGGR Flow Window — rebuilt on Material UI.
 *
 * A single, consistent visual system (unified card chrome, one type scale,
 * one colour grammar) so no two panels ever disagree. RTL-first, dark-only,
 * tuned to the app's design tokens. Every number is read straight off the
 * engine snapshot — no mocks, no recompute.
 */

const toneOf: Record<Tone, string> = {
  long: colors.upFg,
  short: colors.downFg,
  neutral: colors.foreground,
  warn: colors.warnFg,
  good: colors.good,
  quiet: colors.muted,
};

const flowTone = (n: number): Tone => (n > 0 ? "long" : n < 0 ? "short" : "neutral");

const row = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
} as const;

const rowStart = {
  display: "flex",
  alignItems: "center",
} as const;

// ─── Formatting ──────────────────────────────────────────────────────

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

/** Build a per-second net-flow series from the live tape. */
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

// ─── Unified card chrome ─────────────────────────────────────────────

function FlowCard({
  title,
  eyebrow,
  icon,
  tint,
  right,
  children,
}: {
  title: string;
  eyebrow?: string;
  icon?: ReactNode;
  tint?: Tone;
  right?: ReactNode;
  children: ReactNode;
}) {
  const accent = tint ? toneOf[tint] : colors.foreground;
  return (
    <Card
      variant="outlined"
      sx={{
        bgcolor: "background.paper",
        borderColor: "divider",
        borderRadius: radius.panel,
        borderWidth: 1,
        "&:hover": { borderColor: "rgba(244,244,245,0.22)" },
        overflow: "hidden",
        boxShadow: "0 1px 0 rgba(255,255,255,0.02) inset",
      }}
    >
      <Box sx={{ height: 2, background: `linear-gradient(90deg, transparent, ${accent}, transparent)`, opacity: 0.75 }} />
      <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
        <Box sx={{ ...rowStart, justifyContent: "space-between", mb: 1 }}>
          <Box sx={{ ...rowStart, gap: 1 }}>
            {icon ? (
              <Box sx={{ color: "text.secondary", display: "flex" }}>{icon}</Box>
            ) : null}
            <Typography variant="subtitle1" sx={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", color: "text.primary" }}>
              {title}
            </Typography>
            {eyebrow ? (
              <Typography variant="caption" sx={{ color: "text.disabled", fontSize: 10 }}>
                {eyebrow}
              </Typography>
            ) : null}
          </Box>
          {right}
        </Box>
        {children}
      </CardContent>
    </Card>
  );
}

/** A labelled stat value cell with hover tooltip. */
function StatCell({
  label,
  value,
  tone = "neutral",
  tip,
  size = "md",
}: {
  label: string;
  value: string;
  tone?: Tone;
  tip?: string;
  size?: "md" | "lg";
}) {
  const body = (
    <Box sx={{ border: `1px solid ${colors.line}`, borderRadius: radius.chip, bgcolor: "rgba(24,24,27,0.6)", px: 1.2, py: 1 }}>
      <Typography variant="caption" sx={{ color: "text.secondary", fontSize: 10, lineHeight: 1, display: "block" }}>
        {label}
      </Typography>
      <Typography
        sx={{
          mt: 0.5,
          fontFamily: typography.mono,
          fontWeight: 800,
          fontSize: size === "lg" ? 20 : 15,
          lineHeight: 1,
          color: toneOf[tone],
          letterSpacing: "-0.01em",
        }}
        dir="ltr"
      >
        {value}
      </Typography>
    </Box>
  );
  return tip ? <Tooltip title={tip} arrow>{body}</Tooltip> : body;
}

function Bar({ parts }: { parts: { value: number; color: string }[] }) {
  return (
    <Box sx={{ display: "flex", width: "100%", height: 6, borderRadius: 999, overflow: "hidden", bgcolor: "rgba(39,39,42,0.8)" }}>
      {parts.map((p, i) => (
        <Box key={i} sx={{ width: `${pct(p.value, parts.reduce((a, b) => a + b.value, 0))}%`, bgcolor: p.color, transition: "width 300ms ease" }} />
      ))}
    </Box>
  );
}

// ─── 01 · Header (exchanges status) ──────────────────────────────────

const statusTone: Record<string, Tone> = {
  LIVE: "good",
  STALE: "warn",
  CONNECTING: "warn",
  DISCONNECTED: "quiet",
  ERROR: "warn",
};
const statusLabel: Record<string, string> = {
  LIVE: "مباشر",
  STALE: "متأخر",
  CONNECTING: "يتصل",
  DISCONNECTED: "مقطوع",
  ERROR: "خطأ",
};

function StatusChip({ exchange, status, latency, ev }: { exchange: string; status: string; latency: number; ev: number }) {
  const tone = statusTone[status] ?? "quiet";
  const color = toneOf[tone];
  const isLive = status === "LIVE";
  return (
    <Tooltip arrow title={`${ADAPTER_LABELS[exchange] ?? exchange} · ${statusLabel[status] ?? status} · ${ev} حدث`}>
      <Box
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: 1,
          border: `1px solid ${isLive ? "rgba(52,211,153,0.30)" : colors.line}`,
          borderRadius: radius.chip,
          bgcolor: isLive ? "rgba(16,185,129,0.08)" : "rgba(24,24,27,0.6)",
          px: 1,
          py: 0.5,
          height: 34,
          cursor: "default",
        }}
      >
        <Box
          sx={{
            width: 6,
            height: 6,
            borderRadius: 99,
            bgcolor: color,
            boxShadow: isLive ? `0 0 8px ${color}` : "none",
            animation: isLive ? "flowPulse 1.4s ease-in-out infinite" : "none",
            flexShrink: 0,
          }}
        />
        <Typography variant="caption" sx={{ fontSize: 10, fontWeight: 700, color: "text.primary" }}>
          {ADAPTER_LABELS[exchange] ?? exchange}
        </Typography>
        <Typography variant="caption" sx={{ fontSize: 10, fontWeight: 600, color, whiteSpace: "nowrap" }}>
          {statusLabel[status] ?? status}
        </Typography>
        <Typography
          variant="caption"
          sx={{ fontFamily: typography.mono, fontSize: 9, color: "text.secondary", minWidth: 40, textAlign: "right" }}
          dir="ltr"
        >
          {isLive ? `${latency}ms` : "—"} مللي ثانية
        </Typography>
      </Box>
    </Tooltip>
  );
}

function LiveFlowHeader({ snap, minimized, onToggle }: { snap: FlowSnapshot; minimized: boolean; onToggle: () => void }) {
  const { connections, state } = snap;
  const live = connections.filter((c) => c.status === "LIVE");
  const liveLat = live.filter((c) => c.latency >= 0);
  const avgLatency = liveLat.length > 0 ? Math.round(liveLat.reduce((a, b) => a + b.latency, 0) / liveLat.length) : null;

  return (
    <FlowCard
      title="التدفق المباشر"
      eyebrow="Live Aggregation"
      icon={<Activity size={13} />}
      tint={live.length > 0 ? "good" : "warn"}
      right={
        <IconButton size="small" onClick={onToggle} sx={{ color: "text.secondary", p: 0.5, "&:hover": { color: "text.primary", bgcolor: "rgba(255,255,255,0.06)" } }}>
          {minimized ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </IconButton>
      }
    >
      {minimized ? (
        <Box sx={{ ...row, gap: 1 }}>
          <StatCell label="الغطاء" value={state.quality.coverage} tone={live.length > 0 ? "good" : "warn"} />
          <StatCell label="الكمون" value={avgLatency !== null ? `${avgLatency}ms` : "N/A"} tone={live.length > 0 ? "good" : "neutral"} />
          <StatCell label="الحالة" value={live.length > 0 ? "مباشر" : "لا اتصال"} tone={live.length > 0 ? "good" : "warn"} />
        </Box>
      ) : (
        <Box sx={{ display: "grid", gap: 1.5 }}>
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1 }}>
            <StatCell label="الغطاء" value={state.quality.coverage} tone={live.length > 0 ? "good" : "warn"} tip="عدد البورصات المتصلة من الإجمالي" />
            <StatCell label="الكمون" value={avgLatency !== null ? `${avgLatency}ms` : "N/A"} tip="متوسط زمن وصول الصفقات" />
            <StatCell label="الأحداث/ث" value={`${state.quality.eventRate}`} tip="معدل الأحداث في الثانية" />
          </Box>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
            {connections.map((c) => (
              <StatusChip key={c.exchange} exchange={c.exchange} status={c.status} latency={c.latency} ev={c.eventCount} />
            ))}
          </Box>
        </Box>
      )}
    </FlowCard>
  );
}

// ─── 02 · Buy / Sell pressure ────────────────────────────────────────

function PressurePanel({ snap }: { snap: FlowSnapshot }) {
  const w = snap.state.windows.find((x) => x.seconds === 60);
  if (!w) return null;
  const total = w.buyNotional + w.sellNotional;
  return (
    <FlowCard title="ضغط الشراء / البيع" eyebrow="60s" icon={<Zap size={13} />}>
      <Box sx={{ mb: 1.5 }}>
        <Bar parts={[{ value: w.buyNotional, color: colors.upFg }, { value: w.sellNotional, color: colors.downFg }]} />
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
        <StatCell label={`شراء · ${pct(w.buyNotional, total).toFixed(0)}%`} value={usd(w.buyNotional)} tone="long" />
        <StatCell label={`بيع · ${pct(w.sellNotional, total).toFixed(0)}%`} value={usd(w.sellNotional)} tone="short" />
      </Box>
    </FlowCard>
  );
}

// ─── 03 · Net flow ───────────────────────────────────────────────────

function NetFlowPanel({ snap }: { snap: FlowSnapshot }) {
  const { state } = snap;
  const w1s = state.windows.find((x) => x.seconds === 1);
  const net = w1s?.netFlow ?? 0;
  const data = netFlowSeries(snap.recentTrades);
  const spyTone = flowTone(net) === "short" ? colors.downFg : colors.upFg;
  return (
    <FlowCard title="التدفق الصافي" eyebrow="Net / Sec" icon={<Activity size={13} />}>
      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, mb: 1 }}>
        <StatCell label="صافي / ثانية" value={signedUsd(net)} tone={flowTone(net)} tip="صافي حجم الأوامر خلال الثانية الماضية" />
        <StatCell label="التسارع" value={signedUsd(state.velocity.flowAcceleration)} tone={flowTone(state.velocity.flowAcceleration)} />
      </Box>
      <Box sx={{ height: 34, width: "100%" }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="netflowFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={spyTone} stopOpacity={0.5} />
                <stop offset="100%" stopColor={spyTone} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="v" stroke={spyTone} strokeWidth={1.5} fill="url(#netflowFill)" isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </Box>
    </FlowCard>
  );
}

// ─── 04 · Trade tape ─────────────────────────────────────────────────

function TapeRow({ trade }: { trade: NormalizedTrade }) {
  const tone: Tone = trade.side === "buy" ? "long" : "short";
  const color = toneOf[tone];
  return (
    <Box sx={{ ...row, gap: 1, py: 0.6, px: 1, borderRadius: 1, bgcolor: "rgba(24,24,27,0.35)", "&:hover": { bgcolor: "rgba(39,39,42,0.5)" } }}>
      <Typography variant="caption" sx={{ fontFamily: typography.mono, fontSize: 9, color: "text.disabled", width: 46 }} dir="ltr">
        {hhmmss(trade.timestamp)}
      </Typography>
      <Typography variant="caption" sx={{ fontSize: 9, fontWeight: 600, color: "text.secondary", width: 40 }}>
        {ADAPTER_LABELS[trade.exchange] ?? trade.exchange}
      </Typography>
      <Typography variant="caption" sx={{ fontSize: 9, fontWeight: 800, color, width: 34 }}>
        {trade.side === "buy" ? "شراء" : "بيع"}
      </Typography>
      <Typography variant="caption" sx={{ fontFamily: typography.mono, fontSize: 10, fontWeight: 700, color: "text.primary", flex: 1, textAlign: "right" }} dir="ltr">
        {usd(trade.notional)}
      </Typography>
      {trade.liquidation ? (
        <Chip label="LIQ" size="small" sx={{ height: 16, fontSize: 8, fontWeight: 700, color: colors.warnFg, borderColor: "rgba(245,158,11,0.4)", bgcolor: "rgba(245,158,11,0.12)" }} />
      ) : null}
    </Box>
  );
}

function TradeTape({ snap }: { snap: FlowSnapshot }) {
  const trades = snap.recentTrades;
  return (
    <FlowCard
      title="شريط الصفقات"
      eyebrow="Tape"
      icon={<Activity size={13} />}
      tint="good"
      right={
        <Box sx={{ ...rowStart, gap: 0.75 }}>
          <Box sx={{ width: 6, height: 6, borderRadius: 99, bgcolor: colors.good, boxShadow: `0 0 8px ${colors.good}` }} />
          <Typography variant="caption" sx={{ fontSize: 9, color: "text.secondary" }}>مباشر</Typography>
        </Box>
      }
    >
      {trades.length === 0 ? (
        <Typography variant="caption" sx={{ color: "text.disabled", display: "block", textAlign: "center", py: 2 }}>
          بانتظار الصفقات المباشرة…
        </Typography>
      ) : (
        <Box sx={{ maxHeight: 256, overflow: "auto", pr: 0.5, display: "grid", gap: 0.5 }}>
          {[...trades].reverse().map((t, i) => (
            <TapeRow key={`${t.exchange}_${t.tradeId ?? i}_${i}`} trade={t} />
          ))}
        </Box>
      )}
    </FlowCard>
  );
}

// ─── 05 · Large trades ───────────────────────────────────────────────

function LargeTrades({ snap }: { snap: FlowSnapshot }) {
  const { state } = snap;
  const buys = state.largeBuys.slice(-6).map((t) => ({ ...t, side: "buy" as const }));
  const sells = state.largeSells.slice(-6).map((t) => ({ ...t, side: "sell" as const }));
  const all = [...buys, ...sells].sort((a, b) => b.timestamp - a.timestamp).slice(0, 8);
  if (all.length === 0) {
    return (
      <FlowCard title="الصفقات الكبيرة" eyebrow="Large">
        <Typography variant="caption" sx={{ color: "text.disabled" }}>لا صفقات كبيرة مؤخراً</Typography>
      </FlowCard>
    );
  }
  return (
    <FlowCard title="الصفقات الكبيرة" eyebrow="Large" icon={<Activity size={13} />}>
      <Box sx={{ display: "grid", gap: 0.5 }}>
        {all.map((t, i) => {
          const tone: Tone = t.side === "buy" ? "long" : "short";
          return (
            <Box key={`${t.exchange}_${t.timestamp}_${i}`} sx={{ ...row, gap: 1, py: 0.5, px: 1, borderRadius: 1, "&:hover": { bgcolor: "rgba(39,39,42,0.5)" } }}>
              <Typography variant="caption" sx={{ fontFamily: typography.mono, fontSize: 9, color: "text.disabled", width: 46 }} dir="ltr">
                {hhmmss(t.timestamp)}
              </Typography>
              <Typography variant="caption" sx={{ fontSize: 9, fontWeight: 600, color: "text.secondary", width: 40 }}>
                {ADAPTER_LABELS[t.exchange] ?? t.exchange}
              </Typography>
              <Typography variant="caption" sx={{ fontSize: 9, fontWeight: 800, color: toneOf[tone], width: 34 }}>
                {t.side === "buy" ? "شراء" : "بيع"}
              </Typography>
              <Typography variant="caption" sx={{ fontFamily: typography.mono, fontSize: 10, fontWeight: 700, color: "text.primary", flex: 1, textAlign: "right" }} dir="ltr">
                {usd(t.notional)}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </FlowCard>
  );
}

// ─── 06 · Liquidations ───────────────────────────────────────────────

function Liquidations({ snap }: { snap: FlowSnapshot }) {
  const liq = snap.state.liquidations;
  const total = liq.totalVolume;
  return (
    <FlowCard
      title="التصفية"
      eyebrow="Liq"
      icon={<Flame size={13} />}
      tint={liq.burst ? "warn" : "neutral"}
      right={
        liq.burst ? (
          <Chip label="انفجار" size="small" sx={{ height: 18, fontSize: 9, fontWeight: 700, color: colors.warnFg, borderColor: "rgba(245,158,11,0.4)", bgcolor: "rgba(245,158,11,0.12)" }} />
        ) : undefined
      }
    >
      {total === 0 ? (
        <Typography variant="caption" sx={{ color: "text.disabled" }}>لا تصفيات مباشرة</Typography>
      ) : (
        <Box sx={{ display: "grid", gap: 1.5 }}>
          <Bar parts={[{ value: liq.longVolume, color: colors.downFg }, { value: liq.shortVolume, color: colors.upFg }]} />
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
            <StatCell label={`لونج ${pct(liq.longVolume, total).toFixed(0)}%`} value={usd(liq.longVolume)} tone="short" />
            <StatCell label={`شورت ${pct(liq.shortVolume, total).toFixed(0)}%`} value={usd(liq.shortVolume)} tone="long" />
          </Box>
          <Box sx={row}>
            <Typography variant="caption" sx={{ fontSize: 10, color: "text.secondary" }}>السرعة</Typography>
            <Typography variant="caption" sx={{ fontFamily: typography.mono, fontSize: 10, fontWeight: 700, color: toneOf[liq.burst ? "short" : "neutral"] }} dir="ltr">
              {usd(liq.velocity)}/s
            </Typography>
          </Box>
        </Box>
      )}
    </FlowCard>
  );
}

// ─── 07 · CVD ────────────────────────────────────────────────────────

function CvdPanel({ snap }: { snap: FlowSnapshot }) {
  const cvd = snap.state.cvd;
  const cells = [
    { label: "1ث", v: cvd.cvdDelta1s },
    { label: "5ث", v: cvd.cvdDelta5s },
    { label: "30ث", v: cvd.cvdDelta30s },
    { label: "1د", v: cvd.cvdDelta1m },
  ];
  return (
    <FlowCard title="دلتا الحجم التراكمي" eyebrow="CVD" icon={<Activity size={13} />}>
      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0.75 }}>
        {cells.map((c) => (
          <StatCell key={c.label} label={c.label} value={signedUsd(c.v)} tone={flowTone(c.v)} />
        ))}
      </Box>
    </FlowCard>
  );
}

// ─── 08 · Events / windows ───────────────────────────────────────────

function WindowRow({ w }: { w: FlowWindow }) {
  const tone: Tone = flowTone(w.netFlow);
  const total = w.buyNotional + w.sellNotional;
  return (
    <Box sx={{ display: "grid", gap: 0.5, py: 0.25 }}>
      <Box sx={row}>
        <Typography variant="caption" sx={{ fontSize: 10, color: "text.secondary" }}>{w.seconds}ث</Typography>
        <Typography variant="caption" sx={{ fontFamily: typography.mono, fontSize: 10, fontWeight: 700, color: toneOf[tone] }} dir="ltr">
          {signedUsd(w.netFlow)}
        </Typography>
        <Typography variant="caption" sx={{ fontFamily: typography.mono, fontSize: 9, color: "text.disabled" }}>{w.tradeCount} صفقة</Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={pct(w.buyNotional, total)}
        sx={{ height: 4, borderRadius: 99, bgcolor: "rgba(239,68,68,0.35)", "& .MuiLinearProgress-bar": { bgcolor: colors.upFg, borderRadius: 99 } }}
      />
    </Box>
  );
}

function FlowEvents({ snap }: { snap: FlowSnapshot }) {
  const windows = snap.state.windows.filter((w) => [1, 5, 30, 60].includes(w.seconds));
  return (
    <FlowCard title="النوافذ" eyebrow="Time Windows" icon={<Activity size={13} />}>
      <Box sx={{ display: "grid", gap: 1 }}>
        {windows.map((w) => (
          <WindowRow key={w.seconds} w={w} />
        ))}
      </Box>
    </FlowCard>
  );
}

// ─── 09 · Flow × Price ───────────────────────────────────────────────

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
  const rows: { label: string; value: string; tone: Tone }[] = [
    { label: "استجابة السعر", value: responseLabel[a.priceResponse] ?? a.priceResponse, tone: responseTone },
    { label: "امتصاص", value: a.absorption === "buy_absorption" ? "امتصاص شراء" : a.absorption === "sell_absorption" ? "امتصاص بيع" : "—", tone: a.absorption === "buy_absorption" ? "short" : a.absorption === "sell_absorption" ? "long" : "neutral" },
    { label: "تباعد", value: a.divergence === "bullish_divergence" ? "تباعد صاعد" : a.divergence === "bearish_divergence" ? "تباعد هابط" : "—", tone: a.divergence === "bullish_divergence" ? "long" : a.divergence === "bearish_divergence" ? "short" : "neutral" },
    { label: "خطر الانجراف", value: a.cascadeRisk === "high" ? "مرتفع" : a.cascadeRisk === "medium" ? "متوسط" : "منخفض", tone: a.cascadeRisk === "high" ? "short" : a.cascadeRisk === "medium" ? "warn" : "neutral" },
  ];
  return (
    <FlowCard title="التدفق مقابل السعر" eyebrow="Flow × Price">
      <Box sx={{ display: "grid", gap: 1 }}>
        {rows.map((r) => (
          <Box key={r.label} sx={row}>
            <Typography variant="caption" sx={{ fontSize: 10, color: "text.secondary" }}>{r.label}</Typography>
            <Typography variant="caption" sx={{ fontSize: 10, fontWeight: 700, color: toneOf[r.tone] }}>{r.value}</Typography>
          </Box>
        ))}
        <Divider sx={{ borderColor: "divider", my: 0.5 }} />
        <Box sx={row}>
          <Typography variant="caption" sx={{ fontSize: 10, color: "text.secondary" }}>تغيّر السعر</Typography>
          <Typography variant="caption" sx={{ fontFamily: typography.mono, fontSize: 11, fontWeight: 800, color: toneOf[responseTone] }} dir="ltr">
            {a.priceDelta >= 0 ? "+" : ""}
            {a.priceDelta.toFixed(3)}%
          </Typography>
        </Box>
      </Box>
    </FlowCard>
  );
}

// ─── Composite ───────────────────────────────────────────────────────

export function FlowPanel({ snap }: { snap: FlowSnapshot | null | undefined }) {
  const [minimized, setMinimized] = useState(false);

  if (!snap) {
    return (
      <ThemeGate>
        <Card variant="outlined" sx={{ bgcolor: "background.paper", borderColor: "divider", borderRadius: radius.panel }}>
          <CardContent sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1, py: 6 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: 99, bgcolor: colors.warnFg, boxShadow: `0 0 10px ${colors.warnFg}` }} />
            <Typography variant="caption" sx={{ color: "text.disabled" }}>جارٍ الاتصال بمصادر التدفق المباشر…</Typography>
          </CardContent>
        </Card>
      </ThemeGate>
    );
  }

  return (
    <ThemeGate>
      <style>{`
        @keyframes flowPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
      `}</style>
      <Box sx={{ display: "grid", gap: 1.25 }}>
        <LiveFlowHeader snap={snap} minimized={minimized} onToggle={() => setMinimized((v) => !v)} />
        <PressurePanel snap={snap} />
        <NetFlowPanel snap={snap} />
        <TradeTape snap={snap} />
        <LargeTrades snap={snap} />
        <Liquidations snap={snap} />
        <CvdPanel snap={snap} />
        <FlowEvents snap={snap} />
        <FlowPricePanel snap={snap} />
      </Box>
    </ThemeGate>
  );
}
