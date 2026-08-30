"use client";

import { useCallback, useState } from "react";
import type { StrategyType } from "./types";
import { useStrategies, type PersistStatus } from "./hooks/useStrategies";
import { StrategyList } from "./components/StrategyList";
import { LiveStrategyBuilder } from "./components/LiveStrategyBuilder";
import { CreateStrategyModal } from "./components/CreateStrategyModal";
import { Badge, type Tone } from "@/components/ui/index";

const STATUS_META: Record<PersistStatus, { label: string; tone: Tone }> = {
  loading: { label: "جارٍ التحميل…", tone: "quiet" },
  saving: { label: "جارٍ الحفظ…", tone: "warn" },
  saved: { label: "محفوظ في السحابة", tone: "good" },
  error: { label: "تعذّر الحفظ — مخزّن محليًا", tone: "down" },
  local: { label: "مخزّن محليًا فقط", tone: "quiet" },
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
      <section className="rounded-card border border-line bg-surface-1/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-panel border border-line bg-surface-2/60 text-xl">
              🧩
            </div>
            <div>
              <h1 className="text-lg font-bold text-zinc-100">إدارة الاستراتيجيات</h1>
              <p className="text-2xs text-muted">
                أنشئ استراتيجياتك وعدّلها وخزّنها في السحابة، ثم قيّمها في مركز القرارات.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-2xs">
            <span className="rounded-chip border border-line bg-surface-2/60 px-2 py-1">
              {strategies.length} استراتيجية · {enabledCount} مفعّلة
            </span>
            <Badge tone={meta.tone}>{meta.label}</Badge>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-1 rounded-md bg-up/80 px-3 py-1.5 text-xs font-bold text-background hover:bg-up-fg"
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
            <LiveStrategyBuilder
              key={activeStrategy.id}
              strategy={activeStrategy}
              onUpdate={persisted.saveStrategy}
              initialTab={focus.target}
            />
          ) : (
            <div className="rounded-card border border-dashed border-line bg-surface-1/40 p-8 text-center text-sm text-muted">
              اختر أو أنشئ استراتيجية لبدء التحرير.
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
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