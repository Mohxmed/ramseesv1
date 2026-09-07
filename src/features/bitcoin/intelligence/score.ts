import type { MarketState } from "../types";

/** Directional side of a market-state reading. */
export type Side = "bull" | "bear" | "neutral";

export type ComponentReading = {
  label: string;
  value: string;
  side: Side;
  healthy: boolean;
};

/** Explicit mapping label→reading→side. Unknown → neutral. */
const SIDE_BY_LABEL: Record<string, Record<string, Side>> = {
  الاتجاه: { صاعد: "bull", هابط: "bear", جانبي: "neutral" },
  الزخم: { قوي: "bull", "قوي سلبي": "bear", معتدل: "neutral" },
  "تدفق الأوامر": { "ضغط شراء": "bull", "ضغط بيع": "bear", متوازن: "neutral" },
  البنية: { صاعدة: "bull", هابطة: "bear", جانبية: "neutral" },
  "مراكز العقود": { متصاعدة: "bull", منخفضة: "bear", ثابتة: "neutral" },
  الفاندينغ: { إيجابي: "bull", سلبي: "bear", محايد: "neutral", متطرف: "neutral" },
  السيولة: { منخفضة: "bear" },
  "ضغط التصفية": { مرتفع: "bear" },
};

export function classifyComponent(label: string, value: string): Side {
  return SIDE_BY_LABEL[label]?.[value] ?? "neutral";
}

export type ScoreReport = {
  score: number; // -100..100
  direction: "up" | "down" | "flat";
  directionLabel: string;
  agreement: number; // 0..1 share of the dominant side among all components
  present: number;
  total: number;
  bull: ComponentReading[];
  bear: ComponentReading[];
  neutral: ComponentReading[];
};

/**
 * Reads (never fabricates) the aggregate bias the engine already computed
 * (`MarketState.biasScore` / `overallBias`) and splits its components into
 * directional votes so the UI can show *why* without re-deriving a new score.
 */
export function scoreReport(state: MarketState | null): ScoreReport | null {
  if (!state) return null;
  const components = state.components;
  const bull: ComponentReading[] = [];
  const bear: ComponentReading[] = [];
  const neutral: ComponentReading[] = [];
  for (const c of components) {
    const side = classifyComponent(c.label, c.value);
    const r: ComponentReading = { label: c.label, value: c.value, side, healthy: c.healthy };
    if (side === "bull") bull.push(r);
    else if (side === "bear") bear.push(r);
    else neutral.push(r);
  }
  const total = components.length;
  const present = components.filter((c) => c.healthy).length;
  const agreement = total > 0 ? Math.max(bull.length, bear.length) / total : 0.5;
  const score = Math.max(-100, Math.min(100, state.biasScore));
  const direction =
    state.overallBias === "bullish" ? ("up" as const) : state.overallBias === "bearish" ? ("down" as const) : ("flat" as const);
  const directionLabel =
    direction === "up" ? "صاعد" : direction === "down" ? "هابط" : "متقارب";
  return {
    score,
    direction,
    directionLabel,
    agreement,
    present,
    total,
    bull,
    bear,
    neutral,
  };
}

export type ConfidenceArgs = {
  /** 0..1 share of expected signals actually present. */
  coverage: number;
  /** Count of present sources that were updated within their freshness window. */
  freshSources: number;
  /** Total number of present sources (denominator). */
  availableSources: number;
  /** 0..1 directional agreement across readings. */
  agreement: number;
};

/**
 * Confidence = f(completeness, freshness, agreement). Heuristic but fully
 * derived from real presence flags/timestamps — never hard-coded.
 */
export function computeConfidence({
  coverage,
  freshSources,
  availableSources,
  agreement,
}: ConfidenceArgs): number {
  if (availableSources <= 0) return 0;
  const completeness = coverage;
  const freshness = freshSources / availableSources;
  const v = 0.45 * completeness + 0.3 * freshness + 0.25 * agreement;
  return Math.max(0, Math.min(100, Math.round(100 * v)));
}