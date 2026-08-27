import type {
  MarketOverview,
  MarketState,
  OrderBookSnapshot,
  OrderFlowData,
  FuturesContext,
  TechnicalIndicators,
  PredictionResult,
  Forecast,
} from "../../bitcoin/types";
import type { SupportResistanceResult } from "../../bitcoin/analysis/types";
import type { LiquidityAnalysis } from "../../bitcoin/analysis/liquidity";
import type { MarketStructureAnalysis } from "../../bitcoin/analysis/market-structure";
import type { Wave } from "../../bitcoin/analysis/waves";

/** The subset of `useBitcoin()` output that the Decision Center reads. */
export interface DecisionMarketDeps {
  overview: MarketOverview | null;
  marketState: MarketState | null;
  analysis: SupportResistanceResult | null;
  structure: MarketStructureAnalysis | null;
  liquidity: LiquidityAnalysis | null;
  forecast: Forecast | null;
  prediction: PredictionResult | null;
  indicators: TechnicalIndicators | null;
  orderFlow: OrderFlowData | null;
  orderBook: OrderBookSnapshot | null;
  futures: FuturesContext | null;
  waves: Wave[];
}
