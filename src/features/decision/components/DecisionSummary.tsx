"use client";

import type { StrategyEvaluation } from "../types";
import {
  type Tone,
  text as toneText,
  border as toneBorder,
  bg as toneBg,
} from "@/components/ui/index";

const PALETTE: Record<StrategyEvaluation["decision"], { tone: Tone; desc: string }> = {
  VALID: {
    tone: "up",
    desc: "شرط تنفيذ الإستراتيجية مكتمل — القرار ضمن نطاق التفعيل لديك.",
  },
  WAITING: {
    tone: "warn",
    desc: "إحدى التدفقات في حالة انتظار (شروط UNKNOWN تمنع الحسم).",
  },
  INVALID: {
    tone: "down",
    desc: "لا تدفق مفعّل متحقق — الشروط المطلوبة لم تكتمل.",
  },
  UNKNOWN: {
    tone: "neutral",
    desc: "بيانات غير كافية لتقييم هذه الاستراتيجية.",
  },
};

export function DecisionSummary({ evaluation }: { evaluation: StrategyEvaluation | null }) {
  if (!evaluation) {
    return (
      <div className="rounded-card border border-line bg-surface-1/40 p-4 text-center text-xs text-muted">
        أنشئ أو اختر استراتيجية لعرض القرار الكامل.
      </div>
    );
  }
  const p = PALETTE[evaluation.decision];
  return (
    <div className={`rounded-card border p-4 ${toneBorder[p.tone]} ${toneBg[p.tone]}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className={`text-2xl font-extrabold ${toneText[p.tone]}`} dir="ltr">
            {evaluation.decision}
          </div>
          <div className="mt-1 text-xs text-muted">{p.desc}</div>
        </div>
        <div className="flex items-center gap-4 text-center">
          <div>
            <div className="text-lg font-bold text-zinc-100">{evaluation.completion.toFixed(0)}%</div>
            <div className="text-2xs text-muted">إكمال الشروط</div>
          </div>
          <div>
            <div className="text-lg font-bold text-zinc-100">
              {evaluation.flows.filter((f) => f.enabled && f.result === "true").length}
            </div>
            <div className="text-2xs text-muted">تدفقات متحققة</div>
          </div>
          <div>
            <div className="text-lg font-bold text-zinc-100">
              {evaluation.flows.filter((f) => f.enabled && f.unknown.length > 0).length}
            </div>
            <div className="text-2xs text-muted">تدفقات بها UNKNOWN</div>
          </div>
        </div>
      </div>
      <div className="mt-2 text-2xs text-muted">
        ملاحظة: &quot;إكمال الشروط&quot; يعني اكتمال شروط الاستراتيجية على المعطيات الحالية الحقيقية، وليست
        احتمال ربح أو ضمانًا للنتيجة.
      </div>
    </div>
  );
}