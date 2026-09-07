"use client";

import type { DecouplingStatus } from "@/features/market-influence/intelligence";
import { Badge, Progress } from "@/components/ui/index";
import { AlertIcon } from "@/components/icons/icons";

function corrView(v: number | null): { label: string; tone: "up" | "down" | "warn" | "neutral" } {
  if (v == null) return { label: "غير متاح", tone: "neutral" };
  const a = Math.abs(v);
  if (a >= 0.6) return { label: v > 0 ? "مرتبط بقوة" : "معكوس بقوة", tone: v > 0 ? "up" : "down" };
  if (a >= 0.35) return { label: v > 0 ? "مرتبط" : "عكسي", tone: v > 0 ? "up" : "warn" };
  if (a >= 0.15) return { label: "ضعيف", tone: "warn" };
  return { label: "مستقل", tone: "neutral" };
}

/**
 * Spec #7 — BTC decoupling detection vs. equities: short-window (1D) vs
 * medium-window (30D) BTC↔NDX correlation. When the short read collapses,
 * flips sign or sits near zero while the medium read stays high, BTC stops
 * behaving as a high-beta equity proxy and trades on its own drivers.
 */
export function DecouplingPanel({ status }: { status: DecouplingStatus }) {
  const short = corrView(status.shortCorr);
  const long = corrView(status.longCorr);
  const strengthPct = Math.round(status.strength * 100);

  return (
    <div className="rounded-card border border-line bg-surface-1/40 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-3xs font-semibold uppercase tracking-[0.18em] text-muted">
          رصد فك الارتباط عن الأسهم
        </div>
        {status.decoupled ? (
          <Badge tone="warn">
            <AlertIcon className="h-3 w-3" /> BTC منفصل عن الأسهم
          </Badge>
        ) : (
          <Badge tone="good">مرتبط بالأسهم</Badge>
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-panel border border-line/60 px-3 py-2.5">
          <div className="text-2xs text-muted">ارتباط 1D (أقصر نافذة)</div>
          <div className={`mt-1 font-mono text-lg font-black tabular-nums ${short.tone === "up" ? "text-good" : short.tone === "down" ? "text-down-fg" : "text-zinc-300"}`} dir="ltr">
            {status.shortCorr != null ? status.shortCorr.toFixed(2) : "—"}
          </div>
          <div className="text-2xs text-muted">{short.label}</div>
        </div>
        <div className="rounded-panel border border-line/60 px-3 py-2.5">
          <div className="text-2xs text-muted">ارتباط 30D (النافذة الهيكلية)</div>
          <div className={`mt-1 font-mono text-lg font-black tabular-nums ${long.tone === "up" ? "text-good" : long.tone === "down" ? "text-down-fg" : "text-zinc-300"}`} dir="ltr">
            {status.longCorr != null ? status.longCorr.toFixed(2) : "—"}
          </div>
          <div className="text-2xs text-muted">{long.label}</div>
        </div>
        <div className="rounded-panel border border-line/60 px-3 py-2.5">
          <div className="text-2xs text-muted">درجة الفك</div>
          <div className="mt-1 font-mono text-lg font-black tabular-nums text-zinc-200" dir="ltr">
            {strengthPct}%
          </div>
          <Progress pct={strengthPct} tone={status.decoupled ? "warn" : "good"} />
        </div>
      </div>

      <p className="mt-3 text-2xs leading-relaxed text-muted">
        {status.direction === "inverse"
          ? "BTC أصبح يسير عكسياً مع ناسداك — تحوّل من أصل بيتا إلى استثناء متفرّد."
          : status.direction === "uncorrelated"
          ? "BTC تحرّك مستقل تقريباً عن الأسهم في النافذة القصيرة — محركه الأساسي الآن غير الأسهم."
          : status.direction === "coupled"
          ? "BTC لا يزال يرتبط بإيجابية واضحة مع الأسهم — يبقى تحليله ضمن إطار شهية المخاطرة."
          : "بيانات النوافذ غير كافية لتحديد حالة الفك بشكل قاطع."}
      </p>
    </div>
  );
}