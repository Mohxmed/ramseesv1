"use client";

import type { ScalpDecisionView, ScalpRecorderView } from "../../types";
import { Section, Tag, StatRow, Dot, TONE_TEXT } from "./TradingPrimitives";

export function StatisticalEdge({
  decision,
  recorder,
}: {
  decision: ScalpDecisionView | null;
  recorder: ScalpRecorderView | null;
}) {
  const prob = decision?.primaryProbability ?? null;
  const probDir = decision?.probabilityDirection ?? null;
  const probTone: "long" | "short" | "neutral" =
    probDir === "LONG" ? "long" : probDir === "SHORT" ? "short" : "neutral";

  const cost = decision?.costBps ?? null;
  const expMove = decision?.expectedNetMovePct ?? null;

  return (
    <Section
      title="الحافة الإحصائية"
      eyebrow="05 · Edge"
      actions={
        decision?.probabilityCalibrated ? (
          <Tag tone="good">محسوبة من النتائج</Tag>
        ) : (
          <Tag tone="quiet">تقدير توافق (غير محسوبة)</Tag>
        )
      }
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Probability + expected edge */}
        <div className="space-y-3">
          <div className="rounded-panel border border-line bg-surface-2/40 p-3">
            <div className="flex items-center justify-between">
              <span className="text-2xs text-muted">الاحتمال الاتجاهي الأساسي</span>
              <Dot tone={probTone} />
            </div>
            <div className="mt-1 font-mono text-3xl font-extrabold text-zinc-50" dir="ltr">
              {prob != null ? `${(prob * 100).toFixed(0)}%` : "—"}
              <span className="text-sm text-muted"> · {probDir ?? "—"}</span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-2xs">
              <div>
                <span className="text-muted">شراء: </span>
                <span className="font-mono tabular-nums text-up-fg" dir="ltr">
                  {`${((decision?.longProbability ?? 0) * 100).toFixed(0)}%`}
                </span>
              </div>
              <div>
                <span className="text-muted">بيع: </span>
                <span className="font-mono tabular-nums text-down-fg" dir="ltr">
                  {`${((decision?.shortProbability ?? 0) * 100).toFixed(0)}%`}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-panel border border-line bg-surface-2/40 p-3">
            <div className="text-2xs text-muted">الحركة المتوقعة مقابل التكلفة</div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xs text-muted">صافي الحركة المتوقعة</span>
              <span
                className={`font-mono text-lg font-bold ${expMove != null && expMove >= 0 ? "text-up-fg" : expMove != null ? "text-down-fg" : "text-muted"}`}
                dir="ltr"
              >
                {expMove != null ? `${expMove.toFixed(3)}%` : "—"}
              </span>
            </div>
            {cost ? (
              <div className="mt-2 border-t border-line pt-2 text-2xs">
                <StatRow label="الرسوم" value={`${cost.fee.toFixed(1)} bps`} />
                <StatRow label="السبريد" value={`${cost.spread.toFixed(1)} bps`} />
                <StatRow label="الانزلاق" value={`${cost.slippage.toFixed(1)} bps`} />
                <StatRow label="إجمالي التكلفة" value={`${cost.total.toFixed(1)} bps`} strong tone="warn" />
              </div>
            ) : (
              <div className="mt-2 text-2xs text-muted">لا نموذج تكلفة بعد.</div>
            )}
          </div>
        </div>

        {/* Recorder self-eval */}
        <div className="rounded-panel border border-line bg-surface-2/40 p-3">
          <div className="mb-2 text-3xs font-semibold uppercase tracking-[0.18em] text-muted">
            التقييم الذاتي (نافذة الجلسة)
          </div>
          {recorder ? (
            <>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                <StatRow label="القرارات" value={recorder.count} strong />
                <StatRow label="المحسومة" value={recorder.resolved} />
                <StatRow label="اتجاهية" value={recorder.directional} />
                <StatRow label="NO TRADE" value={recorder.noTrade} />
                <StatRow
                  label="معدل الإصابات"
                  value={`${(recorder.hitRate * 100).toFixed(0)}%`}
                  strong
                />
                <StatRow label="خطأ التناسب" value={recorder.calibrationError.toFixed(3)} />
                <StatRow label="Brier" value={recorder.brier.toFixed(3)} />
              </div>
              <div className="mt-3 border-t border-line pt-2">
                <div className="mb-1 text-2xs text-muted">حسب الاتجاه</div>
                {(["LONG", "SHORT"] as const).map((d) => {
                  const p = recorder.perDirection?.[d];
                  const t: "long" | "short" = d === "LONG" ? "long" : "short";
                  return (
                    <div key={d} className="flex items-center justify-between py-0.5 text-2xs">
                      <span className={`flex items-center gap-1.5 ${TONE_TEXT[t]}`}>
                        <Dot tone={t} /> {d}
                      </span>
                      <span className="font-mono tabular-nums text-zinc-300" dir="ltr">
                        {p?.winRate != null ? `${(p.winRate * 100).toFixed(0)}%` : "—"}
                        <span className="text-muted"> فوز · </span>
                        {p?.meanProbability != null ? `${(p.meanProbability * 100).toFixed(0)}%` : "—"}
                        <span className="text-muted"> ثقة · </span>
                        {p?.count ?? 0}
                        <span className="text-muted"> ع</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="text-2xs text-muted">كمية كافية من القرارات تظهر هنا لاحقاً.</p>
          )}
        </div>
      </div>

      <p className="mt-3 text-2xs leading-relaxed text-muted">
        الاحتمال المعروض تقدير توافق على الضغط الحالي، وليس نسبة نجاح مضمونة، ما لم يُشار إليه
        بوصفه «محسوباً من النتائج». قرار NO TRADE يظهر حين تتجاوز التكلفة الحركة المتوقعة.
      </p>
    </Section>
  );
}
