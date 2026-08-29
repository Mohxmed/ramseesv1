"use client";

import type { ScalpDecisionView, ScalpRecorderView } from "../types";
import { Panel, Chip } from "./ui";

const DIR_META: Record<string, { text: string; cls: string }> = {
  LONG: { text: "LONG / شراء", cls: "border-emerald-500/60 bg-emerald-500/15 text-emerald-300" },
  SHORT: { text: "SHORT / بيع", cls: "border-red-500/60 bg-red-500/15 text-red-300" },
  NEUTRAL: { text: "NEUTRAL", cls: "border-zinc-600 bg-zinc-800/40 text-zinc-300" },
  NO_TRADE: { text: "NO TRADE", cls: "border-amber-500/60 bg-amber-500/15 text-amber-300" },
};

const GATE_LABEL: Record<string, string> = {
  none: "قرار مباشر",
  "ev-negative": "التكلفة تأكل الحافة",
  "data-stale": "بيانات قديمة",
  "neutral-score": "لا توافق صافٍ",
};

function pct(v: number | null | undefined): string {
  return v == null ? "—" : `${(v * 100).toFixed(1)}%`;
}

function ProbBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[10px]">
        <span className="text-zinc-400">{label}</span>
        <span className="font-mono font-bold text-zinc-100" dir="ltr">
          {pct(value)}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${Math.round(value * 100)}%` }}
        />
      </div>
    </div>
  );
}

export function DecisionPanel({
  decision,
  recorder,
}: {
  decision: ScalpDecisionView | null | undefined;
  recorder: ScalpRecorderView | null | undefined;
}) {
  if (!decision) {
    return <Panel title="STATISTICAL DECISION — القرار الإحصائي">لا توجد بيانات قرار بعد.</Panel>;
  }

  const dm = DIR_META[decision.direction];
  const cal = decision.probabilityCalibrated;

  return (
    <Panel title="STATISTICAL DECISION — القرار الإحصائي">
      {/* Final decision + gate */}
      <div className="flex flex-wrap items-center gap-3">
        <Chip className={dm.cls}>{dm.text}</Chip>
        <Chip className="border-zinc-700 bg-zinc-800/40 text-zinc-300">{GATE_LABEL[decision.gate]}</Chip>
        {decision.blocked && (
          <Chip className="border-red-500/50 bg-red-500/10 text-red-300">NO TRADE (حافة سلبية)</Chip>
        )}
        {decision.reasonNote && (
          <span className="text-xs text-zinc-400">{decision.reasonNote}</span>
        )}
      </div>

      {/* Probabilities (score is NOT a probability) */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
          <div className="text-[10px] uppercase tracking-wide text-zinc-500">
            الاحتمال الاتجاهي الرئيسي
            <Chip className="ml-1 border-zinc-700 bg-zinc-800/40 text-zinc-400">
              {cal ? "محسوب من النتائج" : "تقدير توافق (غير محسوب)"}
            </Chip>
          </div>
          <div className="mt-1 text-2xl font-extrabold text-zinc-50" dir="ltr">
            {pct(decision.primaryProbability)}
          </div>
          <div className="text-[10px] text-zinc-500">اتجاه: {decision.probabilityDirection ?? "—"}</div>
        </div>

        <div className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
          <div className="text-[10px] uppercase tracking-wide text-zinc-500">الاحتمالات الثنائية</div>
          <ProbBar label="شراء (LONG)" value={decision.longProbability} color="bg-emerald-500" />
          <ProbBar label="بيع (SHORT)" value={decision.shortProbability} color="bg-red-500" />
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
          <div className="text-[10px] uppercase tracking-wide text-zinc-500">التكلفة (فرق السعر/الرسوم/الانزلاق)</div>
          {decision.costBps ? (
            <div className="mt-2 font-mono text-[11px] text-zinc-300" dir="ltr">
              <Row k="رسوم" v={`${decision.costBps.fee.toFixed(1)} bps`} />
              <Row k="سبريد" v={`${decision.costBps.spread.toFixed(1)} bps`} />
              <Row k="انزلاق" v={`${decision.costBps.slippage.toFixed(1)} bps`} />
              <Row k="الإجمالي" v={`${decision.costBps.total.toFixed(1)} bps`} strong />
            </div>
          ) : (
            <div className="mt-2 text-xs text-zinc-500">—</div>
          )}
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[10px] text-zinc-500">صافي الحركة المتوقعة</span>
            <span
              className={`font-mono text-sm font-bold ${
                (decision.expectedNetMovePct ?? 0) >= 0 ? "text-emerald-300" : "text-red-300"
              }`}
              dir="ltr"
            >
              {decision.expectedNetMovePct != null ? `${decision.expectedNetMovePct.toFixed(3)}%` : "—"}
            </span>
          </div>
        </div>
      </div>

      {/* Recorder / self-eval strip */}
      {recorder && (
        <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3 sm:grid-cols-6">
          <Mini label="إجمالي القرارات" value={`${recorder.count}`} />
          <Mini label="اتجاهية" value={`${recorder.directional}`} />
          <Mini label="NO TRADE" value={`${recorder.noTrade}`} />
          <Mini label="تم الحسم" value={`${recorder.resolved}`} />
          <Mini label="معدل الإصابات" value={pct(recorder.hitRate)} />
          <Mini label="خطأ التناسب" value={recorder.calibrationError.toFixed(3)} />
        </div>
      )}
    </Panel>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${strong ? "border-t border-zinc-800 pt-1 font-bold text-zinc-100" : ""}`}>
      <span>{k}</span>
      <span>{v}</span>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="text-[9px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-0.5 font-mono text-sm font-bold text-zinc-100" dir="ltr">
        {value}
      </div>
    </div>
  );
}
