import type {
  BtcCandle,
  FuturesContext,
  MarketState,
  OrderBookSnapshot,
  OrderFlowData,
  TechnicalIndicators,
} from "../types";
import { lastVolumeZCandles } from "./multiTF";

export type AlertSeverity = "info" | "warning" | "critical";

export type AlertItem = {
  id: string;
  severity: AlertSeverity;
  label: string;
  value: string;
  detail: string;
  source: string;
  time: number;
};

/** Transparency list of every active rule (thresholds never hidden). */
export const ALERT_RULES: { id: string; label: string; threshold: string }[] = [
  { id: "funding-extreme", label: "الفاندينغ متطرف", threshold: "أعلى/أدنى من قيمتين قويتين" },
  { id: "wide-spread", label: "انتشار واسع", threshold: "أكبر من 0.05%" },
  { id: "one-sided-flow", label: "تدفق بجهة واحدة (Taker)", threshold: "أعلى من 65% أو أدنى من 35%" },
  { id: "volume-spike", label: "تسارع حجم (30 دقيقة)", threshold: "z أكبر من 1.5" },
  { id: "oi-move", label: "تغيّر العقود المفتوحة (1س)", threshold: "أكبر من 1.5% أو أدنى من -1.5%" },
  { id: "liq-pressure", label: "ضغط التصفية", threshold: "مرتفع" },
  { id: "vwap-deviation", label: "الانحراف عن VWAP", threshold: "أكبر من 0.5%" },
  { id: "depth-imbalance", label: "تفاوت عمق الطلبات", threshold: "أكبر من 0.4" },
  { id: "vol+regime", label: "تقلب + حجم مرتفعان", threshold: "منطقتا «مرتفع» معًا" },
];

export type AlertInput = {
  nowMs: number;
  marketState: MarketState | null;
  orderBook: OrderBookSnapshot | null;
  orderFlow: OrderFlowData | null;
  futures: FuturesContext | null;
  indicators: TechnicalIndicators | null;
  candles30m: BtcCandle[] | null;
};

/** Rule-based market events — every item is derived from real data. */
export function computeAlerts(input: AlertInput): AlertItem[] {
  const { nowMs, marketState, orderBook, orderFlow, futures, indicators, candles30m } = input;
  const items: AlertItem[] = [];
  const push = (
    id: string,
    severity: AlertSeverity,
    label: string,
    value: string,
    detail: string,
    source: string,
    time: number
  ) => items.push({ id, severity, label, value, detail, source, time });

  if (futures) {
    const t = futures.timestamp || nowMs;
    const regime = futures.fundingRegime;
    if (regime === "strongPositive" || regime === "strongNegative") {
      push(
        "funding-extreme",
        "warning",
        "معدل الفاندينغ متطرف",
        `${futures.fundingRate.toFixed(4)}%`,
        "الفاندينغ في منطقة متطرفة — يرجّح ضغط تصفية، وسياق سوق وليس توصية.",
        "Binance Futures",
        t
      );
    }
    if (futures.oiChange1h != null && Math.abs(futures.oiChange1h) > 1.5) {
      const up = futures.oiChange1h > 0;
      push(
        "oi-move",
        "info",
        up ? "ارتفاع العقود المفتوحة (1س)" : "انخفاض العقود المفتوحة (1س)",
        `${futures.oiChange1h.toFixed(2)}%`,
        "تغيّر واضح في مراكز العقود خلال ساعة — سياق سوق فقط.",
        "Binance Futures",
        t
      );
    }
  }

  if (orderBook) {
    const t = orderBook.timestamp || nowMs;
    if (orderBook.spreadPercent > 0.05) {
      push(
        "wide-spread",
        "warning",
        "انتشار عرض/طلب واسع",
        `${orderBook.spreadPercent.toFixed(3)}%`,
        "سيولة رقيقة عند الحافة — انزلاق سعري محتمل أكبر.",
        "Binance Spot",
        t
      );
    }
    if (orderBook.depthImbalance > 0.4 || orderBook.depthImbalance < -0.4) {
      const buySide = orderBook.depthImbalance > 0;
      push(
        "depth-imbalance",
        "info",
        buySide ? "عمق شراء متفوق" : "عمق بيع متفوق",
        `${(orderBook.depthImbalance >= 0 ? "+" : "")}${orderBook.depthImbalance.toFixed(2)}`,
        "كمية عمق قرب السعر غير متوازنة لجهة واحدة.",
        "Binance Spot",
        t
      );
    }
  }

  if (orderFlow) {
    const t = orderFlow.timestamp || nowMs;
    const ratio = orderFlow.takerBuyRatio;
    if (ratio > 0.65 || ratio < 0.35) {
      const buySide = ratio > 0.65;
      push(
        "one-sided-flow",
        "info",
        buySide ? "ضغط شراء بجهة واحدة" : "ضغط بيع بجهة واحدة",
        `${(ratio * 100).toFixed(1)}%`,
        "نسبة المشتري العدواني خارج التوازن في نافذة التجميع.",
        "Binance Spot",
        t
      );
    }
  }

  if (candles30m && candles30m.length >= 31) {
    const z = lastVolumeZCandles(candles30m);
    if (z > 1.5) {
      push(
        "volume-spike",
        "info",
        "تسارع حجم التداول (30 دقيقة)",
        `z=${z.toFixed(2)}`,
        "حجم آخر شمعة أعلى من المعتاد بالنسبة للفترة المتاحة.",
        "Binance Spot",
        candles30m[candles30m.length - 1].time * 1000
      );
    }
  }

  if (marketState) {
    const t = marketState.timestamp || nowMs;
    if (marketState.liquidationPressure === "high") {
      push(
        "liq-pressure",
        "warning",
        "ضغط تصفية مرتفع",
        "مرتفع",
        "نموذج ضغط التصفية (الفاندينغ + التقلب + الحجم) عند ذروته.",
        "Market State (نموذج)",
        t
      );
    }
    if (marketState.volatility === "high" && marketState.volumeRegime === "high") {
      push(
        "vol+regime",
        "critical",
        "تقلب مرتفع مع حجم مرتفع",
        "بيئة حادة",
        "ارتفاع مشترك قد يضخّم الحركة في الاتجاهين على المدى القصير.",
        "Market State (نموذج)",
        t
      );
    }
  }

  const vwap = indicators?.vwap.value ?? null;
  if (vwap != null && marketState?.price) {
    const dev = (marketState.price / vwap - 1) * 100;
    if (Math.abs(dev) > 0.5) {
      push(
        "vwap-deviation",
        "info",
        dev > 0 ? "السعر أعلى من VWAP" : "السعر أدنى من VWAP",
        `${dev >= 0 ? "+" : ""}${dev.toFixed(2)}%`,
        "انحراف مؤقت عن المتوسط المرجّح بالحجم في الإطار المختار.",
        "VWAP (مشتق)",
        marketState.timestamp || nowMs
      );
    }
  }

  const order: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };
  items.sort((a, b) => order[a.severity] - order[b.severity]);
  return items;
}