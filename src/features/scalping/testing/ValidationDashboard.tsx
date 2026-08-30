"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Section,
  Tag,
  StatRow,
  Dot,
} from "../components/terminal/TradingPrimitives";
import {
  listValidationRuns,
  getValidationMetrics,
} from "./services/firestore";
import { buildComparison, type ComparisonOptions } from "./compare/compare";
import type { RunSummaryRow, ValidationMetrics } from "./types";

/**
 * Layer 9 — Validation History & Comparison dashboard for the Decision Engine.
 *
 * Loads immutable validation runs (summary docs only, never decision records)
 * from Firestore, then renders a percentage-point (pp) comparison table with a
 * selectable Golden Baseline. Accuracy deltas are always in pp, not %.
 */

export function ValidationDashboard({
  currentRunId,
  engineVersion,
  strategyVersion,
}: {
  currentRunId: string | null;
  engineVersion: string;
  strategyVersion: string;
}) {
  const [summaries, setSummaries] = useState<
    (import("./types").ValidationRunSummaryDoc & { runId: string })[]
  >([]);
  const [metricsMap, setMetricsMap] = useState<Record<string, ValidationMetrics>>({});
  const [baselineRunId, setBaselineRunId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const list = await listValidationRuns(50);
        if (cancelled) return;
        setSummaries(list);
        if (list.length) {
          setBaselineRunId((prev) => prev ?? list[list.length - 1].runId);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "تعذر تحميل سجل المصادقة");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentRunId]);

  // Load metrics for the baseline and the most recent rows.
  useEffect(() => {
    const ids = new Set<string>();
    if (baselineRunId) ids.add(baselineRunId);
    summaries.slice(0, 8).forEach((h) => ids.add(h.runId));
    ids.forEach((id) => {
      if (metricsMap[id]) return;
      void getValidationMetrics(id).then((m) => {
        if (m) setMetricsMap((p) => ({ ...p, [id]: m }));
      });
    });
  }, [summaries, baselineRunId, metricsMap]);

  const comparison = useMemo(() => {
    const opts: ComparisonOptions = { baselineRunId };
    const entries = summaries.map((s) => {
      const m = metricsMap[s.runId] ?? null;
      return { row: toRow(s, m), metrics: m };
    });
    return buildComparison(entries, opts);
  }, [summaries, metricsMap, baselineRunId]);

  const top = comparison.sorted.slice(0, 6);

  return (
    <Section
      title="سجل المصادقة والمقارنة"
      eyebrow="Layer 9 · Validation History & Comparison"
      actions={
        <Tag tone="quiet" ltr>
          v{engineVersion} · s{strategyVersion}
        </Tag>
      }
    >
      {error ? <div className="text-xs text-red-400">{error}</div> : null}

      {/* Golden baseline picker */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <span className="text-[11px] text-zinc-500">المعيار الذهبي (Golden Baseline):</span>
        <select
          value={baselineRunId ?? ""}
          onChange={(e) => setBaselineRunId(e.target.value || null)}
          className="rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1 text-[11px] text-zinc-300 ltr"
          dir="ltr"
        >
          <option value="">—</option>
          {summaries.map((h) => (
            <option key={h.runId} value={h.runId}>
              {h.runId} · acc60 {h.accuracy60?.toFixed(1)}%
            </option>
          ))}
        </select>
        {comparison.baseline ? (
          <Tag
            tone={comparison.baseline.improved === true ? "good" : comparison.baseline.improved === false ? "short" : "quiet"}
            ltr
          >
            {comparison.baseline.targetRunId
              ? `@ ${fmtDelta(comparison.baseline.delta60sPp)}`
              : "اختر جلسة للمقارنة"}
          </Tag>
        ) : null}
      </div>

      {currentRunId ? (
        <div className="mb-2 text-[11px] text-emerald-400">
          الجلسة الحالية محفوظة: <span className="ltr" dir="ltr">{shortId(currentRunId)}</span>
        </div>
      ) : null}

      {/* Best highlights */}
      <div className="mb-3 grid gap-2 md:grid-cols-4">
        <StatRow label="أفضل جلسة" value={comparison.bestRunId ? shortId(comparison.bestRunId) : "-"} tone="good" />
        <StatRow label="أفضل إصدار محرك" value={comparison.bestEngineVersion ?? "-"} tone="quiet" />
        <StatRow label="أفضل أفق" value={comparison.bestHorizon ?? "-"} tone="good" />
        <StatRow
          label="فرق المعيار (pp)"
          value={comparison.baseline ? fmtDelta(comparison.baseline.delta60sPp) : "-"}
          tone={comparison.baseline?.improved === true ? "good" : "quiet"}
        />
      </div>

      {/* Comparison table */}
      {top.length === 0 ? (
        <p className="text-xs text-zinc-500">
          لا توجد جلسات مصادقة بعد. عند إنهاء محاكاة سيُحفظ سجلٌ تلقائياً.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px] ltr" dir="ltr">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500">
                <th className="py-1 pr-2 text-left">Run</th>
                <th className="py-1 pr-2 text-left">Engine</th>
                <th className="py-1 pr-2 text-left">Dec</th>
                <th className="py-1 pr-2 text-left">30s</th>
                <th className="py-1 pr-2 text-left">60s</th>
                <th className="py-1 pr-2 text-left">120s</th>
                <th className="py-1 pr-2 text-left">Delta (pp)</th>
                <th className="py-1 pr-2 text-left">Regime</th>
                <th className="py-1 pr-2 text-left">Calib</th>
              </tr>
            </thead>
            <tbody>
              {top.map((r) => (
                <Row
                  key={r.runId}
                  r={r}
                  acc={metricsMap[r.runId] ?? null}
                  isBase={baselineRunId === r.runId}
                  isBest={comparison.bestRunId === r.runId}
                  baseAcc={comparison.baseline?.accuracy60.from ?? null}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Per-run accuracy bars */}
      <div className="mt-4 space-y-1">
        {comparison.sorted.slice(0, 4).map((r) => (
          <AccuracyBar key={r.runId} r={r} isBase={baselineRunId === r.runId} />
        ))}
      </div>
    </Section>
  );
}

function Row({
  r,
  acc,
  isBase,
  isBest,
  baseAcc,
}: {
  r: RunSummaryRow;
  acc: ValidationMetrics | null;
  isBase: boolean;
  isBest: boolean;
  baseAcc: number | null;
}) {
  const a60 = acc?.horizons["60s"].accuracy ?? r.accuracy["60s"];
  const a30 = acc?.horizons["30s"].accuracy ?? r.accuracy["30s"];
  const a120 = acc?.horizons["120s"].accuracy ?? r.accuracy["120s"];
  const delta = a60 == null || baseAcc == null ? null : a60 - baseAcc;
  return (
    <tr className="border-b border-zinc-900">
      <td className="py-1 pr-2 text-zinc-300">
        {isBest ? <Dot tone="good" /> : isBase ? <Dot tone="quiet" /> : null}
        <span className="ml-1">{shortId(r.runId)}</span>
      </td>
      <td className="py-1 pr-2 text-zinc-400">{r.engineVersion}</td>
      <td className="py-1 pr-2 text-zinc-400">{r.totalDecisions}</td>
      <td className="py-1 pr-2 text-zinc-300">{fmtAcc(a30)}</td>
      <td className="py-1 pr-2 text-zinc-100">{fmtAcc(a60)}</td>
      <td className="py-1 pr-2 text-zinc-300">{fmtAcc(a120)}</td>
      <td
        className="py-1 pr-2 font-semibold"
        style={{ color: delta == null ? "#52525b" : delta >= 0 ? "#34d399" : "#f87171" }}
      >
        {delta == null ? "—" : fmtDelta(delta)}
      </td>
      <td className="py-1 pr-2 text-zinc-400">{r.bestMarketRegime ?? "-"}</td>
      <td className="py-1 pr-2 text-zinc-400">{fmtCalib(r.calibration)}</td>
    </tr>
  );
}

function AccuracyBar({ r, isBase }: { r: RunSummaryRow; isBase: boolean }) {
  const a60 = r.accuracy["60s"];
  return (
    <div className="flex items-center gap-2">
      <span className="w-24 shrink-0 text-[10px] text-zinc-500 ltr" dir="ltr">
        {isBase ? "★ " : ""}
        {shortId(r.runId)}
      </span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-900">
        <div
          className="h-full rounded-full bg-emerald-500/80"
          style={{ width: `${Math.min(100, Math.max(0, a60 ?? 0))}%` }}
        />
      </div>
      <span className="w-12 shrink-0 text-right text-[10px] text-zinc-400">{fmtAcc(a60)}</span>
    </div>
  );
}

function toRow(
  s: import("./types").ValidationRunSummaryDoc & { runId: string },
  m: ValidationMetrics | null
): RunSummaryRow {
  return {
    runId: s.runId,
    engineVersion: s.engineVersion,
    createdAt: s.createdAt,
    totalDecisions: s.totalDecisions,
    accuracy: {
      "30s": m?.horizons["30s"].accuracy ?? null,
      "60s": m?.horizons["60s"].accuracy ?? s.accuracy60,
      "120s": m?.horizons["120s"].accuracy ?? null,
    },
    averageMovePct: m?.returns.averageReturnPct ?? null,
    averageMFE: m?.returns.averageMFE ?? null,
    averageMAE: m?.returns.averageMAE ?? null,
    bestHorizon: m?.best.bestHorizon ?? s.bestHorizon,
    bestMarketRegime: m?.best.bestMarketRegime ?? s.bestMarketRegime,
    calibration: m ? calibrationOf(m) : null,
    engineVersionLabel: s.engineVersion,
  };
}

function calibrationOf(m: ValidationMetrics): number | null {
  const segs = Object.entries(m.segments.byConfidence);
  let sum = 0;
  let n = 0;
  for (const [label, seg] of segs) {
    if (seg.directionalCount <= 0 || seg.accuracy60 == null) continue;
    const mid = label === "<60" ? 50 : (parseFloat(label.split("-")[0] ?? "") || 0) + 5;
    sum += Math.abs(seg.accuracy60 - mid);
    n++;
  }
  return n ? sum / n : null;
}

function shortId(id: string): string {
  return id.length > 18 ? `…${id.slice(-12)}` : id;
}
function fmtAcc(v: number | null): string {
  return v == null ? "-" : `${v.toFixed(1)}%`;
}
function fmtCalib(v: number | null): string {
  return v == null ? "-" : v.toFixed(1);
}
function fmtDelta(v: number | null): string {
  if (v == null) return "-";
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}pp`;
}
