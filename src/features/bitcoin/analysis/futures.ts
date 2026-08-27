import type {
  BtcCandle,
  FundingRegimeReading,
  FuturesContext as FC,
} from "../types";

export function computeFuturesContext(input: {
  spotPrice: number;
  markPrice: number | null;
  indexPrice: number | null;
  fundingRate: number | null; // %
  lastFundingRate: number | null; // %
  longShortRatio: number | null;
  longAccountShare: number | null; // 0..1
  futuresVolume: number | null;
  openInterest: number | null;
  oiHistory: { time: number; value: number }[];
  fundingHistory: { time: number; rate: number }[];
  spotKlines: BtcCandle[] | null; // for price direction context
}): FC | null {
  const { oiHistory, fundingHistory } = input;

  // OI change over ~20m and ~60m from the OI history series.
  const lastOi = oiHistory.length ? oiHistory[oiHistory.length - 1].value : input.openInterest;
  const oiChange = (agoSecs: number): number | null => {
    if (!oiHistory.length || !lastOi) return null;
    const cutoff = Date.now() / 1000 - agoSecs;
    let base: number | null = null;
    for (const p of oiHistory) if (p.time <= cutoff) base = p.value;
    if (base == null) base = oiHistory[0].value;
    return base > 0 ? ((lastOi - base) / base) * 100 : null;
  };
  const oiChange20m = oiChange(20 * 60);
  const oiChange1h = oiChange(60 * 60);

  // Funding regime from the latest rate (and its magnitude).
  const fundingRate = input.fundingRate ?? input.lastFundingRate ?? null;
  let fundingRegime: FundingRegimeReading = "neutral";
  if (fundingRate == null) fundingRegime = "neutral";
  else if (fundingRate > 0.05) fundingRegime = "strongPositive";
  else if (fundingRate > 0.01) fundingRegime = "positive";
  else if (fundingRate > -0.005) fundingRegime = "neutral";
  else if (fundingRate > -0.05) fundingRegime = "negative";
  else fundingRegime = "strongNegative";

  const fundingChange =
    fundingHistory.length > 1 && fundingHistory[0].rate != null
      ? fundingRate != null
        ? fundingRate - fundingHistory[0].rate
        : null
      : null;

  // Basis (futures premium) in % and bps.
  const basis =
    input.markPrice != null && input.spotPrice > 0
      ? ((input.markPrice - input.spotPrice) / input.spotPrice) * 100
      : null;
  const basisBps = basis != null ? basis * 100 : null;

  // Price (recent) vs OI context.
  let priceDirection = 0;
  if (input.spotKlines && input.spotKlines.length >= 2) {
    const p = input.spotKlines;
    priceDirection =
      p[p.length - 1].close >= p[Math.max(0, p.length - 7)].close ? 1 : -1;
  }
  let priceOiContext = "flat";
  if (oiChange1h != null) {
    if (priceDirection > 0 && oiChange1h > 1) priceOiContext = "price-up-oi-up";
    else if (priceDirection > 0 && oiChange1h < -1) priceOiContext = "price-up-oi-down";
    else if (priceDirection < 0 && oiChange1h > 1) priceOiContext = "price-down-oi-up";
    else if (priceDirection < 0 && oiChange1h < -1) priceOiContext = "price-down-oi-down";
    else priceOiContext = "flat";
  }

  const longAccountShare =
    input.longAccountShare != null
      ? Math.max(0, Math.min(1, input.longAccountShare))
      : null;

  return {
    openInterest: lastOi ?? input.openInterest ?? 0,
    markPrice: input.markPrice ?? input.spotPrice,
    indexPrice: input.indexPrice ?? input.spotPrice,
    fundingRate: fundingRate ?? 0,
    fundingChange,
    fundingRegime,
    longShortRatio: input.longShortRatio ?? 1,
    longAccountShare,
    futuresVolume: input.futuresVolume ?? 0,
    basis,
    basisBps,
    oiChange20m,
    oiChange1h,
    priceOiContext,
    cumulativeLiquidations: null,
    fundingHistory,
    oiHistory,
    timestamp: Date.now(),
  };
}
