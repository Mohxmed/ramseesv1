// ---------------------------------------------------------------------------
// Decision Center — domain types
//
// Design principle: the UI never performs market/strategy logic. This layer
// only describes data. The signal engine (signals/), evaluation engine
// (evaluation/) and strategy persistence (hooks/) implement the behaviour.
// All of it is converted from the real Command Center output produced by
// `useBitcoin()` — no market data is invented here.
// ---------------------------------------------------------------------------

/** Tri-state used for every condition evaluation. */
export type TriState = "true" | "false" | "unknown";

export type SignalCategory =
  | "trend"
  | "probability"
  | "price"
  | "momentum"
  | "volume"
  | "liquidity"
  | "technical"
  | "risk"
  | "volatility";

/** Whether a signal is compared numerically or as a boolean status. */
export type SignalKind = "numeric" | "boolean";

/** A single normalized market signal extracted from the Command Center. */
export interface Signal {
  id: string;
  name: string;
  category: SignalCategory;
  kind: SignalKind;
  /** Derived status under the default threshold for this signal. */
  status: TriState;
  /** Human-readable current value. */
  value: string;
  /** Numeric value used by numeric operators (null when not numeric). */
  valueNumber: number | null;
  /** The default rule/threshold applied to produce `status`. */
  threshold: string;
  /** Human-readable explanation of why it is TRUE/FALSE/UNKNOWN. */
  reason: string;
  /** Where the data came from (Command Center panel / engine). */
  source: string;
  updatedAt: number;
  /** Optional key details for the explainability panel. */
  display?: { label: string; value: string }[];
}

export type Operator =
  | ">"
  | ">="
  | "<"
  | "<="
  | "="
  | "!="
  | "IS_TRUE"
  | "IS_FALSE"
  | "IS_UNKNOWN";

export type GroupLogic = "AND" | "OR";

export interface ConditionLeaf {
  type: "condition";
  signalId: string;
  operator: Operator;
  /** Numeric operand for numeric operators; ignored for IS_* operators. */
  expectedValue: number | null;
  required: boolean;
  enabled: boolean;
}

export interface ConditionGroup {
  type: "group";
  logic: GroupLogic;
  not: boolean;
  children: ConditionNode[];
  required: boolean;
  enabled: boolean;
}

export type ConditionNode = ConditionLeaf | ConditionGroup;

export type StrategyType = "BUY" | "SELL" | "EXIT" | "WAIT";

export interface StrategyFlow {
  type: StrategyType;
  root: ConditionNode;
  enabled: boolean;
}

export interface Strategy {
  id: string;
  name: string;
  flows: StrategyFlow[];
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// Evaluation results
// ---------------------------------------------------------------------------

export interface ConditionEval {
  node: ConditionNode;
  /** FALSE for a `not` group whose inner eval is TRUE (i.e. the not flips it). */
  result: TriState;
  required: boolean;
  satisfied: boolean; // for leaves: result === "true"
  /** Human explanation for leaves. */
  reason: string;
  current: string; // current value string
  expected: string; // expected/threshold string
  missing: boolean; // a required condition that failed
  children?: ConditionEval[];
}

export interface FlowEvaluation {
  type: StrategyType;
  enabled: boolean;
  result: TriState;
  /** Whether the flow's logic expression evaluated to TRUE (before required filtering). */
  expressionSatisfied: boolean;
  totalRequired: number;
  satisfiedRequired: number;
  totalOptional: number;
  satisfiedOptional: number;
  unknown: string[]; // names of conditions that were UNKNOWN
  missing: string[]; // names of required conditions that failed
  /** 0..100 — share of required conditions satisfied (Condition Completion). */
  completion: number;
  tree: ConditionEval;
}

export interface StrategyEvaluation {
  strategyId: string;
  flows: FlowEvaluation[];
  /** True if at least one enabling flow expression is satisfied. */
  anyValid: boolean;
  /** Overall decision text. */
  decision: "VALID" | "WAITING" | "INVALID" | "UNKNOWN";
  /** Combined completion across all flows. */
  completion: number;
  updatedAt: number;
}
