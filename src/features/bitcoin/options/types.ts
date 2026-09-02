/**
 * Options — normalized types.
 *
 * Single normalized vocabulary for options analytics (Deribit). The rest of the
 * app reads ONLY these types and never an exchange-specific API shape. The
 * values carry an explicit DataStatus so the UI can render N/A whenever a value
 * genuinely cannot be provided — nothing is ever mocked or zero-filled.
 */

import type { DataStatus, MarketSource } from "../futures/types";
export type { DataStatus, MarketSource };
/** Base freshness envelope shared by every options reading. */
export type OptionsFresh = {
  timestamp: number; // exchange/observed time (ms)
  receivedAt: number; // local receive time (ms)
  freshnessMs: number | null; // receivedAt - timestamp
  source: MarketSource;
  status: DataStatus;
};

/** One option contract (an expiry x strike x Call/Put). */
export type OptionLeg = {
  /** e.g. "BTC-29SEP26-105000-C". */
  instrumentName: string;
  kind: "call" | "put";
  /** Strike price. */
  strike: number;
  /** Expiry ms epoch. */
  expiry: number;
  /** Open interest (base-currency units, contracts). */
  openInterest: number | null;
  /** Mark implied volatility (%). */
  markIv: number | null;
  /** Best bid / ask (null if absent). */
  bidPrice: number | null;
  askPrice: number | null;
  /** Mid of bid/ask (null if either side missing). */
  midPrice: number | null;
  /** 24h volume (base units). */
  volume: number | null;
  /** Last trade price. */
  lastPrice: number | null;
};

/** Aggregated per-expiry option chain metrics. */
export type OptionsExpiry = {
  /** Expiry ms epoch. */
  expiry: number;
  /** Instrument name prefix (e.g. "BTC-29SEP26"). */
  label: string;
  /** Total OI in that expiry (calls + puts). */
  openInterest: number | null;
  /** Put/Call OI ratio in that expiry. */
  putCallOiRatio: number | null;
  /** Open-interest weighted ATM mark IV (%). */
  atmIv: number | null;
  /** IV skew: OTM-put IV - OTM-call IV (ppt). */
  skew: number | null;
  /** Max-pain strike for the expiry. */
  maxPainStrike: number | null;
  /** Underlying index price at observation. */
  underlyingPrice: number | null;
  /** Days to expiry. */
  daysToExpiry: number | null;
};

/** Unified options state — the only object the feature engine reads. */
export type OptionsState = OptionsFresh & {
  /** Underlying index (spot) price from Deribit. */
  indexPrice: number | null;
  /** Market-wide 24h call / put volume and put/call ratio (volume based). */
  callVolume24h: number | null;
  putVolume24h: number | null;
  putCallVolumeRatio: number | null; // puts/calls (volume)
  putCallOiRatio: number | null; // puts/calls (open interest, all expiries)
  /** Aggregate open interest across all listed options (base units). */
  totalOptionsOi: number | null;
  /** Open-interest-weighted ATM mark IV across the nearest expiries (%). */
  atmIv: number | null;
  /** IV term/level change hint: last session's IV - current (ppt) — directional pace. */
  ivChange: number | null;
  /** 25-delta risk-reversal skew proxy: OTM put IV - OTM call IV (ppt). */
  skew25: number | null;
  /** Flagship expiry chains (closest liquid expiries). */
  expiries: OptionsExpiry[];
  /** Per-expiry raw legs (for deep dive), limited. */
  legs: OptionLeg[];
  /** Number of distinct expiries contributing. */
  expiryCount: number;
  /** Per-sub-system health. */
  dataHealth: {
    oiStatus: DataStatus;
    ivStatus: DataStatus;
    volumeStatus: DataStatus;
    allLive: boolean;
  };
};
