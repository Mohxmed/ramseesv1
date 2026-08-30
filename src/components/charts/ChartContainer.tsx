"use client";

import {
  ResponsiveContainer,
  LineChart as RC_Line,
  Line,
  AreaChart as RC_Area,
  Area,
  BarChart as RC_Bar,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
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

export type ChartKind = "line" | "area" | "bar";

export interface ChartContainerProps {
  data: ChartDatum[];
  xKey: string;
  series: ChartSeries[];
  kind: ChartKind;
  height?: number | string;
  yFormatter?: (v: number) => string;
  xFormatter?: (v: unknown) => React.ReactNode;
  valueFormatter?: (v: number | string | null, name: string) => React.ReactNode;
  showLegend?: boolean;
  showGrid?: boolean;
  showXAxis?: boolean;
  showYAxis?: boolean;
  /** RTL-safe y-axis orientation (defaults to right side). */
  yAxisOrientation?: "left" | "right";
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
  showLegend = false,
  showGrid = true,
  showXAxis = true,
  showYAxis = true,
  yAxisOrientation = "right",
  className = "",
}: ChartContainerProps) {
  const chartProps = {
    data,
    margin: { top: 6, right: 4, left: 4, bottom: 0 },
  };

  const axes = (
    <>
      {showXAxis ? (
        <XAxis
          dataKey={xKey}
          tickFormatter={xFormatter as undefined}
          tick={{ ...tickStyle }}
        />
      ) : null}
      {showYAxis ? (
        <YAxis
          orientation={yAxisOrientation === "right" ? "right" : "left"}
          tickFormatter={yFormatter ? (v) => yFormatter(Number(v)) : undefined}
          width={46}
          tick={{ ...tickStyle }}
        />
      ) : null}
    </>
  );

  const tooltip = (
    <Tooltip
      cursor={cursorProps}
      content={<ChartTooltip formatter={valueFormatter} />}
    />
  );

  const legend = showLegend ? (
    <Legend
      wrapperStyle={{ fontSize: 11, fontFamily: chartTheme.fontFamily, color: colors.muted }}
    />
  ) : null;

  const body = (() => {
    switch (kind) {
      case "line":
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
          </RC_Line>
        );
      case "area":
        return (
          <RC_Area {...chartProps}>
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
                fill={s.color ?? defaultColors[i % defaultColors.length]}
                fillOpacity={s.fillOpacity ?? 0.18}
                strokeWidth={2}
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
    <div className={className} style={{ width: "100%", height }}>
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
