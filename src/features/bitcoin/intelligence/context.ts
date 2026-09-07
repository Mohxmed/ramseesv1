import type { BtcCandle, FuturesContext } from "../types";
import { atrPctOf, lastVolumeZCandles } from "./multiTF";

/** Rank percentile (0..100) of `value` within `reference`. */
export function percentileOf(value: number, reference: number[]): number | null {
  if (!reference.length || !isFinite(value)) return null;
  let count = 0;
  for (const r of reference) if (r <= value) count++;
  return (count / reference.length) * 100;
}

export type ContextStat = {
  id: string;
  label: string;
  value: string;
  percentile: number | null;
  n: number;
  note: string;
};

function atrSeries(candles: BtcCandle[], period = 14): number[] {
  const out: number[] = [];
  if (candles.length < period + 1) return out;
  for (let i = period; i < candles.length; i++) {
    out.push(atrPctOf(candles.slice(i - period + 1, i + 1), period));
  }
  return out;
}

export type ContextInput = {
  /** Candles of the primary analysis frame (30m). */
  candles: BtcCandle[];
  /** Arabic label of that frame, e.g. "30 دقيقة". */
  candlesTf: string;
  futures: FuturesContext | null;
};

/**
 * Window percentiles over the data actually available right now. Every note
 * states the window; nothing pretends to be a multi-year history.
 */
export function buildContextStats(input: ContextInput): ContextStat[] {
  const { candles, candlesTf, futures } = input;
  const stats: ContextStat[] = [];

  if (candles.length >= 40) {
    const series = atrSeries(candles, 14);
    const last = atrPctOf(candles, 14);
    const reference = series.slice(0, -1);
    stats.push({
      id: "volatility",
      label: `التقلب (ATR%) — ${candlesTf}`,
      value: `${last.toFixed(2)}%`,
      percentile: reference.length ? percentileOf(last, reference) : null,
      n: Math.max(0, series.length - 1),
      note: `مقابل نافذة ${Math.max(0, series.length)} قراءة ضمن البيانات المتاحة.`,
    });

    const lastVol = candles[candles.length - 1].volume;
    const volumes = candles.slice(-101, -1).map((c) => c.volume);
    stats.push({
      id: "volume",
      label: "الحجم النسبي — 30 دقيقة",
      value: `z=${lastVolumeZCandles(candles).toFixed(2)}`,
      percentile: volumes.length ? percentileOf(lastVol, volumes) : null,
      n: volumes.length,
      note: "موضع آخر شمعة حجمًا بين آخر 100 شمعة.",
    });
  } else {
    stats.push({
      id: "volatility",
      label: "التقلب (ATR%)",
      value: "غير متاح",
      percentile: null,
      n: 0,
      note: "بيانات غير كافية بعد.",
    });
    stats.push({
      id: "volume",
      label: "الحجم النسبي",
      value: "غير متاح",
      percentile: null,
      n: 0,
      note: "بيانات غير كافية بعد.",
    });
  }

  if (futures) {
    if (futures.fundingHistory.length && futures.fundingRate != null) {
      stats.push({
        id: "funding",
        label: "الفاندينغ — الموضع بين آخر القراءات",
        value: `${futures.fundingRate.toFixed(4)}%`,
        percentile: percentileOf(futures.fundingRate, futures.fundingHistory.map((f) => f.rate)),
        n: futures.fundingHistory.length,
        note: "ضمن سجل الفاندينغ المتاح فقط.",
      });
    } else {
      stats.push({
        id: "funding",
        label: "الفاندينغ",
        value: "غير متاح",
        percentile: null,
        n: 0,
        note: "لا يوجد سجل فاندينغ كافٍ.",
      });
    }

    if (futures.oiHistory.length && futures.openInterest != null) {
      stats.push({
        id: "oi",
        label: "العقود المفتوحة — الموضع بين آخر القراءات",
        value: futures.openInterest.toLocaleString("en-US"),
        percentile: percentileOf(futures.openInterest, futures.oiHistory.map((o) => o.value)),
        n: futures.oiHistory.length,
        note: "ضمن سجل OI المتاح فقط.",
      });
    } else {
      stats.push({
        id: "oi",
        label: "العقود المفتوحة",
        value: "غير متاح",
        percentile: null,
        n: 0,
        note: "لا يوجد سجل OI كافٍ.",
      });
    }
  } else {
    stats.push({
      id: "funding",
      label: "الفاندينغ",
      value: "غير متاح",
      percentile: null,
      n: 0,
      note: "بيانات العقود الآجلة غير متاحة.",
    });
    stats.push({
      id: "oi",
      label: "العقود المفتوحة",
      value: "غير متاح",
      percentile: null,
      n: 0,
      note: "بيانات العقود الآجلة غير متاحة.",
    });
  }

  return stats;
}