"use client";

import { useState, useEffect } from "react";
import { PlusIcon, LinkIcon, TrashIcon } from "@/components/icons/icons";
import { Badge, Status, Tooltip } from "@/components/ui";
import { timeAgo } from "@/features/notifications/format";
import type { ExchangeAccountDto } from "../types";
import { useExchangeAccounts } from "../hooks/useExchangeAccounts";
import { ConnectBinanceModal } from "./ConnectBinanceModal";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

type Freshness = "LIVE" | "FRESH" | "STALE" | "NEVER" | "ERROR" | "SYNCING";

function freshnessOf(a: ExchangeAccountDto, now: number): Freshness {
  if (a.status === "ERROR" || (a.lastErrorAt ?? 0) > (a.lastSuccessfulSync ?? 0)) return "ERROR";
  if (a.status === "SYNCING" || a.status === "CONNECTING" || (a.lastAttemptedSync ?? 0) > (a.lastSuccessfulSync ?? 0)) {
    return "SYNCING";
  }
  if (a.lastSuccessfulSync == null) return "NEVER";
  const elapsed = now - a.lastSuccessfulSync;
  if (elapsed < 15 * MINUTE) return "LIVE";
  if (elapsed < 6 * HOUR) return "FRESH";
  return "STALE";
}

function freshnessStatus(f: Freshness) {
  switch (f) {
    case "LIVE":
      return { label: "محدَّث مباشر", tone: "good" as const };
    case "FRESH":
      return { label: "حديث", tone: "good" as const };
    case "STALE":
      return { label: "قديم", tone: "warn" as const };
    case "SYNCING":
      return { label: "جارٍ المزامنة", tone: "warn" as const, pulse: true };
    case "ERROR":
      return { label: "خطأ بالمزامنة", tone: "down" as const };
    default:
      return { label: "لم تتم المزامنة بعد", tone: "quiet" as const };
  }
}

export function ConnectedAccounts() {
  const {
    accounts,
    exchanges,
    loading,
    error,
    busy,
    connect,
    disconnect,
    syncNow,
    refresh,
  } = useExchangeAccounts();
  const [connectOpen, setConnectOpen] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Refresh "now" every 30s so the freshness labels stay honest.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const binanceSupported = exchanges.some((e) => e.exchangeType.toUpperCase() === "BINANCE");

  return (
    <section className="rounded-card border border-line bg-surface-1/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-foreground">حسابات المنصات</h2>
          <p className="mt-0.5 text-2xs text-muted">
            ربط API يقرأ أرصدتك وحركاتك ويحدّثها تلقائيًا — بدون إرسال صفقات.
          </p>
        </div>
        {binanceSupported ? (
          <button
            type="button"
            onClick={() => setConnectOpen(true)}
            disabled={busy || loading}
            className="flex h-8 items-center gap-1.5 rounded-panel bg-gold/10 px-3 text-xs font-bold text-gold-fg ring-1 ring-gold/40 transition-colors hover:bg-gold/20 disabled:opacity-60"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            ربط حساب
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="mt-2 rounded-panel bg-down/10 px-3 py-2 text-xs font-medium text-down-fg">
          {error}
          <button type="button" onClick={() => void refresh()} className="mr-2 font-bold underline">
            إعادة المحاولة
          </button>
        </p>
      ) : null}

      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {loading && accounts.length === 0 ? (
          Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-card border border-line bg-surface-1/40" />
          ))
        ) : accounts.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-card border border-dashed border-line px-4 py-8 text-center sm:col-span-2 xl:col-span-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-panel bg-gold/10 text-gold-fg ring-1 ring-gold/30">
              <LinkIcon className="h-5 w-5" />
            </span>
            <p className="text-xs font-semibold text-zinc-200">لا توجد حسابات منصات بعد</p>
            <p className="text-2xs text-muted">
              اربط حساب Binance لتتحقق الأرصدة والصفقات تلقائيًا داخل المحفظة.
            </p>
            {binanceSupported ? (
              <button
                type="button"
                onClick={() => setConnectOpen(true)}
                disabled={busy}
                className="rounded-panel bg-gold/10 px-3 py-1.5 text-xs font-bold text-gold-fg ring-1 ring-gold/40 transition-colors hover:bg-gold/20 disabled:opacity-60"
              >
                ربط حساب Binance
              </button>
            ) : null}
          </div>
        ) : (
          accounts.map((a) => {
            const fr = freshnessOf(a, now);
            const st = freshnessStatus(fr);
            const syncing = fr === "SYNCING";
            return (
              <div key={a.id} className="flex flex-col gap-2 rounded-card border border-line bg-surface-1/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-foreground">{a.name}</p>
                    <p className="text-2xs font-semibold text-muted" dir="ltr">
                      {a.exchangeType} · {a.accountType}
                    </p>
                  </div>
                  <Status label={st.label} tone={st.tone} pulse={st.pulse} />
                </div>

                <div className="flex items-end justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-2xs text-muted">إجمالي المحفظة</p>
                    <p className="text-sm font-bold tabular-nums text-foreground">
                      ${a.financials.currentEquity.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-2xs text-muted">
                      {a.lastSuccessfulSync != null ? `آخر مزامنة: ${timeAgo(a.lastSuccessfulSync, now)}` : "لم تُزامن بعد"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {!a.permissions.readOnly ? (
                      <Tooltip title="المفتاح يملك صلاحية تعديل — يُفضَّل استخدام مفتاح قراءة فقط">
                        <Badge tone="warn">تعديل</Badge>
                      </Tooltip>
                    ) : (
                      <Badge tone="good">قراءة فقط</Badge>
                    )}
                  </div>
                </div>

                {a.lastError ? (
                  <p className="rounded-panel bg-down/10 px-2 py-1.5 text-2xs font-medium text-down-fg">
                    {a.lastError}
                  </p>
                ) : null}

                <div className="flex items-center justify-between border-t border-line/60 pt-2">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={syncing || busy}
                      onClick={() => void syncNow(a.id)}
                      className="rounded-chip border border-line px-2 py-1 text-2xs font-bold text-muted transition-colors hover:text-zinc-200 disabled:opacity-50"
                    >
                      {syncing ? "جارٍ…" : "مزامنة"}
                    </button>
                    {confirmId !== a.id ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setConfirmId(a.id)}
                        className="rounded-chip border border-line px-2 py-1 text-2xs font-bold text-down-fg/80 transition-colors hover:text-down-fg disabled:opacity-50"
                      >
                        فصل
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={async () => {
                          const ok = await disconnect(a.id);
                          if (ok) setConfirmId(null);
                        }}
                        className="rounded-chip border border-down/40 bg-down/10 px-2 py-1 text-2xs font-bold text-down-fg transition-colors hover:bg-down/20 disabled:opacity-50"
                      >
                        تأكيد الفصل؟
                      </button>
                    )}
                  </div>
                  <span className="flex items-center gap-1 text-2xs font-semibold text-muted">
                    <TrashIcon className="h-3 w-3" />
                    {a.financials.lastValuedAt ? timeAgo(a.financials.lastValuedAt, now) : "—"}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      <ConnectBinanceModal
        open={connectOpen}
        onClose={() => setConnectOpen(false)}
        busy={busy}
        error={error}
        onSubmit={connect}
      />
    </section>
  );
}