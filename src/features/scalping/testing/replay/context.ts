import type {
  BtcCandle,
  MarketState,
  OrderBookSnapshot,
  OrderFlowData,
} from "../../../bitcoin/types";
import type { ScalpingContext } from "../../types";

/**
 * ReplayAdapter — build a `ScalpingContext` from historical candles WITHOUT
 * look-ahead.
 *
 * The context the live pipeline receives comes from the shared Binance SSOT.
 * Here it is reconstructed only from the 1m candles observed UP TO the
 * simulated time (the current bar's close is included because at decision time
 * that bar has printed; nothing from `index+1` onward is ever read). Fields
 * that cannot be reconstructed from public candles without leaking the future
 * (order book, order flow, futures positioning, S/R analysis) are passed as
 * `null` — those features simply read as *unknown/neutral*, which is the
 * correct, leak-free behaviour, not an invented number.
 */

function candleCloseAt(candles: BtcCandle[], targetMs: number): number | null {
  const idx = candles.findIndex((c) => c.time * 1000 === targetMs);
  if (idx < 0) return null;
  return candles[idx].close;
}

/**
 * Build a micro price seeder over the seen series. `samplePrice(secondsAgo)`
 * returns the close of the candle whose minute-open is closest to
 * `simTime - secondsAgo` (clamped to the seen window). Because it only reads
 * candles at or before `simTime`, there is no future leakage.
 */
export function buildReplayContext(
  candles: BtcCandle[], // full series; only ≤ index is read
  index: number,
  simTime: number
): ScalpingContext {
  const seen = candles.slice(0, index + 1);
  const bar = seen[seen.length - 1];
  const price = bar ? bar.close : null;

  const samplePrice = (secondsAgo: number): number | null => {
    if (seen.length === 0) return null;
    const target = simTime - secondsAgo * 1000;
    const targetMinute = Math.floor(target / 60_000) * 60_000;
    const direct = candleCloseAt(seen, targetMinute);
    if (direct != null) return direct;
    // Fall back to the last seen close (≤ target) without reading the future.
    let best: number | null = null;
    for (let i = seen.length - 1; i >= 0; i--) {
      const t = seen[i].time * 1000;
      if (t <= target) {
        best = seen[i].close;
        break;
      }
    }
    return best ?? seen[seen.length - 1].close;
  };

  const marketState = buildReplayMarketState(seen, price, simTime);
  const book = buildReplayBookProxy(bar);

  return {
    timestamp: simTime,
    price,
    samplePrice,
    priceAgeMs: 0,
    orderBook: book,
    orderFlow: null,
    candles: seen,
    overview: null,
    futures: null,
    futuresState: null,
    marketState,
    analysis30m: null,
    liquidity: null,
    structure: null,
    flow: null,
  };
}

/**
 * Build a minimal but truthful `MarketState` from the seen candle series so
 * the `market-regime` feature has a real (historical) bias signal.
 */
function buildReplayMarketState(
  seen: BtcCandle[],
  price: number | null,
  timestamp: number
): MarketState | null {
  if (seen.length < 2 || price == null) return null;

  const ret30 = returnOver(seen, 30 * 60_000);
  const ret120 = returnOver(seen, 120 * 60_000);
  const biasScore = clampBias((ret30 ?? 0) * 20 + (ret120 ?? 0) * 10);

  const trend: MarketState["trend"] =
    biasScore > 12 ? "bullish" : biasScore < -12 ? "bearish" : "neutral";
  const momentum: MarketState["momentum"] =
    Math.abs(ret30 ?? 0) > 0.12 ? "strong" : Math.abs(ret30 ?? 0) > 0.05 ? "moderate" : "neutral";
  const volatility: MarketState["volatility"] =
    Math.abs(ret30 ?? 0) > 0.3 ? "high" : Math.abs(ret30 ?? 0) > 0.1 ? "medium" : "low";

  return {
    price,
    timestamp,
    trend,
    momentum,
    volatility,
    volumeRegime: "normal",
    liquidity: "medium",
    orderFlow: "balanced",
    marketStructure: trend,
    oiTrend: "flat",
    fundingRegime: "neutral",
    liquidationPressure: "low",
    overallBias: trend,
    biasScore,
    components: [
      { label: "return30m", value: ret30?.toFixed(3) ?? "n/a", reading: trend, healthy: true },
      { label: "return120m", value: ret120?.toFixed(3) ?? "n/a", reading: trend, healthy: true },
    ],
  };
}

/** Percentage return from `windowMs` before the last seen close. */
function returnOver(seen: BtcCandle[], windowMs: number): number | null {
  const last = seen[seen.length - 1];
  const target = last.time * 1000 - windowMs;
  for (let i = seen.length - 1; i >= 0; i--) {
    if (seen[i].time * 1000 <= target) {
      return last.close > 0 ? ((last.close - seen[i].close) / seen[i].close) * 100 : null;
    }
  }
  return null;
}

function clampBias(v: number): number {
  return Math.max(-100, Math.min(100, v));
}

/**
 * Build a synthetic best-bid/ask from the current bar so `book-imbalance` and
 * the decision EV gate have a sane (historical, leak-free) spread context.
 * A single bar cannot give true depth, so depth is a conservative proxy; when
 * unavailable we return null and the book feature reads neutral.
 */
function buildReplayBookProxy(bar: BtcCandle | null): OrderBookSnapshot | null {
  if (!bar || bar.close <= 0) return null;
  const mid = bar.close;
  const halfSpread = mid * 0.0002; // 2 bps synthetic half-spread
  const bestBid = mid - halfSpread;
  const bestAsk = mid + halfSpread;
  const bidQty = bar.volume * 0.5;
  const askQty = bar.volume * 0.5;
  const spread = bestAsk - bestBid;
  return {
    bestBid,
    bestAsk,
    bidQty,
    askQty,
    spread,
    spreadPercent: (spread / mid) * 100,
    bidDepth: bidQty,
    askDepth: askQty,
    depthImbalance: 0,
    timestamp: bar.time * 1000,
  };
}

/** Type-only re-export for callers that want the flow shape. */
export type { OrderFlowData };
