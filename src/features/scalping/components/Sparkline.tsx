"use client";

/** Minimal pure-SVG sparkline. Presentation only; renders a static series. */
export function Sparkline({
  points,
  width = 120,
  height = 28,
  stroke = "#34d399",
  fill = "rgba(52,211,153,0.12)",
}: {
  points: number[];
  width?: number;
  height?: number;
  stroke?: string;
  fill?: string;
}) {
  if (!points.length) {
    return (
      <svg width={width} height={height} className="block" aria-hidden>
        <line x1={0} y1={height / 2} x2={width} y2={height / 2} stroke="#3f3f46" strokeDasharray="3 2" />
      </svg>
    );
  }
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const n = points.length;
  const step = width / (n - 1 || 1);
  const coords = points.map((p, i) => {
    const x = i * step;
    const y = height - ((p - min) / range) * (height - 4) - 2;
    return [x, y] as const;
  });
  const line = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;

  return (
    <svg width={width} height={height} className="block" aria-hidden>
      <path d={area} fill={fill} stroke="none" />
      <path d={line} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
