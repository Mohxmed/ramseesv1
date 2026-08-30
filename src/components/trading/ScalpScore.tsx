"use client";

import { Score, Badge, ScoreBar } from "../ui/primitives";
import type { ScalpScoreData } from "./types";

const dirTone = { LONG: "up", SHORT: "down", NEUTRAL: "neutral" } as const;

/** Reusable score headline with per-family directional decomposition. */
export function ScalpScore({ data }: { data: ScalpScoreData }) {
  return (
    <div className="rounded-card border border-line bg-surface-1/40 p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Score value={data.score} tone={data.direction === "LONG" ? "up" : data.direction === "SHORT" ? "down" : "neutral"} size="lg" />
        <Badge tone={dirTone[data.direction]}>{data.direction}</Badge>
      </div>

      {data.families.length > 0 ? (
        <div className="mt-5 space-y-3">
          {data.families.map((f) => (
            <div key={f.key}>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-2xs text-muted">{f.label}</span>
                <span
                  className={`${dirTone[f.vote === 0 ? "NEUTRAL" : f.vote > 0 ? "LONG" : "SHORT"] === "up" ? "text-up-fg" : dirTone[f.vote === 0 ? "NEUTRAL" : f.vote > 0 ? "LONG" : "SHORT"] === "down" ? "text-down-fg" : "text-muted"} font-mono text-2xs`}
                  dir="ltr"
                >
                  {f.vote.toFixed(2)}
                </span>
              </div>
              <ScoreBar value={f.vote} />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
