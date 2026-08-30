/**
 * Shared, engine-agnostic data shapes for the reusable trading panels.
 *
 * These types describe *presentation* data only — they are intentionally
 * decoupled from any single feature's runtime types so the panels can be
 * reused across pages. Callers map their own data into these shapes.
 */

export type Direction = "LONG" | "SHORT" | "NEUTRAL";
export type Trend = "bullish" | "bearish" | "neutral";
export type Freshness = "LIVE" | "RECENT" | "STALE" | "UNAVAILABLE";

export interface FamilyVote {
  key: string;
  label: string;
  /** -1..1 signed vote. */
  vote: number;
  /** optional strength/confidence of the family. */
  magnitude?: number;
}

export interface MarketHeaderData {
  symbol: string;
  price: number | null;
  change24hPct: number | null;
  session?: string;
  date?: string;
  regime?: string;
  regimeConfidence?: number | null;
  freshness?: Freshness;
  /** degree-of-direction 0..100. */
  bias?: number | null;
}

export interface ScoreFamily {
  key: string;
  label: string;
  vote: number; // -1..1
  magnitude?: number;
}

export interface ScalpScoreData {
  score: number | null; // 0..100
  direction: Direction;
  families: ScoreFamily[];
}

export interface SignalFactor {
  label: string;
  note?: string;
}

export interface SignalData {
  direction: Direction;
  strength?: "weak" | "moderate" | "strong" | "none";
  confidence?: number | null;
  reason?: string;
  factors?: SignalFactor[];
}

export interface FlowData {
  buyVolume: number;
  sellVolume: number;
  delta: number;
  ratio: number | null;
  largeBuyVolume?: number;
  largeSellVolume?: number;
  takerBuyRatio?: number | null;
  sampleSeconds?: number;
  timestamp?: number;
}

export interface LiquidityData {
  bestBid: number;
  bestAsk: number;
  spread: number;
  spreadPct: number | null;
  bidDepth: number;
  askDepth: number;
  depthImbalance: number; // -1..1
}

export interface ExecutionData {
  entry: number | null;
  stopLoss?: number | null;
  takeProfit?: number | null;
  feeBps?: number | null;
  spreadBps?: number | null;
  slippageBps?: number | null;
  totalCostBps?: number | null;
  status?: "OK" | "WARN" | "BLOCKED" | "PENDING";
}

export interface PredictionHorizon {
  minutes: number;
  probabilityUp: number;
  expectedMovePct: number | null;
  confidence: number | null;
}

export interface PredictionData {
  price: number | null;
  generatedAt?: number;
  horizons: PredictionHorizon[];
  align?: string | null;
}

export interface DecisionData {
  direction: Direction;
  probability: number | null;
  confidence: number | null;
  expectedMovePct: number | null;
  reason?: string;
  factors?: SignalFactor[];
  gate?: string;
  blocked?: boolean;
}
