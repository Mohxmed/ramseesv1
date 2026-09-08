"use client";

import { useState } from "react";
import { TextField } from "@mui/material";
import { Modal, Select } from "@/components/ui";
import {
  PORTFOLIO_IMPACT_LABELS,
  PORTFOLIO_TX_TYPE_LABELS,
  type AddTransactionInput,
  type PortfolioImpact,
  type PortfolioTxType,
} from "../types";

function toLocalInputValue(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Form state is reset on every open by keying this component from the parent
 * (remount) — a fresh mount must never read time mid-render, so the "now"
 * timestamp is supplied by the parent's event handler.
 */
export function AddTransactionModal({
  open,
  onClose,
  saving,
  error,
  defaultTimestampMs,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  saving: boolean;
  error: string | null;
  defaultTimestampMs: number;
  onSubmit: (input: AddTransactionInput) => Promise<boolean>;
}) {
  const [type, setType] = useState<PortfolioTxType>("deposit");
  const [impact, setImpact] = useState<PortfolioImpact>("increase");
  const [amount, setAmount] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [dateTime, setDateTime] = useState(() => toLocalInputValue(defaultTimestampMs));
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setLocalError(null);
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setLocalError("أدخل مبلغاً صحيحاً أكبر من صفر.");
      return;
    }
    const ts = new Date(dateTime).getTime();
    if (!Number.isFinite(ts)) {
      setLocalError("التاريخ والوقت غير صالحين.");
      return;
    }
    const ok = await onSubmit({
      type,
      impact,
      amount: parsed,
      symbol: symbol.trim() || undefined,
      description: description.trim() || undefined,
      timestamp: ts,
    });
    if (ok) onClose();
  };

  const shownError = localError ?? error;

  return (
    <Modal open={open} onClose={onClose} title="إضافة عملية">
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-2xs font-semibold text-muted">نوع العملية</label>
          <Select<PortfolioTxType>
            value={type}
            onChange={setType}
            options={(
              Object.keys(PORTFOLIO_TX_TYPE_LABELS) as PortfolioTxType[]
            ).map((t) => ({ value: t, label: PORTFOLIO_TX_TYPE_LABELS[t] }))}
          />
        </div>

        <div>
          <label className="mb-1 block text-2xs font-semibold text-muted">نوع التأثير</label>
          <div className="grid grid-cols-2 gap-1.5">
            {(["increase", "decrease"] as PortfolioImpact[]).map((im) => (
              <button
                key={im}
                type="button"
                onClick={() => setImpact(im)}
                className={`rounded-panel border px-3 py-2 text-xs font-semibold transition-colors ${
                  impact === im
                    ? im === "increase"
                      ? "border-up/50 bg-up/10 text-up-fg"
                      : "border-down/50 bg-down/10 text-down-fg"
                    : "border-line bg-surface-2/30 text-muted hover:text-zinc-200"
                }`}
              >
                {PORTFOLIO_IMPACT_LABELS[im]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-2xs font-semibold text-muted">المبلغ ($)</label>
          <TextField
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            fullWidth
            slotProps={{ htmlInput: { min: 0, step: "any", inputMode: "decimal" } }}
          />
        </div>

        {type === "trade" ? (
          <div>
            <label className="mb-1 block text-2xs font-semibold text-muted">الرمز (اختياري)</label>
            <TextField
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder="BTCUSDT"
              fullWidth
            />
          </div>
        ) : null}

        <div>
          <label className="mb-1 block text-2xs font-semibold text-muted">الوصف (اختياري)</label>
          <TextField
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="ملاحظة على العملية"
            fullWidth
          />
        </div>

        <div>
          <label className="mb-1 block text-2xs font-semibold text-muted">التاريخ والوقت</label>
          <TextField
            type="datetime-local"
            value={dateTime}
            onChange={(e) => setDateTime(e.target.value)}
            fullWidth
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
            className="rounded-panel bg-up/15 px-3 py-1.5 text-xs font-semibold text-up-fg ring-1 ring-up/40 transition-colors hover:bg-up/20 disabled:opacity-60"
          >
            {saving ? "جارٍ الحفظ…" : "إضافة العملية"}
          </button>
        </div>
      </div>
    </Modal>
  );
}