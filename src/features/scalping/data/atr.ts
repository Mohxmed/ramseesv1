/**
 * ATR (Average True Range) — derived from the REAL 1m candle series already
 * in the shared pipeline.
 *
 * Pure function, no React, no network. Returns null when there are not enough
 * candles to compute a meaningful TR sequence. It never fabricates a number:
 * every output is a direct arithmetic reduction of the supplied candles.
 */

export type AtrResult = {
  /** ATR in absolute price units. */
  value: number | null;
  /** ATR as % of the latest close. */
  pct: number | null;
  /** Number of candles used in the average (the look-back period). */
  period: number;
  /** Human label of the timeframe the candles come from (e.g. "1m"). */
  frameLabel: string;
};

/**
 * Average True Range over the last N 1m candles.
 * TR_i = max(high-low, |high-prevClose|, |low-prevClose|).
 * ATR = Wilders-style EMA with alpha = 1/period (or simple mean when short).
 */
export function computeAtr(
  candles: { close: number; high: number; low: number; open: number }[],
  period = 14,
  frameLabel = "1م"
): AtrResult {
  if (!Array.isArray(candles) || candles.length < period + 1) {
    return { value: null, pct: null, period, frameLabel };
  }

  const n = Math.min(period, candles.length - 1);
  const series = candles.slice(-(n + 1));
  const trs: number[] = [];

  for (let i = 1; i < series.length; i++) {
    const c = series[i];
    const prevClose = series[i - 1].close;
    const tr = Math.max(
      c.high - c.low,
      Math.abs(c.high - prevClose),
      Math.abs(c.low - prevClose)
    );
    if (isFinite(tr) && tr >= 0) trs.push(tr);
  }

  if (trs.length < 1) return { value: null, pct: null, period, frameLabel };

  const alpha = 1 / n;
  let atr = trs[0];
  for (let i = 1; i < trs.length; i++) {
    atr = (trs[i] - atr) * alpha + atr;
  }

  const lastClose = series[series.length - 1].close;
  const pct = lastClose > 0 ? (atr / lastClose) * 100 : null;

  return { value: atr, pct, period: n, frameLabel };
}
