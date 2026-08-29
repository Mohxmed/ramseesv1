"use client";

import type { ConditionEval, FlowEvaluation, Strategy, StrategyEvaluation, StrategyType } from "../types";
import { STATE_META } from "../constants";
import { STRATEGY_TYPE_LABELS, catalogById } from "../catalog";
import { Card } from "./ui";

const FLOW_BADGE: Record<StrategyType, string> = {
  BUY: "border-emerald-500/50 bg-emerald-500/10 text-emerald-300",
  SELL: "border-red-500/50 bg-red-500/10 text-red-300",
  EXIT: "border-amber-500/50 bg-amber-500/10 text-amber-300",
  WAIT: "border-zinc-600 bg-zinc-700/20 text-zinc-300",
};

function FlowBar({ flow, enabled }: { flow: FlowEvaluation; enabled: boolean }) {
  const pct = flow.totalRequired > 0 ? (flow.satisfiedRequired / flow.totalRequired) * 100 : flow.result === "true" ? 100 : 0;
  return (
    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800">
      <div
        className={`h-full rounded-full transition-all duration-500 ${
          flow.result === "true"
            ? "bg-emerald-500"
            : flow.result === "unknown"
            ? "bg-zinc-500"
            : enabled
            ? "bg-red-500/70"
            : "bg-zinc-700"
        }`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function NodeRow({ ev, depth }: { ev: ConditionEval; depth?: number }) {
  const node = ev.node;
  const meta = STATE_META[ev.result];
  const entry = node.type === "condition" ? catalogById(node.signalId) : undefined;
  const isGroup = node.type === "group";
  const style = { marginInlineStart: depth ? Math.min(depth * 16, 48) : 0 };

  if (isGroup) {
    return (
      <div style={style} className="mt-1.5">
        <div
          className={`rounded-lg border px-2.5 py-1.5 ${
            ev.result === "true"
              ? "border-emerald-500/30 bg-emerald-500/5"
              : ev.result === "false"
              ? "border-red-500/30 bg-red-500/5"
              : "border-zinc-800/70 bg-zinc-900/30"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[11px] font-bold">
              <span className={node.logic === "AND" ? "text-indigo-300" : "text-fuchsia-300"} dir="ltr">
                {node.logic}
              </span>
              {node.not && <span className="rounded bg-amber-500/10 px-1 text-[10px] text-amber-300">NOT</span>}
              <span className="text-zinc-400">المجموعة</span>
            </div>
            <span
              className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-bold ${meta.bg} ${meta.color}`}
              title={ev.reason}
            >
              {ev.result.toUpperCase()}
            </span>
          </div>
        </div>
        {ev.children?.map((c, i) => <NodeRow key={i} ev={c} depth={(depth ?? 0) + 1} />)}
      </div>
    );
  }

  // condition leaf
  return (
    <div
      style={style}
      className="mt-1.5 flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950/50 px-2.5 py-2"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] font-semibold text-zinc-100">
            {entry?.name ?? node.signalId}
          </span>
          <span className="text-[10px] text-zinc-500">({node.required ? "مطلوب" : "اختياري"})</span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
          <span className="text-zinc-400">
            الشرط:{" "}
            <span className="font-mono text-zinc-200" dir="ltr">
              {ev.expected}
            </span>
          </span>
          <span className="text-zinc-600">·</span>
          <span className="text-zinc-400">
            القيمة الحالية:{" "}
            <span
              className={`font-mono ${
                ev.result === "true"
                  ? "text-emerald-300"
                  : ev.result === "false"
                  ? "text-red-300"
                  : "text-zinc-400"
              }`}
              dir="ltr"
            >
              {ev.current}
            </span>
          </span>
        </div>
        {ev.reason && <div className="mt-0.5 text-[11px] leading-snug text-zinc-500">{ev.reason}</div>}
      </div>
      <span
        className={`inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-bold ${meta.bg} ${meta.color}`}
      >
        {meta.label}
      </span>
    </div>
  );
}

function FlowCard({ flow, strategy, evaluation }: { flow: FlowEvaluation; strategy: Strategy; evaluation: StrategyEvaluation }) {
  const label = STRATEGY_TYPE_LABELS[flow.type];
  return (
    <div className={`rounded-xl border p-3 ${flow.enabled ? "border-zinc-800" : "border-zinc-800/60 opacity-60"}`}>
      <div className="flex items-center justify-between gap-2">
        <span className={`rounded-md border px-2 py-0.5 text-[11px] font-bold ${FLOW_BADGE[flow.type]}`} dir="ltr">
          {flow.type} · {label}
        </span>
        <span className="text-[10px] text-zinc-500">
          {flow.enabled ? "مفعّل" : "مغلق"} · مطلوب {flow.satisfiedRequired}/{flow.totalRequired}
        </span>
      </div>

      <FlowBar flow={flow} enabled={flow.enabled} />

      <div className="mt-1 flex justify-between text-[10px] text-zinc-500">
        <span>الإكمال {flow.completion.toFixed(0)}%</span>
        <span>اختياري {flow.satisfiedOptional}/{flow.totalOptional}</span>
      </div>

      {/* Condition tree — the actual strategy conditions bound to real data */}
      <div className="mt-2">
        <NodeRow ev={flow.tree} />
      </div>

      {flow.unknown.length > 0 && (
        <div className="mt-2 rounded-lg border border-zinc-700/50 bg-zinc-800/20 p-2 text-[10px] text-zinc-400">
          <span className="font-semibold text-zinc-300">غير مؤكد (UNKNOWN):</span> {flow.unknown.join("، ")}
        </div>
      )}
      {flow.missing.length > 0 && (
        <div className="mt-2 rounded-lg border border-red-500/30 bg-red-500/5 p-2 text-[10px] text-red-200/80">
          <span className="font-semibold text-red-300">ناقص (مطلوب):</span> {flow.missing.join("، ")}
        </div>
      )}
    </div>
  );
}

/**
 * Focused strategy decision view. Shows ONLY the enabled strategy's conditions,
 * each bound to its real live value (current vs required) and tri-state result.
 */
export function StrategyConditionViewer({
  evaluation,
  strategy,
  updatedAt,
}: {
  evaluation: StrategyEvaluation;
  strategy: Strategy | null;
  updatedAt: number;
}) {
  const enabledFlows = evaluation.flows.filter((f) => f.enabled);
  const allUnknown =
    enabledFlows.length > 0 && evaluation.flows.every((f) => f.result === "unknown");

  return (
    <Card
      title="شروط الاستراتيجية — التقييم الحي"
      actions={
        <div className="flex items-center gap-2 text-[11px]">
          <span className="rounded-md border border-zinc-700 bg-zinc-800/60 px-2 py-1">
            {evaluation.completion.toFixed(0)}% مكتمل
          </span>
          <span
            className={`rounded-md border px-2 py-1 font-bold ${
              evaluation.decision === "VALID"
                ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                : evaluation.decision === "WAITING" || evaluation.decision === "UNKNOWN"
                ? "border-amber-500/50 bg-amber-500/10 text-amber-300"
                : "border-red-500/50 bg-red-500/10 text-red-300"
            }`}
          >
            {evaluation.decision} {allUnknown ? "·" : ""}
          </span>
        </div>
      }
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-2 text-xs">
        <span className="font-semibold text-zinc-200">
          الاستراتيجية: {strategy?.name ?? "غير معروفة"}
        </span>
        <span className="text-[10px] text-zinc-500">
          وفق البيانات الحية · آخر تحديث{" "}
          <span dir="ltr">{new Date(updatedAt).toLocaleTimeString("ar", { hour12: false })}</span>
        </span>
      </div>

      {enabledFlows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-700 p-6 text-center text-xs text-zinc-500">
          لا توجد تدفقات مفعّلة لهذه الاستراتيجية. فعّل تدفقًا (BUY / SELL / EXIT) في صفحة الإدارة
          لعرض شروطه.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {evaluation.flows.map((flow) => (
            <FlowCard key={flow.type} flow={flow} strategy={strategy!} evaluation={evaluation} />
          ))}
        </div>
      )}
    </Card>
  );
}
