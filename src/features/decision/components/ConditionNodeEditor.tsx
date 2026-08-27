"use client";

import type { ConditionEval, ConditionLeaf, ConditionNode, Operator, Signal } from "../types";
import { NUMERIC_OPERATORS, OPERATOR_LABELS, STATE_META } from "../constants";
import { SIGNAL_CATALOG, catalogById } from "../catalog";
import { Segmented, Toggle, FieldSelect, ValueInput } from "./builder-ui";

function makeLeaf(signalId = "trendBullish"): ConditionLeaf {
  const entry = catalogById(signalId);
  const isNum = entry?.kind === "numeric";
  return {
    type: "condition",
    signalId,
    operator: isNum ? (entry?.defaultOperator as Operator) ?? ">" : "IS_TRUE",
    expectedValue: isNum ? entry?.defaultExpected ?? 0 : null,
    required: true,
    enabled: true,
  };
}

function makeGroup(): ConditionNode {
  return { type: "group", logic: "AND", not: false, children: [], required: true, enabled: true };
}

function operatorOptions(signalId: string): Operator[] {
  const entry = catalogById(signalId);
  if (entry?.kind === "numeric") return NUMERIC_OPERATORS;
  return ["IS_TRUE", "IS_FALSE", "IS_UNKNOWN"];
}

/**
 * Recursive Condition Builder — compact rows with nesting.
 * `path` is an array of child indices from the flow root, used to look up the
 * matching live evaluation (for TRUE/FALSE/UNKNOWN + current value) via `evalAt`.
 */
export function ConditionNodeEditor({
  node,
  onChange,
  onRemove,
  onDuplicate,
  path = [],
  evalAt,
  signals,
}: {
  node: ConditionNode;
  onChange: (next: ConditionNode) => void;
  onRemove?: () => void;
  onDuplicate?: () => void;
  path?: number[];
  evalAt?: (path: number[]) => ConditionEval | undefined;
  signals?: Map<string, Signal>;
}) {
  if (node.type === "condition") return <LeafRow node={node} onChange={onChange} onRemove={onRemove} onDuplicate={onDuplicate} path={path} evalAt={evalAt} signals={signals} />;
  return <GroupRow node={node} onChange={onChange} onRemove={onRemove} path={path} evalAt={evalAt} signals={signals} />;
}

// ---------------------------------------------------------------------------

function LeafRow({
  node,
  onChange,
  onRemove,
  onDuplicate,
  path,
  evalAt,
  signals,
}: {
  node: ConditionLeaf;
  onChange: (next: ConditionLeaf) => void;
  onRemove?: () => void;
  onDuplicate?: () => void;
  path: number[];
  evalAt?: (path: number[]) => ConditionEval | undefined;
  signals?: Map<string, Signal>;
}) {
  const entry = catalogById(node.signalId);
  const isNumeric = entry?.kind === "numeric";
  const operators = operatorOptions(node.signalId);
  const ev = evalAt?.(path);
  const live = signals?.get(node.signalId);
  const meta = ev ? STATE_META[ev.result] : undefined;

  const changeSignal = (signalId: string) => {
    const e = catalogById(signalId);
    const num = e?.kind === "numeric";
    onChange({
      ...node,
      signalId,
      operator: (num ? e?.defaultOperator ?? ">" : "IS_TRUE") as Operator,
      expectedValue: num ? e?.defaultExpected ?? 0 : null,
    });
  };

  // Current display value (live), or the raw numeric when no live eval.
  const currentValue = ev?.current ?? (live?.value ?? null);

  return (
    <div
      className={`group rounded-lg border transition-colors ${
        node.enabled ? "border-zinc-800 bg-zinc-950/40 hover:border-zinc-700" : "border-zinc-800/60 bg-zinc-950/20 opacity-60"
      }`}
    >
      {/* Primary row: signal · operator · value */}
      <div className="flex flex-wrap items-center gap-1.5 px-2 py-1.5">
        <span
          className="h-5 w-1 shrink-0 rounded-full"
          style={{ background: !node.required ? "#3b82f6" : "#71717a" }}
          title={node.required ? "مطلوب" : "اختياري"}
        />

        <FieldSelect value={node.signalId} onChange={changeSignal} className="min-w-[190px] flex-1">
          {SIGNAL_CATALOG.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </FieldSelect>

        <FieldSelect
          value={node.operator}
          onChange={(v) =>
            onChange({
              ...node,
              operator: v as Operator,
              expectedValue: NUMERIC_OPERATORS.includes(v as Operator) ? node.expectedValue ?? 0 : null,
            })
          }
          className="w-[132px]"
        >
          {operators.map((op) => (
            <option key={op} value={op}>
              {OPERATOR_LABELS[op]}
            </option>
          ))}
        </FieldSelect>

        {isNumeric ? (
          <ValueInput
            value={node.expectedValue}
            unit={entry?.unit}
            hint={entry?.hint}
            onCommit={(v) => onChange({ ...node, expectedValue: v })}
          />
        ) : (
          <span className="hidden w-24 sm:inline" />
        )}

        {/* Enable toggle */}
        <Toggle
          checked={node.enabled}
          onChange={(v) => onChange({ ...node, enabled: v })}
        />
      </div>

      {/* Secondary row: required · live status/current */}
      <div className="flex flex-wrap items-center gap-2 border-t border-zinc-800/60 px-2 py-1">
        <Segmented
          value={node.required ? "req" : "opt"}
          size="xs"
          onChange={(v) => onChange({ ...node, required: v === "req" })}
          options={[
            { value: "req", label: "مطلوب" },
            { value: "opt", label: "اختياري" },
          ]}
        />

        {meta && (
          <span
            className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-bold ${meta.bg} ${meta.color}`}
            title={ev?.reason}
          >
            {meta.icon} {meta.label}
          </span>
        )}

        {ev && (
          <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500" title={ev.reason}>
            <span className="text-zinc-400">الآن:</span>
            <span className="font-mono text-zinc-300" dir="ltr">
              {currentValue}
            </span>
            <span className="text-zinc-600">|</span>
            <span className="font-mono text-zinc-500" dir="ltr">
              المطلوب: {ev.expected || "—"}
            </span>
          </span>
        )}

        <div className="ms-auto flex items-center gap-0.5">
          {onDuplicate && (
            <button
              type="button"
              onClick={onDuplicate}
              title="نسخ الشرط"
              className="rounded p-1 text-[12px] text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
            >
              ◈
            </button>
          )}
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              title="حذف الشرط"
              className="rounded p-1 text-[12px] text-zinc-500 hover:bg-red-500/10 hover:text-red-400"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {!node.enabled && (
        <div className="px-2 pb-1 text-[10px] text-zinc-500">هذا الشرط معطّل ولن يُؤخذ في التقييم.</div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function GroupRow({
  node,
  onChange,
  onRemove,
  path,
  evalAt,
  signals,
}: {
  node: Extract<ConditionNode, { type: "group" }>;
  onChange: (next: ConditionNode) => void;
  onRemove?: () => void;
  path: number[];
  evalAt?: (path: number[]) => ConditionEval | undefined;
  signals?: Map<string, Signal>;
}) {
  const ev = evalAt?.(path);

  const addChild = (child: ConditionNode) =>
    onChange({ ...node, children: [...node.children, child] });
  const updateChild = (i: number, next: ConditionNode) =>
    onChange({ ...node, children: node.children.map((c, idx) => (idx === i ? next : c)) });
  const removeChild = (i: number) =>
    onChange({ ...node, children: node.children.filter((_, idx) => idx !== i) });
  const duplicateChild = (i: number) => {
    const src = node.children[i];
    onChange({
      ...node,
      children: [...node.children.slice(0, i + 1), clone(src), ...node.children.slice(i + 1)],
    });
  };

  return (
    <div className={`rounded-lg border ${node.enabled ? "border-zinc-700" : "border-zinc-800/60 opacity-60"}`}>
      {/* Group header bar */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-t-lg border-b border-zinc-800 bg-zinc-900/60 px-2 py-1.5">
        <Segmented
          value={node.logic}
          size="xs"
          onChange={(v) => onChange({ ...node, logic: v })}
          options={[
            { value: "AND", label: "AND الكل", activeClass: "bg-indigo-500/20 text-indigo-200" },
            { value: "OR", label: "OR أيّ", activeClass: "bg-fuchsia-500/20 text-fuchsia-200" },
          ]}
        />
        <Toggle checked={node.not} onChange={(v) => onChange({ ...node, not: v })} label={node.not ? "NOT" : "بدون NOT"} />

        <span className="mx-1 h-4 w-px bg-zinc-700/70" />

        <button
          type="button"
          onClick={() => addChild(makeLeaf())}
          className="rounded border border-zinc-700 bg-zinc-800/50 px-1.5 py-0.5 text-[11px] font-semibold text-zinc-200 hover:border-zinc-500"
        >
          + شرط
        </button>
        <button
          type="button"
          onClick={() => addChild(makeGroup())}
          className="rounded border border-zinc-700 bg-zinc-800/50 px-1.5 py-0.5 text-[11px] font-semibold text-zinc-200 hover:border-zinc-500"
        >
          + مجموعة
        </button>

        <div className="ms-auto flex items-center gap-0.5">
          {ev && (
            <span
              className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-bold ${STATE_META[ev.result].bg} ${STATE_META[ev.result].color}`}
              title={ev.reason}
            >
              {ev.result.toUpperCase()}
            </span>
          )}
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              title="حذف المجموعة"
              className="rounded p-1 text-[12px] text-zinc-500 hover:bg-red-500/10 hover:text-red-400"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Children */}
      <div
        className="space-y-1.5 p-1.5"
        style={{ marginInlineStart: path.length > 0 ? Math.min(path.length * 10, 30) : 0 }}
      >
        {node.children.length === 0 && (
          <div className="rounded-md border border-dashed border-zinc-700 px-3 py-2 text-center text-[11px] text-zinc-500">
            مجموعة فارغة — تُعتبر متحققة (TRUE). أضف شروطًا أو مجموعات فرعية.
          </div>
        )}
        {node.children.map((child, i) => (
          <ConditionNodeEditor
            key={i}
            node={child}
            path={[...path, i]}
            evalAt={evalAt}
            signals={signals}
            onChange={(next) => updateChild(i, next)}
            onRemove={() => removeChild(i)}
            onDuplicate={() => duplicateChild(i)}
          />
        ))}
      </div>
    </div>
  );
}

function clone(n: ConditionNode): ConditionNode {
  return JSON.parse(JSON.stringify(n)) as ConditionNode;
}
