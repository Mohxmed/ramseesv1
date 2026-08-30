"use client";

import type { Strategy } from "../types";
import { Card } from "@/components/ui/index";

export function StrategyList({
  strategies,
  activeId,
  onSelect,
  onDuplicate,
  onDelete,
  onToggle,
}: {
  strategies: Strategy[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string) => void;
  onCreate: () => void;
}) {
  return (
    <Card title="الاستراتيجيات">
      {strategies.length === 0 ? (
        <div className="rounded-panel border border-dashed border-line p-4 text-center text-xs text-muted">
          لا توجد استراتيجيات. أنشئ واحدة للبدء.
        </div>
      ) : (
        <ul className="space-y-1.5">
          {strategies.map((s) => (
            <li
              key={s.id}
              className={`flex items-center justify-between gap-2 rounded-panel border p-2 ${
                s.id === activeId
                  ? "border-up/50 bg-up/5"
                  : "border-line bg-surface-2/30"
              } ${!s.enabled ? "opacity-60" : ""}`}
            >
              <button
                type="button"
                onClick={() => onSelect(s.id)}
                className="min-w-0 flex-1 text-left"
              >
                <div className="truncate text-[13px] font-semibold text-zinc-100">{s.name}</div>
                <div className="flex flex-wrap gap-1 text-2xs text-muted">
                  {s.flows.map((f) => (
                    <span
                      key={f.type}
                      className={f.enabled ? "rounded bg-surface-2 px-1 text-zinc-300" : "rounded bg-surface-1 px-1 text-muted"}
                      dir="ltr"
                    >
                      {f.type}
                    </span>
                  ))}
                  <span className="text-muted">
                    {new Date(s.updatedAt).toLocaleDateString("ar")}
                  </span>
                </div>
              </button>

              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => onToggle(s.id)}
                  title="تفعيل / تعطيل"
                  className={`rounded border px-1.5 py-0.5 text-2xs font-bold ${
                    s.enabled
                      ? "border-up/40 text-up-fg"
                      : "border-line text-muted"
                  }`}
                >
                  {s.enabled ? "مفعّلة" : "معطّلة"}
                </button>
                <button
                  type="button"
                  onClick={() => onDuplicate(s.id)}
                  title="نسخ"
                  className="rounded border border-line px-1.5 py-0.5 text-2xs font-bold text-muted hover:text-zinc-200"
                >
                  نسخ
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(s.id)}
                  title="حذف"
                  className="rounded border border-line px-1.5 py-0.5 text-2xs font-bold text-down-fg hover:border-down/40"
                >
                  حذف
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}