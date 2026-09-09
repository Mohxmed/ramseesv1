"use client";

import { useState } from "react";
import { TextField } from "@mui/material";
import { Modal } from "@/components/ui";

/**
 * Connect an exchange API key (Binance today). The key/secret are validated on
 * the server (testConnection → permissions), then encrypted with AES-256-GCM
 * into the server-only vault BEFORE anything is written — they never appear in
 * Firestore, the bundle, or logs.
 */

export function ConnectBinanceModal({
  open,
  onClose,
  busy,
  error,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  busy: boolean;
  error: string | null;
  onSubmit: (input: {
    exchangeType: string;
    accountType: "SPOT" | "FUTURES";
    apiKey: string;
    secret: string;
    name?: string;
  }) => Promise<boolean>;
}) {
  const [apiKey, setApiKey] = useState("");
  const [secret, setSecret] = useState("");
  const [name, setName] = useState("");
  const [accountType, setAccountType] = useState<"SPOT" | "FUTURES">("SPOT");
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setLocalError(null);
    if (!apiKey.trim() || !secret.trim()) {
      setLocalError("أدخل API Key و Secret Key معًا.");
      return;
    }
    const ok = await onSubmit({
      exchangeType: "BINANCE",
      accountType,
      apiKey: apiKey.trim(),
      secret: secret.trim(),
      name: name.trim() || undefined,
    });
    if (ok) {
      onClose();
      setApiKey("");
      setSecret("");
      setName("");
    }
  };

  const shownError = localError ?? error;

  return (
    <Modal open={open} onClose={onClose} title="ربط حساب المنصة">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAccountType("SPOT")}
            className={`flex-1 rounded-panel border px-3 py-2 text-xs font-bold transition-colors ${
              accountType === "SPOT"
                ? "border-gold/50 bg-gold/10 text-gold-fg"
                : "border-line bg-transparent text-muted hover:text-zinc-200"
            }`}
          >
            الحساب الفوري (Spot)
          </button>
          <button
            type="button"
            onClick={() => setAccountType("FUTURES")}
            className={`flex-1 rounded-panel border px-3 py-2 text-xs font-bold transition-colors ${
              accountType === "FUTURES"
                ? "border-gold/50 bg-gold/10 text-gold-fg"
                : "border-line bg-transparent text-muted hover:text-zinc-200"
            }`}
          >
            حساب العقود (Futures)
          </button>
        </div>

        <div>
          <label className="mb-1 block text-2xs font-semibold text-muted">اسم العرض (اختياري)</label>
          <TextField
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="مثال: حساب التداول اليومي"
            fullWidth
            slotProps={{ htmlInput: { maxLength: 60 } }}
          />
        </div>

        <div>
          <label className="mb-1 block text-2xs font-semibold text-muted">API Key</label>
          <TextField
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="abcdefg…"
            fullWidth
            slotProps={{ htmlInput: { autoComplete: "off", spellCheck: false } }}
          />
        </div>

        <div>
          <label className="mb-1 block text-2xs font-semibold text-muted">Secret Key</label>
          <TextField
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="••••••••"
            fullWidth
            slotProps={{ htmlInput: { autoComplete: "new-password", spellCheck: false } }}
          />
        </div>

        <p className="rounded-panel bg-up/5 px-3 py-2 text-2xs leading-5 text-muted ring-1 ring-up/15">
          يُنصح بإنشاء مفتاح بصلاحيات قراءة فقط من إعدادات المنصة — لن يتم إرسال صفقات
          أبدًا. تُشفّر المفاتيح على الخادم وتُفحص الصلاحيات تلقائيًا عند الربط.
        </p>

        {shownError ? (
          <p className="rounded-panel bg-down/10 px-3 py-2 text-xs font-medium text-down-fg">{shownError}</p>
        ) : null}

        <div className="flex items-center justify-end gap-2 border-t border-line/70 pt-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-panel border border-line px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:text-zinc-200 disabled:opacity-50"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={busy}
            className="rounded-panel bg-gold/10 px-3 py-1.5 text-xs font-semibold text-gold-fg ring-1 ring-gold/40 transition-colors hover:bg-gold/20 disabled:opacity-60"
          >
            {busy ? "جارٍ الربط…" : "ربط الحساب"}
          </button>
        </div>
      </div>
    </Modal>
  );
}