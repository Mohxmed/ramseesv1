"use client";

import { useState } from "react";
import { TextField } from "@mui/material";
import { Modal } from "@/components/ui";

/** Keyed from the parent so every open starts from an empty form. */
export function CreatePortfolioModal({
  open,
  onClose,
  saving,
  error,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  saving: boolean;
  error: string | null;
  onSubmit: (initialBalance: number) => Promise<boolean>;
}) {
  const [amount, setAmount] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setLocalError(null);
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setLocalError("أدخل رأس مال ابتدائياً صحيحاً أكبر من صفر.");
      return;
    }
    const ok = await onSubmit(parsed);
    if (ok) onClose();
  };

  const shownError = localError ?? error;

  return (
    <Modal open={open} onClose={onClose} title="إنشاء المحفظة">
      <p className="text-2xs leading-5 text-muted">
        سيتم تسجيل رأس المال الابتدائي كأول عملية إيداع في السجل، وتُبنى كل المؤشرات
        (الربح/الخسارة · Equity · السحب) من بيانات المحفظة الفعلية.
      </p>
      <div className="mt-3 space-y-3">
        <div>
          <label className="mb-1 block text-2xs font-semibold text-muted">رأس المال الابتدائي ($)</label>
          <TextField
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            fullWidth
            slotProps={{ htmlInput: { min: 0, step: "any", inputMode: "decimal" } }}
          />
        </div>

        {shownError ? (
          <p className="rounded-panel bg-down/10 px-3 py-2 text-xs font-medium text-down-fg">{shownError}</p>
        ) : null}

        <div className="flex items-center justify-end gap-2 border-t border-line/70 pt-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-panel border border-line px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:text-zinc-200 disabled:opacity-50"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="rounded-panel bg-gold/10 px-3 py-1.5 text-xs font-semibold text-gold-fg ring-1 ring-gold/40 transition-colors hover:bg-gold/20 disabled:opacity-60"
          >
            {saving ? "جارٍ الإنشاء…" : "إنشاء المحفظة"}
          </button>
        </div>
      </div>
    </Modal>
  );
}