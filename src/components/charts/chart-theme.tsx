"use client";

import { colors, typography } from "../ui/design-tokens";

/**
 * Shared Recharts theming + tooltip. Every chart wrapper imports from here so
 * axis/grid/tooltip styling is defined ONCE instead of per chart.
 */

export const chartTheme = {
  grid: colors.lineSoft,
  axis: colors.muted,
  fontFamily: typography.fontFamily,
  fontSize: 11,
  cursor: { fill: colors.lineSoft },
  tooltip: {
    background: colors.surface1,
    border: `1px solid ${colors.line}`,
    radius: 8,
    padding: "8px 10px",
  },
};

/** Dark theme tooltip renderer (shared by all cartesian charts). */
export function ChartTooltip({
  active,
  payload,
  label,
  formatter,
  labelFormatter,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{
    name?: string | number;
    value?: number | string | null;
    color?: string;
    dataKey?: string | number;
  }>;
  label?: string | number;
  formatter?: (value: number | string | null, name: string) => React.ReactNode;
  labelFormatter?: (label: string | number) => React.ReactNode;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div
      style={{
        background: chartTheme.tooltip.background,
        border: chartTheme.tooltip.border,
        borderRadius: chartTheme.tooltip.radius,
        padding: chartTheme.tooltip.padding,
        fontFamily: chartTheme.fontFamily,
        fontSize: 11,
        boxShadow: "0 8px 28px -6px rgb(0 0 0 / 0.6)",
        direction: "rtl",
      }}
    >
      <div style={{ color: colors.muted, marginBottom: 4 }}>
        {labelFormatter ? labelFormatter(label ?? "") : label}
      </div>
      {payload.map((p, i) => {
        const v = p.value ?? null;
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color, display: "inline-block" }} />
            <span style={{ color: colors.foreground }}>
              {formatter ? formatter(v, String(p.name ?? p.dataKey ?? "")) : String(v)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export const axisProps = {
  stroke: "transparent",
  tickLine: false as const,
  axisLine: false as const,
  tick: { fill: chartTheme.axis, fontSize: chartTheme.fontSize, fontFamily: chartTheme.fontFamily },
};

export const gridProps = {
  stroke: chartTheme.grid,
  vertical: false as const,
};

export const cursorProps = chartTheme.cursor;
