"use client";

import type { ConditionEval, FlowEvaluation, StrategyEvaluation, StrategyType } from "../types";
import { STATE_META } from "../constants";
import { STRATEGY_TYPE_LABELS } from "../catalog";
import { CatalogEntry, catalogById } from "../catalog";
import { Card, Progress, Badge, type Tone } from "@/components/ui/index";

const FLOW_COLOR: Record<StrategyType, string> = {
  BUY: "border-up/40 bg-up/10 text-up-fg",
  SELL: "border-down/40 bg-down/10 text-down-fg",
  EXIT: "border-warn/40 bg-warn/10 text-warn-fg",
  WAIT: "border-line bg-surface-2/40 text-zinc-300",
};

function barTone(flow: FlowEvaluation): Tone {
  if (flow.result === "true") return "up";
  if (flow.result === "unknown") return "neutral";
  if (!flow.enabled) return "quiet";
  return "down";
}

function NodeView({ ev, depth }: { ev: ConditionEval; depth?: number }) {
  const node = ev.node;
  const meta = STATE_META[ev.result];
  const entry: CatalogEntry | undefined = node.type === "condition" ? catalogById(node.signalId) : undefined;
  const style = { marginInlineStart: depth ? depth * 14 : 0 };

  return (
    <div style={style} className="mt-1">
      <div
        className={`flex items-start justify-between gap-2 rounded-panel border p-2 ${
          ev.result === "true"
            ? "border-up/30 bg-up/5"
            : ev.result === "false"
            ? "border-down/30 bg-down/5"
            : "border-line bg-surface-2/30"
        }`}
      >
        <div className="min-w-0 flex-1">
          {node.type === "condition" ? (
            <div className="text-xs font-semibold text-zinc-100">
              {entry?.name ?? node.signalId}
            </div>
          ) : (
            <div className="text-xs font-bold">
              <span className={node.logic === "AND" ? "text-indigo-300" : "text-fuchsia-300"}>
                {node.logic}
              </span>
              {node.not && <span className="text-warn-fg"> + NOT</span>}
            </div>
          )}
          <div className="mt-0.5 text-2xs text-muted" dir="ltr">
            {ev.current} {node.type === "condition" ? `— ${ev.expected}` : ""}
          </div>
          <div className="mt-1 text-2xs leading-snug text-muted">{ev.reason}</div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-bold ${meta.color} ${meta.bg}`}>
            {meta.label}
          </span>
          {ev.required ? (
            <span className="text-3xs font-semibold text-blue-400">مطلوب</span>
          ) : (
            <span className="text-3xs text-muted">اختياري</span>
          )}
        </div>
      </div>
      {ev.children?.map((c, i) => <NodeView key={i} ev={c} depth={(depth ?? 0) + 1} />)}
    </div>
  );
}

export function StrategyFlows({ evaluation }: { evaluation: StrategyEvaluation | null }) {
  if (!evaluation) {
    return (
      <Card title="نتائج التدفقات">
        <div className="rounded-panel border border-dashed border-line p-6 text-center text-xs text-muted">
          لا توجد استراتيجية نشطة للتقيم.
        </div>
      </Card>
    );
  }

  const { flows } = evaluation;
  const active = flows.filter((f) => f.enabled);
  const waiting = active.some((f) => f.result === "unknown");
  const anyValid = active.some((f) => f.result === "true");

  const decisionTone: Tone =
    evaluation.decision === "VALID"
      ? "good"
      : evaluation.decision === "WAITING" || evaluation.decision === "UNKNOWN"
      ? "warn"
      : "down";

  return (
    <Card
      title="نتائج التدفقات"
      actions={
        <div className="flex items-center gap-2 text-2xs">
          <span className="rounded-chip border border-line bg-surface-2/60 px-2 py-1 font-semibold">
            الإكمال: {evaluation.completion.toFixed(0)}%
          </span>
          <Badge tone={decisionTone}>
            {evaluation.decision} {anyValid ? "✓" : waiting ? "·" : ""}
          </Badge>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {flows.map((f) => {
          const tabLabel = STRATEGY_TYPE_LABELS[f.type];
          return (
            <div
              key={f.type}
              className={`rounded-panel border border-line p-3 ${!f.enabled ? "opacity-60" : ""}`}
            >
              <div className="flex items-center justify-between">
                <span className={`rounded-md border px-2 py-0.5 text-2xs font-bold ${FLOW_COLOR[f.type]}`} dir="ltr">
                  {f.type} · {tabLabel}
                </span>
                <span className="text-2xs text-muted">
                  {f.enabled ? "مفعّل" : "مغلق"} · مطلوب {f.satisfiedRequired}/{f.totalRequired}
                </span>
              </div>

              {/* Completion bar */}
              <Progress pct={f.completion} tone={barTone(f)} className="mt-2" />
              <div className="mt-1 flex justify-between text-2xs text-muted">
                <span>الإكمال {f.completion.toFixed(0)}%</span>
                <span>
                  الاختياري {f.satisfiedOptional}/{f.totalOptional}
                </span>
              </div>

              {/* Condition tree */}
              <div className="mt-2">
                <NodeView ev={f.tree} />
              </div>

              {/* Unknown / missing */}
              {f.unknown.length > 0 && (
                <div className="mt-2 rounded-panel border border-line bg-surface-2/30 p-2 text-2xs text-muted">
                  <span className="font-semibold text-zinc-300">غير مؤكد (UNKNOWN):</span> {f.unknown.join("، ")}
                </div>
              )}
              {f.missing.length > 0 && (
                <div className="mt-2 rounded-panel border border-down/30 bg-down/5 p-2 text-2xs text-down-fg/80">
                  <span className="font-semibold text-down-fg">ناقص (مطلوب):</span> {f.missing.join("، ")}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}