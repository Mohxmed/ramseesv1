import type { SignalCategory, SignalKind, StrategyType } from "./types";
import { NUMERIC_OPERATORS, SIGNAL_THRESHOLDS } from "./constants";

export interface CatalogEntry {
  id: string;
  name: string;
  category: SignalCategory;
  kind: SignalKind;
  /** default operators offered for this signal kind */
  operators: ("is_true" | "is_false" | "is_unknown" | "numeric")[];
  /** default operator */
  defaultOperator: string;
  /** default numeric expected value (null for boolean) */
  defaultExpected: number | null;
  placeholder?: string;
  /** Display unit suffix for numeric inputs (e.g. "%"), or undefined for a plain number. */
  unit?: string;
  /** Optional fine hint shown under a numeric value input. */
  hint?: string;
}

const BOOLEAN_OPS = ["is_true", "is_false", "is_unknown"] as const;
const NUMERIC_OPS = ["numeric"] as const;

function b(
  id: string,
  name: string,
  category: SignalCategory
): CatalogEntry {
  return {
    id,
    name,
    category,
    kind: "boolean",
    operators: BOOLEAN_OPS as unknown as CatalogEntry["operators"],
    defaultOperator: "IS_TRUE",
    defaultExpected: null,
  };
}

function n(
  id: string,
  name: string,
  category: SignalCategory,
  defaultExpected: number,
  opts: { unit?: string; hint?: string } = {}
): CatalogEntry {
  return {
    id,
    name,
    category,
    kind: "numeric",
    operators: NUMERIC_OPS as unknown as CatalogEntry["operators"],
    defaultOperator: ">",
    defaultExpected,
    ...opts,
  };
}

/** Static catalog of every signal the engine can produce — used to populate
 *  the Condition Builder dropdowns even before live data arrives. */
export const SIGNAL_CATALOG: CatalogEntry[] = [
  // Trend
  b("trendBullish", "الترند العام صاعد", "trend"),
  b("structureBullish", "بنية السوق صاعدة", "trend"),
  b("biasBullish", "الانحياز الكلي صاعد", "trend"),

  // Probability
  n("probBullish30", "الاحتمال الإحصائي صاعد (30د)", "probability", SIGNAL_THRESHOLDS.probBullish30, { unit: "%", hint: "نسبة احتمال الصعود" }),
  n("probBullish60", "الاحتمال الإحصائي صاعد (60د)", "probability", SIGNAL_THRESHOLDS.probBullish60, { unit: "%", hint: "نسبة احتمال الصعود" }),
  n("probBullish120", "الاحتمال الإحصائي صاعد (120د)", "probability", SIGNAL_THRESHOLDS.probBullish120, { unit: "%", hint: "نسبة احتمال الصعود" }),

  // Price
  n("nearSupport", "السعر قرب الدعم (%)", "price", SIGNAL_THRESHOLDS.nearSupportDistance, { unit: "%", hint: "المسافة النسبية من الدعم" }),
  n("nearResistance", "السعر قرب المقاومة (%)", "price", SIGNAL_THRESHOLDS.nearResistanceDistance, { unit: "%", hint: "المسافة النسبية من المقاومة" }),
  b("aboveSupport", "السعر فوق الدعم", "price"),
  b("belowResistance", "السعر تحت المقاومة", "price"),

  // Momentum
  b("momentumBullish", "الزخم صاعد", "momentum"),
  b("momentumBearish", "الزخم هابط", "momentum"),

  // Volume
  b("volumeExpansion", "توسع الحجم", "volume"),
  n("volumeConfirmation", "تأكيد الحجم (نسبة شراء %)", "volume", SIGNAL_THRESHOLDS.volumeConfirmRatio * 100, { unit: "%", hint: "نسبة الطلبات الشرائية" }),

  // Liquidity
  b("liquidityPoolNearby", "تجمع سيولة قريب", "liquidity"),
  b("sellSideSwept", "مسح سيولة البيع", "liquidity"),
  b("buySideSwept", "مسح سيولة الشراء", "liquidity"),
  n("buyWallImbalance", "توازن جدار الشراء", "liquidity", 0.1, { hint: "نسبة توازن أوامر الشراء" }),

  // Technical
  b("rsiOversold", "RSI ذروة البيع", "technical"),
  b("rsiOverbought", "RSI ذروة الشراء", "technical"),
  b("rsiBullish", "RSI إيجابي", "technical"),
  b("macdBullish", "MACD إيجابي", "technical"),
  b("priceAboveEma9", "السعر فوق EMA9", "technical"),
  b("emaAligned", "محاذاة المتوسطات", "technical"),

  // Risk
  n("riskRewardOk", "العائد/المخاطرة (R:R)", "risk", SIGNAL_THRESHOLDS.minRiskReward, { hint: "مضاعفات المخاطرة" }),

  // Volatility
  b("volatilityOk", "التقلب مقبول", "volatility"),
  b("volatilityExpansion", "توسع التقلب", "volatility"),
];

const CAT_MAP = new Map(SIGNAL_CATALOG.map((c) => [c.id, c]));

export const catalogById = (id: string): CatalogEntry | undefined => CAT_MAP.get(id);

/** Operator list filtered by numeric/boolean nature for the builder. */
export function operatorsFor(signalId: string): string[] {
  const entry = catalogById(signalId);
  if (!entry) return ["IS_TRUE", "IS_FALSE"];
  if (entry.kind === "numeric") return NUMERIC_OPERATORS;
  return ["IS_TRUE", "IS_FALSE", "IS_UNKNOWN"];
}

export const STRATEGY_TYPE_LABELS: Record<StrategyType, string> = {
  BUY: "شراء",
  SELL: "بيع",
  EXIT: "خروج",
  WAIT: "انتظار",
};
