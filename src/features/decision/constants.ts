import type { Operator, Signal } from "./types";

/** Operators available in the Condition Builder, grouped by nature. */
export const NUMERIC_OPERATORS: Operator[] = [">", ">=", "<", "<=", "=", "!="];
export const BOOLEAN_OPERATORS: Operator[] = ["IS_TRUE", "IS_FALSE", "IS_UNKNOWN"];

export const OPERATOR_LABELS: Record<Operator, string> = {
  ">": "أكبر من",
  ">=": "أكبر أو يساوي",
  "<": "أقل من",
  "<=": "أقل أو يساوي",
  "=": "يساوي",
  "!=": "لا يساوي",
  IS_TRUE: "تحقّق (TRUE)",
  IS_FALSE: "عدم تحقق (FALSE)",
  IS_UNKNOWN: "غير مؤكد (UNKNOWN)",
};

export const SIGNAL_THRESHOLDS: Record<string, number> = {
  probBullish30: 55, // forecast 30m probabilityUp (%) threshold
  probBullish60: 55,
  probBullish120: 55,
  nearSupportDistance: 0.5, // % distance from nearest support
  nearResistanceDistance: 0.5, // % distance from nearest resistance
  minRiskReward: 2, // minimum R:R
  rsiOversold: 30,
  rsiOverbought: 70,
  volumeConfirmRatio: 0.52, // taker buy ratio threshold for volume confirmation
};

/** Tooltip/explainer for the tri-state. */
export const STATE_META: Record<
  "true" | "false" | "unknown",
  { label: string; color: string; bg: string; icon: string }
> = {
  true: {
    label: "TRUE",
    color: "text-emerald-400",
    bg: "bg-emerald-500/15 border-emerald-500/40",
    icon: "✓",
  },
  false: {
    label: "FALSE",
    color: "text-red-400",
    bg: "bg-red-500/15 border-red-500/40",
    icon: "✕",
  },
  unknown: {
    label: "UNKNOWN",
    color: "text-zinc-400",
    bg: "bg-zinc-600/20 border-zinc-500/40",
    icon: "?",
  },
};

export const STRATEGY_TYPES = ["BUY", "SELL", "EXIT", "WAIT"] as const;

/** Storage key for persisted strategies. */
export const STRATEGY_STORAGE_KEY = "ramsees:strategies";

let idCounter = 0;
export function uid(prefix = "n"): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter}`;
}

/** Signals a condition node can reference. Filled by the signal engine at runtime. */
export const AVAILABLE_SIGNALS: Signal[] = [];
