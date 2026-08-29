"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { spotApi, marketApi, futuresApi } from "../services";
import type {
  FundingRateRaw,
  LongShortRatioRaw,
  OpenInterestHistRaw,
} from "../services/api";
import {
  normalizeSpotTicker,
  normalizeKlines,
  normalizeMarketOverview,
  normalizeOrderBook,
  normalizeOrderFlow,
  normalizeOiHistory,
  normalizePremiumIndex,
  normalizeBookTicker,
} from "../data/normalize";
import { computeIndicators } from "../indicators";
import { runPrediction } from "../prediction";
import { analyzeSupportResistance } from "../analysis";
import {
  computeMarketState,
  analyzeLiquidity,
  analyzeMarketStructure,
  analyzeWaves,
  computeFuturesContext,
} from "../analysis";
import { extractFeatureVector, findSimilarCases, buildForecast } from "../prediction";
import {
  useLiveFeed,
  mergeBookTicker,
  type LiveBookTicker,
} from "./useLiveFeed";
import {
  FAST_REFRESH_MS,
  SLOW_REFRESH_MS,
  CHART_DEFAULT_TIMEFRAME,
  MULTI_TF_LIMIT,
  MULTI_TFS,
  SIMILARITY_LIMIT,
} from "../constants";
import type {
  BtcCandle,
  BtcTimeframe,
  FuturesContext,
  MarketOverview,
  MarketState,
  OrderBookSnapshot,
  OrderFlowData,
  PredictionResult,
  TechnicalIndicators,
} from "../types";
import type { SupportResistanceResult } from "../analysis/types";
import type {
  LiquidityAnalysis,
  MarketStructureAnalysis,
  Wave,
} from "../analysis";
import type { Forecast } from "../types";

type DataState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready" };

export function useBitcoinPipeline() {
  const [timeframe, setTimeframe] = useState<BtcTimeframe>(
    CHART_DEFAULT_TIMEFRAME
  );
  const [candles, setCandles] = useState<BtcCandle[]>([]);
  const [chartCandles, setChartCandles] = useState<BtcCandle[]>([]);
  const [overview, setOverview] = useState<MarketOverview | null>(null);
  const [indicators, setIndicators] = useState<TechnicalIndicators | null>(null);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [analysis30m, setAnalysis30m] = useState<SupportResistanceResult | null>(null);
  const [data, setData] = useState<DataState>({ status: "loading" });

  // --- Market Intelligence state ---
  const [multiTF, setMultiTF] = useState<Partial<Record<BtcTimeframe, BtcCandle[]>>>({});
  const [orderBook, setOrderBook] = useState<OrderBookSnapshot | null>(null);
  const [restFlow, setRestFlow] = useState<OrderFlowData | null>(null);
  const [futures, setFutures] = useState<FuturesContext | null>(null);
  const [marketState, setMarketState] = useState<MarketState | null>(null);
  const [liquidity, setLiquidity] = useState<LiquidityAnalysis | null>(null);
  const [structure, setStructure] = useState<MarketStructureAnalysis | null>(null);
  const [waves, setWaves] = useState<Wave[]>([]);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [liveConnected, setLiveConnected] = useState<boolean | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  // Near-live spot price + last-update timestamp driven by the WebSocket feed
  // (throttled to ~1s), surfaced onto the whole shared store.
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [liveUpdatedAt, setLiveUpdatedAt] = useState<number | null>(null);

  const liveFeed = useLiveFeed();
  // Mirror the live payload into a ref so the REST fetch doesn't re-create its
  // effect (and interval) whenever the WebSocket emits a tick.
  const liveFlowRef = useRef<OrderFlowData | null>(null);
  liveFlowRef.current = liveFeed.orderFlow;
  const liveBookRef = useRef<{ bestBid: number; bestAsk: number } | null>(null);
  liveBookRef.current = liveFeed.bookTicker;
  useEffect(() => {
    setLiveConnected(liveFeed.connected);
  }, [liveFeed.connected]);

  // Mirror throttled WebSocket price + last-update onto the shared store. Reading
  // from refs keeps this cheap and independent of the REST polling cadence.
  useEffect(() => {
    setLivePrice(liveFeed.livePrice);
    setLiveUpdatedAt(liveFeed.liveUpdatedAt);
  }, [liveFeed.livePrice, liveFeed.liveUpdatedAt]);

  // Overlay the WebSocket spot price onto the canonical overview so the instant
  // price bar / market overview update in near-real-time (not just every REST
  // poll), and keep the chart's forming 1m candle live.
  useEffect(() => {
    const price = liveFeed.livePrice;
    const ts = liveFeed.liveUpdatedAt;
    if (price != null) {
      setOverview((prev) => {
        if (!prev) return prev;
        if (prev.price === price && prev.updatedAt === (ts ?? prev.updatedAt)) return prev;
        return { ...prev, price, updatedAt: ts ?? prev.updatedAt };
      });
    }

    const kline = liveFeed.liveKline;
    if (kline) {
      setChartCandles((prev) => {
        if (!prev.length) return prev;
        const last = prev[prev.length - 1];
        if (last.time !== kline.time) return prev; // only merge into the forming candle
        const next = prev.slice();
        next[next.length - 1] = {
          ...last,
          high: Math.max(last.high, kline.high),
          low: Math.min(last.low, kline.low),
          close: kline.close,
          volume: kline.volume,
          takerBuyVolume: kline.takerBuyVolume ?? last.takerBuyVolume,
        };
        const merged = next[next.length - 1];
        if (merged.close === last.close && merged.high === last.high && merged.low === last.low) {
          return prev;
        }
        return next;
      });
    }
  }, [liveFeed.livePrice, liveFeed.liveUpdatedAt, liveFeed.liveKline]);

  const busyRef = useRef(false);

  const loadPrediction = useCallback((kLines: BtcCandle[]) => {
    if (kLines.length >= 2) setPrediction(runPrediction(kLines));
  }, []);

  const loadIndicators = useCallback((chartSeries: BtcCandle[]) => {
    if (chartSeries.length >= 2) setIndicators(computeIndicators(chartSeries));
  }, []);

  const loadAnalysis30m = useCallback((kLines: BtcCandle[]) => {
    setAnalysis30m(analyzeSupportResistance(kLines));
  }, []);

  // Fast tier: refresh only the live, lightweight Binance endpoints (~5s).
  // These are the values that genuinely change every few seconds — spot price,
  // the chart's active candle, best bid/ask, depth, trades, and the live
  // futures mark/funding/open-interest. Recomputes just the cheap derived state
  // and leaves the heavy multi-TF analysis & CoinGecko to the slow tier below.
  const fetchFast = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      const [rawTicker, rawKlines, chartRaw, bookRaw, bookTickerRaw, tradesRaw] =
        await Promise.all([
          spotApi.ticker24h(),
          spotApi.klines("1m", SIMILARITY_LIMIT),
          spotApi.klines(timeframe, MULTI_TF_LIMIT),
          spotApi.depth(20).catch(() => null),
          spotApi.bookTicker().catch(() => null),
          spotApi.aggTrades(300).catch(() => null),
        ]);
      const spot = normalizeSpotTicker(rawTicker);
      const all1m = normalizeKlines(rawKlines);
      const chartTf = normalizeKlines(chartRaw);
      setCandles(all1m);
      setChartCandles(chartTf);
      loadIndicators(chartTf);

      // Live order book (depth snapshot + bookTicker best bid/ask).
      const restTicker: LiveBookTicker | null = bookTickerRaw
        ? normalizeBookTicker(bookTickerRaw)
        : null;
      const book = mergeBookTicker(
        bookRaw ? normalizeOrderBook(bookRaw) : null,
        liveBookRef.current ?? restTicker
      );
      setOrderBook(book);

      const flowRaw = tradesRaw ? normalizeOrderFlow(tradesRaw) : null;
      setRestFlow(flowRaw);

      // Live futures mark / funding / open-interest (lightweight fapi calls).
      const [premiumRaw, oiRaw, fundingRaw, futTickerRaw] = await Promise.all([
        futuresApi.premiumIndex().catch(() => null),
        futuresApi.openInterest().catch(() => null),
        futuresApi.fundingRate().catch(() => [] as FundingRateRaw),
        futuresApi.ticker24h().catch(() => null),
      ]);
      const pm = premiumRaw ? normalizePremiumIndex(premiumRaw) : null;
      const fundingHistory = fundingRaw
        .map((f) => ({
          time: Math.floor(f.fundingTime / 1000),
          rate: parseFloat(f.fundingRate) * 100,
        }))
        .filter((f) => isFinite(f.rate))
        .reverse();
      const futuresCtx = computeFuturesContext({
        spotPrice: spot.price,
        markPrice:
          pm?.markPrice ??
          (futTickerRaw ? parseFloat(futTickerRaw.markPrice) : null),
        indexPrice: pm?.indexPrice ?? null,
        fundingRate:
          fundingHistory.length
            ? fundingHistory[0].rate
            : pm?.lastFundingRate != null
            ? pm.lastFundingRate * 100
            : null,
        lastFundingRate: pm?.lastFundingRate != null ? pm.lastFundingRate * 100 : null,
        longShortRatio: null,
        longAccountShare: null,
        futuresVolume: futTickerRaw ? parseFloat(futTickerRaw.quoteVolume) : null,
        openInterest: oiRaw ? parseFloat(oiRaw.openInterest) : null,
        oiHistory: [],
        fundingHistory,
        spotKlines: all1m,
      });
      setFutures(futuresCtx);

      setData({ status: "ready" });
      setRefreshTrigger((t) => t + 1);
    } catch {
      // Non-fatal: keep the last known live state; full errors surface in the
      // slow tier so the dashboard never blanks out on a single bad tick.
    } finally {
      busyRef.current = false;
    }
  }, [timeframe, loadIndicators]);

  const fetchSlow = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      const [rawTicker, rawKlines, rawKlines30m] = await Promise.all([
        spotApi.ticker24h(),
        spotApi.klines("1m", SIMILARITY_LIMIT),
        spotApi.klines("30m"),
      ]);
      const spot = normalizeSpotTicker(rawTicker);
      const all1m = normalizeKlines(rawKlines);
      const all30m = normalizeKlines(rawKlines30m);
      setCandles(all1m);
      loadAnalysis30m(all30m);

      const tfResults = await Promise.all(
        MULTI_TFS.map((tf) =>
          tf !== "30m"
            ? spotApi.klines(tf, MULTI_TF_LIMIT).then(normalizeKlines).catch(() => [] as BtcCandle[])
            : Promise.resolve(all30m)
        )
      );
      const tfMap: Partial<Record<BtcTimeframe, BtcCandle[]>> = {};
      MULTI_TFS.forEach((tf, i) => {
        if (tfResults[i].length) tfMap[tf] = tfResults[i];
      });
      setMultiTF(tfMap);

      const [
        bookRaw,
        bookTickerRaw,
        tradesRaw,
        oiHistRaw,
        premiumRaw,
        fundingRaw,
        oiRaw,
        futTickerRaw,
        lsrRaw,
      ] = await Promise.all([
        spotApi.depth(20).catch(() => null),
        spotApi.bookTicker().catch(() => null),
        spotApi.aggTrades(300).catch(() => null),
        futuresApi.openInterestHist(60).catch(() => null),
        futuresApi.premiumIndex().catch(() => null),
        futuresApi.fundingRate().catch(() => [] as FundingRateRaw),
        futuresApi.openInterest().catch(() => null),
        futuresApi.ticker24h().catch(() => null),
        futuresApi.longShortRatio().catch(() => [] as LongShortRatioRaw),
      ]);

      const restTicker: LiveBookTicker | null = bookTickerRaw
        ? normalizeBookTicker(bookTickerRaw)
        : null;
      const book = mergeBookTicker(
        bookRaw ? normalizeOrderBook(bookRaw) : null,
        liveBookRef.current ?? restTicker
      );
      setOrderBook(book);

      const flowRaw = tradesRaw ? normalizeOrderFlow(tradesRaw) : null;
      setRestFlow(flowRaw);

      const oiHistory = oiHistRaw ? normalizeOiHistory(oiHistRaw as OpenInterestHistRaw) : [];
      const fundingHistory = fundingRaw
        .map((f) => ({
          time: Math.floor(f.fundingTime / 1000),
          rate: parseFloat(f.fundingRate) * 100,
        }))
        .filter((f) => isFinite(f.rate))
        .reverse();
      const pm = premiumRaw ? normalizePremiumIndex(premiumRaw) : null;
      const futuresCtx = computeFuturesContext({
        spotPrice: spot.price,
        markPrice: pm?.markPrice ?? (futTickerRaw ? parseFloat(futTickerRaw.markPrice) : null),
        indexPrice: pm?.indexPrice ?? null,
        fundingRate:
          fundingHistory.length
            ? fundingHistory[0].rate
            : pm?.lastFundingRate != null
            ? pm.lastFundingRate * 100
            : null,
        lastFundingRate: pm?.lastFundingRate != null ? pm.lastFundingRate * 100 : null,
        longShortRatio: lsrRaw?.length
          ? parseFloat(lsrRaw[lsrRaw.length - 1].longShortRatio)
          : null,
        longAccountShare: lsrRaw?.length
          ? parseFloat(lsrRaw[lsrRaw.length - 1].longAccount)
          : null,
        futuresVolume: futTickerRaw ? parseFloat(futTickerRaw.quoteVolume) : null,
        openInterest: oiRaw ? parseFloat(oiRaw.openInterest) : null,
        oiHistory,
        fundingHistory,
        spotKlines: all1m,
      });
      setFutures(futuresCtx);

      const effectiveFlow: OrderFlowData | null =
        liveFlowRef.current && liveFlowRef.current.takerBuyRatio >= 0
          ? liveFlowRef.current
          : flowRaw;

      const state = computeMarketState({
        candles: tfMap,
        orderBook: book,
        orderFlow: effectiveFlow,
        futures: futuresCtx,
        timestamp: Date.now(),
      });
      setMarketState(state);

      const liq = analyzeLiquidity({
        candles: all30m,
        srZones: analysis30m?.zones ?? [],
        orderBook: book,
        orderFlow: effectiveFlow,
        futures: futuresCtx,
        marketState: state,
      });
      setLiquidity(liq);

      setStructure(analyzeMarketStructure(all30m));
      setWaves(analyzeWaves(all30m));

      const features = extractFeatureVector(all1m);
      const conditional = findSimilarCases(all1m, features, [30, 60, 120]);
      const fc = buildForecast({
        candles: all1m,
        features,
        conditional,
        multiTF: tfMap,
      });
      setForecast(fc);

      const chartTf: BtcCandle[] = tfMap[timeframe]?.length
        ? tfMap[timeframe]!
        : all1m;
      setChartCandles(chartTf);
      loadIndicators(chartTf);

      let overviewData: MarketOverview | null = null;
      try {
        const [coin, global] = await Promise.all([
          marketApi.overview(),
          marketApi.global(),
        ]);
        overviewData = normalizeMarketOverview({
          coin,
          global,
          spotPrice: spot.price,
          spotTimestamp: spot.timestamp,
          funding: null,
          openInterest: oiRaw,
          longShort: lsrRaw as LongShortRatioRaw | null,
          futuresTicker: futTickerRaw,
        });
      } catch {
        overviewData = null;
      }
      setOverview(overviewData);
      loadPrediction(all1m);
      setData({ status: "ready" });
      setRefreshTrigger((t) => t + 1);
    } catch (err) {
      setData({
        status: "error",
        message: err instanceof Error ? err.message : "فشل تحميل بيانات السوق",
      });
    } finally {
      busyRef.current = false;
    }
  }, [timeframe, loadIndicators, loadPrediction, loadAnalysis30m]);

  useEffect(() => {
    // Initial load: pull the full snapshot, then start the live feed going.
    fetchSlow();
    fetchFast();
    const slow = setInterval(() => fetchSlow(), SLOW_REFRESH_MS);
    const fast = setInterval(() => fetchFast(), FAST_REFRESH_MS);
    return () => {
      clearInterval(slow);
      clearInterval(fast);
    };
  }, [fetchSlow, fetchFast]);

  const refresh = useCallback(() => {
    fetchFast();
    fetchSlow();
  }, [fetchFast, fetchSlow]);

  return {
    data,
    timeframe,
    setTimeframe,
    overview,
    candles,
    chartCandles,
    indicators,
    prediction,
    analysis30m,
    multiTF,
    orderBook,
    orderFlow: restFlow,
    liveConnected,
    livePrice,
    liveUpdatedAt,
    livePriceTs: liveUpdatedAt,
    futures,
    marketState,
    liquidity,
    structure,
    waves,
    forecast,
    refreshTrigger,
    refresh,
  };
}
