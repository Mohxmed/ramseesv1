/**
 * Macro-layer engine for the Global Markets page.
 *
 * Operates purely on the RAW series (the same `CrossMarketRaw` the engine
 * reads) and derives, with no fabricated numbers:
 *   - a correlation matrix across chosen daily assets on 1D/7D/30D/90D windows
 *   - BTC decoupling detection (instrument vs. equity beta turning unstable)
 *   - per-category BTC macro-pressure sums from the shared factor z/impact
 *   - a curated recurring economic-event calendar (honestly labeled, since no
 *     key-free live calendar exists) + a short-horizon event-risk flag
 *
 * All helpers are PURE: they take `nowMs` as an argument so they never touch
 * the render-time clock.
 */

import { corrOnLookback, pearson } from "./correlation";
import type {
  FactorCategory,
  MarketInfluenceFactor,
  MacroDaily,
  SeriesPoint,
} from "./types";

const DAY_MS = 86_400_000;

export type MacroAssetId = keyof MacroDaily["assets"] | "btc";

export type MacroWindow = "1d" | "7d" | "30d" | "90d";

/** One cell of the correlation matrix. */
export interface CorrCell {
  windowKey: MacroWindow;
  corr: number | null;
  samples: number;
}

export interface MacroCorrMatrix {
  /** Assets across rows/columns (btc included). */
  assets: MacroAssetId[];
  /** cells[rowAsset][colAsset][window] — symmetric, diagonal always 1. */
  cells: Record<string, Record<string, Record<MacroWindow, CorrCell>>>;
  windows: MacroWindow[];
}

export const MACRO_WINDOWS: MacroWindow[] = ["1d", "7d", "30d", "90d"];

/** Intraday (5m) lookback bars per short matrix window. */
const INTRADAY_BARS: Record<Exclude<MacroWindow, "30d" | "90d">, number> = {
  "1d": 288, // 24h of 5m bars
  "7d": 1440, // 5 days of 5m bars (route range cap)
};
const DAILY_LOOKBACK: Record<"30d" | "90d", number> = { "30d": 30, "90d": 90 };

/** Pair log-returns of two daily series aligned on day timestamps. */
export function dailyReturns(
  a: SeriesPoint[],
  b: SeriesPoint[],
  lookbackDays: number
): { xs: number[]; ys: number[] } | null {
  const floor = (p: SeriesPoint): SeriesPoint => ({
    t: p.t - (p.t % DAY_MS),
    v: p.v,
  });
  const amap = new Map<number, number>();
  for (const p of a) {
    const d = floor(p);
    amap.set(d.t, d.v);
  }
  const pairs: { at: number; av: number; bv: number }[] = [];
  for (const p of b) {
    const d = floor(p);
    const av = amap.get(d.t);
    if (av == null || av <= 0 || p.v <= 0) continue;
    pairs.push({ at: d.t, av, bv: p.v });
  }
  pairs.sort((x, y) => x.at - y.at);
  const trimmed = pairs.slice(-lookbackDays);
  if (trimmed.length < 2) return null;
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 1; i < trimmed.length; i++) {
    const prev = trimmed[i - 1];
    const cur = trimmed[i];
    if (prev.av <= 0 || cur.av <= 0) continue;
    xs.push(Math.log(cur.av / prev.av));
    ys.push(Math.log(cur.bv / prev.bv));
  }
  return xs.length >= 2 ? { xs, ys } : null;
}

function pairwiseCorr(
  a: SeriesPoint[] | null,
  b: SeriesPoint[] | null,
  w: MacroWindow
): CorrCell {
  const base: CorrCell = { windowKey: w, corr: null, samples: 0 };
  if (!a || !b || a.length < 2 || b.length < 2) return base;
  if (w === "1d" || w === "7d") {
    const r = corrOnLookback(a, b, INTRADAY_BARS[w]);
    if (r == null) return base;
    return { windowKey: w, corr: r, samples: INTRADAY_BARS[w] };
  }
  const use = dailyReturns(a, b, DAILY_LOOKBACK[w]);
  if (!use || use.xs.length < 2) return base;
  const r = pearson(use.xs, use.ys, 2);
  return r == null ? base : { windowKey: w, corr: r, samples: use.xs.length };
}

/**
 * Compute the full symmetric correlation matrix.
 *  - 1D/7D windows use intraday 5m series (BTC + assets) — trailing returns.
 *  - 30D/90D windows use daily closes.
 * Failed cells (missing series or too few samples) are `corr:null` and are
 * rendered as "—": the UI never fabricates a number.
 *
 * `intraday` supplies the 5m series per asset id (btc + the 6 assets). It is
 * optional: when absent the short windows fall back to null (honest).
 */
export function correlationMatrix(
  daily: MacroDaily,
  intraday?: Partial<Record<MacroAssetId, SeriesPoint[] | null>>
): MacroCorrMatrix {
  const ids: MacroAssetId[] = ["btc", "ndx", "spx", "dxy", "gold", "vix", "us10y"];
  const daySeries = (id: MacroAssetId): SeriesPoint[] | null =>
    id === "btc" ? daily.btc : (daily.assets[id] ?? null);
  const intraSeries = (id: MacroAssetId): SeriesPoint[] | null =>
    id === "btc" ? (intraday?.btc ?? null) : (intraday?.[id] ?? null);

  const cells: MacroCorrMatrix["cells"] = {};
  for (const a of ids) {
    cells[a] = {};
    for (const b of ids) {
      const row: Record<MacroWindow, CorrCell> = {
        "1d": { windowKey: "1d", corr: null, samples: 0 },
        "7d": { windowKey: "7d", corr: null, samples: 0 },
        "30d": { windowKey: "30d", corr: null, samples: 0 },
        "90d": { windowKey: "90d", corr: null, samples: 0 },
      };
      cells[a][b] = row;
      if (a === b) {
        for (const w of MACRO_WINDOWS) {
          row[w] = { windowKey: w, corr: 1, samples: 0 };
        }
        continue;
      }
      for (const w of MACRO_WINDOWS) {
        const source = w === "1d" || w === "7d" ? intraSeries : daySeries;
        row[w] = pairwiseCorr(source(a), source(b), w);
      }
    }
  }

  return { assets: ids, cells, windows: MACRO_WINDOWS };
}

/**
 * BTC decoupling: when the short-horizon BTC↔NDX correlation has collapsed or
 * flipped sign relative to the medium horizon, BTC is "decoupled" from equity
 * risk — it stops being a high-beta risk proxy.
 */
export interface DecouplingStatus {
  decoupled: boolean;
  /** Strength: 0 (tightly coupled) → 1 (fully decoupled). */
  strength: number;
  shortCorr: number | null;
  longCorr: number | null;
  direction: "inverse" | "uncorrelated" | "coupled" | null;
}

export function btcDecoupling(matrix: MacroCorrMatrix): DecouplingStatus {
  const short = matrix.cells.ndx?.btc?.["1d"]?.corr ?? null;
  const long = matrix.cells.ndx?.btc?.["30d"]?.corr ?? null;
  const shortAbs = short == null ? null : Math.abs(short);

  let decoupled: boolean;
  let direction: DecouplingStatus["direction"] = null;
  if (short == null) {
    decoupled = long != null && Math.abs(long) < 0.2;
  } else {
    const inverse = short < -0.3;
    const uncorrelated = shortAbs != null && shortAbs < 0.2;
    const flipped = long != null && Math.sign(short) !== Math.sign(long);
    decoupled = inverse || uncorrelated || flipped;
    if (inverse && flipped) direction = "inverse";
    else if (inverse) direction = "inverse";
    else if (uncorrelated) direction = "uncorrelated";
    else if (flipped) direction = "inverse";
    else direction = "coupled";
  }

  const strength = shortAbs == null ? (long != null ? Math.max(0, Math.min(1, 1 - Math.abs(long))) : 0) : Math.max(0, Math.min(1, 1 - shortAbs));

  return { decoupled, strength, shortCorr: short, longCorr: long, direction };
}

export type MacroRegimeLevel =
  | "STRONG_RISK_ON"
  | "RISK_ON"
  | "NEUTRAL"
  | "RISK_OFF"
  | "STRONG_RISK_OFF";

/**
 * Map the global cross-market score (+volatility dampener) to a 5-state macro
 * market regime. Pure — label/tone translation lives in the UI layer.
 */
export function macroRegimeLevel(
  score: number | null,
  volatility: "HIGH" | "ELEVATED" | "LOW" | "NEUTRAL"
): MacroRegimeLevel {
  if (score == null) return "NEUTRAL";
  let level: MacroRegimeLevel;
  if (score >= 55) level = "STRONG_RISK_ON";
  else if (score >= 25) level = "RISK_ON";
  else if (score <= -55) level = "STRONG_RISK_OFF";
  else if (score <= -25) level = "RISK_OFF";
  else level = "NEUTRAL";
  // High realized/priced volatility cools risk-on states (never fabricate a
  // stronger risk-off than the data itself shows).
  if (volatility === "HIGH") {
    if (level === "STRONG_RISK_ON") level = "RISK_ON";
    else if (level === "RISK_ON") level = "NEUTRAL";
  }
  return level;
}

/**
 * Median of trailing intraday percentage changes — intraday "trend" proxy
 * for a headline instrument when daily data is stale on holidays.
 */
export function intradayTrend(
  series: SeriesPoint[] | null,
  lookback = 96
): number | null {
  if (!series || series.length < 3) return null;
  const pct: number[] = [];
  for (let i = Math.max(1, series.length - lookback); i < series.length; i++) {
    const prev = series[i - 1].v;
    const cur = series[i].v;
    if (prev <= 0) continue;
    pct.push((cur / prev - 1) * 100);
  }
  if (pct.length === 0) return null;
  const sorted = [...pct].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/** Per-category aggregate pressure from the shared factor scores. */
export interface MacroPressureCategory {
  category: FactorCategory;
  /** Weighted sum of z-driven impact * weight over the category's factors. */
  pressure: number;
  /** 0..1 share of a category's factors with usable scores. */
  coverage: number;
  count: number;
  supportive: number;
  pressuring: number;
}

const CATEGORY_ORDER: FactorCategory[] = [
  "equities",
  "dollar",
  "rates",
  "volatility",
  "commodities",
  "fx",
  "liquidity",
];

/**
 * Sum per-category BTC pressure from the shared impact at the CURRENT snapshot.
 * Pure: reads the already-computed state, not the clock.
 */
export function macroPressure(
  factors: Record<string, MarketInfluenceFactor>
): MacroPressureCategory[] {
  const buckets = new Map<FactorCategory, { sum: number; n: number; tot: number; sup: number; pres: number }>();
  for (const cat of CATEGORY_ORDER) buckets.set(cat, { sum: 0, n: 0, tot: 0, sup: 0, pres: 0 });

  for (const f of Object.values(factors)) {
    const bucket = buckets.get(f.category);
    if (!bucket) continue;
    bucket.tot++;
    const imp = f.impactScore;
    if (imp == null) continue;
    bucket.n++;
    bucket.sum += imp * f.weight;
    if (imp > 0) bucket.sup++;
    else if (imp < 0) bucket.pres++;
  }

  return CATEGORY_ORDER.map((cat) => {
    const b = buckets.get(cat)!;
    return {
      category: cat,
      pressure: b.n > 0 ? Math.max(-100, Math.min(100, b.sum / b.n)) : 0,
      coverage: b.tot > 0 ? b.n / b.tot : 0,
      count: b.n,
      supportive: b.sup,
      pressuring: b.pres,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Economic calendar (curated recurring events, honestly labeled)      */
/* ------------------------------------------------------------------ */

export type EventOutcome = "hawkish" | "dovish" | "risk-on" | "risk-off" | "volatile" | "info";
export type EventImpact = "high" | "medium" | "low";

export interface EconEvent {
  id: string;
  /** Human label shown to the user (Arabic). */
  label: string;
  /** Approx UTC millisecond time of the event (recurring estimate). */
  at: number;
  /** UTC day-start the event lands on. */
  dayStart: number;
  country: "US";
  impact: EventImpact;
  /** Directional bias BTC tends to show when the event reads strong. */
  riskDirection: "risk-on" | "risk-off";
  note?: string;
}

/**
 * Grade the next N days of recurring events. No key-free live calendar exists,
 * so this is built from honest date math over the standard US data release
 * cadence and is ALWAYS labeled "مجدولة / تقريبية".
 */
export function economicCalendar(nowMs: number, horizonDays = 14): EconEvent[] {
  const out: EconEvent[] = [];
  // Walk day by day from today for `horizonDays`.
  for (let day = 0; day <= horizonDays; day++) {
    const d = new Date(nowMs + day * DAY_MS);
    const utcDay = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

    const weekday = d.getUTCDay();

    // Weekly Initial Claims — every Thursday (weekday 4), 8:30 ET.
    if (weekday === 4) {
      out.push({
        id: `initial-claims-${utcDay}`,
        label: "مطالبات البطالة الأولية",
        at: utcDay + 12.5 * 3_600_000,
        dayStart: utcDay,
        country: "US",
        impact: "medium",
        riskDirection: "risk-on",
        note: "أسبوعي — مؤشر على سوق العمل",
      });
    }

    // ~mid-month CPI (handled separately below by estimate); NFP early month.
    const dayOfMonth = d.getUTCDate();

    // Non-Farm Payrolls — first Friday of the month, 8:30 ET.
    if (weekday === 5 && dayOfMonth <= 7) {
      out.push({
        id: `nfp-${utcDay}`,
        label: "تقرير التوظيف الأمريكي (NFP)",
        at: utcDay + 12.5 * 3_600_000,
        dayStart: utcDay,
        country: "US",
        impact: "high",
        riskDirection: "risk-on",
      });
    }

    // CPI — roughly mid-month (10th-16th, weekdays only).
    if (weekday >= 2 && weekday <= 6 && dayOfMonth >= 10 && dayOfMonth <= 16) {
      out.push({
        id: `cpi-${utcDay}`,
        label: "مؤشر أسعار المستهلك (CPI)",
        at: utcDay + 12.5 * 3_600_000,
        dayStart: utcDay,
        country: "US",
        impact: "high",
        riskDirection: "risk-off",
      });
    }

    // PPI — the day after CPI typically; approximate 2 days later.
  }

  // Add approximate month-end Treasury refunding note / quarterly rebalancing
  // is intentionally omitted — we only surface USDA-recurring, well-known ones.

  out.sort((a, b) => a.at - b.at);
  return out.slice(0, 40);
}

/**
 * Short-horizon event risk: true when a HIGH-impact scheduled event occurs
 * within the next ~48h. Caller already has `nowMs`.
 */
export function eventRisk(
  events: EconEvent[],
  nowMs: number,
  windowMs = 48 * 3_600_000
): { high: boolean; nextEarly: { label: string; inHours: number; impact: EventImpact } | null } {
  let nextEarly: { label: string; inHours: number; impact: EventImpact } | null = null;
  for (const e of events) {
    if (e.impact !== "high") continue;
    const delta = e.at - nowMs;
    if (delta < 0) continue;
    if (delta <= windowMs) {
      if (!nextEarly || delta < nextEarly.inHours * 3_600_000) {
        nextEarly = { label: e.label, inHours: Math.round(delta / 3_600_000), impact: e.impact };
      }
    }
    if (delta <= windowMs) return { high: true, nextEarly };
  }
  return { high: false, nextEarly };
}