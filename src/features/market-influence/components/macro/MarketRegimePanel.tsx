"use client";

import type { CrossMarketState } from "@/features/market-influence/intelligence";
import { Badge } from "@/components/ui/index";
import { regimeChipsFor } from "../GlobalScoreHero";
import { REGIME_LEVELS, REGIME_META } from "./format";

/** Identify the active regime level from the global score (mirrors engine). */
function regFromScore(score: number): string {
  if (score >= 55) return "STRONG_RISK_ON";
  if (score >= 25) return "RISK_ON";
  if (score <= -55) return "STRONG_RISK_OFF";
  if (score <= -25) return "RISK_OFF";
  return "NEUTRAL";
}

/**
 * Spec #6 — 5-state macro market regime (STRONG_RISK_ON → STRONG_RISK_OFF)
 * with the per-dimension regime chips from the shared engine.
 */
export function MarketRegimePanel({ state }: { state: CrossMarketState }) {
  const chips = regimeChipsFor(state);
  const active = regFromScore(state.score);
  const activeMeta = REGIME_META[active as keyof typeof REGIME_META];
  const activeIdx = REGIME_LEVELS.indexOf(active as (typeof REGIME_LEVELS)[number]);

  return (
    <div className="rounded-card border border-line bg-surface-1/40 p-5">
      <div className="text-3xs font-semibold uppercase tracking-[0.18em] text-muted">
        النظام السوقي الكلي — Market Regime
      </div>

      <div className="mt-4 flex items-center gap-2">
        {REGIME_LEVELS.map((lvl, i) => {
          const meta = REGIME_META[lvl];
          const isActive = i === activeIdx;
          return (
            <div key={lvl} className="flex flex-1 items-center gap-1">
              <div
                className={`w-full rounded-full px-2 py-1.5 text-center text-2xs font-bold transition-colors ${
                  isActive
                    ? meta.tone === "up"
                      ? "bg-up/15 text-up-fg"
                      : meta.tone === "down"
                      ? "bg-down/15 text-down-fg"
                      : "bg-zinc-500/15 text-zinc-200"
                    : "bg-line/40 text-muted"
                }`}
              >
                {meta.short}
              </div>
              {i < REGIME_LEVELS.length - 1 ? (
                <div className="h-px w-2 shrink-0 bg-line" />
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Badge tone={activeMeta.tone as "up" | "down" | "neutral"}>
          الحالة الحالية: {activeMeta.label}
        </Badge>
        <span className="text-2xs text-muted">
          درجة النظام: <span className="font-mono tabular-nums" dir="ltr">{state.score}</span>
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {chips.map((c) => (
          <div
            key={c.dim}
            className="inline-flex items-center gap-2 rounded-panel border border-line/60 px-3 py-2"
          >
            <span className="text-2xs text-muted">{c.label}</span>
            <Badge tone={c.tone}>{c.value}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}