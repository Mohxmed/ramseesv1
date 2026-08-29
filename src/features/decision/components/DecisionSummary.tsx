"use client";

import type { StrategyEvaluation } from "../types";

const PALETTE: Record<StrategyEvaluation["decision"], { text: string; border: string; bg: string; desc: string }> = {
  VALID: {
    text: "text-emerald-300",
    border: "border-emerald-500/50",
    bg: "bg-emerald-500/10",
    desc: "شرط تنفيذ الإستراتيجية مكتمل — القرار ضمن نطاق التفعيل لديك.",
  },
  WAITING: {
    text: "text-amber-300",
    border: "border-amber-500/50",
    bg: "bg-amber-500/10",
    desc: "إحدى التدفقات في حالة انتظار (شروط UNKNOWN تمنع الحسم).",
  },
  INVALID: {
    text: "text-red-300",
    border: "border-red-500/50",
    bg: "bg-red-500/10",
    desc: "لا تدفق مفعّل متحقق — الشروط المطلوبة لم تكتمل.",
  },
  UNKNOWN: {
    text: "text-zinc-300",
    border: "border-zinc-600",
    bg: "bg-zinc-800/20",
    desc: "بيانات غير كافية لتقييم هذه الاستراتيجية.",
  },
};

export function DecisionSummary({ evaluation }: { evaluation: StrategyEvaluation | null }) {
  if (!evaluation) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 text-center text-xs text-zinc-500">
        أنشئ أو اختر استراتيجية لعرض القرار الكامل.
      </div>
    );
  }
  const p = PALETTE[evaluation.decision];
  return (
    <div className={`rounded-2xl border p-4 ${p.border} ${p.bg}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className={`text-2xl font-extrabold ${p.text}`} dir="ltr">
            {evaluation.decision}
          </div>
          <div className="mt-1 text-xs text-zinc-400">{p.desc}</div>
        </div>
        <div className="flex items-center gap-4 text-center">
          <div>
            <div className="text-lg font-bold text-zinc-100">{evaluation.completion.toFixed(0)}%</div>
            <div className="text-[10px] text-zinc-500">إكمال الشروط</div>
          </div>
          <div>
            <div className="text-lg font-bold text-zinc-100">
              {evaluation.flows.filter((f) => f.enabled && f.result === "true").length}
            </div>
            <div className="text-[10px] text-zinc-500">تدفقات متحققة</div>
          </div>
          <div>
            <div className="text-lg font-bold text-zinc-100">
              {evaluation.flows.filter((f) => f.enabled && f.unknown.length > 0).length}
            </div>
            <div className="text-[10px] text-zinc-500">تدفقات بها UNKNOWN</div>
          </div>
        </div>
      </div>
      <div className="mt-2 text-[10px] text-zinc-500">
        ملاحظة: "إكمال الشروط" يعني اكتمال شروط الاستراتيجية على المعطيات الحالية الحقيقية، وليست
        احتمال ربح أو ضمانًا للنتيجة.
      </div>
    </div>
  );
}
