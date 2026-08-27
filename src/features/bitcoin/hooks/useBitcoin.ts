"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  spotApi,
  marketApi,
  futuresApi,
} from "../services";
import {
  normalizeSpotTicker,
  normalizeKlines,
  normalizeMarketOverview,
} from "../data/normalize";
import { computeIndicators } from "../indicators";
import { runPrediction } from "../prediction";
import {
  AUTO_REFRESH_MS,
  CHART_DEFAULT_TIMEFRAME,
} from "../constants";
import type {
  BtcCandle,
  BtcTimeframe,
  MarketOverview,
  PredictionResult,
  TechnicalIndicators,
} from "../types";

type DataState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready" };

export function useBitcoin() {
  const [timeframe, setTimeframe] = useState<BtcTimeframe>(
    CHART_DEFAULT_TIMEFRAME
  );
  const [candles, setCandles] = useState<BtcCandle[]>([]);
  const [chartCandles, setChartCandles] = useState<BtcCandle[]>([]);
  const [overview, setOverview] = useState<MarketOverview | null>(null);
  const [indicators, setIndicators] = useState<TechnicalIndicators | null>(
    null
  );
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [data, setData] = useState<DataState>({ status: "loading" });

  const busyRef = useRef(false);

  const loadPrediction = useCallback((kLines: BtcCandle[]) => {
    if (kLines.length < 2) return;
    setPrediction(runPrediction(kLines));
  }, []);

  const loadIndicators = useCallback((chartSeries: BtcCandle[]) => {
    if (chartSeries.length < 2) return;
    setIndicators(computeIndicators(chartSeries));
  }, []);

  const fetchAll = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      // Fetch 1m candles once for prediction + derive chart from timeframe
      // when the timeframe is 1m, else fetch chart series separately.
      const [rawTicker, rawKlines] = await Promise.all([
        spotApi.ticker24h(),
        spotApi.klines("1m"),
      ]);

      const spot = normalizeSpotTicker(rawTicker);
      const all1m = normalizeKlines(rawKlines);
      setCandles(all1m);

      // Build chart series based on selected timeframe.
      if (timeframe === "1m") {
        setChartCandles(all1m);
        loadIndicators(all1m);
      } else {
        const rawChart = await spotApi.klines(timeframe);
        const chartSeries = normalizeKlines(rawChart);
        setChartCandles(chartSeries);
        loadIndicators(chartSeries);
      }

      // Market overview (CoinGecko + futures) — failures degrade gracefully.
      let overviewData: MarketOverview | null = null;
      try {
        const [coin, global, funding, openInterest, longShort, futuresTicker] =
          await Promise.all([
            marketApi.overview(),
            marketApi.global(),
            futuresApi.fundingRate().catch(() => null),
            futuresApi.openInterest().catch(() => null),
            futuresApi.longShortRatio().catch(() => null),
            futuresApi.ticker24h().catch(() => null),
          ]);
        overviewData = normalizeMarketOverview({
          coin,
          global,
          spotPrice: spot.price,
          spotTimestamp: spot.timestamp,
          funding,
          openInterest,
          longShort,
          futuresTicker,
        });
      } catch {
        overviewData = null;
      }
      setOverview(overviewData);
      loadPrediction(all1m);
      setData({ status: "ready" });
    } catch (err) {
      setData({
        status: "error",
        message:
          err instanceof Error ? err.message : "فشل تحميل بيانات السوق",
      });
    } finally {
      busyRef.current = false;
    }
  }, [timeframe, loadIndicators, loadPrediction]);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(() => fetchAll(), AUTO_REFRESH_MS);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const refresh = useCallback(() => {
    fetchAll();
  }, [fetchAll]);

  return {
    data,
    timeframe,
    setTimeframe,
    overview,
    candles,
    chartCandles,
    indicators,
    prediction,
    refresh,
  };
}
