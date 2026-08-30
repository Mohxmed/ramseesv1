"use client";

import type { ConditionEval, FlowEvaluation, Strategy, StrategyEvaluation, StrategyType } from "../types";
import { STATE_META } from "../constants";
import { STRATEGY_TYPE_LABELS, catalogById } from "../catalog";
import { Card, Progress, Badge, type Tone } from "@/components/ui/index";

const FLOW_BADGE: Record<StrategyType, string> = {
  BUY: "border-up/40 bg-up/10 text-up-fg",
  SELL: "border-down/40 bg-down/10 text-down-fg",
  EXIT: "border-warn/40 bg-warn/10 text-warn-fg",
  WAIT: "border-line bg-surface-2/40 text-zinc-300",
};

function FlowBar({ flow, enabled }: { flow: FlowEvaluation; enabled: boolean }) {
  const pct = flow.totalRequired > 0 ? (flow.satisfiedRequired / flow.totalRequired) * 100 : flow.result === "true" ? 100 : 0;
  const tone: Tone =
    flow.result === "true"
      ? "up"
      : flow.result === "unknown"
      ? "neutral"
      : enabled
      ? "down"
      : "quiet";
  return <Progress pct={pct} tone={tone} className="mt-2" />;
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
          className={`rounded-panel border px-2.5 py-1.5 ${
            ev.result === "true"
              ? "border-up/30 bg-up/5"
              : ev.result === "false"
              ? "border-down/30 bg-down/5"
              : "border-line bg-surface-2/30"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-2xs font-bold">
              <span className={node.logic === "AND" ? "text-indigo-300" : "text-fuchsia-300"} dir="ltr">
                {node.logic}
              </span>
              {node.not && <span className="rounded bg-warn/10 px-1 text-2xs text-warn-fg">NOT</span>}
              <span className="text-muted">المجموعة</span>
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
      className="mt-1.5 flex items-center justify-between gap-3 rounded-panel border border-line bg-surface-2/30 px-2.5 py-2"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-zinc-100">
            {entry?.name ?? node.signalId}
          </span>
          <span className="text-2xs text-muted">({node.required ? "مطلوب" : "اختياري"})</span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-2xs">
          <span className="text-muted">
            الشرط:{" "}
            <span className="font-mono text-zinc-200" dir="ltr">
              {ev.expected}
            </span>
          </span>
          <span className="text-muted">·</span>
          <span className="text-muted">
            القيمة الحالية:{" "}
            <span
              className={`font-mono ${
                ev.result === "true"
                  ? "text-up-fg"
                  : ev.result === "false"
                  ? "text-down-fg"
                  : "text-muted"
              }`}
              dir="ltr"
            >
              {ev.current}
            </span>
          </span>
        </div>
        {ev.reason && <div className="mt-0.5 text-2xs leading-snug text-muted">{ev.reason}</div>}
      </div>
      <span
        className={`inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-bold ${meta.bg} ${meta.color}`}
      >
        {meta.label}
      </span>
    </div>
  );
}

function FlowCard({ flow }: { flow: FlowEvaluation }) {
  const label = STRATEGY_TYPE_LABELS[flow.type];
  return (
    <div className={`rounded-panel border p-3 ${flow.enabled ? "border-line" : "border-line opacity-60"}`}>
      <div className="flex items-center justify-between gap-2">
        <span className={`rounded-md border px-2 py-0.5 text-2xs font-bold ${FLOW_BADGE[flow.type]}`} dir="ltr">
          {flow.type} · {label}
        </span>
        <span className="text-2xs text-muted">
          {flow.enabled ? "مفعّل" : "مغلق"} · مطلوب {flow.satisfiedRequired}/{flow.totalRequired}
        </span>
      </div>

      <FlowBar flow={flow} enabled={flow.enabled} />

      <div className="mt-1 flex justify-between text-2xs text-muted">
        <span>الإكمال {flow.completion.toFixed(0)}%</span>
        <span>اختياري {flow.satisfiedOptional}/{flow.totalOptional}</span>
      </div>

      {/* Condition tree — the actual strategy conditions bound to real data */}
      <div className="mt-2">
        <NodeRow ev={flow.tree} />
      </div>

      {flow.unknown.length > 0 && (
        <div className="mt-2 rounded-panel border border-line bg-surface-2/30 p-2 text-2xs text-muted">
          <span className="font-semibold text-zinc-300">غير مؤكد (UNKNOWN):</span> {flow.unknown.join("، ")}
        </div>
      )}
      {flow.missing.length > 0 && (
        <div className="mt-2 rounded-panel border border-down/30 bg-down/5 p-2 text-2xs text-down-fg/80">
          <span className="font-semibold text-down-fg">ناقص (مطلوب):</span> {flow.missing.join("، ")}
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

  const decisionTone: Tone =
    evaluation.decision === "VALID"
      ? "good"
      : evaluation.decision === "WAITING" || evaluation.decision === "UNKNOWN"
      ? "warn"
      : "down";

  return (
    <Card
      title="شروط الاستراتيجية — التقييم الحي"
      actions={
        <div className="flex items-center gap-2 text-2xs">
          <span className="rounded-chip border border-line bg-surface-2/60 px-2 py-1">
            {evaluation.completion.toFixed(0)}% مكتمل
          </span>
          <Badge tone={decisionTone}>
            {evaluation.decision} {allUnknown ? "·" : ""}
          </Badge>
        </div>
      }
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2 text-xs">
        <span className="font-semibold text-zinc-100">
          الاستراتيجية: {strategy?.name ?? "غير معروفة"}
        </span>
        <span className="text-2xs text-muted">
          وفق البيانات الحية · آخر تحديث{" "}
          <span dir="ltr">{new Date(updatedAt).toLocaleTimeString("ar", { hour12: false })}</span>
        </span>
      </div>

      {enabledFlows.length === 0 ? (
        <div className="rounded-panel border border-dashed border-line p-6 text-center text-xs text-muted">
          لا توجد تدفقات مفعّلة لهذه الاستراتيجية. فعّل تدفقًا (BUY / SELL / EXIT) في صفحة الإدارة
          لعرض شروطه.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {evaluation.flows.map((flow) => (
            <FlowCard key={flow.type} flow={flow} />
          ))}
        </div>
      )}
    </Card>
  );
}