"use client";

import { useMemo, useState } from "react";
import type { ConditionNode, Strategy, StrategyFlow, StrategyType } from "../types";
import { STRATEGY_TYPES } from "../constants";
import { STRATEGY_TYPE_LABELS, SIGNAL_CATALOG } from "../catalog";
import { CATEGORY_LABELS, CategoryTags } from "./CategoryTags";
import { Card } from "./ui";
import { ConditionNodeEditor } from "./ConditionNodeEditor";

export { CATEGORY_LABELS };

export function StrategyBuilder({
  strategy,
  onUpdate,
  liveSignals,
  initialTab = "BUY",
}: {
  strategy: Strategy;
  onUpdate: (s: Strategy) => void;
  liveSignals: { id: string; status: "true" | "false" | "unknown" }[];
  initialTab?: StrategyType;
}) {
  const [tab, setTab] = useState<StrategyType>(initialTab);

  const activeFlow = useMemo(
    () => strategy.flows.find((f) => f.type === tab) ?? strategy.flows[0],
    [strategy.flows, tab]
  );

  const liveMap = useMemo(() => {
    const m = new Map<string, "true" | "false" | "unknown" | null>();
    for (const l of liveSignals) m.set(l.id, l.status);
    return m;
  }, [liveSignals]);

  // Disabled signals referenced by this flow (for a helpful note).
  const disabledRefs = useMemo(() => {
    const set = new Set<string>();
    const walk = (n: ConditionNode) => {
      if (n.type === "condition") set.add(n.signalId);
      else n.children.forEach(walk);
    };
    walk(activeFlow.root);
    return [...set].filter((id) => liveMap.get(id) == null);
  }, [activeFlow.root, liveMap]);

  return (
    <Card
      title={`Strategy Builder — محرر الاستراتيجية: ${strategy.name}`}
      actions={
        <div className="flex items-center gap-2">
          <input
            value={strategy.name}
            onChange={(e) => onUpdate({ ...strategy, name: e.target.value })}
            className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
            placeholder="اسم الاستراتيجية"
          />
          <label className="flex items-center gap-1.5 text-[11px] text-zinc-400">
            <input
              type="checkbox"
              checked={strategy.enabled}
              onChange={(e) => onUpdate({ ...strategy, enabled: e.target.checked })}
              className="accent-emerald-500"
            />
            تفعيل
          </label>
        </div>
      }
    >
      {/* Flow tabs */}
      <div className="mb-3 flex flex-wrap gap-1">
        {STRATEGY_TYPES.map((t) => {
          const f = strategy.flows.find((x) => x.type === t);
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-md border px-3 py-1.5 text-[12px] font-bold ${
                tab === t
                  ? t === "BUY"
                    ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-200"
                    : t === "SELL"
                    ? "border-red-500/60 bg-red-500/10 text-red-200"
                    : t === "EXIT"
                    ? "border-amber-500/60 bg-amber-500/10 text-amber-200"
                    : "border-zinc-500 bg-zinc-800/60 text-zinc-200"
                  : "border-zinc-700 bg-zinc-800/40 text-zinc-500 hover:border-zinc-500"
              } ${f && !f.enabled ? "opacity-50" : ""}`}
            >
              {STRATEGY_TYPE_LABELS[t]} {f && !f.enabled ? "(مغلق)" : ""}
            </button>
          );
        })}
      </div>

      {/* Flow enable toggle */}
      <div className="mb-3 flex items-center gap-2 text-xs text-zinc-400">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={activeFlow.enabled}
            onChange={(e) =>
              onUpdate(updateFlow(strategy, activeFlow.type, { enabled: e.target.checked }))
            }
            className="accent-emerald-500"
          />
          تفعيل تدفق "{STRATEGY_TYPE_LABELS[activeFlow.type]}"
        </label>
      </div>

      <ConditionNodeEditor
        node={activeFlow.root}
        onChange={(next) => onUpdate(updateFlow(strategy, activeFlow.type, { root: next }))}
      />

      {disabledRefs.length > 0 && (
        <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 text-[11px] text-amber-200/80">
          هذه الشروط في هذا التدفق ترجع إلى إشارات لم تُحسب بعد (سيكون تقييمها UNKNOWN حتى تتوفر
          البيانات): {disabledRefs.join("، ")}
        </div>
      )}

      <div className="mt-4">
        <CategoryTags
          title="إشارات متاحة للبناء"
          entries={SIGNAL_CATALOG.map((s) => ({
            id: s.id,
            name: s.name,
            category: s.category,
            status: liveMap.get(s.id) ?? "unknown",
          }))}
        />
      </div>
    </Card>
  );
}

export function updateFlow(
  strategy: Strategy,
  type: StrategyType,
  patch: Partial<StrategyFlow>
): Strategy {
  return {
    ...strategy,
    flows: strategy.flows.map((f) =>
      f.type === type ? { ...f, ...patch } : f
    ),
  };
}
