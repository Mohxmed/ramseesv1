"use client";

import { useState } from "react";
import { TextField } from "@mui/material";
import { Modal } from "@/components/ui";
import { ArrowRightIcon, ArrowLeftIcon, BitcoinIcon, WalletIcon } from "@/components/icons/icons";
import { exchangesApi, ExchangeApiError } from "../services/exchanges.api";

/**
 * Import a wallet from an exchange platform:
 *   1. pick a platform — only Binance is live in v1; the rest are listed but
 *      disabled with a "قريبًا" badge so future platforms fit the same flow.
 *   2. Binance credentials form — the account becomes the single wallet source
 *      (createPortfolio: true). Every operation is then recorded automatically
 *      during server-side syncs; the owner never records operations by hand.
 */

interface PlatformInfo {
  id: string;
  name: string;
  desc: string;
  swatch: string;
  enabled: boolean;
}

const PLATFORMS: PlatformInfo[] = [
  {
    id: "BINANCE",
    name: "Binance",
    desc: "تداول فوري (Spot) وعقود (Futures)",
    swatch: "bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/40",
    enabled: true,
  },
  { id: "BYBIT", name: "Bybit", desc: "تداول فوري وعقود", swatch: "bg-blue-400/15 text-blue-300 ring-1 ring-blue-400/40", enabled: false },
  { id: "KUCOIN", name: "KuCoin", desc: "تداول فوري وعقود", swatch: "bg-violet-400/15 text-violet-300 ring-1 ring-violet-400/40", enabled: false },
  { id: "COINBASE", name: "Coinbase", desc: "تداول فوري", swatch: "bg-sky-400/15 text-sky-300 ring-1 ring-sky-400/40", enabled: false },
  { id: "CRYPTO_COM", name: "Crypto.com", desc: "تداول فوري وعقود", swatch: "bg-gray-300/15 text-gray-200 ring-1 ring-gray-300/40", enabled: false },
];

export function ImportPortfolioModal({
  open,
  onClose,
  onImported,
  replaceManual = false,
}: {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
  /**
   * The manual wallet is being replaced: the server deletes it when the import
   * succeeds (this modal shows a heads-up; the delete itself stays atomic with
   * the successful connect, so a failed import leaves the wallet untouched).
   */
  replaceManual?: boolean;
}) {
  const [platform, setPlatform] = useState<PlatformInfo | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [secret, setSecret] = useState("");
  const [name, setName] = useState("");
  const [accountType, setAccountType] = useState<"SPOT" | "FUTURES">("SPOT");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setPlatform(null);
    setApiKey("");
    setSecret("");
    setName("");
    setAccountType("SPOT");
    setError(null);
  };

  const handleClose = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const pick = (p: PlatformInfo) => {
    if (!p.enabled) return;
    setError(null);
    setPlatform(p);
  };

  const handleSubmit = async () => {
    if (!platform) return;
    setError(null);
    if (!apiKey.trim() || !secret.trim()) {
      setError("أدخل API Key و Secret Key معًا.");
      return;
    }
    setBusy(true);
    try {
      const res = await exchangesApi.connect({
        exchangeType: platform.id,
        accountType,
        apiKey: apiKey.trim(),
        secret: secret.trim(),
        name: name.trim() || undefined,
        createPortfolio: true,
        replaceManual,
      });
      if (!res.portfolio) {
        setError("تعذر تسجيل المحفظة كحساب مستورد.");
        return;
      }
      reset();
      onImported();
    } catch (e) {
      setError(e instanceof ExchangeApiError ? e.message : "تعذر استيراد المحفظة.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={platform ? `استيراد من ${platform.name}` : "استيراد المحفظة تلقائيًا"}
    >
      {platform == null ? (
        <div className="space-y-2">
          {replaceManual ? (
            <p className="rounded-panel border border-down/30 bg-down/10 px-3 py-2 text-2xs leading-5 text-down-fg">
              سيتم حذف المحفظة اليدوية (الرصيد المُدخل يدويًا وسجلّها) واستبدالها
              بالمحفظة المستوردة. الحذف يحدث فقط عند نجاح الربط والاستيراد.
            </p>
          ) : null}
          <p className="text-2xs leading-5 text-muted">
            اختر المنصة — سيتم استيراد كامل سجل العمليات (إيداعات، سحوبات، صفقات،
            رسوم) وبناء رصيد المحفظة منها، وتُسجَّل العمليات الجديدة تلقائيًا.
          </p>
          <div className="grid gap-2">
            {PLATFORMS.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={!p.enabled}
                onClick={() => pick(p)}
                className={`flex items-center gap-3 rounded-panel border p-3 text-start transition-colors ${
                  p.enabled
                    ? "border-line bg-surface-2/30 hover:border-gold/40 hover:bg-gold/5"
                    : "cursor-not-allowed border-dashed border-line/60 bg-surface-1/30 opacity-55"
                }`}
              >
                <span className={`flex h-9 w-9 items-center justify-center rounded-panel text-sm font-extrabold ${p.swatch}`}>
                  {p.id === "BINANCE" ? <BitcoinIcon /> : p.name.charAt(0)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-bold text-zinc-100">{p.name}</span>
                  <span className="block truncate text-2xs text-muted">{p.desc}</span>
                </span>
                {p.enabled ? (
                  <span className="rounded-chip bg-gold/10 px-2 py-0.5 text-2xs font-bold text-gold-fg ring-1 ring-gold/30">
                    متاح
                  </span>
                ) : (
                  <span className="rounded-chip border border-line px-2 py-0.5 text-2xs font-bold text-muted" dir="ltr">
                    قريبًا
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-panel border border-up/20 bg-up/5 px-3 py-2 text-2xs leading-5 text-muted">
            <WalletIcon className="h-4 w-4 shrink-0 text-up-fg" />
            <span>
              المحفظة تُدار بالكامل تلقائيًا — لا نسحب أو نرسل صفقات أبدًا،
              وتُشفّر المفاتيح على الخادم بصلاحيات قراءة فقط إن أمكن.
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {(["SPOT", "FUTURES"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setAccountType(t)}
                className={`rounded-panel border px-3 py-2 text-xs font-bold transition-colors ${
                  accountType === t
                    ? "border-gold/50 bg-gold/10 text-gold-fg"
                    : "border-line bg-transparent text-muted hover:text-zinc-200"
                }`}
              >
                {t === "SPOT" ? "الحساب الفوري (Spot)" : "حساب العقود (Futures)"}
              </button>
            ))}
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

          {error ? (
            <p className="rounded-panel bg-down/10 px-3 py-2 text-xs font-medium text-down-fg">{error}</p>
          ) : null}

          <div className="flex items-center justify-between gap-2 border-t border-line/70 pt-3">
            <button
              type="button"
              onClick={() => setPlatform(null)}
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-panel border border-line px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:text-zinc-200 disabled:opacity-50"
            >
              <ArrowRightIcon />
              تغيير المنصة
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={busy}
                className="rounded-panel border border-line px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:text-zinc-200 disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-panel bg-gold/10 px-3 py-1.5 text-xs font-semibold text-gold-fg ring-1 ring-gold/40 transition-colors hover:bg-gold/20 disabled:opacity-60"
              >
                {busy ? (
                  "جارٍ الاستيراد…"
                ) : (
                  <>
                    استيراد المحفظة
                    <ArrowLeftIcon />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}