"use client";

import { useCallback, useState } from "react";
import type { StrategyType } from "./types";
import { useStrategies, type PersistStatus } from "./hooks/useStrategies";
import { StrategyList } from "./components/StrategyList";
import { StrategyBuilder } from "./components/StrategyBuilder";
import { CreateStrategyModal } from "./components/CreateStrategyModal";

const STATUS_META: Record<PersistStatus, { label: string; className: string }> = {
  loading: { label: "جارٍ التحميل…", className: "border-zinc-700 bg-zinc-800/60 text-zinc-400" },
  saving: { label: "جارٍ الحفظ…", className: "border-amber-500/40 bg-amber-500/10 text-amber-300" },
  saved: { label: "محفوظ في السحابة", className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" },
  error: { label: "تعذّر الحفظ — مخزّن محليًا", className: "border-red-500/40 bg-red-500/10 text-red-300" },
  local: { label: "مخزّن محليًا فقط", className: "border-zinc-700 bg-zinc-800/60 text-zinc-400" },
};

export function StrategiesPage() {
  const persisted = useStrategies();
  const { strategies, activeStrategy, status } = persisted;
  const [showCreate, setShowCreate] = useState(false);
  const [focus, setFocus] = useState<{ target: StrategyType; nonce: number }>({
    target: "BUY",
    nonce: 0,
  });

  const openCreate = useCallback(() => setShowCreate(true), []);
  const closeCreate = useCallback(() => setShowCreate(false), []);

  const onCreate = useCallback(
    (opts: { name: string; templateId?: string; enabled: boolean }) => {
      persisted.createStrategy(opts);
      setFocus((f) => ({ target: "BUY", nonce: f.nonce + 1 }));
      setShowCreate(false);
    },
    [persisted]
  );

  const meta = STATUS_META[status];
  const enabledCount = strategies.filter((s) => s.enabled).length;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800/60 text-xl">
              🧩
            </div>
            <div>
              <h1 className="text-lg font-bold text-zinc-50">إدارة الاستراتيجيات</h1>
              <p className="text-[11px] text-zinc-500">
                أنشئ استراتيجياتك وعدّلها وخزّنها في السحابة، ثم قيّمها في مركز القرارات.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="rounded-md border border-zinc-700 bg-zinc-800/60 px-2 py-1">
              {strategies.length} استراتيجية · {enabledCount} مفعّلة
            </span>
            <span className={`inline-flex items-center rounded-md border px-2 py-1 font-semibold ${meta.className}`}>
              {meta.label}
            </span>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-1 rounded-md bg-emerald-500/80 px-3 py-1.5 text-xs font-bold text-zinc-950 hover:bg-emerald-400"
            >
              + إنشاء استراتيجية
            </button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4">
          <StrategyList
            strategies={strategies}
            activeId={persisted.activeId}
            onSelect={persisted.setActive}
            onDuplicate={persisted.duplicateStrategy}
            onDelete={persisted.deleteStrategy}
            onToggle={persisted.toggleEnabled}
            onCreate={openCreate}
          />
        </div>

        <div className="lg:col-span-2">
          {activeStrategy ? (
            <StrategyBuilder
              key={`${activeStrategy.id}:${focus.nonce}`}
              strategy={activeStrategy}
              onUpdate={persisted.saveStrategy}
              liveSignals={[]}
              initialTab={focus.target}
            />
          ) : (
            <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/40 p-8 text-center text-sm text-zinc-500">
              اختر أو أنشئ استراتيجية لبدء التحرير.
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[12px] text-zinc-400">
        <span className="font-semibold text-zinc-300">نصيحة:</span>
        تُحفَظ التعديلات تلقائيًا في السحابة فور إجرائها. قيّم استراتيجيتك وحقّق نتائجها في صفحة
        مركز القرارات.
      </div>

      {showCreate && (
        <CreateStrategyModal onClose={closeCreate} onCreate={onCreate} />
      )}
    </div>
  );
}
