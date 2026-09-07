"use client";

import { useNow } from "../hooks/useNow";
import { computeConfidence, computeCoverage, scoreReport } from "../intelligence";
import type { MarketState } from "../types";
import { Badge, Card, Progress, Score } from "@/components/ui/index";

function fmtPct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

/**
 * Weighted market score + confidence. Fully derived from real presence flags,
 * freshness timestamps and the engine's bias — never a hard-coded number.
 */
export function MarketScorePanel({
  state,
  latestUpdatedAt,
  freshSources,
  availableSources,
}: {
  state: MarketState | null;
  latestUpdatedAt: number | null;
  freshSources: number;
  availableSources: number;
}) {
  const report = scoreReport(state);
  const now = useNow(3000);

  if (!report) {
    return (
      <Card className="py-10 text-center text-2xs text-muted">
        درجة السوق غير متاحة بعد
      </Card>
    );
  }

  const coverage = computeCoverage(report.present, report.total);
  const fresh =
    latestUpdatedAt != null && now - latestUpdatedAt <= 120_000
      ? freshSources
      : 0;
  const confidence = computeConfidence({
    coverage,
    freshSources: fresh,
    availableSources,
    agreement: report.agreement,
  });
  const tone = report.direction === "up" ? "up" : report.direction === "down" ? "down" : "neutral";

  return (
    <Card className="h-full" title="درجة السوق وثقة القراءة">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-2xs text-muted">الدرجة المركّبة (Bias Score)</p>
          <Score value={report.score} max={100} tone={tone} size="lg" />
        </div>
        <Badge tone={tone}>{report.directionLabel}</Badge>
      </div>

      <div className="mt-4 space-y-3">
        <div>
          <div className="flex items-center justify-between text-2xs">
            <span className="text-muted">تغطية البيانات</span>
            <span className="font-semibold text-zinc-300">{fmtPct(coverage)}</span>
          </div>
          <Progress pct={coverage * 100} tone="neutral" className="mt-1" />
        </div>
        <div>
          <div className="flex items-center justify-between text-2xs">
            <span className="text-muted">توافق المحاور</span>
            <span className="font-semibold text-zinc-300">{Math.round(report.agreement * 100)}%</span>
          </div>
          <Progress pct={report.agreement * 100} tone={tone} className="mt-1" />
        </div>
        <div>
          <div className="flex items-center justify-between text-2xs">
            <span className="text-muted">الثقة الكلية</span>
            <span className="font-semibold text-zinc-300">{confidence}%</span>
          </div>
          <Progress
            pct={confidence}
            tone={confidence >= 70 ? "good" : confidence >= 40 ? "warn" : "down"}
            className="mt-1"
            showLabel
          />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-3 text-2xs font-semibold">
        <span className="text-up-fg">صاعد {report.bull.length}</span>
        <span className="text-zinc-500">·</span>
        <span className="text-zinc-300">محايد {report.neutral.length}</span>
        <span className="text-zinc-500">·</span>
        <span className="text-down-fg">هابط {report.bear.length}</span>
      </div>

      <p className="mt-3 text-2xs leading-relaxed text-muted">
        الثقة = 45% تغطية + 30% حداثة المصادر + 25% توافق الاتجاهات، داخل نافذة البيانات المتاحة.
      </p>
    </Card>
  );
}