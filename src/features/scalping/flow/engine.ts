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

  push(item: T): void {
    this.buf[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) this.count++;
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
  exchanges: ["binance_futures", "bybit", "okx", "bitget", "mexc", "hyperliquid", "binance_spot", "coinbase"],
  symbol: "BTCUSDT",
  windowDurations: [1, 3, 5, 10, 30, 60, 300],
  largeTradeThreshold: 50_000,
  maxRawTrades: 5000,
  maxLargeTrades: 200,
  snapshotIntervalMs: 200,
  computeIntervalMs: 200,
};

// ─── Engine State ───────────────────────────────────────────────────

const config = { ...DEFAULT_CONFIG };
let adapters: ExchangeAdapter[] = [];

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

// Liquidation tracking
let longLiqVolume = 0;
let shortLiqVolume = 0;
let liqTimestamps: number[] = [];

// Price tracking for flow × price
let priceHistory: { time: number; price: number }[] = [];

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
  onSnapshot = null;
}

/** Reset all intra-session accumulated state (for re-init / tests). */
export function resetFlowState(): void {
  cumulativeBuy = 0;
  cumulativeSell = 0;
  cvdSnapshots = [];
  prevNetFlowPerSecond = 0;
  longLiqVolume = 0;
  shortLiqVolume = 0;
  liqTimestamps = [];
  priceHistory = [];
  droppedEvents = 0;
  duplicateEvents = 0;
  lastEventTime = 0;
  eventRateBuffer = [];
  // Drain ring buffers
  rawTradeRing.clear();
  largeBuyRing.clear();
  largeSellRing.clear();
}

// ─── Trade Ingestion ────────────────────────────────────────────────

/** Called by exchange adapters when a normalized trade arrives. */
export function ingestTrade(trade: NormalizedTrade): void {
  // Dedup check (same tradeId within 100ms)
  const latest = rawTradeRing.peekLatest();
  if (latest && latest.tradeId === trade.tradeId && latest.exchange === trade.exchange && Math.abs(latest.timestamp - trade.timestamp) < 100) {
    duplicateEvents++;
    return;
  }

  // Track latency + last-valid-event on the adapter (drives LIVE/STALE status).
  const adapter = adapters.find((a) => a.id === trade.exchange);
  adapter?.markTradeValid(trade);
  lastEventTime = Math.max(lastEventTime, trade.receivedAt);

  // Store raw trade
  rawTradeRing.push(trade);

  // Price tracking
  priceHistory.push({ time: trade.timestamp, price: trade.price });
  if (priceHistory.length > 300) priceHistory = priceHistory.slice(-300);

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

  // Event rate tracking
  eventRateBuffer.push(trade.receivedAt);
  const now = Date.now();
  eventRateBuffer = eventRateBuffer.filter((t) => now - t < 1000);
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
  liqTimestamps.push(trade.timestamp);
  // Keep only last 60s of liq timestamps
  const cutoff = Date.now() - 60_000;
  liqTimestamps = liqTimestamps.filter((t) => t > cutoff);
}

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

  // Record CVD snapshot for delta computation
  cvdSnapshots.push({ time: now, value: cvd });
  if (cvdSnapshots.length > 600) cvdSnapshots = cvdSnapshots.slice(-600);

  const deltaAt = (ms: number): number => {
    const cutoff = now - ms;
    const oldest = cvdSnapshots.find((s) => s.time >= cutoff);
    if (!oldest) return 0;
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

  const acceleration = netPerSec - prevNetFlowPerSecond;
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
  const cutoff30s = now - 30_000;

  // Velocity: liquidation notional in last 10s / 10
  const recentLiqCount = liqTimestamps.filter((t) => t > cutoff10s).length;
  const recentLiqVolume = longLiqVolume + shortLiqVolume; // total
  const velocity = recentLiqCount > 0 ? recentLiqVolume / 10 : 0;

  // Acceleration: compare to previous 10s window
  const prevCutoff = cutoff30s;
  const prevLiqCount = liqTimestamps.filter((t) => t > prevCutoff && t <= cutoff10s).length;
  const prevVelocity = prevLiqCount > 0 ? recentLiqVolume / 10 : 0;
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
    lastEvent: liqTimestamps.length > 0 ? liqTimestamps[liqTimestamps.length - 1] : null,
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

  // Average latency only over LIVE connections with valid (non-negative, finite) latency.
  const liveLatencies = conns.filter((c) => c.status === "LIVE" && c.latency >= 0 && Number.isFinite(c.latency)).map((c) => c.latency);
  const avgLatency = liveLatencies.length > 0 ? liveLatencies.reduce((a, b) => a + b, 0) / liveLatencies.length : 0;
  const eventRate = eventRateBuffer.length;

  const now = Date.now();
  const stale = lastEventTime > 0 && now - lastEventTime > 15_000;
  const dataGap = lastEventTime > 0 && now - lastEventTime > 5_000;

  let level: DataQuality["level"] = "full";
  if (liveCount === 0) level = "degraded";
  else if (liveCount < totalCount / 2) level = "partial";
  else if (stale) level = "stale";

  return {
    level,
    connectedCount: liveCount,
    totalCount,
    coverage,
    latency: avgLatency,
    eventRate,
    droppedEvents,
    duplicateEvents,
    reconnectCount: totalReconnects(),
    dataGap,
  };
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
