// ---------------------------------------------------------------------------
// Evaluation Engine — a pure, UI-independent implementation of strategy logic.
//
// * Handles TRUE / FALSE / UNKNOWN (never treats UNKNOWN as TRUE).
// * Supports AND / OR / NOT groups and arbitrary nesting.
// * Tracks Required vs Optional conditions separately.
// * Produces per-condition explanations for explainability ("why not Buy").
//
// This module imports nothing from React and can later be reused by a
// backtester without any UI dependency.
// ---------------------------------------------------------------------------

import type {
  ConditionNode,
  ConditionEval,
  FlowEvaluation,
  Operator,
  Signal,
  Strategy,
  StrategyEvaluation,
  StrategyType,
  TriState,
} from "../types";

// ---------------------------------------------------------------------------
// Leaf evaluation
// ---------------------------------------------------------------------------

/** Numeric comparison against a signal's numeric value. */
function compareNumeric(
  signal: Signal,
  operator: Operator,
  expected: number | null
): { result: TriState; reason: string; current: string; expected: string } {
  const v = signal.valueNumber;
  if (v == null || expected == null || Number.isNaN(v) || Number.isNaN(expected)) {
    return {
      result: "unknown",
      reason: `لا توجد قيمة رقمية كافية لـ "${signal.name}" للمقارنة (${signal.reason}).`,
      current: signal.value || "N/A",
      expected: expected == null ? "—" : `${expected}`,
    };
  }
  let ok = false;
  switch (operator) {
    case ">": ok = v > expected; break;
    case ">=": ok = v >= expected; break;
    case "<": ok = v < expected; break;
    case "<=": ok = v <= expected; break;
    case "=": ok = Math.abs(v - expected) < 1e-9; break;
    case "!=": ok = Math.abs(v - expected) >= 1e-9; break;
    default: ok = false;
  }
  const opLabel: Record<string, string> = {
    ">": ">", ">=": "≥", "<": "<", "<=": "≤", "=": "=", "!=": "≠",
  };
  return {
    result: ok ? "true" : "false",
    reason: `${signal.name}: القيمة الحالية ${fmt(v)} ${opLabel[operator]} المطلوب ${fmt(expected)}.`,
    current: fmt(v),
    expected: `${opLabel[operator]} ${fmt(expected)}`,
  };
}

function fmt(v: number): string {
  if (Math.abs(v) >= 1000) return `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  return v.toFixed(2);
}

/** Boolean status comparison (IS_TRUE / IS_FALSE / IS_UNKNOWN). */
function compareBoolean(
  signal: Signal,
  operator: Operator
): { result: TriState; reason: string; current: string; expected: string } {
  const s = signal.status;
  switch (operator) {
    case "IS_TRUE":
      return {
        result: s === "true" ? "true" : "false",
        reason:
          s === "true"
            ? `"${signal.name}" متحققة (TRUE): ${signal.reason}`
            : `"${signal.name}" غير متحققة → ${explain(s, signal)}`,
        current: s === "true" ? "TRUE" : s === "false" ? "FALSE" : "UNKNOWN",
        expected: "TRUE",
      };
    case "IS_FALSE":
      return {
        result: s === "false" ? "true" : "false",
        reason:
          s === "false"
            ? `"${signal.name}" غير متحققة (FALSE) كما هو مطلوب: ${signal.reason}`
            : `"${signal.name}" ليست FALSE حاليًا.`,
        current: s === "true" ? "TRUE" : s === "false" ? "FALSE" : "UNKNOWN",
        expected: "FALSE",
      };
    case "IS_UNKNOWN":
      return {
        result: s === "unknown" ? "true" : "false",
        reason:
          s === "unknown"
            ? `"${signal.name}" في حالة غير مؤكدة (UNKNOWN).`
            : `"${signal.name}" ليست في حالة UNKNOWN.`,
        current: s === "true" ? "TRUE" : s === "false" ? "FALSE" : "UNKNOWN",
        expected: "UNKNOWN",
      };
    default:
      // numeric operator applied to a boolean signal → use numeric fallback
      return compareNumeric(signal, operator, null);
  }
}

function explain(s: TriState, signal: Signal): string {
  if (s === "unknown") return `بيانات غير كافية للـ "${signal.name}" (${signal.reason}).`;
  return signal.reason;
}

// ---------------------------------------------------------------------------
// Recursive tree evaluation
// ---------------------------------------------------------------------------

const NO_SIGNAL = "الإشارة غير موجودة في مصفوفة الإشارات الحالية.";

export function evaluateNode(
  node: ConditionNode,
  signalById: Map<string, Signal>
): ConditionEval {
  if (node.type === "condition") {
    const signal = signalById.get(node.signalId);
    if (!signal) {
      return {
        node,
        result: "unknown",
        required: node.required,
        satisfied: false,
        reason: NO_SIGNAL,
        current: "N/A",
        expected: "—",
        missing: false,
      };
    }
    const isNumericOp =
      node.operator === ">" || node.operator === ">=" || node.operator === "<" ||
      node.operator === "<=" || node.operator === "=" || node.operator === "!=";
    const evalDetail = isNumericOp
      ? compareNumeric(signal, node.operator, node.expectedValue)
      : compareBoolean(signal, node.operator);
    return {
      node,
      result: evalDetail.result,
      required: node.required,
      satisfied: evalDetail.result === "true",
      reason: evalDetail.result === "unknown" ? `بيانات UNKNOWN: ${signal.reason}` : evalDetail.reason,
      current: evalDetail.current,
      expected: evalDetail.expected,
      missing: node.required && evalDetail.result === "false",
    };
  }

  // group
  const children = node.children.map((c) => evaluateNode(c, signalById));
  let inner: TriState;
  if (children.length === 0) {
    inner = "true"; // empty group is trivially satisfied
  } else if (node.logic === "AND") {
    if (children.every((c) => c.result === "true")) inner = "true";
    else if (children.some((c) => c.result === "false")) inner = "false";
    else inner = "unknown";
  } else {
    // OR
    if (children.some((c) => c.result === "true")) inner = "true";
    else if (children.every((c) => c.result === "false")) inner = "false";
    else inner = "unknown";
  }
  const result: TriState = node.not ? flip(inner) : inner;
  return {
    node,
    result,
    required: node.required,
    satisfied: result === "true",
    reason:
      result === "true"
        ? `المجموعة (${node.logic}${node.not ? " + NOT" : ""}) متحققة.`
        : result === "false"
        ? node.not
          ? "تم عكس نتيجة المجموعة بـ NOT فصارت FALSE."
          : `المجموعة (${node.logic}) لم تتحقق.`
        : "نتيجة المجموعة غير مؤكدة بسبب حالة UNKNOWN لأحد العناصر.",
    current: result === "true" ? "TRUE" : result === "false" ? "FALSE" : "UNKNOWN",
    expected: `${node.logic}${node.not ? " (مع NOT)" : ""}`,
    missing: node.required && result === "false",
    children,
  };
}

function flip(t: TriState): TriState {
  if (t === "true") return "false";
  if (t === "false") return "true";
  return "unknown";
}

// ---------------------------------------------------------------------------
// Flow evaluation
// ---------------------------------------------------------------------------

export function evaluateFlow(
  type: StrategyType,
  root: ConditionNode,
  enabled: boolean,
  signalById: Map<string, Signal>
): FlowEvaluation {
  const tree = evaluateNode(root, signalById);

  // roll up required/optional from the tree
  const req = collect(tree);
  const totalRequired = req.requiredTotal;
  const satisfiedRequired = req.requiredSatisfied;
  const totalOptional = req.optionalTotal;
  const satisfiedOptional = req.optionalSatisfied;
  const unknown = req.unknown;
  const missing = req.missing;

  const expressionSatisfied = tree.result === "true";
  // With required/optional semantics: a flow is VALID when the expression is
  // satisfied AND every required condition is satisfied. Optional conditions
  // never block the flow.
  const requiredMet = satisfiedRequired === totalRequired;
  const result: TriState =
    !enabled
      ? "false"
      : tree.result === "unknown"
      ? "unknown"
      : expressionSatisfied && requiredMet
      ? "true"
      : "false";

  const completion =
    totalRequired > 0 ? (satisfiedRequired / totalRequired) * 100 : tree.result === "true" ? 100 : 0;

  return {
    type,
    enabled,
    result,
    expressionSatisfied,
    totalRequired,
    satisfiedRequired,
    totalOptional,
    satisfiedOptional,
    unknown,
    missing,
    completion,
    tree,
  };
}

interface Rollup {
  requiredTotal: number;
  requiredSatisfied: number;
  optionalTotal: number;
  optionalSatisfied: number;
  unknown: string[];
  missing: string[];
}

/** Collect required/optional/unknown/missing leaf conditions from an eval tree. */
function collect(ev: ConditionEval): Rollup {
  const r: Rollup = {
    requiredTotal: 0,
    requiredSatisfied: 0,
    optionalTotal: 0,
    optionalSatisfied: 0,
    unknown: [],
    missing: [],
  };
  const walk = (e: ConditionEval) => {
    if (e.node.type === "condition") {
      const name = signalName(e.node.signalId) || "Condition";
      if (e.node.required) {
        r.requiredTotal++;
        if (e.result === "true") r.requiredSatisfied++;
        else if (e.result === "unknown") r.unknown.push(name);
        else r.missing.push(name);
      } else {
        r.optionalTotal++;
        if (e.result === "true") r.optionalSatisfied++;
      }
    } else if (e.children) {
      for (const c of e.children) walk(c);
    }
  };
  walk(ev);
  return r;
}

let nameLookup: Record<string, string> = {};

export function setSignalNames(names: Record<string, string>): void {
  nameLookup = names;
}

function signalName(id: string): string | undefined {
  return nameLookup[id];
}

// ---------------------------------------------------------------------------
// Strategy evaluation (all flows)
// ---------------------------------------------------------------------------

export function evaluateStrategy(
  strategy: Strategy,
  signalById: Map<string, Signal>
): StrategyEvaluation {
  const flows = strategy.flows.map((f) =>
    evaluateFlow(f.type, f.root, strategy.enabled && f.enabled, signalById)
  );

  const realFlows = flows.filter((f) => f.type !== "WAIT");
  const anyValid = realFlows.some((f) => f.result === "true");
  const allUnknown = flows.length > 0 && flows.every((f) => f.result === "unknown");
  const decision: "VALID" | "WAITING" | "INVALID" | "UNKNOWN" = allUnknown
    ? "UNKNOWN"
    : anyValid
    ? "VALID"
    : realFlows.some((f) => f.result === "unknown")
    ? "UNKNOWN"
    : "INVALID";

  const completions = flows.map((f) => f.completion);
  const completion =
    completions.length > 0 ? completions.reduce((a, b) => a + b, 0) / completions.length : 0;

  return {
    strategyId: strategy.id,
    flows,
    anyValid,
    decision,
    completion,
    updatedAt: Date.now(),
  };
}
