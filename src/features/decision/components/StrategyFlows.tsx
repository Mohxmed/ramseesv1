"use client";

import type { ConditionEval, FlowEvaluation, StrategyEvaluation, StrategyType } from "../types";
import { STATE_META } from "../constants";
import { STRATEGY_TYPE_LABELS } from "../catalog";
import { CatalogEntry, catalogById } from "../catalog";
import { Card } from "./ui";

const FLOW_COLOR: Record<StrategyType, string> = {
  BUY: "text-emerald-300 border-emerald-500/50 bg-emerald-500/10",
  SELL: "text-red-300 border-red-500/50 bg-red-500/10",
  EXIT: "text-amber-300 border-amber-500/50 bg-amber-500/10",
  WAIT: "text-zinc-300 border-zinc-600 bg-zinc-700/20",
};

function barColor(flow: FlowEvaluation) {
  if (flow.result === "true") return "bg-emerald-500";
  if (flow.result === "unknown") return "bg-zinc-500";
  if (!flow.enabled) return "bg-zinc-700";
  return "bg-red-500/70";
}

function NodeView({ ev, depth }: { ev: ConditionEval; depth?: number }) {
  const node = ev.node;
  const meta = STATE_META[ev.result];
  const entry: CatalogEntry | undefined = node.type === "condition" ? catalogById(node.signalId) : undefined;
  const style = { marginInlineStart: depth ? depth * 14 : 0 };

  return (
    <div style={style} className="mt-1">
      <div
        className={`flex items-start justify-between gap-2 rounded-lg border p-2 ${
          ev.result === "true"
            ? "border-emerald-500/30 bg-emerald-500/5"
            : ev.result === "false"
            ? "border-red-500/30 bg-red-500/5"
            : "border-zinc-700/60 bg-zinc-800/20"
        }`}
      >
        <div className="min-w-0 flex-1">
          {node.type === "condition" ? (
            <div className="text-[12px] font-semibold text-zinc-100">
              {entry?.name ?? node.signalId}
            </div>
          ) : (
            <div className="text-[12px] font-bold">
              <span className={node.logic === "AND" ? "text-indigo-300" : "text-fuchsia-300"}>
                {node.logic}
              </span>
              {node.not && <span className="text-amber-300"> + NOT</span>}
            </div>
          )}
          <div className="mt-0.5 text-[11px] text-zinc-500" dir="ltr">
            {ev.current} {node.type === "condition" ? `— ${ev.expected}` : ""}
          </div>
          <div className="mt-1 text-[11px] leading-snug text-zinc-500">{ev.reason}</div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-bold ${meta.color} ${meta.bg}`}>
            {meta.label}
          </span>
          {ev.required ? (
            <span className="text-[9px] font-semibold text-blue-400">Required</span>
          ) : (
            <span className="text-[9px] text-zinc-500">Optional</span>
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
      <Card title="Strategy Flows — نتائج التدفقات">
        <div className="rounded-xl border border-dashed border-zinc-700 p-6 text-center text-xs text-zinc-500">
          لا توجد استراتيجية نشطة للتقيم.
        </div>
      </Card>
    );
  }

  const { flows } = evaluation;
  const active = flows.filter((f) => f.enabled);
  const waiting = active.some((f) => f.result === "unknown");
  const anyValid = active.some((f) => f.result === "true");

  return (
    <Card
      title="Strategy Flows — نتائج التدفقات"
      actions={
        <div className="flex items-center gap-2 text-[11px]">
          <span className="rounded-md border border-zinc-700 bg-zinc-800/60 px-2 py-1 font-semibold">
            Completion: {evaluation.completion.toFixed(0)}%
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
            {evaluation.decision} {anyValid ? "✓" : waiting ? "·" : ""}
          </span>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {flows.map((f) => {
          const tabLabel = STRATEGY_TYPE_LABELS[f.type];
          return (
            <div
              key={f.type}
              className={`rounded-xl border p-3 ${!f.enabled ? "border-zinc-800/60 opacity-60" : "border-zinc-800"}`}
            >
              <div className="flex items-center justify-between">
                <span className={`rounded-md border px-2 py-0.5 text-[11px] font-bold ${FLOW_COLOR[f.type]}`} dir="ltr">
                  {f.type} · {tabLabel}
                </span>
                <span className="text-[10px] text-zinc-500">
                  {f.enabled ? "مفعّل" : "مغلق"} · مطلوب {f.satisfiedRequired}/{f.totalRequired}
                </span>
              </div>

              {/* Completion bar */}
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                <div
                  className={`h-full rounded-full ${barColor(f)} transition-all duration-500`}
                  style={{ width: `${f.completion}%` }}
                />
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-zinc-500">
                <span>Completion {f.completion.toFixed(0)}%</span>
                <span>
                  Optional {f.satisfiedOptional}/{f.totalOptional}
                </span>
              </div>

              {/* Condition tree */}
              <div className="mt-2">
                <NodeView ev={f.tree} />
              </div>

              {/* Unknown / missing */}
              {f.unknown.length > 0 && (
                <div className="mt-2 rounded-lg border border-zinc-700/50 bg-zinc-800/20 p-2 text-[10px] text-zinc-400">
                  <span className="font-semibold text-zinc-300">UNKNOWN:</span> {f.unknown.join("، ")}
                </div>
              )}
              {f.missing.length > 0 && (
                <div className="mt-2 rounded-lg border border-red-500/30 bg-red-500/5 p-2 text-[10px] text-red-200/80">
                  <span className="font-semibold text-red-300">ناقص (مطلوب):</span> {f.missing.join("، ")}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
