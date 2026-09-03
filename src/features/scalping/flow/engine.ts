/**
 * Real-Time AGGR Flow Engine
 *
 * Processes normalized trades from multiple exchanges and computes:
 * - Rolling flow windows (1s, 3s, 5s, 10s, 30s, 1m, 5m)
 * - CVD (Cumulative Volume Delta)
 * - Flow velocity and acceleration
 * - Large trade detection
 * - Liquidation aggregation
 * - Per-exchange flow breakdown
 * - Flow × Price analysis
 * - Data quality monitoring
 *
 * Architecture: Non-React module-scope state (ring buffers + rolling
 * aggregators). The React boundary is in useFlowEngine.ts which
 * reads a snapshot at a throttled rate.
 */

import type {
  NormalizedTrade,
  MarketFlowState,
  FlowWindow,
  CvdState,
  FlowVelocity,
  LargeTrade,
  LiquidationState,
  ExchangeFlow,
  FlowPriceAnalysis,
  DataQuality,
  FlowEngineConfig,
  FlowSnapshot,
  ExchangeAdapter,
  ExchangeConnection,
  CompositePrice,
  ExchangeDivergence,
  DataQualityStatus,
  GlobalMetrics,
  StartupMetrics,
  PressureState,
  TfPressure,
  PressureStrength,
  PressureDirection,
  PressureMomentum,
  PressureBreakdown,
  ExchangePressure,
  PressureDivergence,
} from "./types";

// ─── Ring Buffer (generic) ──────────────────────────────────────────

class RingBuffer<T> {
  private buf: T[];
  private head = 0;
  private count = 0;
  private capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.buf = new Array(capacity);
  }

  push(item: T): boolean {
    // True when the ring was already full, i.e. we are evicting the oldest item.
    // This is genuine data loss for any consumer (e.g. long window aggregation).
    const overflowed = this.count === this.capacity;
    this.buf[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) this.count++;
    return overflowed;
  }

  /** Return all items in insertion order (oldest first). */
  toArray(): T[] {
    if (this.count === 0) return [];
    const start = this.head - this.count;
    const result: T[] = [];
    for (let i = 0; i < this.count; i++) {
      result.push(this.buf[((start + i) % this.capacity + this.capacity) % this.capacity]);
    }
    return result;
  }

  /** Return items newer than `sinceMs`. */
  since(sinceMs: number, getTs: (item: T) => number): T[] {
    if (this.count === 0) return [];
    const result: T[] = [];
    const start = this.head - this.count;
    for (let i = 0; i < this.count; i++) {
      const item = this.buf[((start + i) % this.capacity + this.capacity) % this.capacity];
      if (getTs(item) >= sinceMs) result.push(item);
    }
    return result;
  }

  clear(): void {
    this.head = 0;
    this.count = 0;
  }

  get size(): number {
    return this.count;
  }

  /** Get the most recent item. */
  peekLatest(): T | null {
    if (this.count === 0) return null;
    return this.buf[(this.head - 1 + this.capacity) % this.capacity];
  }
}

// ─── Default Config ─────────────────────────────────────────────────

const DEFAULT_CONFIG: FlowEngineConfig = {
  exchanges: [
    "binance_futures",
    "bybit",
    "okx",
    "bitget",
    "mexc",
    "hyperliquid",
    "binance_spot",
    "coinbase",
    "gateio",
    "kucoin",
    "kraken",
    "deribit",
    "upbit",
    "htx",
    "bitstamp",
    "bitfinex",
  ],
  symbol: "BTCUSDT",
  // 5s, 30s, 1m, 5m, 10m, 30m, 1h, 4h — the pressure timeline/matrix timeframes.
  // 1s retained for velocity; 60s retained for exchange flow + existing panels.
  windowDurations: [1, 5, 30, 60, 300, 600, 1800, 3600, 14400],
  largeTradeThreshold: 50_000,
  // Shared across all 16 feeds and read for the 300s (5min) window aggregation.
  // 5000 was far too small under high-frequency traffic and silently truncated
  // long-window history = real data loss. Raised to retain 5min fully.
  maxRawTrades: 100_000,
  maxLargeTrades: 200,
  snapshotIntervalMs: 80,
  computeIntervalMs: 80,
};

// ─── Engine State ───────────────────────────────────────────────────

const config = { ...DEFAULT_CONFIG };
let adapters: ExchangeAdapter[] = [];

// Per-exchange O(1) lookup for the hot ingest path. Rebuilt whenever adapters
// change. Avoids an O(n) array scan on every single trade.
let adapterById = new Map<string, ExchangeAdapter>();

// Raw trade buffer (most recent for tape display)
const rawTradeRing = new RingBuffer<NormalizedTrade>(DEFAULT_CONFIG.maxRawTrades);

// Large trade buffers
const largeBuyRing = new RingBuffer<LargeTrade>(DEFAULT_CONFIG.maxLargeTrades);
const largeSellRing = new RingBuffer<LargeTrade>(DEFAULT_CONFIG.maxLargeTrades);

// CVD tracking
let cumulativeBuy = 0;
let cumulativeSell = 0;
let cvdSnapshots: { time: number; value: number }[] = [];

// Flow velocity tracking
let prevNetFlowPerSecond = 0;
let prevVelocityTs = 0;

// Liquidation tracking (event ring keeps per-event notional so windowed
// velocity/acceleration reflect the last 10s — never the session cumulative).
type LiqEvent = { ts: number; notional: number; side: "buy" | "sell" };
let longLiqVolume = 0;
let shortLiqVolume = 0;
let liqEvents: LiqEvent[] = [];

// Price tracking for flow × price
let priceHistory: { time: number; price: number }[] = [];

// Latest valid trade price per exchange (drives composite price + divergence).
const latestPriceByExchange = new Map<
  string,
  { price: number; receivedAt: number; latency: number }
>();

// Per-exchange last-seen trade (tradeId + exchange timestamp) for correct dedup.
// Deduping against a GLOBAL ring's latest trade was wrong: tradeIds are not
// unique across exchanges, so interleaved feeds let genuine duplicates slip
// through (inflating flows) while also comparing unrelated ids. Scoping dedup
// to the producing exchange fixes both.
const lastSeenByExchange = new Map<string, { tradeId: string; timestamp: number }>();

// Backpressure/overflow diagnostics: when a bounded buffer must drop events we
// log exchange + queue size + running dropped count + timestamp rather than
// silently losing data.
let overflowCount = 0;
const overflowLog: { exchange: string; queueSize: number; droppedCount: number; ts: number }[] = [];

// Data quality
let droppedEvents = 0;
let duplicateEvents = 0;
let lastEventTime = 0;
let eventRateBuffer: number[] = [];

// Connection tracking (per-adapter diagnostics reflected into snapshots)
function syncConnections(): ExchangeConnection[] {
  return adapters.map((a) => a.getHealth());
}

// Kept for data-quality reconnect accounting.
function totalReconnects(): number {
  return adapters.reduce((sum, a) => sum + a.getHealth().reconnectCount, 0);
}

// Snapshot callback
let onSnapshot: ((snapshot: FlowSnapshot) => void) | null = null;
let snapshotTimer: ReturnType<typeof setInterval> | null = null;

// ─── Initialization ─────────────────────────────────────────────────

export function initFlowEngine(
  adapters_: ExchangeAdapter[],
  onSnapshot_: (snapshot: FlowSnapshot) => void
): void {
  adapters = adapters_;
  adapterById = new Map(adapters_.map((a) => [a.id, a] as const));
  onSnapshot = onSnapshot_;

  // Connect all adapters
  for (const adapter of adapters) {
    adapter.connect();
    adapter.subscribe(config.symbol);
  }

  // Start snapshot publishing
  snapshotTimer = setInterval(publishSnapshot, config.snapshotIntervalMs);
}

export function destroyFlowEngine(): void {
  if (snapshotTimer) {
    clearInterval(snapshotTimer);
    snapshotTimer = null;
  }
  for (const adapter of adapters) {
    adapter.onTrade = null;
    adapter.disconnect();
  }
  adapters = [];
  adapterById = new Map();
  onSnapshot = null;
}

/** Reset all intra-session accumulated state (for re-init / tests). */
export function resetFlowState(): void {
  cumulativeBuy = 0;
  cumulativeSell = 0;
  cvdSnapshots = [];
  prevNetFlowPerSecond = 0;
  prevVelocityTs = 0;
  longLiqVolume = 0;
  shortLiqVolume = 0;
  liqEvents = [];
  priceHistory = [];
  droppedEvents = 0;
  duplicateEvents = 0;
  lastEventTime = 0;
  eventRateBuffer = [];
  // Drain ring buffers
  rawTradeRing.clear();
  largeBuyRing.clear();
  largeSellRing.clear();
  latestPriceByExchange.clear();
  lastSeenByExchange.clear();
  overflowCount = 0;
  overflowLog.length = 0;
  pressurePrimarySeconds = 60;
}

// ─── Trade Ingestion ────────────────────────────────────────────────

/** Called by exchange adapters when a normalized trade arrives. */
export function ingestTrade(trade: NormalizedTrade): void {
  // O(1) adapter lookup (avoids an O(n) array scan on the hot path).
  const adapter = adapterById.get(trade.exchange);

  // Per-exchange dedup: the same trade re-delivered by the exchange within a
  // short window (same id + same exchange timestamp). Scoped to the producing
  // exchange — tradeIds are NOT globally unique across 16 feeds, so a global
  // last-trade check let genuine duplicates slip through (and inflated flows).
  if (trade.tradeId) {
    const last = lastSeenByExchange.get(trade.exchange);
    if (last && last.tradeId === trade.tradeId && Math.abs(last.timestamp - trade.timestamp) < 100) {
      duplicateEvents++;
      adapter?.recordDropped?.();
      return;
    }
    lastSeenByExchange.set(trade.exchange, { tradeId: trade.tradeId, timestamp: trade.timestamp });
  }

  // Stamp true end-to-end processing time (frame decode → validated/ingested)
  // on every ingested trade. This is `processedAt` used for processing-latency.
  const processedNow = Date.now();
  trade.processedAt = processedNow;

  adapter?.markTradeValid(trade);
  lastEventTime = Math.max(lastEventTime, trade.receivedAt);

  // Store raw trade (reports whether an older trade was evicted = data loss)
  if (rawTradeRing.push(trade)) {
    overflowCount++;
    overflowLog.push({
      exchange: trade.exchange,
      queueSize: rawTradeRing.size,
      droppedCount: overflowCount,
      ts: Date.now(),
    });
    if (overflowLog.length > 100) overflowLog.shift();
  }

  // Latest price per exchange (cheap O(1) latency read — no health object built).
  latestPriceByExchange.set(trade.exchange, {
    price: trade.price,
    receivedAt: trade.receivedAt,
    latency: adapter?.lastLatency ?? -1,
  });

  // Price tracking (bounded trim only near the cap — no per-trade re-allocation)
  priceHistory.push({ time: trade.timestamp, price: trade.price });
  trimPriceHistory();

  // CVD update
  if (trade.side === "buy") {
    cumulativeBuy += trade.notional;
  } else {
    cumulativeSell += trade.notional;
  }

  // Large trade detection
  checkLargeTrade(trade);

  // Liquidation handling
  if (trade.liquidation) {
    ingestLiquidation(trade);
  }

  // Event-rate tracking (bounded window; trim on a low-frequency cadence)
  eventRateBuffer.push(trade.receivedAt);
  trimEventRate();
}

const PRICE_HISTORY_MAX = 300;
function trimPriceHistory(): void {
  // Rebuild only once past the bound — never re-allocate a fresh array per trade.
  if (priceHistory.length > PRICE_HISTORY_MAX) {
    priceHistory = priceHistory.slice(-PRICE_HISTORY_MAX);
  }
}

const EVENT_RATE_WINDOW_MS = 1000;
let lastEventRateTrim = 0;
function trimEventRate(): void {
  // Filter at ~10Hz instead of re-filtering the whole window on every trade.
  const now = Date.now();
  if (now - lastEventRateTrim <= 100) return;
  lastEventRateTrim = now;
  const cutoff = now - EVENT_RATE_WINDOW_MS;
  const out: number[] = [];
  for (const t of eventRateBuffer) if (t >= cutoff) out.push(t);
  eventRateBuffer = out;
}

function checkLargeTrade(trade: NormalizedTrade): void {
  if (trade.notional >= config.largeTradeThreshold) {
    const lt: LargeTrade = {
      timestamp: trade.timestamp,
      exchange: trade.exchange,
      side: trade.side,
      price: trade.price,
      notional: trade.notional,
      market: trade.market,
    };
    if (trade.side === "buy") {
      largeBuyRing.push(lt);
    } else {
      largeSellRing.push(lt);
    }
  }
}

function ingestLiquidation(trade: NormalizedTrade): void {
  if (trade.side === "buy") {
    longLiqVolume += trade.notional;
  } else {
    shortLiqVolume += trade.notional;
  }
  liqEvents.push({ ts: trade.timestamp, notional: trade.notional, side: trade.side });
  // Keep only last 60s of liq events (trim at low cadence, not per event)
  const cutoff = Date.now() - 60_000;
  if (liqEvents.length > 500 && Date.now() - lastLiqTrim > 500) {
    lastLiqTrim = Date.now();
    liqEvents = liqEvents.filter((e) => e.ts > cutoff);
  }
}
let lastLiqTrim = 0;

// ─── Flow Window Computation ────────────────────────────────────────

function computeFlowWindows(): FlowWindow[] {
  const now = Date.now();
  return config.windowDurations.map((seconds) => {
    const cutoff = now - seconds * 1000;
    const trades = rawTradeRing.since(cutoff, (t) => t.receivedAt);

    let buyNotional = 0;
    let sellNotional = 0;
    let buyCount = 0;
    let sellCount = 0;
    let maxNotional = 0;

    for (const t of trades) {
      if (t.side === "buy") {
        buyNotional += t.notional;
        buyCount++;
      } else {
        sellNotional += t.notional;
        sellCount++;
      }
      if (t.notional > maxNotional) maxNotional = t.notional;
    }

    const total = buyNotional + sellNotional;
    const count = buyCount + sellCount;

    return {
      seconds,
      buyNotional,
      sellNotional,
      netFlow: buyNotional - sellNotional,
      buyCount,
      sellCount,
      avgTradeSize: count > 0 ? total / count : 0,
      largestTrade: maxNotional,
      tradeCount: count,
    };
  });
}

// ─── CVD Computation ────────────────────────────────────────────────

function computeCvd(): CvdState {
  const now = Date.now();
  const cvd = cumulativeBuy - cumulativeSell;

  // Record CVD snapshot for delta computation. The ring must span the longest
  // requested window (60s) at the 80ms snapshot cadence — 600 (48s) was too
  // short, so cvdDelta1m could never resolve and always returned 0.
  // 80ms * 1000 = 80s of history, comfortably covering the 60s window.
  cvdSnapshots.push({ time: now, value: cvd });
  const maxSnapshots = 1000;
  if (cvdSnapshots.length > maxSnapshots) cvdSnapshots = cvdSnapshots.slice(-maxSnapshots);

  const deltaAt = (ms: number): number | null => {
    const cutoff = now - ms;
    const oldest = cvdSnapshots.find((s) => s.time >= cutoff);
    // No snapshot old enough => delta is UNKNOWN, not zero.
    if (!oldest) return null;
    return cvd - oldest.value;
  };

  return {
    cvd,
    cvdDelta1s: deltaAt(1000),
    cvdDelta5s: deltaAt(5000),
    cvdDelta30s: deltaAt(30_000),
    cvdDelta1m: deltaAt(60_000),
  };
}

// ─── Flow Velocity Computation ──────────────────────────────────────

function computeVelocity(): FlowVelocity {
  const window1s = computeFlowWindows().find((w) => w.seconds === 1);

  const buyPerSec = window1s ? window1s.buyNotional : 0;
  const sellPerSec = window1s ? window1s.sellNotional : 0;
  const netPerSec = buyPerSec - sellPerSec;

  // Acceleration = change in net flow-per-second, normalised to a per-second
  // rate by the elapsed time since the previous compute (defaulting to the
  // compute cadence when the first sample has no previous timestamp).
  const now = Date.now();
  const dtSec = prevVelocityTs > 0 ? Math.max(0.001, (now - prevVelocityTs) / 1000) : config.computeIntervalMs / 1000;
  prevVelocityTs = now;
  const acceleration = (netPerSec - prevNetFlowPerSecond) / dtSec;
  prevNetFlowPerSecond = netPerSec;

  return {
    buyFlowPerSecond: buyPerSec,
    sellFlowPerSecond: sellPerSec,
    netFlowPerSecond: netPerSec,
    flowAcceleration: acceleration,
  };
}

// ─── Liquidation State Computation ──────────────────────────────────

function computeLiquidations(): LiquidationState {
  const now = Date.now();
  const cutoff10s = now - 10_000;
  const cutoff20s = now - 20_000;

  // Velocity: liquidation notional actually printed in the last 10s, / 10.
  // (The old code divided the SESSION-cumulative volume by 10 — vastly
  // overstated and ever-growing. Now it is a true 10s-windowed rate.)
  const recent = liqEvents.filter((e) => e.ts > cutoff10s);
  const recentLiqCount = recent.length;
  const recentLiqVolume = recent.reduce((sum, e) => sum + e.notional, 0);
  const velocity = recentLiqCount > 0 ? recentLiqVolume / 10 : 0;

  // Acceleration: compare the last-10s rate to the prior-10s rate.
  const prevWindow = liqEvents.filter((e) => e.ts > cutoff20s && e.ts <= cutoff10s);
  const prevWindowVolume = prevWindow.reduce((sum, e) => sum + e.notional, 0);
  const prevVelocity = prevWindow.length > 0 ? prevWindowVolume / 10 : 0;
  const acceleration = velocity - prevVelocity;

  // Burst detection: >10 liquidation events in last 10s
  const burst = recentLiqCount > 10;

  return {
    longVolume: longLiqVolume,
    shortVolume: shortLiqVolume,
    totalVolume: longLiqVolume + shortLiqVolume,
    velocity,
    acceleration,
    burst,
    lastEvent: liqEvents.length > 0 ? liqEvents[liqEvents.length - 1].ts : null,
  };
}

// ─── Per-Exchange Flow ──────────────────────────────────────────────

function computeExchangeFlows(): ExchangeFlow[] {
  const now = Date.now();
  const cutoff = now - 60_000; // 1-minute window per exchange

  return adapters.map((adapter) => {
    const trades = rawTradeRing.since(cutoff, (t) => t.receivedAt).filter((t) => t.exchange === adapter.id);

    let buy = 0;
    let sell = 0;
    for (const t of trades) {
      if (t.side === "buy") buy += t.notional;
      else sell += t.notional;
    }

    const conn = adapter.getHealth();

    return {
      exchange: adapter.id,
      buyNotional: buy,
      sellNotional: sell,
      netFlow: buy - sell,
      tradeCount: trades.length,
      connected: conn.status === "LIVE",
    };
  });
}

// ─── Flow × Price Analysis ──────────────────────────────────────────

function computeFlowPriceAnalysis(): FlowPriceAnalysis {
  const now = Date.now();

  // Price change over last 5s
  const price5sAgo = priceHistory.find((p) => p.time >= now - 5000);
  const currentPrice = priceHistory.length > 0 ? priceHistory[priceHistory.length - 1].price : 0;
  const priceDelta = price5sAgo ? ((currentPrice - price5sAgo.price) / price5sAgo.price) * 100 : 0;

  // Price velocity (% per second)
  const priceVelocity = price5sAgo ? priceDelta / 5 : 0;

  // Flow delta (net flow in last 5s)
  const window5s = computeFlowWindows().find((w) => w.seconds === 5);
  const flowDelta = window5s ? window5s.netFlow : 0;

  // Price response classification
  let priceResponse: FlowPriceAnalysis["priceResponse"] = "neutral";
  if (priceDelta > 0.05) priceResponse = "strong_positive";
  else if (priceDelta > 0.01) priceResponse = "positive";
  else if (priceDelta < -0.05) priceResponse = "strong_negative";
  else if (priceDelta < -0.01) priceResponse = "negative";

  // Absorption detection: strong flow but weak price response
  let absorption: FlowPriceAnalysis["absorption"] = "none";
  const flowMagnitude = Math.abs(flowDelta);
  if (flowMagnitude > 100_000) {
    if (flowDelta > 0 && priceDelta < 0.005) absorption = "buy_absorption";
    else if (flowDelta < 0 && priceDelta > -0.005) absorption = "sell_absorption";
  }

  // Exhaustion: diminishing flow response
  let exhaustion: FlowPriceAnalysis["exhaustion"] = "none";
  const window1m = computeFlowWindows().find((w) => w.seconds === 60);
  if (window1m && window5s) {
    const ratio = window5s.tradeCount > 0 ? (window5s.buyNotional + window5s.sellNotional) / (window1m.buyNotional + window1m.sellNotional) : 0;
    if (ratio > 0.15 && Math.abs(priceDelta) < 0.01) {
      exhaustion = flowDelta > 0 ? "buy_exhaustion" : "sell_exhaustion";
    }
  }

  // Divergence: flow direction != price direction
  let divergence: FlowPriceAnalysis["divergence"] = "none";
  if (flowDelta > 50_000 && priceDelta < -0.02) divergence = "bullish_divergence";
  else if (flowDelta < -50_000 && priceDelta > 0.02) divergence = "bearish_divergence";

  // Cascade risk: accelerating liquidations + strong price move
  let cascadeRisk: FlowPriceAnalysis["cascadeRisk"] = "none";
  const liqs = computeLiquidations();
  if (liqs.burst && Math.abs(priceDelta) > 0.05) cascadeRisk = "high";
  else if (liqs.acceleration > 0 && Math.abs(priceDelta) > 0.03) cascadeRisk = "medium";
  else if (liqs.burst) cascadeRisk = "low";

  return {
    priceDelta,
    priceVelocity,
    flowDelta,
    priceResponse,
    absorption,
    exhaustion,
    divergence,
    cascadeRisk,
  };
}

// ─── Data Quality ───────────────────────────────────────────────────

function computeDataQuality(): DataQuality {
  const conns = syncConnections();
  const liveCount = conns.filter((c) => c.status === "LIVE").length;
  const totalCount = adapters.length;
  const coverage = `${liveCount}/${totalCount}`;

  // Latency = fastest HEALTHY live source, NOT a mean. A plain average over
  // live connections lets one slow/flatlined source (e.g. GT at 38s) drag the
  // reported system latency up for everyone, even though the healthy feeds are
  // sub-second. Fault isolation => show the best live feed's latency.
  const latency = healthyLiveLatency() ?? 0;
  const eventRate = eventRateBuffer.length;

  const now = Date.now();
  const stale = lastEventTime > 0 && now - lastEventTime > 15_000;
  const dataGap = lastEventTime > 0 && now - lastEventTime > 5_000;

  let level: DataQuality["level"] = "full";
  if (liveCount === 0) level = "degraded";
  else if (liveCount < totalCount / 2) level = "partial";
  else if (stale) level = "stale";

  // Data age = age of the freshest LIVE supporting source (fault-isolated best
  // of, never the mean). `-1` when no source is live yet → rendered N/A.
  let dataAge = -1;
  for (const c of conns) {
    if (c.status !== "LIVE" || c.dataAge < 0) continue;
    dataAge = dataAge < 0 ? c.dataAge : Math.min(dataAge, c.dataAge);
  }

  // Overflow + outage diagnostics aggregated across feeds. Kept honest: any
  // local queue/buffer that dropped events, or any transport outage, is never
  // hidden — it is surfaced here (and logged with ts/size on the hot path).
  let overflowCountTotal = overflowCount;
  let reconnectGapTotal = 0;
  for (const c of conns) {
    overflowCountTotal += c.overflowCount || 0;
    if (c.reconnectGapMs > 0) reconnectGapTotal += c.reconnectGapMs;
  }

  return {
    level,
    connectedCount: liveCount,
    totalCount,
    coverage,
    latency,
    dataAge,
    eventRate,
    droppedEvents,
    duplicateEvents,
    reconnectCount: totalReconnects(),
    dataGap,
    overflowCount: overflowCountTotal,
    reconnectGapMs: reconnectGapTotal,
  };
}

// ─── Composite Price + Cross-Exchange Divergence ────────────────────
/**
 * Build the composite price from all LIVE exchanges.
 *
 * Robust to garbage: prices are median/MAD-outlier-rejected, weighted toward
 * fresh + low-latency sources, and only genuinely-live exchanges contribute.
 * There is NEVER a fabricated 0: if no live exchange reports a price the
 * composite is null and the status is DEGRADED/UNAVAILABLE accordingly.
 *
 * Only USD/USDT-quoted venues feed the USD composite; non-USD venues (e.g.
 * Upbit's KRW market) still contribute to trade flow but are never averaged
 * into a USD price with a different currency.
 */
const NON_USD_QUOTED = new Set(["upbit"]);

/**
 * Percentile helper over a sorted numeric array (0-100). Returns null on empty.
 */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

/**
 * Global metrics computed ONLY from the currently HEALTHY/LIVE exchange set.
 * Deliberately not an average: true median/P95/min/max over the live feeds so a
 * single slow/outlier venue never drags the number for everyone. Each quantity
 * is a DIFFERENT signal (freshness vs. heartbeat RTT), never conflated. Stale /
 * disconnected exchanges are excluded entirely.
 */
function computeGlobalMetrics(): GlobalMetrics {
  const dataAges: number[] = [];
  const rtts: number[] = [];
  for (const adapter of adapters) {
    const conn = adapter.getHealth();
    if (conn.status !== "LIVE") continue; // only healthy/live contribute
    // Data age must reflect a genuinely fresh reading on an open socket.
    if (Number.isFinite(conn.dataAge) && conn.dataAge >= 0 && conn.wsOpen) {
      dataAges.push(conn.dataAge);
    }
    if (Number.isFinite(conn.rttMs) && conn.rttMs >= 0) {
      rtts.push(conn.rttMs);
    }
  }

  const dSorted = [...dataAges].sort((a, b) => a - b);
  const rSorted = [...rtts].sort((a, b) => a - b);

  const first = (arr: number[]) => (arr.length > 0 ? arr[0] : null);
  const last = (arr: number[]) => (arr.length > 0 ? arr[arr.length - 1] : null);

  return {
    medianDataAgeMs: dSorted.length > 0 ? dSorted[Math.floor(dSorted.length / 2)] : null,
    p95DataAgeMs: dSorted.length > 0 ? percentile(dSorted, 95) : null,
    minDataAgeMs: first(dSorted),
    maxDataAgeMs: last(dSorted),
    medianRttMs: rSorted.length > 0 ? rSorted[Math.floor(rSorted.length / 2)] : null,
    p95RttMs: rSorted.length > 0 ? percentile(rSorted, 95) : null,
    healthyCount: dataAges.length,
  };
}

/**
 * End-to-end startup / parallelism metrics measured from each exchange's real
 * lifecycle timestamps. `connectStartSpreadMs` is the spread of connect() start
 * times across all venues — because the init loop starts every adapter in the
 * same synchronous tick (no await between them), this is ≈0, which PROVES the
 * connects are parallel, not serialized. `firstEventSpreadMs` is how
 * independently each exchange finishes its own handshake/subscribe. All values
 * are real measurements collected live — never mocked or zeroed to look better.
 */
function computeStartupMetrics(): StartupMetrics {
  const connectStarts: number[] = [];
  const firstEvents: number[] = [];
  let connectedCount = 0;
  let liveCount = 0;
  for (const adapter of adapters) {
    const conn = adapter.getHealth();
    if (conn.connectStartedAt > 0) connectStarts.push(conn.connectStartedAt);
    if (conn.firstEventAt > 0) firstEvents.push(conn.firstEventAt);
    if (conn.status === "LIVE") liveCount++;
    if (conn.wsOpen) connectedCount++;
  }

  const min = (arr: number[]) => Math.min(...arr);
  const max = (arr: number[]) => Math.max(...arr);
  const spread = (arr: number[]) => (arr.length >= 2 ? max(arr) - min(arr) : null);

  const liveStart = firstEvents.length > 0 ? min(firstEvents) : null;
  return {
    totalCount: adapters.length,
    startedCount: connectStarts.length,
    connectedCount,
    liveCount,
    connectStartSpreadMs: spread(connectStarts),
    firstEventSpreadMs: spread(firstEvents),
    liveTimeMs: liveStart !== null ? Date.now() - liveStart : null,
  };
}

/**
 * Fault isolation for the reference price: a single slow/stale/flatlined
 * source must never skew the composite or drag down divergence. A source only
 * counts toward the reference price when it is LIVE, has delivered fresh data,
 * is USD/USDT-quoted, has a valid price AND is not carrying an excessive
 * latency. Sources failing any check are excluded from the reference price and
 * reported as non-contributing (they still feed trade flow/CVD independently).
 */
const PRICE_FRESH_MS = 2500; // trades freshness window for reference-price inclusion
const PRICE_LATENCY_CAP_MS = 5000; // above this per-event latency a source is too slow to trust

/** Live + fresh + low-latency + USD-quoted sources with a valid price (for composite/divergence). */
function livePriceRows(): { exchange: string; price: number; receivedAt: number; latency: number }[] {
  const now = Date.now();
  const rows: { exchange: string; price: number; receivedAt: number; latency: number }[] = [];
  for (const adapter of adapters) {
    const conn = adapter.getHealth();
    if (conn.status !== "LIVE") continue; // not feeding us right now
    if (NON_USD_QUOTED.has(adapter.id)) continue; // not USD-comparable
    const row = latestPriceByExchange.get(adapter.id);
    if (!row || !Number.isFinite(row.price) || !(row.price > 0)) continue;
    if (now - row.receivedAt > PRICE_FRESH_MS) continue; // stale — ignore for pricing
    const lat = Number.isFinite(conn.latency) ? conn.latency : -1;
    if (lat > PRICE_LATENCY_CAP_MS) continue; // excessive latency — ignore for pricing
    rows.push({ exchange: adapter.id, price: row.price, receivedAt: row.receivedAt, latency: Math.max(0, lat) });
  }
  return rows;
}

/**
 * Fastest HEALTHY live latency (fault-isolated): the smallest latency among
 * LIVE sources that are fresh and not carrying excessive latency. This is the
 * "system latency" that reflects the fastest live stream, not a mean that a
 * single slow platform drags upward. Null when no healthy live source exists.
 */
function healthyLiveLatency(): number | null {
  const now = Date.now();
  let best: number | null = null;
  for (const adapter of adapters) {
    const conn = adapter.getHealth();
    if (conn.status !== "LIVE") continue;
    const lat = conn.latency;
    if (!Number.isFinite(lat) || lat < 0) continue; // unknown latency — not a candidate
    if (lat > PRICE_LATENCY_CAP_MS) continue; // too slow to call "healthy"
    if (now - conn.receivedAt > PRICE_FRESH_MS) continue; // stale, not healthy
    if (best === null || lat < best) best = lat;
  }
  return best;
}

function computeComposite(): CompositePrice {
  const now = Date.now();
  const priceRows = livePriceRows();
  const ingredients: CompositePrice["ingredients"] = [];

  for (const adapter of adapters) {
    const row = priceRows.find((r) => r.exchange === adapter.id);
    ingredients.push({
      exchange: adapter.id,
      price: row ? row.price : null,
      latency: adapter.getHealth().latency,
    });
  }

  const livePrices = priceRows.map((r) => r.price);

  if (livePrices.length === 0) {
    return {
      price: null,
      contributingCount: 0,
      rejectedOutliers: 0,
      spreadPct: null,
      freshnessMs: null,
      status: "UNAVAILABLE",
      ingredients,
    };
  }

  // Outlier rejection: drop prices beyond 2x MAD below/above the median.
  const sorted = [...livePrices].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const absDev = sorted.map((p) => Math.abs(p - median)).sort((a, b) => a - b);
  const mad = absDev[Math.floor(absDev.length / 2)] || 0;
  const scale = (1.4826 * mad + 1e-9); // robust sigma (avoid div-by-0 on ties)
  const threshold = scale * 2;

  let rejected = 0;
  const kept = ingredients.filter((i) => {
    if (i.price == null) return false;
    if (Math.abs(i.price - median) / scale > 2) {
      rejected++;
      return false;
    }
    return true;
  });

  if (kept.length === 0) {
    // All were outliers — fall back to the median rather than inventing one.
    return {
      price: median,
      contributingCount: 1,
      rejectedOutliers: rejected,
      spreadPct: 0,
      freshnessMs: now - latestReceipt(ingredients),
      status: "DEGRADED",
      ingredients,
    };
  }

  // Freshness/latency weighting: fresher + lower-latency sources weigh more.
  let wSum = 0;
  let wPrice = 0;
  let oldestRcv = Infinity;
  let newestRcv = 0;
  for (const i of kept) {
    const ageMs = now - (latestPriceByExchange.get(i.exchange)?.receivedAt ?? now);
    const w = 1 / (1 + ageMs / 1000 + Math.max(0, i.latency) / 1000);
    wPrice += (i.price as number) * w;
    wSum += w;
    oldestRcv = Math.min(oldestRcv, latestPriceByExchange.get(i.exchange)?.receivedAt ?? now);
    newestRcv = Math.max(newestRcv, latestPriceByExchange.get(i.exchange)?.receivedAt ?? now);
  }
  const composite = wSum > 0 ? wPrice / wSum : median;
  const spreadPct =
    kept.length > 1 && composite > 0
      ? ((Math.max(...kept.map((i) => i.price as number)) - Math.min(...kept.map((i) => i.price as number))) /
          composite) *
        100
      : 0;

  const contributingCount = kept.length;
  let status: DataQualityStatus = "LIVE";
  if (contributingCount === 1) status = "DEGRADED";
  else if (newestRcv > 0 && now - newestRcv > POLL_STALE) status = "STALE";

  return {
    price: composite,
    contributingCount,
    rejectedOutliers: rejected,
    spreadPct,
    freshnessMs: newestRcv > 0 ? now - newestRcv : null,
    status,
    ingredients,
  };
}

function latestReceipt(ingredients: CompositePrice["ingredients"]): number {
  let max = 0;
  for (const i of ingredients) {
    const rcv = latestPriceByExchange.get(i.exchange)?.receivedAt ?? 0;
    if (rcv > max) max = rcv;
  }
  return max;
}

/** Threshold for considering a composite source fresh (aligned with the hybrid fallback window). */
const POLL_STALE = 15_000;

/**
 * Cross-exchange divergence measured against the composite. Only LIVE sources
 * contribute; leading/lagging identify the extremes of the live set.
 */
function computeDivergence(composite: CompositePrice): ExchangeDivergence {
  const ingredients = composite.ingredients.filter(
    (i) => i.price != null && !NON_USD_QUOTED.has(i.exchange)
  );
  const referencePrice = composite.price;

  if (referencePrice == null || ingredients.filter((i) => i.price != null).length < 2) {
    return {
      referencePrice,
      maxDeviationPct: null,
      deviationPct: null,
      maxSpreadPct: null,
      leading: null,
      lagging: null,
      contributingCount: ingredients.filter((i) => i.price != null).length,
      status: "UNAVAILABLE",
    };
  }

  // Build the live set that actually has a price.
  const liveRows = ingredients
    .filter((i) => i.price != null)
    .map((i) => ({ exchange: i.exchange, price: i.price as number, pct: ((i.price as number) - referencePrice) / referencePrice }));

  if (liveRows.length < 2) {
    return {
      referencePrice,
      maxDeviationPct: null,
      deviationPct: null,
      maxSpreadPct: null,
      leading: null,
      lagging: null,
      contributingCount: liveRows.length,
      status: "DEGRADED",
    };
  }

  let leading = liveRows[0];
  let lagging = liveRows[0];
  let maxPct = 0;
  for (const r of liveRows) {
    if (r.pct > leading.pct) leading = r;
    if (r.pct < lagging.pct) lagging = r;
    if (Math.abs(r.pct) > Math.abs(maxPct)) maxPct = r.pct;
  }
  const prices = liveRows.map((r) => r.price);
  const maxSpreadPct = referencePrice > 0 ? ((Math.max(...prices) - Math.min(...prices)) / referencePrice) * 100 : null;

  return {
    referencePrice,
    maxDeviationPct: Math.abs(maxPct) * 100,
    deviationPct: maxPct * 100,
    maxSpreadPct,
    leading: { exchange: leading.exchange, pct: leading.pct * 100 },
    lagging: { exchange: lagging.exchange, pct: lagging.pct * 100 },
    contributingCount: liveRows.length,
    status: composite.status === "LIVE" ? "LIVE" : "DEGRADED",
  };
}

// ─── Pressure (Composite Buy/Sell Pressure Model) ───────────────────

/** The 8 pressure timeframes (5s → 4h), in seconds. */
const PRESSURE_TFS = [5, 30, 60, 300, 600, 1800, 3600, 14400];
const TF_LABELS: Record<number, string> = {
  5: "5s", 30: "30s", 60: "1m", 300: "5m", 600: "10m", 1800: "30m", 3600: "1h", 14400: "4h",
};
function tfLabel(seconds: number): string {
  return TF_LABELS[seconds] ?? `${seconds}s`;
}
/** Buy share of notional (0-100); 50 when no trades. */
function pctOf(buy: number, sell: number): number {
  const t = buy + sell;
  return t > 0 ? (buy / t) * 100 : 50;
}
/** Signed score from a BUY % (67% buy → +34). */
function scoreOf(buyPct: number): number {
  return 2 * buyPct - 100;
}
function strengthOf(score: number): PressureStrength {
  const a = Math.abs(score);
  if (a < 8) return "weak";
  if (a < 22) return "moderate";
  return "strong";
}
function dirOf(score: number): PressureDirection {
  if (score > 8) return "BUY";
  if (score < -8) return "SELL";
  return "BALANCED";
}
function momentumOf(score: number, prevScore: number): PressureMomentum {
  const d = score - prevScore;
  if (d > 1) return "increasing";
  if (d < -1) return "decreasing";
  return "stable";
}

/** Timeframe currently spotlighted by the hero/breakdown (UI-driven). */
let pressurePrimarySeconds = 60;

/**
 * Select which timeframe the pressure hero + breakdown reflect. Call from the
 * UI on filter change; the next snapshot (every ~80ms) reflects the new TF.
 * Only real pressure timeframes are accepted; anything else is ignored.
 */
export function setPressureTimeframe(seconds: number): void {
  if (PRESSURE_TFS.includes(seconds)) pressurePrimarySeconds = seconds;
  else if (seconds === 1) pressurePrimarySeconds = 60; // 1s is not a pressure TF
}
export function getPressureTimeframe(): number {
  return pressurePrimarySeconds;
}

/** Large-trade counts over a window (from the session large-trade rings). */
function largeCountsInWindow(seconds: number, now: number): { buys: number; sells: number } {
  const cutoff = now - seconds * 1000;
  let buys = 0;
  let sells = 0;
  for (const t of largeBuyRing.toArray()) if (t.timestamp >= cutoff) buys++;
  for (const t of largeSellRing.toArray()) if (t.timestamp >= cutoff) sells++;
  return { buys, sells };
}

/** CVD delta over a window; null until enough history exists. */
function cvdDeltaOver(seconds: number, cvd: number): number | null {
  const cutoff = Date.now() - seconds * 1000;
  const oldest = cvdSnapshots.find((s) => s.time >= cutoff);
  if (!oldest) return null;
  return cvd - oldest.value;
}

/** Per-timeframe pressure from a real flow window. */
function buildTfPressure(w: FlowWindow, cvd: number, large: { buys: number; sells: number }, now: number): TfPressure {
  const buyPct = pctOf(w.buyNotional, w.sellNotional);
  const score = scoreOf(buyPct);
  const secs = Math.max(1, w.seconds);
  return {
    seconds: w.seconds,
    label: tfLabel(w.seconds),
    buyPct,
    sellPct: 100 - buyPct,
    delta: w.netFlow,
    score,
    strength: strengthOf(score),
    direction: dirOf(score),
    buyVolume: w.buyNotional,
    sellVolume: w.sellNotional,
    tradeCount: w.tradeCount,
    buyTradesPerSec: w.buyCount / secs,
    sellTradesPerSec: w.sellCount / secs,
    tradesPerSec: w.tradeCount / secs,
    avgTradeSize: w.avgTradeSize,
    largeBuys: large.buys,
    largeSells: large.sells,
    cvdDelta: cvdDeltaOver(w.seconds, cvd),
    ageMs: now - (rawTradeRing.peekLatest()?.receivedAt ?? now),
  };
}

/** Per-exchange pressure over the primary window (real trades per venue). */
function computeExchangePressure(primarySeconds: number, now: number): ExchangePressure[] {
  const cutoff = now - primarySeconds * 1000;
  const rows: ExchangePressure[] = [];
  for (const adapter of adapters) {
    const conn = adapter.getHealth();
    let buy = 0;
    let sell = 0;
    for (const t of rawTradeRing.toArray()) {
      if (t.receivedAt < cutoff || t.exchange !== adapter.id) continue;
      if (t.side === "buy") buy += t.notional;
      else sell += t.notional;
    }
    const buyPct = pctOf(buy, sell);
    rows.push({
      exchange: adapter.id,
      label: adapter.label || adapter.id,
      status: conn.status,
      contributing: conn.status === "LIVE" && now - conn.receivedAt <= 2500,
      buyPct,
      sellPct: 100 - buyPct,
      delta: buy - sell,
      eventsPerSec: conn.messagesPerSec,
      dataAge: conn.dataAge >= 0 ? conn.dataAge : -1,
    });
  }
  return rows;
}

/** Real cross-signal pressure/price divergence & confirmation detection. */
function computePressureDivergences(cvd: number, liqs: LiquidationState, stats30: { priceDeltaPct: number; cvdDelta: number | null; score: number }): PressureDivergence[] {
  const out: PressureDivergence[] = [];
  const { priceDeltaPct, cvdDelta, score } = stats30;

  const push = (id: string, title: string, bullish: boolean | null, severity: PressureDivergence["severity"], detail: string) =>
    out.push({ id, title, detail, bullish, severity });

  // Price ↑ / ↓ over the primary window with pressure on the OPPOSITE side.
  if (priceDeltaPct > 0.02 && score < -8) {
    push("bearish_vs_price", "Bearish Divergence", false, "moderate",
      `Price +${priceDeltaPct.toFixed(2)}% while BUY pressure is negative (${score > 0 ? "+" : ""}${score.toFixed(0)}). Aggressive sellers pressing into the rise.`);
  } else if (priceDeltaPct < -0.02 && score > 8) {
    push("bullish_vs_price", "Bullish Divergence", true, "moderate",
      `Price ${priceDeltaPct.toFixed(2)}% while BUY pressure is positive (+${score.toFixed(0)}). Buyers accumulating into the dip.`);
  }

  // CVD vs price (aggressive delta direction vs price direction).
  if (cvdDelta != null) {
    if (priceDeltaPct > 0.02 && cvdDelta < 0) {
      push("selling_into_rally", "Selling Into Rally", false, "moderate",
        `Price +${priceDeltaPct.toFixed(2)}% yet CVD is ${cvdDelta.toFixed(0)} USD — net sellers absorbing the rally.`);
    } else if (priceDeltaPct < -0.02 && cvdDelta > 0) {
      push("buying_into_drop", "Buying Into Drop", true, "moderate",
        `Price ${priceDeltaPct.toFixed(2)}% yet CVD is +${cvdDelta.toFixed(0)} USD — net buyers stepping into the drop.`);
    }
  }

  // Aggressive-flow / price agreement => confirmation (no divergence).
  if (priceDeltaPct > 0.02 && score > 8) {
    push("confirm_up", "Price Confirm Upside", true, "low",
      `Price +${priceDeltaPct.toFixed(2)}% with positive BUY pressure (+${score.toFixed(0)}) — buying pressure and price agree.`);
  } else if (priceDeltaPct < -0.02 && score < -8) {
    push("confirm_down", "Price Confirm Downside", false, "low",
      `Price ${priceDeltaPct.toFixed(2)}% with negative pressure (${score.toFixed(0)}) — selling pressure and price agree.`);
  }

  // Liquidation-driven signals (real long/short liquidation asymmetry).
  if (liqs.velocity > 0) {
    if (liqs.longVolume > liqs.shortVolume && liqs.velocity > 150_000) {
      push("long_liq_pressure", "Long Liquidation Pressure", false, "moderate",
        `Long liquidations dominate (${usdShort(liqs.longVolume)}) at ${usdShort(liqs.velocity)}/s — flushing longs, downside risk if price drops.`);
    } else if (liqs.shortVolume > liqs.longVolume && liqs.velocity > 150_000) {
      push("short_liq_pressure", "Short Squeeze Pressure", true, "moderate",
        `Short liquidations dominate (${usdShort(liqs.shortVolume)}) at ${usdShort(liqs.velocity)}/s — shorts squeezing, upside risk if price rises.`);
    }
  }

  return out;
}

/** USD short-format for messages (K/M, no decimals). */
function usdShort(v: number): string {
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${(a / 1_000_000).toFixed(2)}M`;
  if (a >= 1_000) return `${(a / 1_000).toFixed(1)}K`;
  return a.toFixed(0);
}

/**
 * Compute the full composite pressure model from REAL trade data only. Order
 * book / OI / funding are genuinely unavailable (no such stream) and are
 * reported UNAVAILABLE, never fabricated.
 */
function computePressure(): PressureState {
  const now = Date.now();
  const windows = computeFlowWindows();
  const cvd = computeCvd();
  const liquidations = computeLiquidations();

  const bySeconds = new Map(windows.map((w) => [w.seconds, w]));

  // Build each timeframe, sorted short → long.
  const tfs: TfPressure[] = [];
  for (const sec of PRESSURE_TFS) {
    const w = bySeconds.get(sec);
    if (!w) continue;
    tfs.push(buildTfPressure(w, cvd.cvd, largeCountsInWindow(sec, now), now));
  }

  const primary = bySeconds.get(pressurePrimarySeconds) ?? bySeconds.get(60);
  const primaryIdx = tfs.findIndex((t) => t.seconds === (primary?.seconds ?? 60));
  const primaryTf = primaryIdx >= 0 ? tfs[primaryIdx] : null;

  // Pressure score + acceleration (2nd difference of score across timeframes).
  const score = primaryTf?.score ?? 50;
  const shorter = primaryIdx > 0 ? tfs[primaryIdx - 1] : null;
  const shorter2 = primaryIdx > 1 ? tfs[primaryIdx - 2] : null;
  const acceleration =
    shorter && shorter2
      ? (primaryTf!.score - shorter.score) - (shorter.score - shorter2.score)
      : (shorter ? primaryTf!.score - shorter.score : 0);

  const dominant = dirOf(score);
  const momentum = momentumOf(score, shorter?.score ?? score);

  // Confidence: fraction of usable timeframes that agree with the dominant side.
  const agreeing = tfs.filter((t) => dirOf(t.score) === dominant || t.score === 0 || termAgrees(t.score, dominant));
  const confidence =
    tfs.length > 0 ? Math.round((agreeing.length / tfs.length) * 100) : 0;

  // Price delta over the primary window (for divergence detection).
  let priceDeltaPct = 0;
  const cutoff = now - (primary?.seconds ?? 30) * 1000;
  const oldest = priceHistory.find((p) => p.time >= cutoff);
  const lastPrice = priceHistory.length > 0 ? priceHistory[priceHistory.length - 1].price : 0;
  if (oldest && oldest.price > 0) priceDeltaPct = ((lastPrice - oldest.price) / oldest.price) * 100;

  const breakdown: PressureBreakdown = {
    aggressiveFlow: {
      buyVolume: primaryTf?.buyVolume ?? 0,
      sellVolume: primaryTf?.sellVolume ?? 0,
      ratio: (primaryTf?.sellVolume ?? 0) > 0 ? (primaryTf?.buyVolume ?? 0) / Math.max(0.0001, primaryTf?.sellVolume ?? 0) : 0,
      delta: primaryTf?.delta ?? 0,
      status: primaryTf && primaryTf.tradeCount > 0 ? "LIVE" : "DEGRADED",
    },
    volumeDelta: {
      value: primaryTf?.delta ?? 0,
      status: primaryTf && primaryTf.tradeCount > 0 ? "LIVE" : "DEGRADED",
      source: primaryTf?.tradeCount ? "aggr" : null,
      ageMs: primaryTf && primaryTf.tradeCount > 0 ? primaryTf.ageMs : null,
    },
    cvd: { value: cvd.cvd, cvdVelocity: cvd.cvdDelta5s ?? 0, status: cvd.cvdDelta5s != null ? "LIVE" : "DEGRADED" },
    orderBook: { status: "UNAVAILABLE", note: "أوامر دفتر الطلبات غير متوفرة عبر بثّ الصفقات — تتطلب بثّ Order Book منفصل" },
    tradeActivity: {
      tradesPerSec: primaryTf?.tradesPerSec ?? 0,
      buyTradesPerSec: primaryTf?.buyTradesPerSec ?? 0,
      sellTradesPerSec: primaryTf?.sellTradesPerSec ?? 0,
      avgTradeSize: primaryTf?.avgTradeSize ?? 0,
      largeBuys: primaryTf?.largeBuys ?? 0,
      largeSells: primaryTf?.largeSells ?? 0,
      status: primaryTf && primaryTf.tradeCount > 0 ? "LIVE" : "DEGRADED",
    },
    futures: { status: "UNAVAILABLE", note: "OI والفاندينغ غير متوفرين عبر بثّ الصفقات العام — يتطلب بثّ مستقل" },
    liquidations: {
      longNotional10s: longNotional10s(),
      shortNotional10s: shortNotional10s(),
      velocity: liquidations.velocity,
      burst: liquidations.burst,
      status: liquidations.totalVolume > 0 || liquidations.velocity > 0 ? "LIVE" : "DEGRADED",
    },
  };

  const exchanges = computeExchangePressure(primary?.seconds ?? 60, now);
  const globalLiveCount = exchanges.filter((e) => e.contributing).length;

  const divergences = computePressureDivergences(cvd.cvd, liquidations, {
    priceDeltaPct,
    cvdDelta: primaryTf?.cvdDelta ?? null,
    score,
  });

  const buyPct = primaryTf?.buyPct ?? 50;

  return {
    dominant,
    buyPct,
    score,
    strength: strengthOf(score),
    momentum,
    acceleration,
    confidence,
    primarySeconds: primary?.seconds ?? 60,
    timeframes: tfs,
    breakdown,
    exchanges,
    globalLiveCount,
    totalCount: adapters.length,
    divergences,
  };
}

/** Long-liquidation notional printed in the last 10s (real, windowed). */
function longNotional10s(): number {
  const cutoff = Date.now() - 10_000;
  let s = 0;
  for (const e of liqEvents) if (e.ts > cutoff && e.side === "buy") s += e.notional;
  return s;
}
/** Short-liquidation notional printed in the last 10s (real, windowed). */
function shortNotional10s(): number {
  const cutoff = Date.now() - 10_000;
  let s = 0;
  for (const e of liqEvents) if (e.ts > cutoff && e.side === "sell") s += e.notional;
  return s;
}

/** Whether a timeframe's score agrees with the dominant direction. */
function termAgrees(score: number, dominant: PressureDirection): boolean {
  if (dominant === "BUY") return score > 0;
  if (dominant === "SELL") return score < 0;
  return score === 0;
}

// ─── Snapshot Publication ───────────────────────────────────────────

function publishSnapshot(): void {
  if (!onSnapshot) return;

  const now = Date.now();
  const windows = computeFlowWindows();
  const cvd = computeCvd();
  const velocity = computeVelocity();
  const liquidations = computeLiquidations();
  const exchangeFlows = computeExchangeFlows();
  const analysis = computeFlowPriceAnalysis();
  const quality = computeDataQuality();
  const composite = computeComposite();
  const divergence = computeDivergence(composite);
  const global = computeGlobalMetrics();
  const startup = computeStartupMetrics();
  const pressure = computePressure();

  const currentPrice = priceHistory.length > 0 ? priceHistory[priceHistory.length - 1].price : 0;
  const lastTrade = rawTradeRing.peekLatest();

  const state: MarketFlowState = {
    timestamp: now,
    windows,
    cvd,
    velocity,
    largeBuys: largeBuyRing.toArray(),
    largeSells: largeSellRing.toArray(),
    liquidations,
    exchangeFlows,
    analysis,
    quality,
    composite,
    divergence,
    global,
    startup,
    pressure,
    currentPrice,
    lastTradePrice: lastTrade?.price ?? 0,
  };

  // Get recent trades for tape (last 50)
  const recentTrades = rawTradeRing.since(now - 5000, (t) => t.receivedAt).slice(-50);

  onSnapshot({
    state,
    recentTrades,
    connections: syncConnections(),
  });
}

// ─── Public Getters ─────────────────────────────────────────────────

export function getConfig(): FlowEngineConfig {
  return { ...config };
}

export function getConnections(): ExchangeConnection[] {
  return syncConnections();
}
