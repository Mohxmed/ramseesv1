"use client";

import { useMemo } from "react";
import type { SeriesPoint } from "@/features/market-influence/intelligence";

/**
 * Minimal dependency-free sparkline: downsampled polyline from a price series
 * inside a tiny inline SVG. RTL-safe (drawn in data space, not script space).
 */
export function Sparkline({
  points,
  width = 96,
  height = 28,
  tone = "neutral",
}: {
  points: SeriesPoint[];
  width?: number;
  height?: number;
  tone?: "up" | "down" | "neutral";
}) {
  const path = useMemo(() => {
    if (!points || points.length < 2) return null;
    const max = Math.min(points.length, width);
    const step = (points.length - 1) / (max - 1);
    const sample: number[] = [];
    for (let i = 0; i < max; i++) {
      const idx = Math.round(i * step);
      sample.push(points[Math.min(points.length - 1, idx)].v);
    }
    const vs = sample.slice();
    const min = Math.min(...vs);
    const maxV = Math.max(...vs);
    const span = maxV - min || 1;
    const pts = sample.map((v, i) => {
      const x = (i / (max - 1)) * (width - 2) + 1;
      const y = height - 2 - ((v - min) / span) * (height - 4);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return pts.join(" ");
  }, [points, width, height]);

  if (!path) return <div className="h-6" />;

  const stroke =
    tone === "up"
      ? "var(--color-up)"
      : tone === "down"
      ? "var(--color-down)"
      : "var(--color-good)";

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="shrink-0"
      aria-hidden="true"
    >
      <polyline
        points={path}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.85}
      />
    </svg>
  );
}