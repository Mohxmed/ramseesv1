/**
 * Execution & decision engine — public surface.
 *
 * All heavy, pure calculation logic lives here (and in the Cloud Function's own
 * copy of these contracts). The client never ships the Brier self-calibration
 * sweep; it only needs the consensus, slippage and gate functions, which are
 * tiny and tree-shakeable.
 */
export {
  calculateConsensusScore,
} from "./consensus";
export {
  REGIME_WEIGHTS,
  consensusThreshold,
  applyRegimeWeights,
} from "./weights";
export {
  calculateDynamicSlippage,
  evaluateExecutionGate,
} from "./slippage";
export {
  classifyMarketRegime,
  REGIME_BOUNDS,
  type RegimeInput,
} from "./regime";
export {
  WATCHDOG_STALE_MS,
  STREAM_THROTTLE_MS,
  SLIPPAGE_TOP_LEVELS,
  CONFLICT_CONFIDENCE,
} from "./types";

export type {
  MarketRegime,
  SignalDirection,
  DecisionStatus,
  OrderBookLevel,
  OrderBookDepth,
  IndicatorEvidence,
  FlowEvidence,
  StructureEvidence,
  EngineInput,
  AppliedWeights,
  ConsensusResult,
  SlippageCost,
  ExecutionGates,
  ExecutionGateResult,
  EngineState,
  StreamSource,
  StreamHealth,
  StreamError,
  StalenessMap,
  TickerPayload,
  ForecastPayload,
  Side,
} from "./types";
