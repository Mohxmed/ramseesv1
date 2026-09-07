import type { MarketSessionKind, MarketSessionStatus } from "./types";

/**
 * US Market Session Engine — pure and deterministic, driven entirely by the
 * `nowMs` the caller supplies (never the render-time clock).
 *
 * Computes, per asset kind, the real session state of its exchange at a moment
 * in time (Eastern Time with proper DST): NYSE/Nasdaq indices, CME Globex
 * futures and spot FX, plus the official US market-holiday calendar.
 *
 * Honesty rules:
 *   - Indices (^NDX/^GSPC/^VIX/^RUT/…, ^TNX/^TYX) stop printing at the regular
 *     close — there is no meaningful after-hours index price. Equity-kind
 *     assets therefore only report OPEN / PRE_MARKET / AFTER_HOURS / CLOSED /
 *     HOLIDAY; the freshness model treats everything outside OPEN as "the
 *     final close" (never "stale" on a closed market).
 *   - Futures trade almost around the clock (Sun 18:00 ET → Fri 17:00 ET with
 *     a daily 17:00–18:00 ET maintenance break) and on most equity holidays.
 *   - FX is 24/5 continuous (Sun 17:00 ET → Fri 17:00 ET), including US
 *     holidays.
 */

const MIN = 60_000;

/** Off-UTC minutes for Eastern Time at `nowMs` (240 in EDT, 300 in EST). */
export function etOffsetMinutes(nowMs: number): number {
  return dstInEffect(nowMs) ? 240 : 300;
}

/** US DST: second Sunday in March 02:00 → first Sunday in November 02:00. */
export function dstInEffect(nowMs: number): boolean {
  const y = new Date(nowMs).getUTCFullYear();
  const start = Date.UTC(y, 2, nthSundayOfMonth(y, 2, 2), 7); // 2nd Sun Mar
  const end = Date.UTC(y, 10, nthSundayOfMonth(y, 10, 1), 6); // 1st Sun Nov
  return nowMs >= start && nowMs < end;
}

/** Day-of-month of the nth Sunday (monthIndex is 0-based). */
function nthSundayOfMonth(year: number, monthIndex: number, nth: number): number {
  const firstDow = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay();
  const firstSunday = ((7 - firstDow) % 7) + 1;
  return firstSunday + (nth - 1) * 7;
}

/** A Date whose UTC fields equal the ET wall clock at `nowMs`. */
function etDay(nowMs: number): Date {
  return new Date(nowMs - etOffsetMinutes(nowMs) * MIN);
}

/** Wall-clock minutes since midnight ET (0–1439). */
export function etMinutesOfDay(nowMs: number): number {
  const d = etDay(nowMs);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

/** ET weekday, 0 = Sunday … 6 = Saturday (raw `getUTCDay()` on the ET-shift). */
export function etWeekday(nowMs: number): number {
  return etDay(nowMs).getUTCDay();
}

/** ET date key `YYYY-MM-DD` (used for the calendar lookup). */
export function etDateKey(nowMs: number): string {
  const d = etDay(nowMs);
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const da = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

/* ------------------------------------------------------------------ */
/* US exchange calendars (official published dates)                    */
/* ------------------------------------------------------------------ */

/** NYSE / Nasdaq equity-index holidays: full-day closures and 13:00 early
 *  closes. Weekend dates are pre-shifted to the observed weekday. */
const EQUITY_HOLIDAYS: Record<number, { full: string[]; early: string[] }> = {
  2025: {
    full: ["01-01", "01-20", "02-17", "04-18", "05-26", "06-19", "07-04", "09-01", "12-25"],
    early: ["11-27", "12-24"],
  },
  2026: {
    full: ["01-01", "01-19", "02-16", "04-03", "05-25", "06-19", "07-03", "09-07", "12-25"],
    early: ["11-26", "12-24"],
  },
  2027: {
    full: ["01-01", "01-18", "02-15", "03-26", "05-31", "06-18", "07-05", "09-06", "12-24"],
    early: ["11-25"],
  },
};

/** CME equity-futures closures (Globex is otherwise near-24/5): New Year's
 *  Day, Good Friday and Christmas. */
const CME_HOLIDAYS: Record<number, string[]> = {
  2025: ["01-01", "04-18", "12-25"],
  2026: ["01-01", "04-03", "12-25"],
  2027: ["01-01", "03-26", "12-24"],
};

export interface USCalendar {
  /** `full` → the entire day is closed; `early` → 13:00 ET early close. */
  type: "full" | "early";
}

/** Equity-index calendar verdict for the ET date at `nowMs`. */
export function usEquityCalendar(nowMs: number): USCalendar | null {
  const key = etDateKey(nowMs);
  const cal = EQUITY_HOLIDAYS[Number(key.slice(0, 4))];
  if (!cal) return null;
  const md = key.slice(5);
  if (cal.full.includes(md)) return { type: "full" };
  if (cal.early.includes(md)) return { type: "early" };
  return null;
}

/* ------------------------------------------------------------------ */
/* Session math per asset kind                                         */
/* ------------------------------------------------------------------ */

/** NYSE/Nasdaq index hours, pre-shifted holidays and early closes. */
function equitySession(nowMs: number): MarketSessionStatus {
  const wd = etWeekday(nowMs);
  if (wd === 0 || wd === 6) return "CLOSED"; // Sun / Sat
  const cal = usEquityCalendar(nowMs);
  const m = etMinutesOfDay(nowMs);
  if (cal?.type === "full") return "HOLIDAY";
  const close = cal?.type === "early" ? 780 : 960; // early day: 13:00 ET
  if (m < 240) return "CLOSED"; // before pre-market
  if (m < 570) return "PRE_MARKET"; // 04:00–09:30
  if (m < close) return "OPEN"; // regular session
  if (close === 960 && m < 1200) return "AFTER_HOURS"; // 16:00–20:00
  return "CLOSED";
}

/** CME Globex equity futures: Sun 18:00 ET → Fri 17:00 ET, daily 17–18 ET
 *  maintenance break; holidays are only the three full CME closures. */
function futuresSession(nowMs: number): MarketSessionStatus {
  const wd = etWeekday(nowMs);
  const m = etMinutesOfDay(nowMs);
  const key = etDateKey(nowMs);
  if (CME_HOLIDAYS[Number(key.slice(0, 4))]?.includes(key.slice(5))) return "HOLIDAY";
  if (wd === 6) return "CLOSED"; // Saturday
  if (wd === 0) return m >= 1080 ? "OPEN" : "CLOSED"; // Sunday 18:00 open
  if (wd === 5) return m < 1020 ? "OPEN" : "CLOSED"; // Friday 17:00 close
  return m >= 1020 && m < 1080 ? "CLOSED" : "OPEN"; // daily break
}

/** Spot FX: 24/5 continuous Sun 17:00 ET → Fri 17:00 ET. */
function fxSession(nowMs: number): MarketSessionStatus {
  const wd = etWeekday(nowMs);
  const m = etMinutesOfDay(nowMs);
  if (wd === 6) return "CLOSED"; // Saturday
  if (wd === 0) return m >= 1020 ? "OPEN" : "CLOSED"; // Sunday 17:00 open
  if (wd === 5) return m < 1020 ? "OPEN" : "CLOSED"; // Friday 17:00 close
  return "OPEN";
}

/** Session state of an asset kind at `nowMs` (periodic ⇒ no session). */
export function marketSessionFor(
  kind: MarketSessionKind,
  nowMs: number
): MarketSessionStatus {
  switch (kind) {
    case "equity":
    case "derived":
      return equitySession(nowMs);
    case "future":
      return futuresSession(nowMs);
    case "fx":
      return fxSession(nowMs);
    default:
      return "NONE";
  }
}

/** Is the market in a state where we expect fresh prints? */
export function isTradingSession(s: MarketSessionStatus | null): boolean {
  return s === "OPEN";
}

/** Short English key for debugging/logging. */
export function sessionCode(s: MarketSessionStatus | null): string {
  return s ?? "NONE";
}