"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  ConditionEval,
  ConditionNode,
  Signal,
  Strategy,
  StrategyEvaluation,
  StrategyFlow,
  StrategyType,
} from "../types";
import { STRATEGY_TYPES } from "../constants";
import { STRATEGY_TYPE_LABELS, SIGNAL_CATALOG, catalogById } from "../catalog";
import { CATEGORY_LABELS, CategoryTags } from "./CategoryTags";
import { Card } from "./ui";
import { ConditionNodeEditor } from "./ConditionNodeEditor";
import { defaultFlowNode } from "../templates";

export { CATEGORY_LABELS };

const FLOW_TAB_CLASS: Record<StrategyType, string> = {
  BUY: "border-emerald-500/60 bg-emerald-500/10 text-emerald-200",
  SELL: "border-red-500/60 bg-red-500/10 text-red-200",
  EXIT: "border-amber-500/60 bg-amber-500/10 text-amber-200",
  WAIT: "border-zinc-500 bg-zinc-800/60 text-zinc-200",
};

export function StrategyBuilder({
  strategy,
  onUpdate,
  liveSignals = [],
  initialTab = "BUY",
  evaluation = null,
}: {
  strategy: Strategy;
  onUpdate: (s: Strategy) => void;
  liveSignals: { id: string; status: "true" | "false" | "unknown" }[];
  initialTab?: StrategyType;
  evaluation?: StrategyEvaluation | null;
}) {
  const [tab, setTab] = useState<StrategyType>(initialTab);
  const [draft, setDraft] = useState<Strategy>(strategy);
  const [savedFlash, setSavedFlash] = useState(false);

  // Refresh the draft whenever the persisted strategy changes externally.
  useEffect(() => {
    setDraft(strategy);
  }, [strategy]);

  const activeIndex = Math.max(
    0,
    STRATEGY_TYPES.findIndex((t) => t === tab)
  );
  const activeFlow = useMemo(
    () => draft.flows.find((f) => f.type === tab) ?? draft.flows[0],
    [draft.flows, tab]
  );

  const signalsById = useMemo(() => {
    const m = new Map<string, Signal>();
    for (const l of liveSignals) {
      const entry = catalogById(l.id);
      if (!entry) continue;
      m.set(l.id, {
        id: l.id,
        name: entry.name,
        category: entry.category,
        kind: entry.kind,
        status: l.status,
        value: l.status === "unknown" ? "—" : l.status === "true" ? "TRUE" : "FALSE",
        valueNumber: null,
        threshold: "—",
        reason: "",
        source: "",
        updatedAt: 0,
      });
    }
    return m;
  }, [liveSignals]);

  // Live eval lookup: current flow's evaluation tree, indexed by path.
  const flowEval = useMemo(
    () => evaluation?.flows.find((f) => f.type === tab) ?? null,
    [evaluation, tab]
  );
  const makeEvalAt = useMemo(() => {
    return (path: number[]): ConditionEval | undefined =>
      flowEval ? findAt(flowEval.tree, path) : undefined;
  }, [flowEval]);

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(strategy), [draft, strategy]);

  const setName = (name: string) => setDraft((d) => ({ ...d, name }));
  const setEnabled = (enabled: boolean) => setDraft((d) => ({ ...d, enabled }));

  const save = () => {
    onUpdate({ ...draft, updatedAt: Date.now() });
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1500);
  };
  const cancel = () => setDraft(strategy);
  const resetFlow = () => {
    // Reset only the active flow to its default condition tree.
    const root = defaultFlowNode(tab);
    setDraft((d) => ({
      ...d,
      flows: d.flows.map((f) => (f.type === tab ? { ...f, root } : f)),
    }));
  };

  // Disabled signal refs for a helpful note.
  const disabledRefs = useMemo(() => {
    const set = new Set<string>();
    const walk = (n: ConditionNode) => {
      if (n.type === "condition") set.add(n.signalId);
      else n.children.forEach(walk);
    };
    walk(activeFlow.root);
    return [...set].filter((id) => !signalsById.has(id));
  }, [activeFlow.root, signalsById]);

  const summary = flowEval
    ? {
        required: `${flowEval.satisfiedRequired}/${flowEval.totalRequired}`,
        optional: `${flowEval.satisfiedOptional}/${flowEval.totalOptional}`,
        unknown: flowEval.unknown.length,
        result: flowEval.result,
      }
    : null;

  return (
    <Card
      title="محرر الاستراتيجية"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {dirty && (
            <span className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
              لم يتم الحفظ
            </span>
          )}
          {savedFlash && (
            <span className="rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
              ✓ تم الحفظ
            </span>
          )}
          <button
            type="button"
            onClick={cancel}
            disabled={!dirty}
            className="rounded-md border border-zinc-700 bg-zinc-800/60 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!dirty}
            className="rounded-md bg-emerald-500/80 px-3 py-1.5 text-xs font-bold text-zinc-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            حفظ
          </button>
        </div>
      }
    >
      {/* Strategy header: name + global enabled */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <input
          value={draft.name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm text-zinc-100 focus:border-emerald-500/60 focus:outline-none"
          placeholder="اسم الاستراتيجية"
        />
        <label className="flex items-center gap-1.5 text-[11px] text-zinc-400">
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="accent-emerald-500"
          />
          تفعيل الاستراتيجية
        </label>
      </div>

      {/* Flow tabs */}
      <div className="mb-3 flex flex-wrap gap-1">
        {STRATEGY_TYPES.map((t) => {
          const f = draft.flows.find((x) => x.type === t);
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-md border px-3 py-1.5 text-[12px] font-bold transition-colors ${
                tab === t
                  ? FLOW_TAB_CLASS[t]
                  : "border-zinc-700 bg-zinc-800/40 text-zinc-500 hover:border-zinc-500"
              } ${f && !f.enabled ? "opacity-50" : ""}`}
            >
              {STRATEGY_TYPE_LABELS[t]} {f && !f.enabled ? "(مغلق)" : ""}
            </button>
          );
        })}
        <span className="ms-auto text-[11px] text-zinc-500">
          تدفق: {STRATEGY_TYPE_LABELS[tab]}
        </span>
      </div>

      {/* Condition tree */}
      <ConditionNodeEditor
        node={activeFlow.root}
        path={[]}
        evalAt={makeEvalAt}
        signals={signalsById}
        onChange={(next) => setDraft((d) => ({
          ...d,
          flows: d.flows.map((f) => (f.type === tab ? { ...f, root: next } : f)),
        }))}
      />

      {disabledRefs.length > 0 && (
        <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 text-[11px] text-amber-200/80">
          هذه الشروط في هذا التدفق ترجع إلى إشارات لم تُحسب بعد (ستكون UNKNOWN حتى تتوفر البيانات):
          {disabledRefs.join("، ")}
        </div>
      )}

      {/* Sticky action bar + live summary */}
      <div className="sticky bottom-3 z-10 mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-800 bg-zinc-900/90 p-2.5 backdrop-blur">
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-zinc-400">
          {summary ? (
            <>
              <span>
                مطلوب <b className="font-mono text-zinc-200">{summary.required}</b>
              </span>
              <span>
                اختياري <b className="font-mono text-zinc-200">{summary.optional}</b>
              </span>
              <span>
                غير مؤكد <b className="font-mono text-zinc-200">{summary.unknown}</b>
              </span>
            </>
          ) : (
            <span className="text-zinc-500">لا يوجد تقييم مباشر — أنشئ/احفظ ثم قيّم في مركز القرارات.</span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={resetFlow}
            className="rounded-md border border-zinc-700 bg-zinc-800/60 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:border-red-500/40"
          >
            إعادة تعيين التدفق
          </button>
          <button
            type="button"
            onClick={cancel}
            disabled={!dirty}
            className="rounded-md border border-zinc-700 bg-zinc-800/60 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:border-zinc-500 disabled:opacity-50"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!dirty}
            className="rounded-md bg-emerald-500/80 px-4 py-1.5 text-xs font-bold text-zinc-950 hover:bg-emerald-400 disabled:opacity-40"
          >
            حفظ
          </button>
        </div>
      </div>

      {/* Available signals reference */}
      <div className="mt-4">
        <CategoryTags
          title="إشارات متاحة للبناء"
          entries={SIGNAL_CATALOG.map((s) => ({
            id: s.id,
            name: s.name,
            category: s.category,
            status: signalsById.get(s.id)?.status ?? "unknown",
          }))}
        />
      </div>
    </Card>
  );
}

function findAt(ev: ConditionEval, path: number[]): ConditionEval | undefined {
  if (path.length === 0) return ev;
  if (!ev.children) return undefined;
  const [i, ...rest] = path;
  const child = ev.children[i];
  if (!child) return undefined;
  return findAt(child, rest);
}

export function updateFlow(
  strategy: Strategy,
  type: StrategyType,
  patch: Partial<StrategyFlow>
): Strategy {
  return {
    ...strategy,
    flows: strategy.flows.map((f) => (f.type === type ? { ...f, ...patch } : f)),
  };
}
