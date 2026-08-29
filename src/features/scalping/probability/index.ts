/**
 * Probability / Calibration.
 *
 * STRICT separation between:
 *   - signal `score` (0..100 magnitude of agreement) and
 *   - `probability` (a calibrated probability of the directional outcome).
 *
 * A score is NEVER called a probability. Until this pipeline has accumulated
 * enough resolved outcomes to estimate a calibration map (isotonic / Platt / a
 * per-bin empirical reliability), the returned probability is an EXPLICITLY
 * UNCALIBRATED monotone transform of the normalized score + agreement, and is
 * flagged `calibrated: false`.
 *
 * The calibration layer stores per-direction reliability tables and the
 * scoring metrics (Brier score, log loss, calibration error) used to validate
 * any future calibration — all wired to the Recording module.
 *
 * Pure and deterministic over its inputs.
 */

export type DirectionalProbability = {
  /** Direction this probability refers to. */
  direction: "LONG" | "SHORT";
  /** 0..1 probability of the direction being a profitable move. */
  probability: number;
  /** 0..1 complement: probability of the adverse move. */
  complement: number;
  /** 0..1 neutral / small-move probability (residual). */
  neutral: number;
  /** true only when this value was produced by a validated calibration map. */
  calibrated: boolean;
  /** Basis label to display ("heuristic" while uncalibrated). */
  basis: "heuristic" | "calibrated";
  /** Brier score of this forecast vs its resolved outcome (set post-hoc). */
  brierScore: number | null;
};

export type ProbabilityInput = {
  /** 0..100 magnitude of the directional agreement (the signal score). */
  score: number;
  /** 0..100 agreement/freshness confidence (drives sharpness, not calibration). */
  confidence: number;
  /** Net signed family vote, -1..1 (positive = LONG-friendly). */
  signed: number;
  /** Optional precomputed calibration map lookup (null while uncalibrated). */
  calibration?: CalibrationModel | null;
};

/** Historical per-bin reliability used only when calibration is validated. */
export type CalibrationModel = {
  /** Map of score-bin => observed win-rate (0..1) for the bin's direction. */
  map: Record<string, number>;
  bins: number[];
  brier: number;
  logLoss: number;
  calibrationError: number;
  sampleCount: number;
};

/**
 * Transform a score/agreement into a directional probability pair.
 * While uncalibrated this is a monotone squashing of the normalized signed
 * vote — a loud "how strong is the agreement", NOT a validated hit-rate.
 */
export function toProbability(input: ProbabilityInput): {
  long: DirectionalProbability;
  short: DirectionalProbability;
} {
  const { score, confidence, signed } = input;

  // Normalise the signed vote to a 0..1 bullish tendency (0 = fully bearish).
  const bull = clamp01((signed + 1) / 2);

  // Squash into [0.5 .. 1] around the "agreement" strength.
  const strength = clamp01(score / 100);
  const sharpness = clamp01((confidence / 100) * 0.5 + 0.5);

  // Bullish probability = directional bias scaled by agreement strength.
  const longUp = clamp01(bull * (0.5 + strength * 0.5 * sharpness));
  const shortUp = clamp01((1 - bull) * (0.5 + strength * 0.5 * sharpness));

  const make = (prob: number, direction: "LONG" | "SHORT"): DirectionalProbability => {
    const complement = clamp01(1 - prob - 1e-6);
    const neutral = clamp01(1 - prob - complement);
    return {
      direction,
      probability: prob,
      complement,
      neutral,
      calibrated: false,
      basis: "heuristic",
      brierScore: null,
    };
  };

  const effective = (p: DirectionalProbability): DirectionalProbability => {
    // Reserved: once a CalibrationModel is validated, remap probabilities
    // through the per-bin reliability table and flip `calibrated`.
    const cal = input.calibration;
    if (cal && cal.sampleCount > 500) {
      const bin = nearestBin(cal.bins, Math.round(score));
      const mapped = cal.map[String(bin)];
      if (mapped != null) {
        return {
          ...p,
          probability: clamp01(mapped),
          complement: clamp01(1 - mapped),
          neutral: clamp01(Math.max(0, 1 - mapped - (1 - mapped) * 0.1)),
          calibrated: true,
          basis: "calibrated",
        };
      }
    }
    return p;
  };

  return {
    long: effective(make(longUp, "LONG")),
    short: effective(make(shortUp, "SHORT")),
  };
}

/** Which direction's probability to surface, given the signed vote. */
export function dominantProbability(
  signed: number,
  probs: { long: DirectionalProbability; short: DirectionalProbability }
): DirectionalProbability {
  return signed >= 0 ? probs.long : probs.short;
}

// --- calibration scoring (used by the Recording / backtest layer) -----------

/** Brier score for a single probabilistic forecast with a binary outcome. */
export function brier(probability: number, outcome: 0 | 1): number {
  return (probability - outcome) ** 2;
}

/** Log loss for a single probabilistic forecast with a binary outcome. */
export function logLoss(probability: number, outcome: 0 | 1): number {
  const p = clamp01(probability);
  if (outcome === 1) return p <= 0 ? 10 : -Math.log(p);
  return p >= 1 ? 10 : -Math.log(1 - p);
}

/** Mean Brier + log loss + calibration error over resolved forecasts. */
export function calibrationReport(
  resolved: { probability: number; outcome: 0 | 1 }[]
): Omit<CalibrationModel, "map" | "bins"> & { brier: number; logLoss: number } {
  if (!resolved.length) {
    return { brier: 0, logLoss: 0, calibrationError: 0, sampleCount: 0 };
  }
  let b = 0;
  let ll = 0;
  for (const r of resolved) {
    b += brier(r.probability, r.outcome);
    ll += logLoss(r.probability, r.outcome);
  }
  const meanProb = meanOf(resolved.map((r) => r.probability));
  const winRate = resolved.reduce((a, r) => a + r.outcome, 0) / resolved.length;
  const calibrationError = Math.abs(meanProb - winRate);
  return {
    brier: b / resolved.length,
    logLoss: ll / resolved.length,
    calibrationError,
    sampleCount: resolved.length,
  };
}

function clamp01(v: number): number {
  return v <= 0 ? 0 : v >= 1 ? 1 : v;
}

function nearestBin(bins: number[], x: number): number {
  if (!bins.length) return 0;
  let best = bins[0];
  let bestD = Infinity;
  for (const b of bins) {
    const d = Math.abs(b - x);
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  return best;
}

function meanOf(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}
