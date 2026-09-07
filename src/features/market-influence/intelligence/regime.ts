import { REGIME_THRESHOLDS } from "./config";
import type {
  DollarRegime,
  EquitiesRegime,
  LiquidityRegime,
  MarketInfluenceFactor,
  RatesRegime,
  RegimeState,
  RiskRegime,
  VolatilityRegime,
} from "./types";

const T = REGIME_THRESHOLDS;

function sign(v: number | null, thresh: number, pos: string, neg: string): string {
  if (v == null) return "NEUTRAL";
  if (v > thresh) return pos;
  if (v < -thresh) return neg;
  return "NEUTRAL";
}

/**
 * Market regime detection from the computed factors only. Multiple regimes can
 * coexist (risk appetite, liquidity, dollar, rates, vol, equities).
 */
export function buildRegime(
  factors: Record<string, MarketInfluenceFactor>,
  globalScore: number | null
): RegimeState {
  const f = factors;

  const eqNdx = f.nasdaq?.momentum ?? null;
  const eqSp = f.sp500?.momentum ?? null;
  const eqRut = f.rut2000?.momentum ?? null;
  const eqZ =
    [eqNdx, eqSp, eqRut].filter((v): v is number => v != null).length > 0
      ? (eqNdx ?? 0) * 0.5 + (eqSp ?? 0) * 0.3 + (eqRut ?? 0) * 0.2
      : null;

  const dxyZ = f.dxy?.zScore;
  const vixM = f.vix?.momentum;
  const vixZ = f.vix?.zScore;
  const rateZ =
    (f.us10y?.zScore ?? 0) * 0.6 + (f.spread?.zScore ?? 0) * 0.4;

  const liqChg = f.liquidity?.change24hPct;
  const m2Chg = f.m2?.change24hPct;
  const liqZ =
    liqChg != null || m2Chg != null
      ? (liqChg ?? 0) * 0.6 + (m2Chg ?? 0) * 0.4
      : null;

  // --- Risk appetite: equities + volatility + dollar ----------------------
  let risk: RiskRegime = "NEUTRAL";
  if (eqZ != null && vixZ != null) {
    const eqStrong = eqZ > T.equityZ;
    const vixHigh = vixZ > T.vixHigh;
    const dxyStrong = dxyZ != null && dxyZ > T.dxyZ;
    if (eqStrong && !vixHigh && !dxyStrong) risk = "RISK_ON";
    else if (!eqStrong || vixHigh || dxyStrong) risk = "RISK_OFF";
  } else if (eqZ != null) {
    risk = eqZ > T.equityZ ? "RISK_ON" : eqZ < -T.equityZ ? "RISK_OFF" : "NEUTRAL";
  }

  // --- Liquidity ----------------------------------------------------------
  let liquidity: LiquidityRegime = "NEUTRAL";
  if (liqZ != null) {
    if (liqZ > T.liquidityPct) liquidity = "EXPANSION";
    else if (liqZ < -T.liquidityPct) liquidity = "CONTRACTION";
  }

  // --- Volatility ---------------------------------------------------------
  let volatility: VolatilityRegime = "NEUTRAL";
  if (vixZ != null) {
    if (vixZ > T.vixHigh) volatility = "HIGH";
    else if (vixZ > T.vixElevated) volatility = "ELEVATED";
    else if (vixZ < T.vixLow) volatility = "LOW";
  } else if (vixM != null) {
    if (vixM > T.vixElevated) volatility = "ELEVATED";
    else if (vixM < -T.vixElevated) volatility = "LOW";
  }

  // --- Dollar -------------------------------------------------------------
  const dollar: DollarRegime =
    sign(dxyZ, T.dxyZ, "STRONG", "WEAK") as DollarRegime;

  // --- Rates --------------------------------------------------------------
  const rates: RatesRegime =
    rateZ == null
      ? "NEUTRAL"
      : rateZ > T.rateZ
      ? "RISING"
      : rateZ < -T.rateZ
      ? "FALLING"
      : "NEUTRAL";

  // --- Equities -----------------------------------------------------------
  const equities: EquitiesRegime =
    sign(eqZ, T.equityZ, "STRONG", "WEAK") as EquitiesRegime;

  const externalEnvironment =
    globalScore == null
      ? "NEUTRAL"
      : globalScore >= T.envFavorable
      ? "FAVORABLE"
      : globalScore <= T.envUnfavorable
      ? "UNFAVORABLE"
      : "NEUTRAL";

  return {
    risk,
    liquidity,
    volatility,
    dollar,
    rates,
    equities,
    externalEnvironment,
  };
}