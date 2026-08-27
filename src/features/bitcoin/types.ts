export type BtcTimeframe = "1m" | "5m" | "15m" | "30m" | "1h" | "4h" | "1d";

export type BtcCandle = {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
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
