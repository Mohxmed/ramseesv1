"use client";

import type { ConditionNode, Operator } from "../types";
import { NUMERIC_OPERATORS, OPERATOR_LABELS } from "../constants";
import { SIGNAL_CATALOG, catalogById } from "../catalog";

function operatorListFor(kind: "numeric" | "boolean"): Operator[] {
  return kind === "numeric" ? NUMERIC_OPERATORS : ["IS_TRUE", "IS_FALSE", "IS_UNKNOWN"];
}

/**
 * Recursive Condition Builder node editor. Supports leaves and AND/OR groups
 * with NOT, per-node Required/Optional and Enabled switches, and arbitrary
 * nesting via "Add Condition" / "Add Group".
 */
export function ConditionNodeEditor({
  node,
  onChange,
  onRemove,
  depth = 0,
}: {
  node: ConditionNode;
  onChange: (next: ConditionNode) => void;
  onRemove?: () => void;
  depth?: number;
}) {
  if (node.type === "condition") {
    const entry = catalogById(node.signalId);
    const kind = entry?.kind ?? "boolean";
    const operators = operatorListFor(kind);
    const isNumeric = NUMERIC_OPERATORS.includes(node.operator);

    return (
      <div
        className={`rounded-xl border ${node.enabled ? "border-zinc-700 bg-zinc-950/40" : "border-zinc-800/50 bg-zinc-950/20 opacity-60"} p-2.5`}
        style={{ marginInlineStart: depth > 0 ? depth * 14 : 0 }}
      >
        <div className="flex flex-wrap items-center gap-2">
          {/* Signal selector */}
          <select
            value={node.signalId}
            onChange={(e) => {
              const entry = catalogById(e.target.value);
              const isNum = entry?.kind === "numeric";
              const op: Operator = isNum ? ">" : "IS_TRUE";
              onChange({
                ...node,
                signalId: e.target.value,
                operator: op,
                expectedValue: isNum ? entry?.defaultExpected ?? 0 : null,
              });
            }}
            className="min-w-[200px] flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-[12px] text-zinc-100"
          >
            {SIGNAL_CATALOG.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          {/* Operator */}
          <select
            value={node.operator}
            onChange={(e) =>
              onChange({
                ...node,
                operator: e.target.value as Operator,
                expectedValue: NUMERIC_OPERATORS.includes(e.target.value as Operator)
                  ? node.expectedValue ?? 0
                  : null,
              })
            }
            className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-[12px] text-zinc-100"
          >
            {operators.map((op) => (
              <option key={op} value={op}>
                {OPERATOR_LABELS[op]}
              </option>
            ))}
          </select>

          {/* Expected value (numeric only) */}
          {isNumeric ? (
            <input
              type="number"
              step="any"
              dir="ltr"
              value={node.expectedValue ?? ""}
              onChange={(e) =>
                onChange({ ...node, expectedValue: parseFloat(e.target.value) })
              }
              placeholder="الحد"
              className="w-24 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-right text-[12px] text-zinc-100"
            />
          ) : null}

          {/* Required toggle */}
          <button
            type="button"
            onClick={() => onChange({ ...node, required: !node.required })}
            title="مطلوب / اختياري"
            className={`rounded-md border px-2 py-1.5 text-[11px] font-bold ${
              node.required
                ? "border-blue-500/50 bg-blue-500/10 text-blue-300"
                : "border-zinc-700 bg-zinc-800/40 text-zinc-400"
            }`}
          >
            {node.required ? "Required" : "Optional"}
          </button>

          {/* Enabled toggle */}
          <button
            type="button"
            onClick={() => onChange({ ...node, enabled: !node.enabled })}
            title="تفعيل / تعطيل"
            className={`rounded-md border px-2 py-1.5 text-[11px] font-bold ${
              node.enabled
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                : "border-zinc-700 bg-zinc-800/40 text-zinc-500"
            }`}
          >
            {node.enabled ? "ON" : "OFF"}
          </button>

          {onRemove ? (
            <button
              type="button"
              onClick={onRemove}
              className="rounded-md border border-zinc-700 bg-zinc-800/40 px-2 py-1.5 text-[11px] font-bold text-red-400 hover:border-red-500/40"
            >
              ✕
            </button>
          ) : null}
        </div>

        {!node.enabled && (
          <div className="mt-1.5 text-[10px] text-zinc-500">هذا الشرط معطّل ولن يُؤخذ في التقييم.</div>
        )}
      </div>
    );
  }

  // ---------------- Group ----------------
  return (
    <div
      className={`rounded-xl border-2 ${node.logic === "AND" ? "border-zinc-700" : "border-zinc-700"} bg-zinc-900/30 p-2.5`}
      style={{ marginInlineStart: depth > 0 ? depth * 14 : 0 }}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-[10px] uppercase tracking-wide text-zinc-500">Group</span>

        <button
          type="button"
          onClick={() => onChange({ ...node, logic: node.logic === "AND" ? "OR" : "AND" })}
          className={`rounded-md border px-2 py-1 text-[11px] font-bold ${
            node.logic === "AND"
              ? "border-indigo-500/50 bg-indigo-500/10 text-indigo-200"
              : "border-fuchsia-500/50 bg-fuchsia-500/10 text-fuchsia-200"
          }`}
        >
          {node.logic === "AND" ? "AND (الكل)" : "OR (أي واحد)"}
        </button>

        <button
          type="button"
          onClick={() => onChange({ ...node, not: !node.not })}
          className={`rounded-md border px-2 py-1 text-[11px] font-bold ${
            node.not
              ? "border-amber-500/50 bg-amber-500/10 text-amber-200"
              : "border-zinc-700 bg-zinc-800/40 text-zinc-400"
          }`}
        >
          {node.not ? "NOT (معكوس)" : "بدون NOT"}
        </button>

        <button
          type="button"
          onClick={() => onChange({ ...node, required: !node.required })}
          className={`rounded-md border px-2 py-1 text-[11px] font-bold ${
            node.required
              ? "border-blue-500/50 bg-blue-500/10 text-blue-300"
              : "border-zinc-700 bg-zinc-800/40 text-zinc-400"
          }`}
        >
          {node.required ? "Required" : "Optional"}
        </button>

        {/* Add controls */}
        <button
          type="button"
          onClick={() =>
            onChange({
              ...node,
              children: [
                ...node.children,
                {
                  type: "condition",
                  signalId: "trendBullish",
                  operator: "IS_TRUE",
                  expectedValue: null,
                  required: true,
                  enabled: true,
                },
              ],
            })
          }
          className="rounded-md border border-zinc-600 bg-zinc-800/60 px-2 py-1 text-[11px] font-semibold text-zinc-200 hover:border-zinc-400"
        >
          + Condition
        </button>
        <button
          type="button"
          onClick={() =>
            onChange({
              ...node,
              children: [
                ...node.children,
                {
                  type: "group",
                  logic: "AND",
                  not: false,
                  required: true,
                  enabled: true,
                  children: [],
                },
              ],
            })
          }
          className="rounded-md border border-zinc-600 bg-zinc-800/60 px-2 py-1 text-[11px] font-semibold text-zinc-200 hover:border-zinc-400"
        >
          + Group
        </button>

        {onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="rounded-md border border-zinc-700 bg-zinc-800/40 px-2 py-1 text-[11px] font-bold text-red-400 hover:border-red-500/40"
          >
            ✕ Group
          </button>
        ) : null}
      </div>

      <div className="space-y-2">
        {node.children.length === 0 && (
          <div className="rounded-lg border border-dashed border-zinc-700 p-3 text-center text-[11px] text-zinc-500">
            مجموعة فارغة — تُعتبر متحققة (TRUE). أضف شروطًا أو مجموعات فرعية.
          </div>
        )}
        {/* children */}
        {node.children.map((child, i) => (
          <ConditionNodeEditor
            key={i}
            node={child}
            depth={depth + 1}
            onRemove={() =>
              onChange({
                ...node,
                children: node.children.filter((_, idx) => idx !== i),
              })
            }
            onChange={(next) =>
              onChange({
                ...node,
                children: node.children.map((c, idx) => (idx === i ? next : c)),
              })
            }
          />
        ))}
      </div>
    </div>
  );
}
