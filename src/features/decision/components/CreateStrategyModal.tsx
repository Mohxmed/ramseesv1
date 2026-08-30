"use client";

import { useEffect, useRef, useState } from "react";
import { STRATEGY_TEMPLATES } from "../templates";
import { Modal } from "@/components/ui/index";

export function CreateStrategyModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (opts: { name: string; templateId?: string; enabled: boolean }) => void;
}) {
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleSubmit = () => {
    if (!name.trim()) {
      setError("يرجى إدخال اسم للاستراتيجية.");
      return;
    }
    onCreate({ name, templateId: templateId || undefined, enabled });
  };

  return (
    <Modal open onClose={onClose} title="إنشاء استراتيجية جديدة">
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-2xs font-semibold text-muted">
            اسم الاستراتيجية
          </label>
          <input
            ref={nameRef}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
            }}
            placeholder="مثال: استراتيجيتي اليومية"
            className="w-full rounded-md border border-line bg-surface-1 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-up/60 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-2xs font-semibold text-muted">
            قالب مبدئي (اختياري)
          </label>
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="w-full rounded-md border border-line bg-surface-1 px-3 py-2 text-sm text-zinc-100 focus:border-up/60 focus:outline-none"
          >
            <option value="">بدون قالب — ابدأ من استراتيجية افتراضية</option>
            {STRATEGY_TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="accent-up"
          />
          تفعيل الاستراتيجية فور الإنشاء
        </label>

        {error && (
          <div className="rounded-md border border-down/40 bg-down/10 px-3 py-2 text-xs text-down-fg">
            {error}
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-line bg-surface-2/60 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:border-zinc-500"
        >
          إلغاء
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          className="rounded-md bg-up/80 px-4 py-1.5 text-xs font-bold text-background hover:bg-up-fg"
        >
          إنشاء
        </button>
      </div>
    </Modal>
  );
}