"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createChart,
  ColorType,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  BaselineSeries,
  LineStyle,
  CrosshairMode,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type BaselineData,
  type UTCTimestamp,
  type MouseEventParams,
  type Time,
  type LineData,
  type SeriesMarker,
  type WhitespaceData,
} from "lightweight-charts";
import type { BtcCandle, BtcTimeframe } from "../types";
import type {
  SupportResistanceResult,
  Zone,
  LiquidityAnalysis,
  MarketStructureAnalysis,
  Wave,
} from "../analysis";
import { TIMEFRAMES, TIMEFRAME_MINUTES } from "../constants";
import { formatPrice } from "../utils";

export type DecisionOverlay = {
  entry?: number;
  stopLoss?: number;
  takeProfit?: number;
  title?: string;
};

type Props = {
  candles: BtcCandle[];
  timeframe: BtcTimeframe;
  onTimeframeChange: (tf: BtcTimeframe) => void;
  analysis?: SupportResistanceResult | null;
  liquidity?: LiquidityAnalysis | null;
  structure?: MarketStructureAnalysis | null;
  waves?: Wave[];
  /** Additive decision price-line overlay (entry / SL / TP) from Decision Center. */
  decision?: DecisionOverlay | null;
};

const COLOR = {
  supportLine: "#10b981",
  supportFill: "rgba(16,185,129,0.12)",
  resistanceLine: "#ef4444",
  resistanceFill: "rgba(239,68,68,0.12)",
  nearestSupportLine: "#34d399",
  nearestSupportFill: "rgba(52,211,153,0.25)",
  nearestResistanceLine: "#f87171",
  nearestResistanceFill: "rgba(248,113,113,0.25)",
  currentPrice: "#e4e4e7",
  up: "#10b981",
  down: "#ef4444",
  ema9: "#38bdf8",
  ema21: "#fbbf24",
  ema50: "#a78bfa",
  vwap: "#22d3ee",
  decisionEntry: "#0ea5e9",
  decisionStop: "#fb923c",
  decisionTarget: "#34d399",
};

type OverlayKey = "ema9" | "ema21" | "ema50" | "vwap";

/** Number of real future timestamps (whitespace) reserved on the time scale
 *  to the right of the last candle, like TradingView's future zone. These are
 *  actual positions the user can pan into and later draw forecasts /
 *  projected paths / targets on. */
const FUTURE_BARS = 18;
/** Small visual cushion (bars) shown beyond the future whitespace zone. */
const RIGHT_PADDING = 4;

type Snapshot = {
  time: Time | undefined;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
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

function formatCountdown(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function BtcChart({ candles, timeframe, onTimeframeChange, analysis, liquidity, structure, waves, decision }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const overlayRef = useRef<Map<OverlayKey, ISeriesApi<"Line">>>(new Map());
  const zoneSeriesRef = useRef<ISeriesApi<"Baseline">[]>([]);
  const waveSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const futureSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const lastFittedTfRef = useRef<BtcTimeframe | null>(null);
  const [overlays, setOverlays] = useState<OverlayKey[]>([]);
  const [crosshair, setCrosshair] = useState<Snapshot | null>(null);
  const [closeCountdown, setCloseCountdown] = useState<number | null>(null);

  // ------------------------------------------------------------------ init
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#a1a1aa",
        fontFamily: "'Cairo', sans-serif",
        fontSize: 12,
      },
      grid: {
        vertLines: { color: "rgba(39,39,42,0.4)" },
        horzLines: { color: "rgba(39,39,42,0.4)" },
      },
      rightPriceScale: {
        borderColor: "rgba(63,63,70,0.6)",
        minimumWidth: 72,
        scaleMargins: { top: 0.08, bottom: 0.28 },
        ensureEdgeTickMarksVisible: true,
      },
      timeScale: {
        borderColor: "rgba(63,63,70,0.6)",
        rightOffset: RIGHT_PADDING,
        barSpacing: 7,
        minBarSpacing: 0.5,
        fixRightEdge: false,
        lockVisibleTimeRangeOnResize: true,
        shiftVisibleRangeOnNewBar: true,
        ignoreWhitespaceIndices: true,
      },
      crosshair: {
        mode: CrosshairMode.Magnet,
        vertLine: { color: "#52525b", width: 1, labelBackgroundColor: "#27272a" },
        horzLine: { color: "#52525b", width: 1, labelBackgroundColor: "#27272a" },
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: { time: true, price: true },
        axisDoubleClickReset: { time: true, price: true },
      },
      localization: {
        locale: "ar",
        timeFormatter: (t: number) => new Date(t * 1000).toLocaleString("ar"),
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: COLOR.up,
      downColor: COLOR.down,
      borderUpColor: COLOR.up,
      borderDownColor: COLOR.down,
      wickUpColor: COLOR.up,
      wickDownColor: COLOR.down,
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
      lastValueVisible: false,
      priceLineVisible: false,
    });
    chart.priceScale("vol").applyOptions({
      scaleMargins: { top: 0.82, bottom: 0.02 },
    });

    const waveSeries = chart.addSeries(LineSeries, {
      color: "#f0abfc",
      lineWidth: 2,
      lastValueVisible: false,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
    });

    // Series that only carries *future* whitespace points (time, no value).
    // It gives the time scale real future timestamps so the user can pan to
    // the right and later draw forecasts / projected paths / targets there.
    // Whitespace is invisible and (with ignoreWhitespaceIndices) ignored by
    // the crosshair & grid, so it never disturbs the existing chart.
    const futureSeries = chart.addSeries(LineSeries, {
      color: "transparent",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });

    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    waveSeriesRef.current = waveSeries;
    futureSeriesRef.current = futureSeries;
    markersRef.current = createSeriesMarkers(candleSeries);
    chartRef.current = chart;

    // Crosshair legend (OHLC + time + volume).
    chart.subscribeCrosshairMove((param: MouseEventParams<Time>) => {
      const candle = param.seriesData.get(candleSeries) as
        | { open: number; high: number; low: number; close: number }
        | undefined;
      const volume = param.seriesData.get(volumeSeries) as { value: number } | undefined;
      setCrosshair({
        time: param.time,
        open: candle?.open ?? 0,
        high: candle?.high ?? 0,
        low: candle?.low ?? 0,
        close: candle?.close ?? 0,
        volume: volume?.value ?? 0,
      });
    });

    // Ctrl + Wheel => vertical price zoom (uses the price scale API, not canvas).
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      e.stopPropagation();
      const ps = chart.priceScale("right");
      const r = ps.getVisibleRange();
      if (!r) return;
      const factor = e.deltaY > 0 ? 1.12 : 0.89;
      const mid = (r.from + r.to) / 2;
      const half = ((r.to - r.from) / 2) * factor;
      ps.applyOptions({ autoScale: false });
      ps.setVisibleRange({ from: Math.max(0, mid - half), to: mid + half });
    };
    el.addEventListener("wheel", onWheel, { passive: false, capture: true });

    // Double-click anywhere on the chart resets time + price to fit all data.
    const onDoubleClick = (e: MouseEvent) => {
      if (e.defaultPrevented) return;
      e.preventDefault();
      chart.priceScale("right").applyOptions({ autoScale: true });
      chart.timeScale().fitContent();
    };
    el.addEventListener("dblclick", onDoubleClick);

    return () => {
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      waveSeriesRef.current = null;
      futureSeriesRef.current = null;
      markersRef.current = null;
      overlayRef.current.clear();
      zoneSeriesRef.current = [];
      lastFittedTfRef.current = null;
      el.removeEventListener("wheel", onWheel, { capture: true } as EventListenerOptions);
      el.removeEventListener("dblclick", onDoubleClick);
    };
  }, []);

  // ------------------------------------------------------- candle + volume
  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    const chart = chartRef.current;
    if (!candleSeries || !volumeSeries || !chart) return;
    if (candles.length === 0) return;

    candleSeries.setData(
      candles.map((c) => ({
        time: c.time as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
    );

    candleSeries.update({
      time: candles[candles.length - 1].time as UTCTimestamp,
      open: candles[candles.length - 1].open,
      high: candles[candles.length - 1].high,
      low: candles[candles.length - 1].low,
      close: candles[candles.length - 1].close,
    });

    volumeSeries.setData(
      candles.map((c) => ({
        time: c.time as UTCTimestamp,
        value: c.volume,
        color: c.close >= c.open ? "rgba(16,185,129,0.35)" : "rgba(239,68,68,0.35)",
      }))
    );

    // Update the future whitespace anchor series so the time scale always has
    // real future timestamps the user can pan right into (and later draw
    // forecasts / projected paths on) — even as live candles arrive. Whitespace
    // is invisible and ignored by the crosshair & grid (ignoreWhitespaceIndices).
    const futureSeries = futureSeriesRef.current;
    if (futureSeries) {
      const intervalS = TIMEFRAME_MINUTES[timeframe] * 60;
      const lastTimeS = candles[candles.length - 1].time;
      const whitespace: WhitespaceData<Time>[] = [];
      for (let k = 1; k <= FUTURE_BARS; k++) {
        whitespace.push({ time: (lastTimeS + k * intervalS) as UTCTimestamp });
      }
      futureSeries.setData(whitespace);
    }

    // Fit only on the very first load or when the timeframe actually changed,
    // so the user's zoom is preserved across live data updates. The future
    // zone (rightOffset) is re-applied so it stays a stable part of the scale.
    if (lastFittedTfRef.current !== timeframe) {
      lastFittedTfRef.current = timeframe;
      chart.timeScale().applyOptions({ rightOffset: RIGHT_PADDING, shiftVisibleRangeOnNewBar: true });
      chart.timeScale().fitContent();
      chart.priceScale("right").applyOptions({ autoScale: true });
    }
  }, [candles, timeframe]);

  // ----------------------------------------------------- candle-close timer
  // Counts down to the close of the latest (still-forming) candle.
  useEffect(() => {
    if (!candles.length) return;
    const intervalMs = TIMEFRAME_MINUTES[timeframe] * 60 * 1000;
    const lastTime = candles[candles.length - 1].time;
    const closeAt = lastTime * 1000 + intervalMs;
    const tick = () => {
      setCloseCountdown(Math.max(0, closeAt - Date.now()));
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [candles, timeframe]);

  // ------------------------------------------------------- overlays (EMA/VWAP)
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || candles.length === 0) return;

    // Remove overlay series no longer active.
    for (const key of Array.from(overlayRef.current.keys())) {
      if (!overlays.includes(key)) {
        chart.removeSeries(overlayRef.current.get(key)!);
        overlayRef.current.delete(key);
      }
    }
    if (overlays.length === 0) return;

    const closes = candles.map((c) => c.close);
    const times = candles.map((c) => c.time as UTCTimestamp);

    const ema = (period: number) => {
      const out: number[] = [];
      let prev = closes[0];
      const k = 2 / (period + 1);
      for (let i = 0; i < closes.length; i++) {
        prev = i === 0 ? closes[0] : closes[i] * k + prev * (1 - k);
        out.push(prev);
      }
      return out;
    };

    const vwap: number[] = [];
    {
      let cumPV = 0;
      let cumVol = 0;
      for (const c of candles) {
        const typ = (c.high + c.low + c.close) / 3;
        cumPV += typ * c.volume;
        cumVol += c.volume;
        vwap.push(cumVol > 0 ? cumPV / cumVol : typ);
      }
    }

    const color: Record<OverlayKey, string> = {
      ema9: COLOR.ema9,
      ema21: COLOR.ema21,
      ema50: COLOR.ema50,
      vwap: COLOR.vwap,
    };
    const build: Record<OverlayKey, () => number[]> = {
      ema9: () => ema(9),
      ema21: () => ema(21),
      ema50: () => ema(50),
      vwap: () => vwap,
    };

    for (const key of overlays) {
      let series = overlayRef.current.get(key);
      if (!series) {
        series = chart.addSeries(LineSeries, {
          color: color[key],
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        });
        overlayRef.current.set(key, series);
      }
      const values = build[key]();
      series.setData(times.map((t, i) => ({ time: t, value: values[i] })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles, overlays]);

  // -------------------------------------------------------------------- S/R
  useEffect(() => {
    const chart = chartRef.current;
    const candleSeries = candleSeriesRef.current;
    if (!chart || !candleSeries) return;
    if (candles.length === 0) return;

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

    candleSeries.createPriceLine({
      price: analysis ? analysis.currentPrice : candles[candles.length - 1].close,
      color: COLOR.currentPrice,
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: "السعر",
    });

    // Liquidity zones (distinct purple styling)
    if (liquidity && liquidity.zones.length > 0) {
      const targetZones = liquidity.zones
        .slice()
        .sort((a, b) => b.strength - a.strength)
        .slice(0, 6);
      for (const zone of targetZones) {
        const fill = zone.kind === "support" ? "rgba(168,85,247,0.10)" : "rgba(168,85,247,0.10)";
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

        candleSeries.createPriceLine({
          price: zone.center,
          color: "#a855f7",
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: "سيولة",
        });
      }
    }

    // Current waves as a connecting polyline (30m-domain)
    if (waves && waves.length > 1 && waveSeriesRef.current) {
      const pts = waves
        .filter((w) => !!w.startTime && !!w.endTime)
        .map((w) => ({
          time: Math.floor(w.startTime / 1000) as UTCTimestamp,
          value: w.startPrice,
        }));
      const last = waves[waves.length - 1];
      if (last && last.endTime) {
        pts.push({
          time: Math.floor(last.endTime / 1000) as UTCTimestamp,
          value: last.endPrice,
        });
      }
      waveSeriesRef.current.setData(pts as LineData[]);
    }

    // Market structure markers (HH/HL/LH/LL) on the candle series
    if (structure && structure.points.length > 0) {
      const markers: SeriesMarker<Time>[] = structure.points
        .slice(-12)
        .map((p) => {
          const bull = p.type === "HH" || p.type === "HL";
          return {
            time: Math.floor(p.time / 1000) as UTCTimestamp,
            position: bull ? ("belowBar" as const) : ("aboveBar" as const),
            color: bull ? "#34d399" : "#f87171",
            shape: ("arrowUp" as const),
            text: p.type,
          };
        });
      markersRef.current?.setMarkers(markers);
    }
  }, [analysis, candles, liquidity, structure, waves]);

  // --------------------------------------------------- decision overlay
  // Additive, non-breaking: when the Decision Center supplies an entry / SL / TP
  // decision, render them as labelled price lines. Runs after the S/R effect so
  // it re-applies its lines whenever the chart rebuilds, without touching any
  // existing S/R / liquidity / price overlays.
  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    if (!candleSeries || candles.length === 0) return;

    // Remove only our own previous decision lines (keyed by a unique prefix).
    const DEC_TITLES = new Set(["DEC:ENTRY", "DEC:SL", "DEC:TP"]);
    for (const line of candleSeries.priceLines()) {
      if (line.options().title && DEC_TITLES.has(line.options().title)) {
        candleSeries.removePriceLine(line);
      }
    }

    if (!decision) return;

    const addLine = (price: number | undefined, color: string, title: string, style: LineStyle) => {
      if (price == null || Number.isNaN(price)) return;
      candleSeries.createPriceLine({
        price,
        color,
        lineWidth: 1,
        lineStyle: style,
        axisLabelVisible: true,
        title,
      });
    };

    addLine(decision.entry, COLOR.decisionEntry, "DEC:ENTRY", LineStyle.Dashed);
    addLine(decision.stopLoss, COLOR.decisionStop, "DEC:SL", LineStyle.Dotted);
    addLine(decision.takeProfit, COLOR.decisionTarget, "DEC:TP", LineStyle.Solid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysis, candles, liquidity, structure, waves, decision]);

  // ------------------------------------------------------------ navigation
  const autoScale = useCallback(() => {
    chartRef.current?.priceScale("right").applyOptions({ autoScale: true });
  }, []);

  const fit = useCallback(() => {
    chartRef.current?.timeScale().fitContent();
  }, []);

  const reset = useCallback(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.timeScale().fitContent();
    chart.priceScale("right").applyOptions({ autoScale: true });
  }, []);

  const lastCandle = candles[candles.length - 1];
  const displaySnapshot = crosshair && crosshair.close > 0 ? crosshair : null;
  const quote =
    displaySnapshot ?? {
      time: lastCandle ? (lastCandle.time as Time) : undefined,
      open: lastCandle?.open ?? 0,
      high: lastCandle?.high ?? 0,
      low: lastCandle?.low ?? 0,
      close: lastCandle?.close ?? 0,
      volume: lastCandle?.volume ?? 0,
    };

  const toggleOverlay = useCallback(
    (key: OverlayKey) => {
      setOverlays((prev) => {
        if (prev.includes(key)) return prev.filter((k) => k !== key);
        return [...prev, key];
      });
    },
    []
  );

  const overlayButtons: { key: OverlayKey; label: string }[] = [
    { key: "ema9", label: "EMA 9" },
    { key: "ema21", label: "EMA 21" },
    { key: "ema50", label: "EMA 50" },
    { key: "vwap", label: "VWAP" },
  ];

  return (
    <div className="min-w-0 rounded-2xl border border-zinc-800 bg-zinc-900/40">
      {/* Chart header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-zinc-400" />
          <h2 className="text-sm font-semibold text-zinc-100">BTC/USDT</h2>
          {analysis && (
            <span className="hidden text-[11px] text-zinc-500 sm:inline">
              {analysis.candleCount} شمعة 30m
            </span>
          )}
        </div>
        <div className="text-left">
          <div className="text-lg font-bold leading-tight text-zinc-50">
            {quote.close > 0 ? formatPrice(quote.close) : "—"}
          </div>
          {quote.close > 0 && quote.open > 0 && (
            <div
              className={`text-[11px] font-medium ${
                quote.close >= quote.open ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {((quote.close - quote.open) / quote.open) * 100 >= 0 ? "+" : ""}
              {(((quote.close - quote.open) / quote.open) * 100).toFixed(2)}%
            </div>
          )}
        </div>
      </div>

      {/* Timeframe selector */}
      <div className="flex flex-nowrap items-center gap-1 overflow-x-auto border-b border-zinc-800 px-4 py-2 [scrollbar-width:thin]">
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf}
            type="button"
            onClick={() => onTimeframeChange(tf)}
            className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              tf === timeframe
                ? "bg-zinc-700 text-zinc-50"
                : "bg-transparent text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
            }`}
          >
            {tf.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 px-4 py-2">
        <div className="flex flex-wrap items-center gap-1">
          {overlayButtons.map((b) => {
            const active = overlays.includes(b.key);
            return (
              <button
                key={b.key}
                type="button"
                onClick={() => toggleOverlay(b.key)}
                title={b.label}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  active
                    ? "bg-zinc-700 text-zinc-50"
                    : "bg-transparent text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
                }`}
              >
                {b.label}
              </button>
            );
          })}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={autoScale}
            title="مقياس تلقائي"
            className="rounded-md bg-transparent px-2.5 py-1 text-[11px] font-medium text-zinc-300 transition-colors hover:bg-zinc-800/60 hover:text-zinc-100"
          >
            Auto Scale
          </button>
          <button
            type="button"
            onClick={fit}
            title="ملاءمة المحتوى"
            className="rounded-md bg-transparent px-2.5 py-1 text-[11px] font-medium text-zinc-300 transition-colors hover:bg-zinc-800/60 hover:text-zinc-100"
          >
            Fit
          </button>
          <button
            type="button"
            onClick={reset}
            title="إعادة الضبط"
            className="rounded-md bg-transparent px-2.5 py-1 text-[11px] font-medium text-zinc-300 transition-colors hover:bg-zinc-800/60 hover:text-zinc-100"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Crosshair / OHLC readout */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-zinc-800 px-4 py-1.5 text-[11px] text-zinc-400">
        <span className="text-zinc-200">
          {quote.time
            ? new Date(Number(quote.time) * 1000).toLocaleString("ar")
            : "—"}
        </span>
        <span>
          ف: <span className="text-zinc-200">{formatPrice(quote.open)}</span>
        </span>
        <span>
          ع: <span className="text-emerald-400">{formatPrice(quote.high)}</span>
        </span>
        <span>
          د: <span className="text-red-400">{formatPrice(quote.low)}</span>
        </span>
        <span>
          إ: <span className="text-zinc-200">{formatPrice(quote.close)}</span>
        </span>
        <span className="hidden sm:inline">
          حجم:{" "}
          <span className="text-zinc-200">
            {quote.volume >= 1e6
              ? (quote.volume / 1e6).toFixed(2) + "M"
              : quote.volume >= 1e3
              ? (quote.volume / 1e3).toFixed(1) + "K"
              : quote.volume.toFixed(0)}
          </span>
        </span>
      </div>

      {/* Chart */}
      <div className="relative px-2 pt-2">
        {closeCountdown != null && (
          <div className="pointer-events-none absolute right-4 top-3 z-10 flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-950/85 px-3 py-1.5 text-xs backdrop-blur">
            <span className="text-zinc-400">إغلاق شمعة {timeframe.toUpperCase()}</span>
            <span className="font-mono font-bold tabular-nums text-zinc-50" dir="ltr">
              {formatCountdown(closeCountdown)}
            </span>
          </div>
        )}
        <div
          ref={containerRef}
          className="h-[420px] w-full sm:h-[540px] lg:h-[640px]"
        />
      </div>

      {/* Nearest S/R + legend footer */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-t border-zinc-800 px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-zinc-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500/40" />
            دعم
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-500/40" />
            مقاومة
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 border-t-2 border-dashed border-zinc-300" />
            السعر
          </span>
          {overlays.includes("ema9") && (
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4 bg-[#38bdf8]" /> EMA9
            </span>
          )}
          {overlays.includes("ema21") && (
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4 bg-[#fbbf24]" /> EMA21
            </span>
          )}
          {overlays.includes("ema50") && (
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4 bg-[#a78bfa]" /> EMA50
            </span>
          )}
          {overlays.includes("vwap") && (
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4 bg-[#22d3ee]" /> VWAP
            </span>
          )}
          {decision && (
            <span className="inline-flex items-center gap-1.5 text-[10px] text-sky-300">
              <span className="inline-block h-0.5 w-4 border-t-2 border-dashed border-[#0ea5e9]" />
              {decision.title ?? "Decision"}
            </span>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 text-[11px]">
          {analysis?.nearestResistance && (
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-500">أقرب مقاومة</span>
              <span className="font-semibold text-red-300">
                {formatPrice(analysis.nearestResistance.center)}
              </span>
            </div>
          )}
          {analysis?.nearestSupport && (
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-500">أقرب دعم</span>
              <span className="font-semibold text-emerald-300">
                {formatPrice(analysis.nearestSupport.center)}
              </span>
            </div>
          )}
        </div>
      </div>
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

  for (const nz of [analysis.nearestSupport, analysis.nearestResistance]) {
    if (nz && !ids.has(nz.id)) {
      ids.add(nz.id);
      selected.push(nz);
    }
  }

  return selected;
}
