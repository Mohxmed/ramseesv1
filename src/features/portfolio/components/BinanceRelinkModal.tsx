"use client";

import { useState } from "react";
import { TextField } from "@mui/material";
import { Modal } from "@/components/ui";
import { WalletIcon } from "@/components/icons/icons";
import { exchangesApi, ExchangeApiError } from "../services/exchanges.api";

/**
 * Re-link a disconnected wallet with a fresh API key.
 *
 * Deliberately NOT the import flow: importing creates a wallet (and with it a
 * new initial capital). Re-linking attaches a key to the wallet that already
 * exists, so the server keeps the original baseline and the whole performance
 * record continues uninterrupted.
 *
 * The secret lives in component state only until the request resolves — it is
 * sent once, encrypted server-side, and never stored in the browser.
 */
export function BinanceRelinkModal({
  open,
  accountId,
  exchangeName,
  onClose,
  onRelinked,
}: {
  open: boolean;
  accountId: string;
  exchangeName: string;
  onClose: () => void;
  onRelinked: () => void;
}) {
  const [apiKey, setApiKey] = useState("");
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    if (busy) return;
    setApiKey("");
    setSecret("");
    setError(null);
    onClose();
  };

  const submit = async () => {
    if (!apiKey.trim() || !secret.trim()) {
      setError("أدخل API Key و Secret Key معًا.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await exchangesApi.reconnect(accountId, {
        apiKey: apiKey.trim(),
        secret: secret.trim(),
      });
      setApiKey("");
      setSecret("");
      onRelinked();
    } catch (e) {
      setError(e instanceof ExchangeApiError ? e.message : "تعذر إعادة الربط.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={close} title={`إعادة ربط ${exchangeName}`}>
      <div className="space-y-3">
        <div className="flex items-center gap-2 rounded-panel border border-up/20 bg-up/5 px-3 py-2 text-2xs leading-5 text-muted">
          <WalletIcon className="h-4 w-4 shrink-0 text-up-fg" />
          <span>
            محفظتك وسجلّها ورأس المال الابتدائي (خط الأساس) تبقى كما هي — لن
            يُعاد احتساب الأداء من الصفر. ننصح بمفتاح بصلاحية{" "}
            <b className="text-zinc-200">القراءة فقط</b>؛ فالمفتاح الأوسع
            يُقبل لكنه لن يُستخدم إلا للقراءة.
          </span>
        </div>

        <div>
          <label className="mb-1 block text-2xs font-semibold text-muted">
            API Key
          </label>
          <TextField
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="abcdefg…"
            fullWidth
            slotProps={{
              htmlInput: { autoComplete: "off", spellCheck: false },
            }}
          />
        </div>

        <div>
          <label className="mb-1 block text-2xs font-semibold text-muted">
            Secret Key
          </label>
          <TextField
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="••••••••"
            fullWidth
            slotProps={{
              htmlInput: { autoComplete: "new-password", spellCheck: false },
            }}
          />
        </div>

        {error ? (
          <p className="rounded-panel bg-down/10 px-3 py-2 text-xs font-medium text-down-fg">
            {error}
          </p>
        ) : null}

        <div className="flex items-center justify-end gap-2 border-t border-line/70 pt-3">
          <button
            type="button"
            onClick={close}
            disabled={busy}
            className="rounded-panel border border-line px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:text-zinc-200 disabled:opacity-50"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy}
            className="rounded-panel bg-gold/10 px-3 py-1.5 text-xs font-semibold text-gold-fg ring-1 ring-gold/40 transition-colors hover:bg-gold/20 disabled:opacity-60"
          >
            {busy ? "جارٍ إعادة الربط…" : "إعادة الربط"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
