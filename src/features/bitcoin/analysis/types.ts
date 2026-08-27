export type SwingType = "high" | "low";

export type SwingPoint = {
  index: number; // index into candles array
  time: number; // unix seconds
  price: number;
  type: SwingType;
};

export type PivotLevel = "S3" | "S2" | "S1" | "P" | "R1" | "R2" | "R3";

export type PivotPoint = {
  level: PivotLevel;
  price: number;
  time: number;
};

/** A single test/touch of an S/R level (candle whose wick reached it). */
export type LevelTest = {
  time: number;
  index: number;
  price: number;
  volume: number;
  /** How strongly price bounced away after touching (rejection magnitude). */
  impact: number;
};

/** Detected raw price level before clustering. */
export type RawLevel = {
  price: number;
  tests: LevelTest[];
};

/** A clustered support/resistance zone combining nearby raw levels. */
export type Zone = {
  id: string;
  center: number;
  upper: number;
  lower: number;
  tests: number;
  strength: number; // 0-100
  distancePercent: number; // % from current price
  lastTest: number | null; // unix seconds
  kind: "support" | "resistance";
  isNearest: boolean;
};

export type MarketStructure = "bullish" | "bearish" | "neutral";

export type SupportResistanceResult = {
  zones: Zone[];
  nearestSupport: Zone | null;
  nearestResistance: Zone | null;
  structure: MarketStructure;
  currentPrice: number;
  generatedAt: number;
  candleCount: number;
  swingHighs: SwingPoint[];
  swingLows: SwingPoint[];
  pivots: PivotPoint[];
};
