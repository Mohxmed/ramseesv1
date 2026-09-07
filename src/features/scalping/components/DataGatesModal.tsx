"use client";

import { useState } from "react";
import type { CSSProperties } from "react";

import type { ExchangeConnection, FlowSnapshot } from "../flow/types";
import { ADAPTER_LABELS } from "../flow/exchanges";
import { Dot, TONE_TEXT, type Tone } from "./terminal/TradingPrimitives";
import { Tip } from "./terminal/TerminalTip";
import { Modal } from "@/components/ui/overlay";
import { WifiIcon } from "@/components/icons/icons";
import { ThemeGate } from "@/components/ui/mui-theme";
import { useFlowLatest, type FlowLatestRef } from "../hooks/useFlowLatest";

const mono: CSSProperties = {
  fontVariantNumeric: "tabular-nums",
  fontFamily: "var(--font-mono), ui-monospace, monospace",
};

const STATUS_META: Record<string, { label: string; tone: Tone }> = {
  LIVE: { label: "مباشر", tone: "good" },
  CONNECTED: { label: "متصل", tone: "warn" },
  SUBSCRIBING: { label: "جارٍ الاشتراك", tone: "warn" },
  DEGRADED: { label: "متدهور", tone: "warn" },
  STALE: { label: "متأخر", tone: "warn" },
  CONNECTING: { label: "يتصل", tone: "warn" },
  DISCONNECTED: { label: "مقطوع", tone: "quiet" },
  ERROR: { label: "خطأ", tone: "warn" },
};

/** Platform letter marks — short code + brand colour so identity reads at a glance. */
const PLATFORM: Record<string, { code: string; bg: string; fg: string }> = {
  binance_futures: { code: "BN", bg: "#F0B90B", fg: "#1a1200" },
  binance_spot: { code: "BN", bg: "#F0B90B", fg: "#1a1200" },
  bybit: { code: "BY", bg: "#F5A900", fg: "#1a1200" },
  bitget: { code: "BG", bg: "#00AEEC", fg: "#06222a" },
  okx: { code: "OK", bg: "#1a1a1a", fg: "#ffffff" },
  mexc: { code: "MX", bg: "#1E7DF0", fg: "#ffffff" },
  hyperliquid: { code: "HL", bg: "#E2E8F0", fg: "#0b1220" },
  coinbase: { code: "CB", bg: "#0052FF", fg: "#ffffff" },
  gateio: { code: "GT", bg: "#2F54EB", fg: "#ffffff" },
  kucoin: { code: "KC", bg: "#24AE8F", fg: "#04201a" },
  kraken: { code: "KR", bg: "#6A4CFF", fg: "#ffffff" },
  deribit: { code: "DR", bg: "#1a1a2e", fg: "#F4E3D7" },
  upbit: { code: "UP", bg: "#2F6BFF", fg: "#ffffff" },
  htx: { code: "HT", bg: "#0F2D7C", fg: "#ffffff" },
  bitstamp: { code: "BS", bg: "#FF6B00", fg: "#ffffff" },
  bitfinex: { code: "BI", bg: "#5A7D9C", fg: "#ffffff" },
};

/** Fall back to the label short-form when a platform isn't in the map above. */
function platformCode(exchange: string): { code: string; bg: string; fg: string } {
  const p = PLATFORM[exchange];
  if (p) return p;
  return { code: (ADAPTER_LABELS[exchange] ?? exchange).slice(0, 2).toUpperCase(), bg: "#5a6472", fg: "#ffffff" };
}

function hhmmss(d: Date | number): string {
  const x = typeof d === "number" ? new Date(d) : d;
  const p = (n: number) => n.toString().padStart(2, "0");
  return `${p(x.getHours())}:${p(x.getMinutes())}:${p(x.getSeconds())}`;
}

/** One labelled line inside the platform tooltip. */
function TipRow({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex items-center justify-between gap-3">
      <span className="text-muted">{label}</span>
      <span dir="ltr" className="font-semibold text-zinc-100" style={mono}>{value}</span>
    </span>
  );
}

function GatewayRow({ conn }: { conn: ExchangeConnection }) {
  const meta = STATUS_META[conn.status] ?? { label: conn.status, tone: "quiet" as Tone };
  const isLive = conn.status === "LIVE";
  const p = platformCode(conn.exchange);
  const fullName = conn.label || ADAPTER_LABELS[conn.exchange] || conn.exchange;
  const dim = !isLive;

  const tooltip = (
    <div className="flex min-w-[170px] flex-col gap-1 text-[11px]">
      <span className="mb-0.5 flex items-center gap-1.5 font-bold text-zinc-100">
        {fullName}
        <span className="font-medium normal-case text-muted">{meta.label}</span>
      </span>
      <TipRow label="الاستجابة" value={conn.latency >= 0 ? `${conn.latency}ms` : "N/A"} />
      <TipRow label="RTT (نبضة)" value={conn.rttMs >= 0 ? `${conn.rttMs}ms` : "N/A"} />
      <TipRow label="عمر البيانات" value={conn.dataAge >= 0 ? `${conn.dataAge}ms` : "N/A"} />
      <TipRow label="زمن النقل" value={conn.transportLatency >= 0 ? `${conn.transportLatency}ms` : "N/A"} />
      <TipRow label="زمن المعالجة" value={conn.processingLatency >= 0 ? `${conn.processingLatency}ms` : "N/A"} />
      {conn.lastEventAgeMs >= 0 ? <TipRow label="مضى على آخر حدث" value={`${conn.lastEventAgeMs}ms`} /> : null}
      {conn.connectionAgeMs > 0 ? <TipRow label="عمر الاتصال" value={`${(conn.connectionAgeMs / 1000).toFixed(0)}ث`} /> : null}
      <TipRow label="آخر تحديث" value={conn.receivedAt ? hhmmss(conn.receivedAt) : "N/A"} />
      <TipRow label="حدث/ث" value={String(conn.messagesPerSec)} />
      <TipRow label="أحداث" value={String(conn.eventCount)} />
      {conn.droppedEvents > 0 ? <TipRow label="مُسقَط" value={String(conn.droppedEvents)} /> : null}
      {conn.sequenceGaps > 0 ? <TipRow label="فجوات التسلسل" value={String(conn.sequenceGaps)} /> : null}
      <TipRow label="الاتصال" value={conn.wsOpen ? "مفتوح" : "مغلق"} />
      {conn.reconnectCount > 0 ? <TipRow label="إعادة الاتصال" value={String(conn.reconnectCount)} /> : null}
    </div>
  );

  return (
    <div
      dir="rtl"
      className={`flex items-center justify-between gap-2 rounded-panel border border-line bg-surface-1/30 px-2.5 py-2 transition-opacity ${dim ? "opacity-55" : ""}`}
    >
      <Tip title={tooltip}>
        <span className="flex items-center gap-2">
          <span
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] text-[10px] font-extrabold leading-none"
            style={{ backgroundColor: p.bg, color: p.fg }}
          >
            {p.code}
          </span>
          <Dot tone={meta.tone} pulse={isLive} />
        </span>
      </Tip>
      <span className="shrink-0 text-2xs text-zinc-300" dir="ltr" style={mono}>
        {conn.latency >= 0 ? `${conn.latency}ms` : "N/A"}
      </span>
    </div>
  );
}

/** Live data-gates summary: aggregated tiles + startup spread + per-gateway rail. */
export function DataGatesContent({ snap }: { snap: FlowSnapshot }) {
  const { connections, state } = snap;
  const live = connections.filter((c) => c.status === "LIVE");
  // Fault-isolated aggregate latency: fastest HEALTHY live source. A plain mean
  // lets one slow/flatlined platform (e.g. GT at 38s) drag the reported
  // response time up for everyone — here we ignore stale/too-slow sources and
  // report the best live feed's latency instead.
  const now = snap.state.timestamp; // derived from the snapshot → render-pure
  const healthyLat = live
    .filter((c) => Number.isFinite(c.latency) && c.latency >= 0 && c.latency <= 5000 && now - c.receivedAt <= 2500)
    .map((c) => c.latency);
  const avgLatency = healthyLat.length > 0 ? Math.min(...healthyLat) : null;
  const overallTone: Tone = live.length > 0 ? "good" : "warn";

  // Freshness (fault-isolated best-of): age of the freshest LIVE source's data.
  const liveAges = live
    .filter((c) => Number.isFinite(c.dataAge) && c.dataAge >= 0)
    .map((c) => c.dataAge);
  const dataAge = liveAges.length > 0 ? Math.min(...liveAges) : null;

  const tiles: { label: string; tip: string; value: string; tone: Tone; compact?: boolean }[] = [
    {
      label: "المتصل",
      tip: "عدد المنصات المتصلة الآن من إجمالي المنصات المدعومة",
      value: `${live.length}/${connections.length}`,
      tone: overallTone,
    },
    {
      label: "الاستجابة",
      tip: "زمن استجابة أسرع مصدر حي سليم (Fault-Isolated) — يستبعد المصادر البطيئة/المجمدة حتى لا تسحب أوقات استجابة المنصات السريعة — يظهر N/A عند عدم وجود مصدر حي",
      value: avgLatency !== null ? `${avgLatency}ms` : "N/A",
      tone: live.length > 0 ? "good" : "neutral",
    },
    {
      label: "عمر البيانات",
      tip: "أحدث عمر لبيانات أسرع مصدر حي (Fault-Isolated) — يقيس طراوة القراءة اللحظية بغضّ النظر عن زمن النقل — يظهر N/A عند عدم وجود مصدر حي",
      value: dataAge !== null ? `${dataAge}ms` : "N/A",
      tone: dataAge !== null && dataAge <= 5000 ? "good" : "neutral",
    },
    {
      label: "حدث/ث",
      tip: "عدد أحداث التداول المستلمة في الثانية الواحدة",
      value: `${state.quality.eventRate}`,
      tone: "neutral",
    },
    {
      label: "السعر المرجعي",
      tip: "سعر مركب (Composite) من البورصات المباشرة: وسطيات مستبعدة للقيم الشاذّة وموزونة بالطزوجة وخطأ التوازن — يظهر N/A عند عدم وجود مصدر مباشر",
      value: state.composite.price != null ? state.composite.price.toFixed(0) : "N/A",
      tone: state.composite.status === "UNAVAILABLE" ? "quiet" : "neutral",
      compact: true,
    },
    {
      label: "تباعد المنصات",
      tip: "أقصى انحراف بين أسعار البورصات المباشرة عن السعر المرجعي (٪) — يحتاج 2+ بورصة مباشرة",
      value: state.divergence.maxDeviationPct != null ? `${state.divergence.maxDeviationPct.toFixed(3)}%` : "N/A",
      tone: state.divergence.maxDeviationPct != null && state.divergence.maxDeviationPct > 0.3 ? "warn" : "neutral",
    },
  ];

  return (
    <>
      {/* Summary metrics — compact stacked (label above value) */}
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
        {tiles.map((t) => (
          <div
            key={t.label}
            title={t.tip}
            dir="rtl"
            className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-panel border border-line bg-surface-1/30 px-2 py-2 text-center"
          >
            <span className="text-3xs font-semibold text-muted">{t.label}</span>
            <span
              className={`min-w-0 max-w-full truncate ${TONE_TEXT[t.tone]} ${t.compact ? "text-[13px] font-bold" : "text-lg font-extrabold"} leading-none`}
              dir="ltr"
              style={mono}
            >
              {t.value}
            </span>
          </div>
        ))}
      </div>

      {/* Startup / parallelism — real wall-clock spread of the 16 connects. */}
      <div
        className="mt-2 flex items-center justify-between gap-2 rounded-chip border border-line/60 bg-surface-1/20 px-2 py-1 text-2xs text-muted"
        dir="rtl"
        title={
          state.startup.connectStartSpreadMs != null
            ? `فارق زمن انطلاق 16 منصّة: ${state.startup.connectStartSpreadMs}ms ≈ 0 = اتصال متوازٍ حقيقي (لا انتظار متسلسل)`
            : "لا يزال الانطلاق جارياً — سجّل أول اتصال"
        }
      >
        <span>
          بدء متوازٍ · <span dir="ltr" style={mono}>{state.startup.startedCount}/{state.startup.totalCount}</span> منصّة
          <span
            className={state.startup.connectStartSpreadMs != null && state.startup.connectStartSpreadMs <= 150 ? "text-emerald-300/90" : "text-warn-fg"}
            dir="ltr"
            style={mono}
          >
            {" "}انطلاق {state.startup.connectStartSpreadMs ?? "…"}ms
          </span>
        </span>
        <span>
          مباشر <span dir="ltr" style={mono}>{state.startup.liveCount}</span>
          {state.startup.firstEventSpreadMs != null && (
            <span className="text-zinc-400" dir="ltr" style={mono}>
              {" "}· أول حدث ±{state.startup.firstEventSpreadMs}ms
            </span>
          )}
        </span>
      </div>

      {/* Gateways — fixed 2-col grid, no scroll: brand logo right / response speed left */}
      <div className="mt-3 grid grid-cols-2 gap-1.5">
        {connections.map((c) => (
          <GatewayRow key={c.exchange} conn={c} />
        ))}
      </div>
    </>
  );
}

/**
 * Floating "بوابات البيانات" launcher — sits directly above the sidebar
 * collapse button (bottom-left, desktop) and opens the live data-gates modal.
 * Polls the shared flow ref so the gates stay live inside the modal.
 */
export function DataGatesFab({ latest }: { latest?: FlowLatestRef }) {
  const [open, setOpen] = useState(false);
  const flow = useFlowLatest(latest);

  const liveCount = flow?.connections.filter((c) => c.status === "LIVE").length ?? 0;

  return (
    <ThemeGate>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-16 left-4 z-30 hidden items-center gap-2 rounded-panel border border-line bg-surface-1 px-3 py-2 text-xs font-medium text-zinc-300 shadow-pop transition-colors hover:bg-surface-2 lg:flex"
        title="بوابات البيانات — حالة مصادر التدفق المباشر"
        aria-label="بوابات البيانات"
      >
        <Dot tone={liveCount > 0 ? "good" : "warn"} pulse={liveCount > 0} />
        <WifiIcon className="h-4 w-4" />
        <span>بوابات البيانات</span>
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="بوابات البيانات" maxWidth={760}>
        {flow ? (
          <DataGatesContent snap={flow} />
        ) : (
          <p className="py-4 text-center text-2xs text-muted">جارٍ الاتصال بمصادر التدفق المباشر…</p>
        )}
      </Modal>
    </ThemeGate>
  );
}