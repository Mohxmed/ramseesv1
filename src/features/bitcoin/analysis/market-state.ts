import type {
  BtcCandle,
  BtcTimeframe,
  FuturesContext,
  MarketState,
  OrderBookSnapshot,
  OrderFlowData,
} from "../types";
import { indicatorSeries } from "../indicators";
import { MULTI_TFS } from "../constants";

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function mean(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function std(values: number[]): number {
  const m = mean(values);
  return Math.sqrt(mean(values.map((v) => (v - m) * (v - m))));
}

function atrPct(candles: BtcCandle[], period = 14): number {
  if (candles.length < 2) return 0;
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const tr = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low - candles[i - 1].close)
    );
    trs.push(tr);
  }
  const recent = trs.slice(-period);
  const a = mean(recent);
  const last = candles[candles.length - 1].close;
  return last > 0 ? (a / last) * 100 : 0;
}

// ---------------------------------------------------------------------------
// per-timeframe signal
// ---------------------------------------------------------------------------

type TfSignal = {
  trend: number; // -1..1
  momentum: number; // -1..1
  volumeZ: number;
  takerRatio: number;
};

function signalOnTf(candles: BtcCandle[] | undefined): TfSignal | null {
  if (!candles || candles.length < 30) return null;
  const s = indicatorSeries(candles);
  const closes = s.closes;
  const last = closes[closes.length - 1];

  const ema9 = s.ema9[s.ema9.length - 1] ?? null;
  const ema21 = s.ema21[s.ema21.length - 1] ?? null;
  const ema50 = s.ema50[s.ema50.length - 1] ?? null;
  const sma50 = s.sma50[s.sma50.length - 1] ?? null;

  let trendScore = 0;
  if (ema9 != null && ema21 != null) {
    trendScore += ema9 > ema21 ? 1 : -1;
    trendScore += last > ema21 * 1.002 ? 0.5 : last < ema21 * 0.998 ? -0.5 : 0;
  }
  if (ema50 != null) trendScore += last > ema50 ? 0.5 : -0.5;
  if (sma50 != null) trendScore += last > sma50 ? 0.5 : -0.5;
  const norm = Math.max(1, Math.abs(trendScore));
  const trend = trendScore / norm;

  // Momentum: RSI (canonical indicator series) + ROC over 14 bars.
  let momentum = 0;
  const rsiVal = s.rsi14[s.rsi14.length - 1];
  if (rsiVal != null) {
    momentum = (rsiVal - 50) / 50; // -1..1
    const roc =
      closes.length >= 20 ? (last / closes[closes.length - 20] - 1) * 100 : 0;
    momentum = momentum * 0.6 + Math.max(-1, Math.min(1, roc / 1.5)) * 0.4;
  }

  // Volume z-score over last 30 bars.
  const vols = candles.slice(-30).map((c) => c.volume);
  const vMean = mean(vols);
  const vStd = std(vols);
  const lastVol = candles[candles.length - 1].volume;
  const volumeZ = vStd > 0 ? (lastVol - vMean) / vStd : 0;

  // Taker buy ratio.
  const taker = candles
    .slice(-20)
    .map((c) => c.takerBuyVolume ?? c.volume / 2);
  const takerSum = taker.reduce((a, b) => a + b, 0);
  const volSum = candles
    .slice(-20)
    .reduce((a, c) => a + c.volume, 0);
  const takerRatio = volSum > 0 ? takerSum / volSum : 0.5;

  return { trend, momentum, volumeZ, takerRatio };
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

export function computeMarketState(input: {
  candles: Partial<Record<BtcTimeframe, BtcCandle[]>>;
  orderBook: OrderBookSnapshot | null;
  orderFlow: OrderFlowData | null;
  futures: FuturesContext | null;
  timestamp: number;
}): MarketState {
  const { orderBook, orderFlow, futures, timestamp } = input;
  const price =
    input.candles["30m"]?.slice(-1)[0]?.close ??
    input.candles["1m"]?.slice(-1)[0]?.close ??
    0;

  // Aggregate across timeframes (weight shorter TFs for the "now" read).
  const tfs: BtcTimeframe[] = MULTI_TFS;
  const sigs = tfs
    .map((tf) => signalOnTf(input.candles[tf]))
    .filter((s): s is TfSignal => s !== null);

  let trendScore = 0;
  let momentumScore = 0;
  let takerScore = 0;
  if (sigs.length) {
    for (const s of sigs) {
      trendScore += s.trend;
      momentumScore += s.momentum;
      takerScore += s.takerRatio;
    }
    trendScore /= sigs.length;
    momentumScore /= sigs.length;
    takerScore /= sigs.length;
  }

  const trend: MarketState["trend"] =
    trendScore > 0.15 ? "bullish" : trendScore < -0.15 ? "bearish" : "neutral";

  const maxMom = Math.max(...sigs.map((s) => s.momentum).concat([0]));
  const minMom = Math.min(...sigs.map((s) => s.momentum).concat([0]));
  const spreadMom = maxMom - minMom;
  const momentum: MarketState["momentum"] =
    momentumScore > 0.35
      ? "strong"
      : momentumScore > 0.08
      ? "moderate"
      : momentumScore < -0.35
      ? "strong"
      : momentumScore < -0.08
      ? "moderate"
      : "neutral";
  // (direction handled by trend; momentum here reflects strength)
  const momentumStrength = Math.abs(momentumScore);

  // Volatility: ATR% / realized-vol on 30m + 1h.
  const atr30 = atrPct(input.candles["30m"] ?? [], 14);
  const atr1h = atrPct(input.candles["1h"] ?? [], 14);
  const volRef = atr1h > 0 ? atr1h : atr30;
  const volPercentile = atr1h;
  const volatility: MarketState["volatility"] =
    volPercentile > 1.6 ? "high" : volPercentile > 0.8 ? "medium" : "low";

  // Volume regime from average volume z-score.
  const volZ = sigs.length ? mean(sigs.map((s) => s.volumeZ)) : 0;
  const volumeRegime: MarketState["volumeRegime"] =
    volZ > 1.2 ? "high" : volZ < -0.8 ? "low" : "normal";

  // Liquidity from depth magnitude + imbalance.
  const liquidity: MarketState["liquidity"] =
    !orderBook
      ? "medium"
      : orderBook.bidDepth + orderBook.askDepth > 300
      ? "high"
      : orderBook.bidDepth + orderBook.askDepth > 80
      ? "medium"
      : "low";

  // Order flow reading.
  const flowScore = orderFlow
    ? (orderFlow.takerBuyRatio - 0.5) * 2 * 0.6 +
      Math.max(-1, Math.min(1, (orderFlow.buySellRatio - 1) * 2)) * 0.4
    : 0;
  const orderFlowReading: MarketState["orderFlow"] =
    orderFlow === null
      ? "balanced"
      : flowScore > 0.2
      ? "buy"
      : flowScore < -0.2
      ? "sell"
      : "balanced";

  // Market structure from 30m swing trend (reuse simple EMA structure).
  const structure: MarketState["marketStructure"] = trend;

  // OI trend from futures.
  let oiTrend: MarketState["oiTrend"] = "flat";
  if (futures) {
    const oi1h = futures.oiChange1h;
    if (oi1h == null) oiTrend = "flat";
    else if (oi1h > 2) oiTrend = "increasing";
    else if (oi1h < -2) oiTrend = "decreasing";
    else if (oi1h > 0.5) oiTrend = "increasing";
    else if (oi1h < -0.5) oiTrend = "decreasing";
    else oiTrend = "flat";
  }

  const fundingRegime = futures?.fundingRegime ?? "neutral";

  // Liquidation pressure: blend funding extreme + volume surge + vol.
  let liqScore = 0;
  liqScore += fundingRegime === "strongPositive" || fundingRegime === "strongNegative" ? 1 : 0;
  liqScore += volatility === "high" ? 1 : 0;
  liqScore += volumeRegime === "high" ? 0.5 : 0;
  const liquidationPressure: MarketState["liquidationPressure"] =
    liqScore >= 1.5 ? "high" : liqScore >= 0.5 ? "moderate" : "low";

  // Overall bias: combine trend, momentum, structure, flow, funding push.
  let bias = 0;
  bias += trend === "bullish" ? 1 : trend === "bearish" ? -1 : 0;
  bias += momentumStrength > 0.35 ? Math.sign(momentumScore) * 0.7 : Math.sign(momentumScore) * 0.3;
  bias += orderFlowReading === "buy" ? 0.4 : orderFlowReading === "sell" ? -0.4 : 0;
  bias += oiTrend === "increasing" ? Math.sign(trendScore) * 0.25 : 0;
  bias += fundingRegime === "positive" ? 0.15 : fundingRegime === "negative" ? -0.15 : 0;
  bias += (orderBook?.depthImbalance ?? 0) * 0.3;

  const biasScore = Math.max(-100, Math.min(100, bias * 34));
  const overallBias: MarketState["overallBias"] =
    biasScore > 12 ? "bullish" : biasScore < -12 ? "bearish" : "neutral";

  const components = buildComponents({
    trend,
    momentumScore,
    volatility,
    volumeRegime,
    liquidity,
    orderFlowReading,
    structure,
    oiTrend,
    fundingRegime,
    liquidationPressure,
    volZ,
    takerScore,
  });

  return {
    price,
    timestamp,
    trend,
    momentum,
    volatility,
    volumeRegime,
    liquidity,
    orderFlow: orderFlowReading,
    marketStructure: structure,
    oiTrend,
    fundingRegime,
    liquidationPressure,
    overallBias,
    biasScore,
    components,
  };
}

function buildComponents(input: {
  trend: string;
  momentumScore: number;
  volatility: string;
  volumeRegime: string;
  liquidity: string;
  orderFlowReading: string;
  structure: string;
  oiTrend: string;
  fundingRegime: string;
  liquidationPressure: string;
  volZ: number;
  takerScore: number;
}): MarketState["components"] {
  const r = (label: string, value: string, healthy: boolean) => ({
    label,
    value,
    reading: value,
    healthy,
  });
  return [
    r("الاتجاه", input.trend === "bullish" ? "صاعد" : input.trend === "bearish" ? "هابط" : "جانبي", input.trend !== "bearish"),
    r("الزخم", input.momentumScore > 0.35 ? "قوي" : input.momentumScore < -0.35 ? "قوي سلبي" : "معتدل", true),
    r("التقلب", input.volatility === "high" ? "مرتفع" : input.volatility === "medium" ? "متوسط" : "منخفض", true),
    r("حجم التداول", input.volumeRegime === "high" ? "مرتفع" : input.volumeRegime === "low" ? "منخفض" : "طبيعي", true),
    r("السيولة", input.liquidity === "high" ? "عالية" : input.liquidity === "medium" ? "متوسطة" : "منخفضة", input.liquidity !== "low"),
    r("تدفق الأوامر", input.orderFlowReading === "buy" ? "ضغط شراء" : input.orderFlowReading === "sell" ? "ضغط بيع" : "متوازن", true),
    r("البنية", input.structure === "bullish" ? "صاعدة" : input.structure === "bearish" ? "هابطة" : "جانبية", true),
    r("مراكز العقود", input.oiTrend === "increasing" ? "متصاعدة" : input.oiTrend === "decreasing" ? "منخفضة" : "ثابتة", true),
    r("الفاندينغ", input.fundingRegime === "neutral" ? "محايد" : input.fundingRegime === "positive" ? "إيجابي" : input.fundingRegime === "negative" ? "سلبي" : "متطرف", input.fundingRegime === "neutral"),
    r("ضغط التصفية", input.liquidationPressure === "high" ? "مرتفع" : input.liquidationPressure === "moderate" ? "متوسط" : "منخفض", input.liquidationPressure !== "high"),
  ];
}
