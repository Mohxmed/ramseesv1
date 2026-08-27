import type {
  ConditionGroup,
  ConditionLeaf,
  ConditionNode,
  Strategy,
  StrategyFlow,
  StrategyType,
} from "./types";
import { uid, SIGNAL_THRESHOLDS } from "./constants";

export function leaf(
  signalId: string,
  operator: ConditionLeaf["operator"],
  expectedValue: number | null,
  required = true
): ConditionLeaf {
  return {
    type: "condition",
    signalId,
    operator,
    expectedValue,
    required,
    enabled: true,
  };
}

export function group(logic: "AND" | "OR", children: ConditionNode[], not = false, required = true): ConditionGroup {
  return {
    type: "group",
    logic,
    not,
    required,
    enabled: true,
    children,
  };
}

/** A sensible default condition tree for a given flow type. */
export function defaultFlowNode(flowType: StrategyType): ConditionNode {
  switch (flowType) {
    case "BUY":
      return group("AND", [
        leaf("trendBullish", "IS_TRUE", null, true),
        leaf("probBullish30", ">", SIGNAL_THRESHOLDS.probBullish30, true),
        leaf("nearSupport", "<=", SIGNAL_THRESHOLDS.nearSupportDistance, false),
        leaf("riskRewardOk", ">=", SIGNAL_THRESHOLDS.minRiskReward, false),
      ]);
    case "SELL":
      return group("AND", [
        leaf("trendBullish", "IS_FALSE", null, true),
        leaf("probBullish30", "<", SIGNAL_THRESHOLDS.probBullish30, true),
        leaf("nearResistance", "<=", SIGNAL_THRESHOLDS.nearResistanceDistance, false),
        leaf("riskRewardOk", ">=", SIGNAL_THRESHOLDS.minRiskReward, false),
      ]);
    case "EXIT":
      return group("OR", [
        leaf("momentumBearish", "IS_TRUE", null, false),
        leaf("priceAboveEma9", "IS_FALSE", null, false),
      ]);
    case "WAIT":
    default:
      return group("AND", []);
  }
}

export function createDefaults(): Strategy[] {
  const base = defaultStrategy(true);
  return base;
}

/** Build one new default strategy (fresh ids) with the four flow types. */
export function defaultStrategy(named = true): Strategy[] {
  const now = Date.now();
  const flowTypes: StrategyType[] = ["BUY", "SELL", "EXIT", "WAIT"];
  const flows: StrategyFlow[] = flowTypes.map((type, i) => ({
    type,
    enabled: i < 3,
    root: defaultFlowNode(type),
  }));
  const fallback: Strategy = {
    id: uid("s"),
    name: "استراتيجيتي",
    flows,
    enabled: true,
    createdAt: now,
    updatedAt: now,
  };
  return [fallback];
}

export interface StrategyTemplate {
  id: string;
  name: string;
  flows: StrategyFlow[];
}

function clone(n: ConditionNode): ConditionNode {
  return JSON.parse(JSON.stringify(n)) as ConditionNode;
}

function template(name: string, flows: StrategyFlow[]): StrategyTemplate {
  return {
    id: uid("t"),
    name,
    flows: flows.map((f) => ({ type: f.type, enabled: f.enabled, root: clone(f.root) })),
  };
}

/** Ready-made strategies users can start from. All conditions reference real
 *  signal ids produced by the signal engine. */
export const STRATEGY_TEMPLATES: StrategyTemplate[] = [
  template("ارتداد من الدعم (Support Reversal) — BUY", [
    {
      type: "BUY",
      enabled: true,
      root: group("AND", [
        leaf("trendBullish", "IS_TRUE", null, true),
        leaf("probBullish30", ">", 60, true), // deliberate stricter threshold
        leaf("nearSupport", "<=", SIGNAL_THRESHOLDS.nearSupportDistance, true),
        leaf("riskRewardOk", ">=", SIGNAL_THRESHOLDS.minRiskReward, true),
        leaf("volumeConfirmation", ">=", SIGNAL_THRESHOLDS.volumeConfirmRatio * 100, false),
        leaf("sellSideSwept", "IS_TRUE", null, false),
      ]),
    },
    {
      type: "SELL",
      enabled: false,
      root: defaultFlowNode("SELL"),
    },
    {
      type: "EXIT",
      enabled: true,
      root: defaultFlowNode("EXIT"),
    },
    {
      type: "WAIT",
      enabled: false,
      root: defaultFlowNode("WAIT"),
    },
  ]),
  template("اختراق الزخم (Momentum Breakout) — BUY", [
    {
      type: "BUY",
      enabled: true,
      root: group("AND", [
        leaf("momentumBullish", "IS_TRUE", null, true),
        leaf("macdBullish", "IS_TRUE", null, true),
        leaf("volumeExpansion", "IS_TRUE", null, false),
        leaf("priceAboveEma9", "IS_TRUE", null, true),
        leaf("probBullish30", ">", SIGNAL_THRESHOLDS.probBullish30, true),
        leaf("riskRewardOk", ">=", SIGNAL_THRESHOLDS.minRiskReward, false),
      ]),
    },
    {
      type: "SELL",
      enabled: false,
      root: defaultFlowNode("SELL"),
    },
    {
      type: "EXIT",
      enabled: true,
      root: group("OR", [
        leaf("momentumBearish", "IS_TRUE", null, true),
        leaf("emaAligned", "IS_FALSE", null, false),
      ]),
    },
    {
      type: "WAIT",
      enabled: false,
      root: defaultFlowNode("WAIT"),
    },
  ]),
  template("انعكاس ترند (Trend Reversal) — SELL", [
    {
      type: "BUY",
      enabled: false,
      root: defaultFlowNode("BUY"),
    },
    {
      type: "SELL",
      enabled: true,
      root: group("AND", [
        leaf("trendBullish", "IS_FALSE", null, true),
        leaf("probBullish30", "<", SIGNAL_THRESHOLDS.probBullish30, true),
        leaf("nearResistance", "<=", SIGNAL_THRESHOLDS.nearResistanceDistance, false),
        leaf("momentumBearish", "IS_TRUE", null, true),
        leaf("riskRewardOk", ">=", SIGNAL_THRESHOLDS.minRiskReward, true),
      ]),
    },
    {
      type: "EXIT",
      enabled: true,
      root: defaultFlowNode("EXIT"),
    },
    {
      type: "WAIT",
      enabled: false,
      root: defaultFlowNode("WAIT"),
    },
  ]),
];
