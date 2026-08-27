// ---------------------------------------------------------------------------
// Signal Engine — the "Normalized Market Signals" layer.
//
// Converts the real Command Center output (`useBitcoin()`) into a stable,
// queryable set of `Signal`s with TRUE / FALSE / UNKNOWN status. Everything
// here is derived from data the Command Center already computes — nothing is
// invented or fetched again. Missing data yields UNKNOWN (never a fake value).
// ---------------------------------------------------------------------------

import type {
  MarketOverview,
  MarketState,
  OrderBookSnapshot,
  OrderFlowData,
  FuturesContext,
  BtcCandle,
  TechnicalIndicators,
  PredictionResult,
  Forecast,
} from "../../bitcoin/types";
import type { SupportResistanceResult, Zone } from "../../bitcoin/analysis/types";
import type { LiquidityAnalysis } from "../../bitcoin/analysis/liquidity";
import type { MarketStructureAnalysis } from "../../bitcoin/analysis/market-structure";
import type { Wave } from "../../bitcoin/analysis/waves";
import type { Signal, SignalCategory, SignalKind, TriState } from "../types";
import {
  SIGNAL_THRESHOLDS,
} from "../constants";

export interface DecisionMarketInput {
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
  candles: BtcCandle[];
  waves: Wave[];
  updatedAt: number;
}

interface BuildCtx extends DecisionMarketInput {}

function stat(
  id: string,
  name: string,
  category: SignalCategory,
  kind: SignalKind,
  status: TriState,
  value: string,
  valueNumber: number | null,
  threshold: string,
  reason: string,
  source: string,
  updatedAt: number,
  display?: { label: string; value: string }[]
): Signal {
  return {
    id,
    name,
    category,
    kind,
    status,
    value,
    valueNumber,
    threshold,
    reason,
    source,
    updatedAt,
    display,
  };
}

export function buildSignals(input: DecisionMarketInput): Signal[] {
  const { marketState, analysis, structure, liquidity, forecast, prediction, indicators, orderFlow, candles, updatedAt } = input;
  const out: Signal[] = [];
  const push = (s: Signal) => out.push(s);

  const now = updatedAt || Date.now();

  // ---------------- Helpers ----------------
  const need = (data: unknown, name = ""): string =>
    data == null
      ? `${name ? name + ": " : ""}بيانات غير متوفرة (DATA UNAVAILABLE)`
      : "بيانات متوفرة";

  // ---------------- Trend ----------------
  const trend = marketState?.trend;
  if (marketState == null) {
    push(stat("trendBullish", "الترند صاعد (Trend Bullish)", "trend", "boolean", "unknown", "N/A", null, "—", need(marketState, "Market State"), "Market State", now));
  } else {
    push(
      stat(
        "trendBullish",
        "الترند العام صاعد",
        "trend",
        "boolean",
        trend === "bullish" ? "true" : trend === "bearish" ? "false" : "false",
        trend === "bullish" ? "Bullish" : trend === "bearish" ? "Bearish" : "Neutral",
        trend === "bullish" ? 1 : 0,
        "ترند = Bullish",
        trend === "bullish"
          ? "بنية الترند العامة عبر الأطر الزمنية ما زالت صاعدة."
          : trend === "bearish"
          ? "بنية الترند العامة هابطة."
          : "الترند متقارب بين الأطر الزمنية.",
        "Market State (trend)",
        now
      )
    );
  }

  const srStructure = analysis?.structure ?? structure?.deemedTrend;
  push(
    stat(
      "structureBullish",
      "بنية السوق صاعدة (Structure Bullish)",
      "trend",
      "boolean",
      srStructure == null ? "unknown" : srStructure === "bullish" ? "true" : "false",
      srStructure == null ? "N/A" : srStructure === "bullish" ? "Bullish" : srStructure === "bearish" ? "Bearish" : "Neutral",
      srStructure === "bullish" ? 1 : 0,
      "بنية السوق = Bullish (HH/HL)",
      srStructure == null
        ? "بيانات بنية السوق غير متوفرة."
        : srStructure === "bullish"
        ? "هيكل السوق (قيعان/قمم مرتفعة) يشير إلى اتجاه صاعد."
        : srStructure === "bearish"
        ? "هيكل السوق هابط (LL/LH)."
        : "هيكل السوق متقارب.",
      "S/R Structure",
      now
    )
  );

  const bias = marketState?.overallBias;
  push(
    stat(
      "biasBullish",
      "الانحياز الكلي صاعد (Bias Bullish)",
      "trend",
      "boolean",
      bias == null ? "unknown" : bias === "bullish" ? "true" : "false",
      bias == null ? "N/A" : bias === "bullish" ? "Bullish" : bias === "bearish" ? "Bearish" : "Neutral",
      bias === "bullish" ? 1 : 0,
      "الانحياز الكلي = Bullish",
      bias == null
        ? "انحياز السوق غير متوفر."
        : bias === "bullish"
        ? `الانحياز الكلي صاعد (درجة ${marketState?.biasScore?.toFixed(0) ?? "—"}).`
        : bias === "bearish"
        ? `الانحياز الكلي هابط (درجة ${marketState?.biasScore?.toFixed(0) ?? "—"}).`
        : "الانحياز الكلي محايد.",
      "Market State (biasScore)",
      now
    )
  );

  // ---------------- Probability (numeric) ----------------
  const horizon = (min: number) => forecast?.horizons?.find((h) => h.minutes === min);
  const h30 = horizon(30);
  const h60 = horizon(60);
  const h120 = horizon(120);
  // fallback to prediction when forecast is unavailable
  const p30 = h30?.probabilityUp ?? prediction?.p30?.probabilityUp ?? null;
  const p60 = h60?.probabilityUp ?? prediction?.p60?.probabilityUp ?? null;

  push(
    stat(
      "probBullish30",
      "الاحتمال الإحصائي صاعد (30د)",
      "probability",
      "numeric",
      p30 == null ? "unknown" : p30 >= SIGNAL_THRESHOLDS.probBullish30 ? "true" : "false",
      p30 == null ? "N/A" : `${p30.toFixed(1)}%`,
      p30,
      `>= ${SIGNAL_THRESHOLDS.probBullish30}%`,
      p30 == null
        ? "احتمال ارتفاع 30 دقيقة غير متوفر."
        : p30 >= SIGNAL_THRESHOLDS.probBullish30
        ? `احتمال ارتفاع 30د (${p30.toFixed(1)}%) فوق الحد (${SIGNAL_THRESHOLDS.probBullish30}%).`
        : `احتمال ارتفاع 30د (${p30.toFixed(1)}%) دون الحد (${SIGNAL_THRESHOLDS.probBullish30}%).`,
      h30 ? "Forecast (30m)" : "Prediction (p30)",
      now,
      [{ label: "المعامل (%).", value: `${p30?.toFixed(2) ?? "—"}` }]
    )
  );

  push(
    stat(
      "probBullish60",
      "الاحتمال الإحصائي صاعد (60د)",
      "probability",
      "numeric",
      p60 == null ? "unknown" : p60 >= SIGNAL_THRESHOLDS.probBullish60 ? "true" : "false",
      p60 == null ? "N/A" : `${p60.toFixed(1)}%`,
      p60,
      `>= ${SIGNAL_THRESHOLDS.probBullish60}%`,
      p60 == null
        ? "احتمال ارتفاع 60 دقيقة غير متوفر."
        : p60 >= SIGNAL_THRESHOLDS.probBullish60
        ? `احتمال ارتفاع 60د (${p60.toFixed(1)}%) فوق الحد (${SIGNAL_THRESHOLDS.probBullish60}%).`
        : `احتمال ارتفاع 60د (${p60.toFixed(1)}%) دون الحد (${SIGNAL_THRESHOLDS.probBullish60}%).`,
      h60 ? "Forecast (60m)" : "Prediction (p60)",
      now,
      [{ label: "المعامل (%).", value: `${p60?.toFixed(2) ?? "—"}` }]
    )
  );

  push(
    stat(
      "probBullish120",
      "الاحتمال الإحصائي صاعد (120د)",
      "probability",
      "numeric",
      h120 == null ? "unknown" : h120.probabilityUp >= SIGNAL_THRESHOLDS.probBullish120 ? "true" : "false",
      h120 == null ? "N/A" : `${h120.probabilityUp.toFixed(1)}%`,
      h120 == null ? null : h120.probabilityUp,
      `>= ${SIGNAL_THRESHOLDS.probBullish120}%`,
      h120 == null
        ? "احتمال ارتفاع 120 دقيقة غير متوفر."
        : h120.probabilityUp >= SIGNAL_THRESHOLDS.probBullish120
        ? `احتمال ارتفاع 120د (${h120.probabilityUp.toFixed(1)}%) فوق الحد.`
        : `احتمال ارتفاع 120د (${h120.probabilityUp.toFixed(1)}%) دون الحد.`,
      "Forecast (120m)",
      now,
      [{ label: "المعامل (%).", value: `${h120?.probabilityUp?.toFixed(2) ?? "—"}` }]
    )
  );

  // ---------------- Price location (numeric distance) ----------------
  const ns = analysis?.nearestSupport ?? null;
  const nr = analysis?.nearestResistance ?? null;
  const price = analysis?.currentPrice ?? input.overview?.price ?? null;
  const distS = ns != null ? Math.abs(ns.distancePercent) : null; // positive %
  const distR = nr != null ? Math.abs(nr.distancePercent) : null;

  push(
    stat(
      "nearSupport",
      "السعر قرب الدعم",
      "price",
      "numeric",
      distS == null ? "unknown" : distS <= SIGNAL_THRESHOLDS.nearSupportDistance ? "true" : "false",
      distS == null ? "N/A" : `${distS.toFixed(2)}%`,
      distS,
      `<= ${SIGNAL_THRESHOLDS.nearSupportDistance}%`,
      distS == null
        ? "أقرب منطقة دعم غير متوفرة."
        : distS <= SIGNAL_THRESHOLDS.nearSupportDistance
        ? `السعر على بعد ${distS.toFixed(2)}% فقط من الدعم (ضمن الحد ${SIGNAL_THRESHOLDS.nearSupportDistance}%).`
        : `السعر على بعد ${distS.toFixed(2)}% من الدعم (أبعد من الحد ${SIGNAL_THRESHOLDS.nearSupportDistance}%).`,
      "S/R Analysis (nearestSupport)",
      now,
      [
        { label: "السعر الحالي", value: price != null ? `$${price.toLocaleString()}` : "—" },
        { label: "الدعم", value: ns ? `$${ns.center.toLocaleString()}` : "—" },
        { label: "المسافة", value: distS != null ? `${distS.toFixed(2)}%` : "—" },
      ]
    )
  );

  push(
    stat(
      "nearResistance",
      "السعر قرب المقاومة",
      "price",
      "numeric",
      distR == null ? "unknown" : distR <= SIGNAL_THRESHOLDS.nearResistanceDistance ? "true" : "false",
      distR == null ? "N/A" : `${distR.toFixed(2)}%`,
      distR,
      `<= ${SIGNAL_THRESHOLDS.nearResistanceDistance}%`,
      distR == null
        ? "أقرب منطقة مقاومة غير متوفرة."
        : distR <= SIGNAL_THRESHOLDS.nearResistanceDistance
        ? `السعر على بعد ${distR.toFixed(2)}% فقط من المقاومة (ضمن الحد).`
        : `السعر على بعد ${distR.toFixed(2)}% من المقاومة (أبعد من الحد).`,
      "S/R Analysis (nearestResistance)",
      now,
      [
        { label: "السعر الحالي", value: price != null ? `$${price.toLocaleString()}` : "—" },
        { label: "المقاومة", value: nr ? `$${nr.center.toLocaleString()}` : "—" },
        { label: "المسافة", value: distR != null ? `${distR.toFixed(2)}%` : "—" },
      ]
    )
  );

  push(
    stat(
      "aboveSupport",
      "السعر فوق الدعم (Above Support)",
      "price",
      "boolean",
      price == null || ns == null ? "unknown" : price > ns.center ? "true" : "false",
      price == null || ns == null ? "N/A" : price > ns.center ? "Above" : "At/Below",
      price != null && ns != null ? (price > ns.center ? 1 : 0) : null,
      "السعر > مركز الدعم",
      price == null || ns == null
        ? "قيم الدعم غير متوفرة."
        : price > ns.center
        ? "السعر أعلى من أقرب دعم."
        : "السعر عند أو أسفل أقرب دعم.",
      "S/R Analysis",
      now
    )
  );

  push(
    stat(
      "belowResistance",
      "السعر تحت المقاومة (Below Resistance)",
      "price",
      "boolean",
      price == null || nr == null ? "unknown" : price < nr.center ? "true" : "false",
      price == null || nr == null ? "N/A" : price < nr.center ? "Below" : "At/Above",
      price != null && nr != null ? (price < nr.center ? 1 : 0) : null,
      "السعر < مركز المقاومة",
      price == null || nr == null
        ? "قيم المقاومة غير متوفرة."
        : price < nr.center
        ? "السعر أقل من أقرب مقاومة."
        : "السعر عند أو أعلى من أقرب مقاومة.",
      "S/R Analysis",
      now
    )
  );

  // ---------------- Momentum ----------------
  const mom = indicators?.momentum;
  push(
    stat(
      "momentumBullish",
      "الزخم صاعد (Momentum Bullish)",
      "momentum",
      "boolean",
      mom == null ? "unknown" : mom.signal === "bullish" ? "true" : "false",
      mom == null ? "N/A" : mom.signal === "bullish" ? "Bullish" : mom.signal === "bearish" ? "Bearish" : "Neutral",
      mom?.value ?? null,
      "ROC(20) > 0",
      mom == null
        ? "بيانات الزخم غير متوفرة."
        : mom.signal === "bullish"
        ? `معدل التغير (ROC ${mom.value?.toFixed(2) ?? "—"}%) موجب → زخم صاعد.`
        : `معدل التغير (ROC ${mom.value?.toFixed(2) ?? "—"}%) غير موجب → زخم غير صاعد.`,
      "TechnicalIndicators (momentum)",
      now,
      [{ label: "ROC %", value: mom?.value != null ? `${mom.value.toFixed(2)}%` : "—" }]
    )
  );
  push(
    stat(
      "momentumBearish",
      "الزخم هابط (Momentum Bearish)",
      "momentum",
      "boolean",
      mom == null ? "unknown" : mom.signal === "bearish" ? "true" : "false",
      mom == null ? "N/A" : mom.signal === "bearish" ? "Bearish" : mom.signal === "bullish" ? "Bullish" : "Neutral",
      mom?.value ?? null,
      "ROC(20) < 0",
      mom == null
        ? "بيانات الزخم غير متوفرة."
        : mom.signal === "bearish"
        ? "معدل التغير سالب → زخم هابط."
        : "معدل التغير غير سالب → الزخم ليس هابطًا.",
      "TechnicalIndicators (momentum)",
      now
    )
  );

  // ---------------- Volume ----------------
  const volumeRegime = marketState?.volumeRegime;
  push(
    stat(
      "volumeExpansion",
      "توسع الحجم (Volume Expansion)",
      "volume",
      "boolean",
      volumeRegime == null ? "unknown" : volumeRegime === "high" ? "true" : "false",
      volumeRegime == null ? "N/A" : volumeRegime === "high" ? "High" : volumeRegime === "normal" ? "Normal" : "Low",
      volumeRegime === "high" ? 1 : 0,
      "حجم الحجم = High",
      volumeRegime == null
        ? "نظام الحجم غير متوفر."
        : volumeRegime === "high"
        ? "حجم التداول في نطاق مرتفع يدعم الحركة الحالية."
        : `حجم التداول ${volumeRegime === "normal" ? "عادي" : "منخفض"} (غير موسّع).`,
      "Market State (volumeRegime)",
      now
    )
  );

  const takerRatio = orderFlow?.takerBuyRatio ?? null;
  push(
    stat(
      "volumeConfirmation",
      "تأكيد الحجم (Volume Confirmation)",
      "volume",
      "numeric",
      takerRatio == null ? "unknown" : takerRatio >= SIGNAL_THRESHOLDS.volumeConfirmRatio ? "true" : "false",
      takerRatio == null ? "N/A" : `${(takerRatio * 100).toFixed(1)}%`,
      takerRatio != null ? takerRatio * 100 : null,
      `نسبة الشراء الطرفي >= ${(SIGNAL_THRESHOLDS.volumeConfirmRatio * 100).toFixed(0)}%`,
      takerRatio == null
        ? "بيانات تدفق الطلبات غير متوفرة."
        : takerRatio >= SIGNAL_THRESHOLDS.volumeConfirmRatio
        ? `نسبة المشتري الوكيل ${(takerRatio * 100).toFixed(1)}% تؤكد ضغط شراء.`
        : `نسبة المشتري الوكيل ${(takerRatio * 100).toFixed(1)}% لا تؤكد ضغط شراء.`,
      "Order Flow (takerBuyRatio)",
      now,
      [{ label: "Taker Buy", value: takerRatio != null ? `${(takerRatio * 100).toFixed(1)}%` : "—" }]
    )
  );

  // ---------------- Liquidity ----------------
  const nearbyPool = liquidity?.zones?.find(
    (z) => z.center != null && price != null && Math.abs((z.center - price) / price) * 100 <= 3
  );
  push(
    stat(
      "liquidityPoolNearby",
      "تجمع سيولة قريب (Liquidity Pool Nearby)",
      "liquidity",
      "boolean",
      liquidity == null || price == null ? "unknown" : nearbyPool ? "true" : "false",
      liquidity == null || nearbyPool == null || price == null ? "N/A" : `${((Math.abs(nearbyPool.center - price) / price) * 100).toFixed(2)}%`,
      nearbyPool && price ? 1 : 0,
      "يوجد تجمع سيولة خلال 3% من السعر",
      liquidity == null || price == null
        ? "بيانات السيولة غير متوفرة."
        : nearbyPool
        ? `يوجد تجمع سيولة (${nearbyPool.source}) على بعد ${((Math.abs(nearbyPool.center - price) / price) * 100).toFixed(2)}%.`
        : "لا يوجد تجمع سيولة ضمن نطاق 3%.",
      "Liquidity Analysis",
      now,
      [
        { label: "تجمعات", value: `${liquidity?.zones?.length ?? "—"}` },
        { label: "توازن الجدار", value: liquidity?.buyWallImbalance?.toFixed(2) ?? "—" },
      ]
    )
  );

  // Liquidity sweeps — derived from candle wicks vs liquidity zone bounds.
  const sweep = detectSweeps(candles, liquidity?.zones ?? []);
  push(
    stat(
      "sellSideSwept",
      "مسح سيولة البيع (Sell-side Sweep)",
      "liquidity",
      "boolean",
      sweep == null || candles.length === 0 ? "unknown" : sweep.sellSide ? "true" : "false",
      sweep == null ? "N/A" : sweep.sellSide ? "Yes" : "No",
      sweep ? (sweep.sellSide ? 1 : 0) : null,
      "قمة اخترقت مقاومة ثم أغلقت تحتها",
      sweep == null || candles.length === 0
        ? "بيانات السيولة/الشمعة غير كافية لكشف المسح."
        : sweep.sellSide
        ? "حدث مسح لسيولة البيع (قمة اخترقت مقاومة ثم أغلق السعر تحتها)."
        : "لم يُرصد مسح لسيولة البيع في الشموع الأخيرة.",
      "Derived (candles + liquidity zones)",
      now
    )
  );
  push(
    stat(
      "buySideSwept",
      "مسح سيولة الشراء (Buy-side Sweep)",
      "liquidity",
      "boolean",
      sweep == null || candles.length === 0 ? "unknown" : sweep.buySide ? "true" : "false",
      sweep == null ? "N/A" : sweep.buySide ? "Yes" : "No",
      sweep ? (sweep.buySide ? 1 : 0) : null,
      "قاع اخترق دعم ثم أغلق فوقه",
      sweep == null || candles.length === 0
        ? "بيانات السيولة/الشمعة غير كافية لكشف المسح."
        : sweep.buySide
        ? "حدث مسح لسيولة الشراء (قاع اخترق دعم ثم أغلق السعر فوقه)."
        : "لم يُرصد مسح لسيولة الشراء في الشموع الأخيرة.",
      "Derived (candles + liquidity zones)",
      now
    )
  );

  const imbalance = liquidity?.buyWallImbalance ?? null;
  push(
    stat(
      "buyWallImbalance",
      "توازن جدار الشراء (Buy Wall Imbalance)",
      "liquidity",
      "numeric",
      imbalance == null ? "unknown" : imbalance >= 0.1 ? "true" : "false",
      imbalance == null ? "N/A" : imbalance.toFixed(2),
      imbalance,
      ">= 0.10",
      imbalance == null
        ? "بيانات توازن الجدار غير متوفرة."
        : imbalance >= 0.1
        ? `جدار الشراء أكبر من جدار البيع (+${imbalance.toFixed(2)}).`
        : `لا يوجد توازن واضح لصالح الشراء (${imbalance.toFixed(2)}).`,
      "Liquidity Analysis (buyWallImbalance)",
      now
    )
  );

  // ---------------- Technical ----------------
  const rsi = indicators?.rsi;
  push(
    stat(
      "rsiOversold",
      "RSI في ذروة البيع (Oversold)",
      "technical",
      "boolean",
      rsi?.value == null ? "unknown" : rsi.value < SIGNAL_THRESHOLDS.rsiOversold ? "true" : "false",
      rsi?.value == null ? "N/A" : rsi.value.toFixed(1),
      rsi?.value ?? null,
      `< ${SIGNAL_THRESHOLDS.rsiOversold}`,
      rsi?.value == null
        ? "بيانات RSI غير متوفرة."
        : rsi.value < SIGNAL_THRESHOLDS.rsiOversold
        ? `RSI عند ${rsi.value.toFixed(1)} (أقل من ${SIGNAL_THRESHOLDS.rsiOversold}) — منطقة ذروة بيع.`
        : `RSI عند ${rsi.value.toFixed(1)} (فوق ${SIGNAL_THRESHOLDS.rsiOversold}).`,
      "TechnicalIndicators (rsi)",
      now,
      [{ label: "RSI(14)", value: rsi?.value?.toFixed(1) ?? "—" }]
    )
  );
  push(
    stat(
      "rsiOverbought",
      "RSI في ذروة الشراء (Overbought)",
      "technical",
      "boolean",
      rsi?.value == null ? "unknown" : rsi.value > SIGNAL_THRESHOLDS.rsiOverbought ? "true" : "false",
      rsi?.value == null ? "N/A" : rsi.value.toFixed(1),
      rsi?.value ?? null,
      `> ${SIGNAL_THRESHOLDS.rsiOverbought}`,
      rsi?.value == null
        ? "بيانات RSI غير متوفرة."
        : rsi.value > SIGNAL_THRESHOLDS.rsiOverbought
        ? `RSI عند ${rsi.value.toFixed(1)} (أعلى من ${SIGNAL_THRESHOLDS.rsiOverbought}) — منطقة ذروة شراء.`
        : `RSI عند ${rsi.value.toFixed(1)} (أقل من ${SIGNAL_THRESHOLDS.rsiOverbought}).`,
      "TechnicalIndicators (rsi)",
      now
    )
  );
  push(
    stat(
      "rsiBullish",
      "RSI إيجابي (RSI Bullish)",
      "technical",
      "boolean",
      rsi?.signal == null ? "unknown" : rsi.signal === "bullish" ? "true" : "false",
      rsi?.signal == null ? "N/A" : rsi.signal === "bullish" ? "Bullish" : rsi.signal === "bearish" ? "Bearish" : "Neutral",
      rsi?.value ?? null,
      "إشارة RSI = Bullish",
      rsi?.signal == null
        ? "بيانات RSI غير متوفرة."
        : rsi.signal === "bullish"
        ? "إشارة RSI إيجابية (خروج من ذروة بيع)."
        : `إشارة RSI ${rsi.signal}.`,
      "TechnicalIndicators (rsi)",
      now
    )
  );

  const macd = indicators?.macd;
  push(
    stat(
      "macdBullish",
      "MACD إيجابي (MACD Bullish)",
      "technical",
      "boolean",
      macd == null ? "unknown" : macd.signal === "bullish" ? "true" : "false",
      macd == null ? "N/A" : macd.signal === "bullish" ? "Bullish" : macd.signal === "bearish" ? "Bearish" : "Neutral",
      macd?.value ?? null,
      "إشارة MACD = Bullish",
      macd == null
        ? "بيانات MACD غير متوفرة."
        : macd.signal === "bullish"
        ? "MACD يتقاطع / فوق خط الإشارة → إيجابي."
        : `إشارة MACD ${macd.signal}.`,
      "TechnicalIndicators (macd)",
      now
    )
  );

  const e9 = indicators?.ema9;
  push(
    stat(
      "priceAboveEma9",
      "السعر فوق EMA9",
      "technical",
      "boolean",
      e9 == null ? "unknown" : e9.signal === "bullish" ? "true" : "false",
      e9 == null ? "N/A" : e9.signal === "bullish" ? "Above" : e9.signal === "bearish" ? "Below" : "—",
      e9?.value != null && price != null ? (price > e9.value ? 1 : 0) : null,
      "السعر > EMA9",
      e9 == null
        ? "بيانات EMA9 غير متوفرة."
        : e9.signal === "bullish"
        ? "السعر أعلى من المتوسط EMA9."
        : "السعر أدنى من المتوسط EMA9.",
      "TechnicalIndicators (ema9)",
      now,
      [{ label: "EMA9", value: e9?.value != null ? `$${e9.value.toLocaleString()}` : "—" }]
    )
  );

  const e21 = indicators?.ema21;
  const e50 = indicators?.ema50;
  const aligned =
    e9?.value != null && e21?.value != null && e50?.value != null
      ? e9.value > e21.value && e21.value > e50.value
      : null;
  push(
    stat(
      "emaAligned",
      "محاذاة المتوسطات (EMA Alignment)",
      "technical",
      "boolean",
      aligned == null ? "unknown" : aligned ? "true" : "false",
      aligned == null
        ? "N/A"
        : aligned
        ? "Bullish (9>21>50)"
        : "Bearish/No",
      aligned != null ? (aligned ? 1 : 0) : null,
      "EMA9 > EMA21 > EMA50",
      aligned == null
        ? "بيانات المتوسطات غير كافية."
        : aligned
        ? "المتوسطات مرتبة تصاعديًا (9>21>50) وهو ترتيب صاعد."
        : "المتوسطات غير مرتبة تصاعديًا (لاتوجد محاذاة صاعدة).",
      "TechnicalIndicators (emas)",
      now,
      [
        { label: "EMA9", value: e9?.value?.toLocaleString() ?? "—" },
        { label: "EMA21", value: e21?.value?.toLocaleString() ?? "—" },
        { label: "EMA50", value: e50?.value?.toLocaleString() ?? "—" },
      ]
    )
  );

  // ---------------- Risk / Reward ----------------
  // R:R derived from nearest S/R distances: (resistance distance) / (support distance).
  const rr = ns != null && nr != null ? nr.distancePercent / Math.abs(ns.distancePercent) : null;
  push(
    stat(
      "riskRewardOk",
      "Risk/Reward مناسبة",
      "risk",
      "numeric",
      rr == null ? "unknown" : rr >= SIGNAL_THRESHOLDS.minRiskReward ? "true" : "false",
      rr == null ? "N/A" : rr.toFixed(2),
      rr,
      `>= ${SIGNAL_THRESHOLDS.minRiskReward}`,
      rr == null
        ? "تعذر حساب R:R (قيم الدعم/المقاومة غير كافية)."
        : rr >= SIGNAL_THRESHOLDS.minRiskReward
        ? `R:R = ${rr.toFixed(2)} (أعلى من الحد ${SIGNAL_THRESHOLDS.minRiskReward}).`
        : `R:R = ${rr.toFixed(2)} (أقل من الحد ${SIGNAL_THRESHOLDS.minRiskReward}).`,
      "Derived (S/R distances)",
      now,
      [
        { label: "المقاومة/الدعم (٪)", value: `${nr?.distancePercent?.toFixed(2) ?? "—"} / ${ns?.distancePercent?.toFixed(2) ?? "—"}` },
        { label: "العائد/المخاطرة", value: rr?.toFixed(2) ?? "—" },
      ]
    )
  );

  // ---------------- Volatility ----------------
  const vol = marketState?.volatility;
  push(
    stat(
      "volatilityOk",
      "التقلب مقبول (Volatility Acceptable)",
      "volatility",
      "boolean",
      vol == null ? "unknown" : vol === "medium" || vol === "low" ? "true" : "false",
      vol == null ? "N/A" : vol === "high" ? "High" : vol === "medium" ? "Medium" : "Low",
      vol === "high" ? 0 : vol == null ? null : 1,
      "Medium / Low",
      vol == null
        ? "بيانات التقلب غير متوفرة."
        : vol === "medium" || vol === "low"
        ? "التقلب في مستوى مقبول (لا ارتفاع حاد)."
        : "التقلب مرتفع (قد يزيد الخطر).",
      "Market State (volatility)",
      now
    )
  );
  push(
    stat(
      "volatilityExpansion",
      "توسع التقلب (Volatility Expansion)",
      "volatility",
      "boolean",
      vol == null ? "unknown" : vol === "high" ? "true" : "false",
      vol == null ? "N/A" : vol === "high" ? "High" : "Low/Medium",
      vol === "high" ? 1 : vol == null ? null : 0,
      "Volatility = High",
      vol == null
        ? "بيانات التقلب غير متوفرة."
        : vol === "high"
        ? "التقلب في حالة توسع (High)."
        : "التقلب ليس في حالة توسع.",
      "Market State (volatility)",
      now
    )
  );

  return out;
}

// ---------------------------------------------------------------------------
// Liquidity sweep detector — derived from recent 1m candles vs liquidity zones.
// A "sweep" is a wick that pierces a liquidity zone bound and then closes back
// on the other side (a fakeout). Nothing here is fabricated; it is computed
// from the real candle series and the real liquidity zones.
// ---------------------------------------------------------------------------
function detectSweeps(
  candles: BtcCandle[],
  zones: { kind: string; center: number; upper: number; lower: number }[]
): { sellSide: boolean; buySide: boolean } | null {
  if (!candles.length || !zones.length) return null;
  const lookback = candles.slice(-24); // last ~24 one-minute candles
  let sellSide = false;
  let buySide = false;
  for (const z of zones) {
    if (z.kind === "resistance") {
      // sell-side resting liquidity above resistance, pierced then closed back below
      for (const c of lookback) {
        if (c.high > z.upper && c.close < z.upper) sellSide = true;
      }
    } else if (z.kind === "support") {
      // buy-side resting liquidity below support, pierced then closed back above
      for (const c of lookback) {
        if (c.low < z.lower && c.close > z.lower) buySide = true;
      }
    }
  }
  return { sellSide, buySide };
}
