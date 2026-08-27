"use client";

import type { Strategy } from "../types";
import { Card } from "./ui";

export function StrategyList({
  strategies,
  activeId,
  onSelect,
  onDuplicate,
  onDelete,
  onToggle,
  onCreate,
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
        <div className="rounded-xl border border-dashed border-zinc-700 p-4 text-center text-xs text-zinc-500">
          لا توجد استراتيجيات. أنشئ واحدة للبدء.
        </div>
      ) : (
        <ul className="space-y-1.5">
          {strategies.map((s) => (
            <li
              key={s.id}
              className={`flex items-center justify-between gap-2 rounded-lg border p-2 ${
                s.id === activeId
                  ? "border-emerald-500/50 bg-emerald-500/5"
                  : "border-zinc-800 bg-zinc-950/40"
              } ${!s.enabled ? "opacity-60" : ""}`}
            >
              <button
                type="button"
                onClick={() => onSelect(s.id)}
                className="min-w-0 flex-1 text-left"
              >
                <div className="truncate text-[13px] font-semibold text-zinc-100">{s.name}</div>
                <div className="flex flex-wrap gap-1 text-[10px] text-zinc-500">
                  {s.flows.map((f) => (
                    <span
                      key={f.type}
                      className={f.enabled ? "rounded bg-zinc-800 px-1 text-zinc-300" : "rounded bg-zinc-900 px-1 text-zinc-600"}
                      dir="ltr"
                    >
                      {f.type}
                    </span>
                  ))}
                  <span className="text-zinc-600">
                    {new Date(s.updatedAt).toLocaleDateString("ar")}
                  </span>
                </div>
              </button>

              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => onToggle(s.id)}
                  title="تفعيل / تعطيل"
                  className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${
                    s.enabled
                      ? "border-emerald-500/40 text-emerald-300"
                      : "border-zinc-700 text-zinc-500"
                  }`}
                >
                  {s.enabled ? "مفعّلة" : "معطّلة"}
                </button>
                <button
                  type="button"
                  onClick={() => onDuplicate(s.id)}
                  title="نسخ"
                  className="rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] font-bold text-zinc-400 hover:text-zinc-200"
                >
                  نسخ
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(s.id)}
                  title="حذف"
                  className="rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] font-bold text-red-400 hover:border-red-500/40"
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
