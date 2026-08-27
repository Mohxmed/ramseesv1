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
  avgReturn: number; // percentage
  medianReturn: number; // percentage
  winRate: number; // 0-100
  downsideFrequency: number; // 0-100
  volatility: number; // percentage (std dev of returns)
  maxFavorable: number; // percentage
  maxAdverse: number; // percentage (positive number = adverse magnitude)
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

export type PredictionFeatureSet = {
  lastPrice: number;
  return5m: number; // percentage
  return15m: number; // percentage
  return30m: number; // percentage
  momentumSlope: number; // percentage per minute
  realizedVolatility30: number; // annualized-ish, percentage
  shortRatio: number; // avg up-period / down-period volume
  trend: "up" | "down" | "flat";
};
