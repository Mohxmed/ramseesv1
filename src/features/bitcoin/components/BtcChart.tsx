"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  ColorType,
  CandlestickSeries,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import type { BtcCandle, BtcTimeframe } from "../types";
import { TIMEFRAMES } from "../constants";

type Props = {
  candles: BtcCandle[];
  timeframe: BtcTimeframe;
  onTimeframeChange: (tf: BtcTimeframe) => void;
};

export function BtcChart({ candles, timeframe, onTimeframeChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#a1a1aa",
        fontFamily: "'Cairo', sans-serif",
      },
      grid: {
        vertLines: { color: "rgba(39,39,42,0.4)" },
        horzLines: { color: "rgba(39,39,42,0.4)" },
      },
      rightPriceScale: { borderColor: "rgba(63,63,70,0.5)" },
      timeScale: { borderColor: "rgba(63,63,70,0.5)" },
      crosshair: {
        mode: 0,
        vertLine: { color: "#52525b" },
        horzLine: { color: "#52525b" },
      },
      autoSize: true,
      localization: {
        locale: "ar",
        timeFormatter: (t: number) => new Date(t * 1000).toLocaleString("ar"),
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981",
      downColor: "#ef4444",
      borderUpColor: "#10b981",
      borderDownColor: "#ef4444",
      wickUpColor: "#10b981",
      wickDownColor: "#ef4444",
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "",
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    chartRef.current = chart;

    return () => {
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current) return;
    if (candles.length === 0) return;

    candleSeriesRef.current.setData(
      candles.map((c) => ({
        time: c.time as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
    );

    volumeSeriesRef.current.setData(
      candles.map((c) => ({
        time: c.time as UTCTimestamp,
        value: c.volume,
        color: c.close >= c.open ? "rgba(16,185,129,0.35)" : "rgba(239,68,68,0.35)",
      }))
    );

    chartRef.current?.timeScale().fitContent();
  }, [candles]);

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-zinc-200">مخطط الشموع — BTC/USDT</h2>
        <div className="flex flex-wrap gap-1">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              type="button"
              onClick={() => onTimeframeChange(tf)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                tf === timeframe
                  ? "bg-zinc-700 text-zinc-50"
                  : "bg-zinc-800/60 text-zinc-400 hover:bg-zinc-700/60 hover:text-zinc-200"
              }`}
            >
              {tf.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <div ref={containerRef} className="h-[360px] w-full" />
    </div>
  );
}
