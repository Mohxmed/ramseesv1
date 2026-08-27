"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  ColorType,
  CandlestickSeries,
  HistogramSeries,
  BaselineSeries,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type BaselineData,
  type UTCTimestamp,
} from "lightweight-charts";
import type { BtcCandle, BtcTimeframe } from "../types";
import type { SupportResistanceResult, Zone } from "../analysis";
import { TIMEFRAMES } from "../constants";

type Props = {
  candles: BtcCandle[];
  timeframe: BtcTimeframe;
  onTimeframeChange: (tf: BtcTimeframe) => void;
  analysis?: SupportResistanceResult | null;
};

const COLOR = {
  supportLine: "#10b981",
  supportFill: "rgba(16,185,129,0.10)",
  resistanceLine: "#ef4444",
  resistanceFill: "rgba(239,68,68,0.10)",
  nearestSupportLine: "#34d399",
  nearestSupportFill: "rgba(52,211,153,0.22)",
  nearestResistanceLine: "#f87171",
  nearestResistanceFill: "rgba(248,113,113,0.22)",
  currentPrice: "#e4e4e7",
};

function zoneColor(zone: Zone) {
  if (zone.isNearest) {
    return zone.kind === "support"
      ? { line: COLOR.nearestSupportLine, fill: COLOR.nearestSupportFill }
      : { line: COLOR.nearestResistanceLine, fill: COLOR.nearestResistanceFill };
  }
  return zone.kind === "support"
    ? { line: COLOR.supportLine, fill: COLOR.supportFill }
    : { line: COLOR.resistanceLine, fill: COLOR.resistanceFill };
}

export function BtcChart({ candles, timeframe, onTimeframeChange, analysis }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const zoneSeriesRef = useRef<ISeriesApi<"Baseline">[]>([]);

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
      zoneSeriesRef.current = [];
    };
  }, []);

  // Candle + volume data.
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

  // Support / Resistance zone overlays + current price line.
  useEffect(() => {
    const chart = chartRef.current;
    const candleSeries = candleSeriesRef.current;
    if (!chart || !candleSeries) return;
    if (candles.length === 0) return;

    // Clean previous overlays (price lines only ever added here).
    for (const s of zoneSeriesRef.current) chart.removeSeries(s);
    for (const line of candleSeries.priceLines()) candleSeries.removePriceLine(line);
    zoneSeriesRef.current = [];

    const firstTime = candles[0].time as UTCTimestamp;
    const lastTime = candles[candles.length - 1].time as UTCTimestamp;

    if (analysis) {
      const zonesToDraw = pickZones(analysis);
      for (const zone of zonesToDraw) {
        const { line, fill } = zoneColor(zone);
        const width = zone.isNearest ? 2 : 1;

        // Horizontal band between zone.lower (base) and zone.upper (line).
        const zoneSeries = chart.addSeries(BaselineSeries, {
          baseValue: { type: "price", price: zone.lower },
          topLineColor: "transparent",
          topFillColor1: fill,
          topFillColor2: fill,
          bottomLineColor: "transparent",
          bottomFillColor1: "transparent",
          bottomFillColor2: "transparent",
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        });
        zoneSeries.setData([
          { time: firstTime, value: zone.upper },
          { time: lastTime, value: zone.upper },
        ] as BaselineData[]);
        zoneSeriesRef.current.push(zoneSeries);

        // Crisp center level.
        candleSeries.createPriceLine({
          price: zone.center,
          color: line,
          lineWidth: width,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: zone.isNearest
            ? zone.kind === "support"
              ? "دعم"
              : "مقاومة"
            : zone.kind === "support"
            ? "S"
            : "R",
        });
      }
    }

    // Current price dashed line.
    candleSeries.createPriceLine({
      price: analysis ? analysis.currentPrice : candles[candles.length - 1].close,
      color: COLOR.currentPrice,
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: "السعر",
    });
  }, [analysis, candles]);

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
      <div ref={containerRef} className="h-[400px] w-full" />
      {analysis && (
        <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-zinc-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500/40" />
            منطقة دعم
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-500/40" />
            منطقة مقاومة
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 border-t-2 border-dashed border-zinc-300" />
            السعر الحالي
          </span>
          <span className="text-zinc-600">
            {analysis.candleCount} شمعة 30m · تُحدَّث تلقائياً
          </span>
        </div>
      )}
    </div>
  );
}

/** Selects the zones to draw: nearest always + strongest, capped. */
function pickZones(analysis: SupportResistanceResult): Zone[] {
  const MAX = 16;
  const strong = analysis.zones
    .filter((z) => z.strength >= 30 || z.isNearest)
    .sort((a, b) => b.strength - a.strength);

  const selected: Zone[] = [];
  const ids = new Set<string>();
  for (const z of strong) {
    if (selected.length >= MAX) break;
    if (ids.has(z.id)) continue;
    ids.add(z.id);
    selected.push(z);
  }

  // Ensure nearest levels are always present even if low strength.
  for (const nz of [analysis.nearestSupport, analysis.nearestResistance]) {
    if (nz && !ids.has(nz.id)) {
      ids.add(nz.id);
      selected.push(nz);
    }
  }

  return selected;
}
