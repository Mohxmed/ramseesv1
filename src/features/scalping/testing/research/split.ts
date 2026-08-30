/**
 * Train / Validation / Out-of-Sample split.
 *
 * A single time-ordered split (no shuffling — financial data is sequential).
 * Validation is held out for tuning/early decisions; the out-of-sample tail is
 * measured NEVER during training or validation. Returns off-by-construction so
 * no evaluation leaks backwards through expensive reset-by-index logic.
 */
export interface SplitPlan {
  /** Candle index ranges [start, endExclusive) for each partition. */
  train: [number, number];
  validation: [number, number];
  outOfSample: [number, number];
  /** Offsets (decision indices) preserved from the full series. */
  indices: { train: number[]; validation: number[]; outOfSample: number[] };
}

export interface SplitOptions {
  /** Candle index where decisions begin (must be >= warmup budget). */
  startIdx: number;
  endIdx: number;
  /** Fractions of the decision span (start..end), summing to 1. */
  trainRatio?: number;
  validationRatio?: number;
  /** 0.7 / 0.15 / 0.15 defaults (no overfit, no shuffling). */
}

export function planSplit(o: SplitOptions): SplitPlan {
  const trainRatio = o.trainRatio ?? 0.7;
  const validationRatio = o.validationRatio ?? 0.15;

  const total = Math.max(0, o.endIdx - o.startIdx);
  const trainEnd = o.startIdx + Math.round(total * trainRatio);
  const valEnd = trainEnd + Math.round(total * validationRatio);
  const oosEnd = o.endIdx;

  const range = (a: number, b: number): number[] => {
    const out: number[] = [];
    for (let x = a; x < b; x++) out.push(x);
    return out;
  };

  return {
    train: [o.startIdx, trainEnd],
    validation: [trainEnd, valEnd],
    outOfSample: [valEnd, oosEnd],
    indices: {
      train: range(o.startIdx, trainEnd),
      validation: range(trainEnd, valEnd),
      outOfSample: range(valEnd, oosEnd),
    },
  };
}
