"use client";

import { useId } from "react";
import {
  ResponsiveContainer,
  LineChart as RC_Line,
  Line,
  AreaChart as RC_Area,
  Area,
  BarChart as RC_Bar,
  Bar,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
  ReferenceLine,
} from "recharts";
import {
  chartTheme,
  ChartTooltip,
  gridProps,
  cursorProps,
} from "./chart-theme";
import { colors } from "../ui/design-tokens";

export type ChartDatum = Record<string, number | string | null>;

export interface ChartSeries {
  key: string;
  name: string;
  color?: string;
  fillOpacity?: number;
  /** Per-datum colour (bar charts / heatmaps). */
  dataKeyForCellColor?: string;
}

export interface ChartReferenceLine {
  y: number;
  label?: string;
  color?: string;
  strokeDasharray?: string;
}

export type ChartKind = "line" | "area" | "bar";

export interface ChartContainerProps {
  data: ChartDatum[];
  xKey: string;
  series: ChartSeries[];
  kind: ChartKind;
  height?: number | string;
  yFormatter?: (v: number) => string;
  xFormatter?: (v: number | string) => string;
  valueFormatter?: (v: number | string | null, name: string) => React.ReactNode;
  /** Formats the tooltip's x label (defaults to the raw datum). */
  labelFormatter?: (label: number | string) => React.ReactNode;
  showLegend?: boolean;
  showGrid?: boolean;
  showXAxis?: boolean;
  showYAxis?: boolean;
  /** RTL-safe y-axis orientation (defaults to left side). */
  yAxisOrientation?: "left" | "right";
  /** Force the y-domain (e.g. ['dataMin', 'auto'] for a non-zero baseline). */
  yDomain?: [number | string, number | string];
  /** Soft vertical gradient fill under the curve (uses the first series colour). */
  fillGradient?: boolean;
  /** Horizontal dashed benchmarks (e.g. initial capital line). */
  referenceLines?: ChartReferenceLine[];
  /** Minimum pixel gap between x ticks (auto-thins crowded axes). */
  minTickGap?: number;
  className?: string;
}

const defaultColors = [
  colors.accent,
  colors.info,
  colors.warnFg,
  colors.downFg,
  colors.good,
  colors.muted,
];

/**
 * ChartContainer — one place that owns Recharts theming/responsiveness so
 * every chart is consistent and no chart re-implements axis/grid/tooltip.
 * All colours resolve from the design tokens; gradients/reference-lines are
 * optional so existing callers keep identical output unless they opt in.
 */
export function ChartContainer({
  data,
  xKey,
  series,
  kind,
  height = 240,
  yFormatter,
  xFormatter,
  valueFormatter,
  labelFormatter,
  showLegend = false,
  showGrid = true,
  showXAxis = true,
  showYAxis = true,
  yAxisOrientation = "left",
  yDomain,
  fillGradient = false,
  referenceLines,
  minTickGap = 14,
  className = "",
}: ChartContainerProps) {
  const gradId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const gradColor = fillGradient
    ? (series[0]?.color ?? defaultColors[0])
    : undefined;

  const chartProps = {
    data,
    margin: { top: 6, right: 4, left: 4, bottom: 0 },
  };

  const axes = (
    <>
      {showXAxis ? (
        <XAxis
          dataKey={xKey}
          tickFormatter={
            xFormatter ? (v) => xFormatter(v as number | string) : undefined
          }
          minTickGap={minTickGap}
          tick={{ ...tickStyle }}
        />
      ) : null}
      {showYAxis ? (
        <YAxis
          orientation={yAxisOrientation === "right" ? "right" : "left"}
          tickFormatter={yFormatter ? (v) => yFormatter(Number(v)) : undefined}
          domain={yDomain}
          width={46}
          tick={{ ...tickStyle }}
        />
      ) : null}
    </>
  );

  const tooltip = (
    <Tooltip
      cursor={cursorProps}
      content={<ChartTooltip formatter={valueFormatter} labelFormatter={labelFormatter} />}
    />
  );

  const legend = showLegend ? (
    <Legend
      wrapperStyle={{ fontSize: 11, fontFamily: chartTheme.fontFamily, color: colors.muted }}
    />
  ) : null;

  const gradientDefs = gradColor ? (
    <defs>
      <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={gradColor} stopOpacity={0.3} />
        <stop offset="60%" stopColor={gradColor} stopOpacity={0.08} />
        <stop offset="100%" stopColor={gradColor} stopOpacity={0.02} />
      </linearGradient>
    </defs>
  ) : null;

  const activeDot = { r: 4, strokeWidth: 2, stroke: colors.background };

  const body = (() => {
    switch (kind) {
      case "line":
        // recharts v3 renders <Area> only inside AreaChart/ComposedChart — it
        // silently returns null inside a LineChart, so gradient-filled curves
        // must be composed rather than passed to RC_Line.
        if (fillGradient) {
          return (
            <ComposedChart {...chartProps}>
              {gradientDefs}
              {showGrid ? <CartesianGrid {...gridProps} /> : null}
              {axes}
              {tooltip}
              {legend}
              {series.map((s, i) => (
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.name}
                  stroke={s.color ?? defaultColors[i % defaultColors.length]}
                  strokeWidth={2}
                  fill={`url(#${gradId})`}
                  fillOpacity={1}
                  dot={false}
                  activeDot={activeDot}
                />
              ))}
              {referenceLines?.map((rl, i) => (
                <ReferenceLine
                  key={i}
                  y={rl.y}
                  stroke={rl.color ?? colors.lineSoft}
                  strokeDasharray={rl.strokeDasharray ?? "5 5"}
                  label={
                    rl.label
                      ? {
                          value: rl.label,
                          position: "insideTopRight",
                          fill: rl.color ?? colors.muted,
                          fontSize: 10,
                          fontFamily: chartTheme.fontFamily,
                        }
                      : undefined
                  }
                />
              ))}
            </ComposedChart>
          );
        }
        return (
          <RC_Line {...chartProps}>
            {showGrid ? <CartesianGrid {...gridProps} /> : null}
            {axes}
            {tooltip}
            {legend}
            {series.map((s, i) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name}
                stroke={s.color ?? defaultColors[i % defaultColors.length]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3 }}
              />
            ))}
            {referenceLines?.map((rl, i) => (
              <ReferenceLine
                key={i}
                y={rl.y}
                stroke={rl.color ?? colors.lineSoft}
                strokeDasharray={rl.strokeDasharray ?? "5 5"}
                label={
                  rl.label
                    ? {
                        value: rl.label,
                        position: "insideTopRight",
                        fill: rl.color ?? colors.muted,
                        fontSize: 10,
                        fontFamily: chartTheme.fontFamily,
                      }
                    : undefined
                }
              />
            ))}
          </RC_Line>
        );
      case "area":
        return (
          <RC_Area {...chartProps}>
            {gradientDefs}
            {showGrid ? <CartesianGrid {...gridProps} /> : null}
            {axes}
            {tooltip}
            {legend}
            {series.map((s, i) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name}
                stroke={s.color ?? defaultColors[i % defaultColors.length]}
                fill={fillGradient ? `url(#${gradId})` : s.color ?? defaultColors[i % defaultColors.length]}
                fillOpacity={fillGradient ? 1 : s.fillOpacity ?? 0.18}
                strokeWidth={2}
                activeDot={activeDot}
              />
            ))}
            {referenceLines?.map((rl, i) => (
              <ReferenceLine
                key={i}
                y={rl.y}
                stroke={rl.color ?? colors.lineSoft}
                strokeDasharray={rl.strokeDasharray ?? "5 5"}
                label={
                  rl.label
                    ? {
                        value: rl.label,
                        position: "insideTopRight",
                        fill: rl.color ?? colors.muted,
                        fontSize: 10,
                        fontFamily: chartTheme.fontFamily,
                      }
                    : undefined
                }
              />
            ))}
          </RC_Area>
        );
      case "bar":
        return (
          <RC_Bar {...chartProps}>
            {showGrid ? <CartesianGrid {...gridProps} /> : null}
            {axes}
            {tooltip}
            {legend}
            {series.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.name}
                fill={s.color ?? defaultColors[i % defaultColors.length]}
                radius={[3, 3, 0, 0]}
                maxBarSize={48}
              >
                {s.dataKeyForCellColor
                  ? data.map((d, di) => (
                      <Cell key={di} fill={String(d[s.dataKeyForCellColor as string] ?? s.color ?? defaultColors[i % defaultColors.length])} />
                    ))
                  : null}
              </Bar>
            ))}
          </RC_Bar>
        );
    }
  })();

  return (
    <div dir="ltr" className={className} style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        {body}
      </ResponsiveContainer>
    </div>
  );
}

const tickStyle = {
  fill: chartTheme.axis,
  fontSize: chartTheme.fontSize,
  fontFamily: chartTheme.fontFamily,
};

/* Reusable presets — thin wrappers around ChartContainer. */

export function LineChart(props: Omit<ChartContainerProps, "kind">) {
  return <ChartContainer {...props} kind="line" />;
}
export function AreaChart(props: Omit<ChartContainerProps, "kind">) {
  return <ChartContainer {...props} kind="area" />;
}
export function BarChart(props: Omit<ChartContainerProps, "kind">) {
  return <ChartContainer {...props} kind="bar" />;
}

export type { ChartSeries as ChartSeriesType };