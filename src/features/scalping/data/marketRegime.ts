/**
 * Market Regime Monitor — the header of the scalping terminal.
 *
 * Pure, UI-agnostic computation of the general market state + the current
 * wave per timeframe, sourced from ONE real source only: the multi-timeframe
 * candle series already delivered by the shared market SSOT (`multiTF`).
 *
 * Each timeframe talks the SAME data contract (MarketTfReading), so the
 * presentation layer renders a single grid with no per-tf branching.
 *
 * The directional reads are REAL (end of the current wave from fractal swing
 * points, or the drift of the real candles). The only presentational band is
 * the "sideways / عرضي" label, which is a small relative move threshold per
 * timeframe — never a fabricated direction. Missing / too-young data stays
 * "غير متاح" (available: false) instead of inventing a value.
 */

import type { BtcCandle, BtcTimeframe } from "../../bitcoin/types";
import { analyzeWaves } from "../../bitcoin/analysis/waves";

export type WaveState = "up" | "down" | "sideways";

export type MarketTfReading = {
  /** Raw timeframe key, e.g. "5m". */
  tf: string;
  /** Compact period label for the cell, e.g. "5د". */
  label: string;
  /** Fuller period label for tooltip / a11y, e.g. "5 دقائق". */
  periodLabel: string;
  /** Wave state — up (صاعدة), down (هابطة), sideways (عرضية), null = "غير متاح". */
  wave: WaveState | null;
  /** Arrow glyph: ↗ / ↘ / → — null when unavailable. */
  arrow: "↗" | "↘" | "→" | null;
  /** Signed move % of the current wave (real, nullable). */
  pct: number | null;
  /** Wave strength 0..100 (real, nullable). */
  strength: number | null;
  /** true when the underlying candle series could produce a reading. */
  available: boolean;
};

export type MarketRegimeMonitor = {
  /** Aggregate general market state (صاعد/هابط/عرضي) across timeframes, or null. */
  generalState: WaveState | null;
  /** Model state label for the header (null → "غير متاح"). */
  generalLabel: "صاعد" | "هابط" | "عرضي" | null;
  /** The primary "current wave" direction (↗/↘/→) shown next to the state. */
  currentArrow: "↗" | "↘" | "→" | null;
  /** One reading per requested timeframe, all with the same data contract. */
  timeframes: MarketTfReading[];
};

const ORDER: BtcTimeframe[] = ["1m", "5m", "15m", "30m", "1h", "4h"];

const LABEL: Record<string, string> = {
  "1m": "1د",
  "5m": "5د",
  "15m": "15د",
  "30m": "30د",
  "1h": "1س",
  "4h": "4س",
};

const PERIOD_LABEL: Record<string, string> = {
  "1m": "1 دقيقة",
  "5m": "5 دقائق",
  "15m": "15 دقيقة",
  "30m": "30 دقيقة",
  "1h": "ساعة واحدة",
  "4h": "4 ساعات",
};

/**
 * Sideways band (relative move %, per timeframe). Real direction comes from
 * the current wave; "عرضي" is only reached when the wave move is this small.
 */
const FLAT_PCT: Record<string, number> = {
  "1m": 0.03,
  "5m": 0.04,
  "15m": 0.06,
  "30m": 0.08,
  "1h": 0.12,
  "4h": 0.2,
};

function arrowOf(wave: WaveState | null): "↗" | "↘" | "→" | null {
  if (wave === "up") return "↗";
  if (wave === "down") return "↘";
  if (wave === "sideways") return "→";
  return null;
}

function stateOf(wave: WaveState | null): "صاعد" | "هابط" | "عرضي" | null {
  if (wave === "up") return "صاعد";
  if (wave === "down") return "هابط";
  if (wave === "sideways") return "عرضي";
  return null;
}

/** Reading for a single timeframe. */
function readTf(tf: BtcTimeframe, candles?: BtcCandle[]): MarketTfReading {
  const label = LABEL[tf] ?? tf;
  const periodLabel = PERIOD_LABEL[tf] ?? tf;
  const notAvailable: MarketTfReading = {
    tf,
    label,
    periodLabel,
    wave: null,
    arrow: null,
    pct: null,
    strength: null,
    available: false,
  };

  if (!candles || candles.length < 10) return notAvailable;

  const current = analyzeWaves(candles).find((w) => w.isCurrent);
  if (!current) {
    // Fall back to the raw drift of the real candles when no swing is found yet.
    const a = candles[candles.length - 10]?.close ?? null;
    const b = candles[candles.length - 1]?.close ?? null;
    if (a == null || b == null || a === 0) return notAvailable;
    const pct = ((b - a) / a) * 100;
    const wave: WaveState = Math.abs(pct) < FLAT_PCT[tf] ? "sideways" : pct > 0 ? "up" : "down";
    return { tf, label, periodLabel, wave, arrow: arrowOf(wave), pct, strength: null, available: true };
  }

  const flat = Math.abs(current.movePercent) < FLAT_PCT[tf];
  const wave: WaveState = flat ? "sideways" : current.direction === "up" ? "up" : "down";
  return {
    tf,
    label,
    periodLabel,
    wave,
    arrow: arrowOf(wave),
    pct: current.movePercent,
    strength: current.strength,
    available: true,
  };
}

/**
 * Build the whole regime monitor from the shared multi-timeframe candles.
 * Computed once per snapshot — the presentation layer never recomputes it.
 */
export function buildMarketRegimeMonitor(
  multiTF: Partial<Record<BtcTimeframe, BtcCandle[]>> | undefined
): MarketRegimeMonitor {
  const timeframes = ORDER.map((tf) => readTf(tf, multiTF?.[tf]));

  const states = timeframes
    .filter((t) => t.wave != null)
    .map((t) => t.wave as WaveState);

  let generalState: WaveState | null = null;
  if (states.length > 0) {
    const up = states.filter((s) => s === "up").length;
    const down = states.filter((s) => s === "down").length;
    const side = states.filter((s) => s === "sideways").length;
    if (up > down && up >= side) generalState = "up";
    else if (down > up && down >= side) generalState = "down";
    else generalState = "sideways";
  }

  return {
    generalState,
    generalLabel: stateOf(generalState),
    currentArrow: arrowOf(generalState),
    timeframes,
  };
}
