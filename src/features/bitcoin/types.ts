export type BtcTimeframe = "1m" | "5m" | "15m" | "30m" | "1h" | "2h" | "4h" | "1d";

export type BtcCandle = {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  /** Base-asset volume filled by aggressive (taker) buy orders. */
  takerBuyVolume?: number;
};

export type SpotTicker = {
  price: number;
  open: number;
  high: number;
  low: number;
  volume: number; // base volume (BTC)
  quoteVolume: number; // USDT volume
  priceChange: number;
  priceChangePercent: number;
  weightedAvgPrice: number;
  timestamp: number; // unix ms closeTime
};

export type MarketOverview = {
  price: number;
  change24h: number | null;
  change24hPercent: number | null;
  high24h: number;
  low24h: number;
  volume24h: number; // quote volume USD
  marketCap: number;
  btcDominance: number | null;
  circulatingSupply: number;
  totalSupply: number | null;
  maxSupply: number | null;
  fundRate: number | null;
  openInterest: number | null;
  openInterestChange: number | null;
  longShortRatio: number | null;
  longAccount: number | null;
  shortAccount: number | null;
  liquidations: number | null;
  futuresVolume: number | null;
  basis: number | null;
  updatedAt: number;
  sources: string[];
};

export type IndicatorValue = {
  label: string;
  value: number | null;
  signal: "bullish" | "bearish" | "neutral";
};

export type TechnicalIndicators = {
  rsi: IndicatorValue;
  macd: IndicatorValue;
  ema9: IndicatorValue;
  ema21: IndicatorValue;
  ema50: IndicatorValue;
  sma20: IndicatorValue;
  sma50: IndicatorValue;
  sma200: IndicatorValue;
  bollingerUpper: IndicatorValue;
  bollingerMiddle: IndicatorValue;
  bollingerLower: IndicatorValue;
  atr: IndicatorValue;
  vwap: IndicatorValue;
  momentum: IndicatorValue;
  volatility: IndicatorValue;
};

export type PredictionWindow = {
  probabilityUp: number;
  probabilityDown: number;
  expectedReturn: number; // percentage
  expectedPrice: number;
  lowerBound: number;
  upperBound: number;
  confidence: number; // 0-100
  sampleSize: number;
};

export type HistoricalStats = {
  windowMinutes: number;
  avgReturn: number;
  medianReturn: number;
  winRate: number;
  downsideFrequency: number;
  volatility: number;
  maxFavorable: number;
  maxAdverse: number;
  sampleSize: number;
};

export type PredictionResult = {
  generatedAt: number;
  lastPrice: number;
  p30: PredictionWindow;
  p60: PredictionWindow;
  h30: HistoricalStats;
  h60: HistoricalStats;
  source: string;
};

// ---------------------------------------------------------------------------
// Live Market Intelligence types
// ---------------------------------------------------------------------------

export type Direction = "up" | "down";
export type Intensity = "strong" | "moderate" | "neutral" | "weak";

export type TrendReading = "bullish" | "bearish" | "neutral";
export type MomentumReading = Intensity;
export type VolatilityReading = "high" | "medium" | "low";
export type VolumeRegimeReading = "high" | "normal" | "low";
export type OrderFlowReading = "buy" | "sell" | "balanced";
export type FundingRegimeReading = "strongPositive" | "positive" | "neutral" | "negative" | "strongNegative";
export type LiquidationPressureReading = "high" | "moderate" | "low";
export type LiquidityReading = "high" | "medium" | "low";

/** Snapshot of the instantaneous order book (best prices / spread / depth). */
export type OrderBookSnapshot = {
  bestBid: number;
  bestAsk: number;
  bidQty: number;
  askQty: number;
  spread: number; // absolute
  spreadPercent: number; // % of mid
  /** Cumulative bid liquidity within a few percent of mid. */
  bidDepth: number;
  /** Cumulative ask liquidity within a few percent of mid. */
  askDepth: number;
  depthImbalance: number; // (bid-ask)/(bid+ask), -1..1
  timestamp: number;
};

/** Aggressive trade / order-flow aggregates over a rolling window. */
export type OrderFlowData = {
  buyVolume: number;
  sellVolume: number;
  buySellDelta: number; // buy - sell (base units)
  buySellRatio: number; // buy/sell
  takerBuyRatio: number; // share of volume that was taker-buy, 0..1
  largeBuyVolume: number;
  largeSellVolume: number;
  largeTradeCount: number;
  sampleSeconds: number;
  timestamp: number;
};

/** Futures market context (market-wide, never an account). */
export type FuturesContext = {
  openInterest: number;
  markPrice: number;
  indexPrice: number;
  fundingRate: number; // %
  fundingChange: number | null; // latest vs previous, pp
  fundingRegime: FundingRegimeReading;
  longShortRatio: number;
  longAccountShare: number | null; // 0..1
  futuresVolume: number; // quote
  basis: number | null; // %
  basisBps: number | null;
  oiChange20m: number | null; // % change vs 20m ago
  oiChange1h: number | null;
  priceOiContext: string; // e.g. "price-up-oi-up"
  cumulativeLiquidations: number | null;
  fundingHistory: { time: number; rate: number }[];
  oiHistory: { time: number; value: number }[];
  timestamp: number;
};

export type MarketState = {
  price: number;
  timestamp: number;
  trend: TrendReading;
  momentum: MomentumReading;
  volatility: VolatilityReading;
  volumeRegime: VolumeRegimeReading;
  liquidity: LiquidityReading;
  orderFlow: OrderFlowReading;
  marketStructure: TrendReading;
  oiTrend: "increasing" | "decreasing" | "flat";
  fundingRegime: FundingRegimeReading;
  liquidationPressure: LiquidationPressureReading;
  overallBias: TrendReading;
  biasScore: number; // -100..100 (negative = bearish)
  components: {
    label: string;
    value: string;
    reading: string;
    healthy: boolean;
  }[];
};

export type SimilarCase = {
  distance: number;
  forwardReturn30: number;
  forwardReturn60: number;
  forwardReturn120: number;
};

export type ConditionalStats = {
  similarCases: number;
  after30: {
    up: number;
    down: number;
    avgReturn: number;
  };
  after60: {
    up: number;
    down: number;
    avgReturn: number;
  };
  after120: {
    up: number;
    down: number;
    avgReturn: number;
  };
  avgDistance: number | null;
  currentStateSummary: string;
  generatedAt: number;
};

export type ForecastHorizon = {
  minutes: number;
  probabilityUp: number;
  probabilityDown: number;
  expectedReturn: number; // %
  expectedPrice: number;
  expectedRangeLow: number;
  expectedRangeHigh: number;
  confidence: number; // 0..100
  drift: number; // % expected direction-weighted
};

export type Forecast = {
  generatedAt: number;
  price: number;
  horizons: ForecastHorizon[]; // 30, 60, 120
  conditional: ConditionalStats | null;
  source: string;
};

export type AnalysisBundle = {
  marketState: MarketState | null;
  orderBook: OrderBookSnapshot | null;
  orderFlow: OrderFlowData | null;
  futures: FuturesContext | null;
  forecast: Forecast | null;
  multiTimeframe: Partial<Record<BtcTimeframe, { candles: BtcCandle[]; forecast?: ForecastHorizon }>>;
  stalenessMs: number;
  lastUpdated: number;
  refreshTrigger: number;
};
