"use client";

import Link from "next/link";
import type { ConditionEval, FlowEvaluation, StrategyType } from "../types";
import { STRATEGY_TYPE_LABELS } from "../catalog";
import { catalogById } from "../catalog";
import { Card } from "@/components/ui/index";

function collectLeaves(ev: ConditionEval, out: ConditionEval[]): void {
  if (ev.node.type === "condition") out.push(ev);
  else ev.children?.forEach((c) => collectLeaves(c, out));
}

export function WhyNot({ flows, flowType }: {
  flows: FlowEvaluation[];
  flowType?: StrategyType;
}) {
  const target = flowType ?? "BUY";
  const flow = flows.find((f) => f.type === target);

  const blocks: ConditionEval[] = [];
  if (flow) {
    const leaves: ConditionEval[] = [];
    collectLeaves(flow.tree, leaves);
    // only leaves that are required and blocking (missing) or unknown matter
    for (const l of leaves) {
      if (l.required && (l.result === "false" || l.result === "unknown")) blocks.push(l);
    }
  }

  const isPending = flow ? flow.unknown.length > 0 : false;

  return (
    <Card
      title={`Why Not ${target}? — لماذا لا ${STRATEGY_TYPE_LABELS[target]} الآن؟`}
      actions={
        <Link
          href="/strategies"
          className="rounded-md border border-line bg-surface-2/60 px-2 py-1 text-2xs font-semibold text-zinc-300 hover:border-zinc-500"
        >
          تحرير استراتيجياتك
        </Link>
      }
    >
      {!flow ? (
        <div className="text-xs text-muted">
          لا يوجد تدفق &quot;{STRATEGY_TYPE_LABELS[target]}&quot; في هذه الاستراتيجية.
        </div>
      ) : flow.result === "true" ? (
        <div className="rounded-card border border-up/30 bg-up/10 p-3 text-sm font-semibold text-up-fg">
          نتيجة تدفق {STRATEGY_TYPE_LABELS[target]} هي TRUE — كل الشروط المطلوبة متحققة. لا مانع من
          اتخاذ القرار وفق هذه الاستراتيجية (تذكّر: هذا تقييم اكتمال شروط، وليس ضمان ربح).
        </div>
      ) : (
        <div>
          <p className="mb-2 text-xs text-muted">
            تدفق {STRATEGY_TYPE_LABELS[target]} لم يتحقق لأن الشروط المطلوبة التالية لم تكتمل
            {isPending ? " (وبعض الشروط في حالة UNKNOWN تمنع حسم القرار)" : ""}:
          </p>
          {blocks.length === 0 ? (
            <div className="rounded-panel border border-line bg-surface-2/30 p-3 text-xs text-muted">
              لا توجد شروط مطلوبة صريحة فاشلة. القرار يتأثر ببنية المجموعات (AND/OR/NOT) أو بحالة
              UNKNOWN.
              {flow.unknown.length > 0 && (
                <div className="mt-1 text-warn-fg">
                  شروط UNKNOWN: {flow.unknown.join("، ")}
                </div>
              )}
            </div>
          ) : (
            <ul className="space-y-1.5">
              {blocks.map((b, i) => {
                const meta = catalogById(b.node.type === "condition" ? b.node.signalId : "");
                return (
                  <li
                    key={i}
                    className={`flex items-start justify-between gap-2 rounded-panel border p-2 text-xs ${
                      b.result === "unknown"
                        ? "border-warn/30 bg-warn/5"
                        : "border-down/30 bg-down/5"
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-zinc-100">
                        {b.node.type === "condition" ? meta?.name ?? b.node.signalId : "المجموعة"}
                      </div>
                      <div className="mt-0.5 text-2xs text-muted" dir="ltr">
                        {b.current} — المطلوب: {b.expected}
                      </div>
                      <div className="mt-0.5 text-2xs text-muted">{b.reason}</div>
                    </div>
                    <span
                      className={`shrink-0 rounded border px-1.5 py-0.5 text-2xs font-bold ${
                        b.result === "unknown"
                          ? "border-warn/40 text-warn-fg"
                          : "border-down/40 text-down-fg"
                      }`}
                    >
                      {b.result === "unknown" ? "UNKNOWN" : "FALSE"}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="mt-3 rounded-panel border border-line bg-surface-2/30 p-2.5 text-2xs text-muted">
            <span className="font-semibold text-zinc-300">Conflict with data?</span> أي شروط تظهر
            FALSE بسبب بيانات غير متوفرة تُعرض بتصنيف UNKNOWN (بيانات غير متاحة، لا نمنحها قيمة
            افتراضية). افحص مصدر كل إشارة في صفحة «مصفوفة الإشارات».
          </div>
        </div>
      )}
    </Card>
  );
}