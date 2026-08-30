"use client";

import { Badge, Progress, DataRow } from "../ui/primitives";
import { num } from "../ui/design-tokens";
import type { DecisionData, Direction, SignalData, SignalFactor } from "./types";

const dirTone = { LONG: "up", SHORT: "down", NEUTRAL: "neutral" } as const;
const dirText = { LONG: "شراء", SHORT: "بيع", NEUTRAL: "حياد" } as const;
const strengthTone = { strong: "up", moderate: "warn", weak: "neutral", none: "quiet" } as const;

function Factors({ factors }: { factors?: SignalFactor[] }) {
  if (!factors || factors.length === 0) return null;
  return (
    <ul className="mt-3 space-y-1.5">
      {factors.map((f, i) => (
        <li key={i} className="flex items-start gap-2 text-xs text-zinc-300">
          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-zinc-500" />
          <span>{f.label}</span>
          {f.note ? <span className="text-muted">— {f.note}</span> : null}
        </li>
      ))}
    </ul>
  );
}

/** SignalPanel — the raw signal state (direction + strength + reasons). */
export function SignalPanel({ data }: { data: SignalData }) {
  return (
    <div className="rounded-card border border-line bg-surface-1/40 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-2xs font-semibold uppercase tracking-[0.18em] text-muted">الإشارة</span>
        {data.strength ? <Badge tone={strengthTone[data.strength]}>{data.strength}</Badge> : null}
      </div>

      <div className="mt-3 flex items-center gap-3">
        <Badge tone={dirTone[data.direction]}>{dirText[data.direction]}</Badge>
        {data.confidence != null ? (
          <span className={`${num} text-sm font-bold text-zinc-200`} dir="ltr">
            {data.confidence.toFixed(0)}%
          </span>
        ) : null}
      </div>

      {data.confidence != null ? (
        <div className="mt-3">
          <Progress
            pct={data.confidence}
            tone={data.direction === "LONG" ? "up" : data.direction === "SHORT" ? "down" : "neutral"}
            showLabel
          />
        </div>
      ) : null}

      {data.reason ? <p className="mt-3 text-xs text-zinc-400">{data.reason}</p> : null}
      <Factors factors={data.factors} />
    </div>
  );
}

/** DecisionCard — the actionable decision in a tinted call box. */
export function DecisionCard({ data }: { data: DecisionData }) {
  const tone = data.direction === "LONG" ? "up" : data.direction === "SHORT" ? "down" : "neutral";
  const boxTone =
    tone === "up"
      ? "border-up/40 bg-up/10"
      : tone === "down"
      ? "border-down/40 bg-down/10"
      : "border-zinc-700 bg-zinc-800/40";
  const textTone = data.direction === "LONG" ? "text-up-fg" : data.direction === "SHORT" ? "text-down-fg" : "text-zinc-300";

  return (
    <div className="rounded-card border border-line bg-surface-1/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-2xs font-semibold uppercase tracking-[0.18em] text-muted">القرار</span>
        {data.blocked ? (
          <Badge tone="down">مُعطَّل</Badge>
        ) : (
          <Badge tone={data.direction === "NEUTRAL" ? "neutral" : dirTone[data.direction]}>
            {data.direction === "NEUTRAL" ? "انتظار" : dirText[data.direction]}
          </Badge>
        )}
      </div>

      <div className={`rounded-panel border p-4 ${boxTone}`}>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <span className={`${num} text-2xl font-extrabold ${textTone}`} dir="ltr">
            {dirText[data.direction]}
          </span>
          {data.probability != null ? (
            <span className={`${num} text-lg font-bold ${textTone}`} dir="ltr">
              {data.probability.toFixed(0)}%
            </span>
          ) : null}
        </div>
        {data.reason ? <p className="mt-2 text-xs text-zinc-300">{data.reason}</p> : null}
        <Factors factors={data.factors} />
      </div>

      <div className="mt-3 space-y-0.5">
        <DataRow label="الاحتمال" value={`${data.probability != null ? data.probability.toFixed(1) : "—"}%`} ltr />
        <DataRow label="الثقة" value={`${data.confidence != null ? data.confidence.toFixed(0) : "—"}%`} ltr />
        <DataRow
          label="الحركة المتوقعة"
          value={`${data.expectedMovePct != null ? data.expectedMovePct.toFixed(2) : "—"}%`}
          ltr
        />
        {data.gate ? <DataRow label="البوابة" value={data.gate} /> : null}
      </div>
    </div>
  );
}

export type { Direction };
