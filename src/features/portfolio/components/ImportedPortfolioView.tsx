"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader, Status } from "@/components/ui";
import { WalletIcon, LinkIcon, RefreshIcon, RotateIcon, LogoutIcon, TrashIcon } from "@/components/icons/icons";
import { timeAgo } from "@/features/notifications/format";
import { accountTypeLabel, exchangeTypeLabel } from "../utils";
import type { ImportedPortfolioSummary } from "../types";
import { useImportedPortfolio } from "../hooks/useImportedPortfolio";
import { exchangesApi, ExchangeApiError } from "../services/exchanges.api";
import { liveManager } from "../live/binanceLiveManager";
import { ImportedOverview } from "./ImportedOverview";
import { ImportedMetricGrid } from "./ImportedMetricGrid";
import { ImportedOpenPositions } from "./ImportedOpenPositions";
import { ImportedCashFlow } from "./ImportedCashFlow";
import { ImportedPerformance } from "./ImportedPerformance";
import { ImportedHistory } from "./ImportedHistory";
import { BinanceUnlinkModal } from "./BinanceUnlinkModal";
import { BinanceRelinkModal } from "./BinanceRelinkModal";
import { BinanceDeleteModal } from "./BinanceDeleteModal";
import { WalletActionsMenu, type WalletActionItem } from "./WalletActionsMenu";

function statusOf(syncStatus: ImportedPortfolioSummary["syncStatus"]) {
  switch (syncStatus) {
    case "HEALTHY":
      return { label: "متصل", tone: "good" as const };
    case "SYNCING":
      return { label: "جارٍ المزامنة", tone: "warn" as const, pulse: true };
    case "CONNECTING":
      return { label: "جارٍ الربط", tone: "warn" as const, pulse: true };
    case "ERROR":
      return { label: "غير متصل", tone: "down" as const };
    default:
      return { label: "مفصول", tone: "quiet" as const };
  }
}

/** Freshness of the shown snapshot — display-only, never triggers a refresh. */
function freshnessOf(ts: number | null, now: number) {
  if (ts == null) return null;
  const diff = now - ts;
  if (diff < 5 * 60_000) return { label: "بيانات حديثة", cls: "text-good" };
  if (diff <= 30 * 60_000) return { label: "تحتاج تحديث", cls: "text-warn-fg" };
  return { label: "قديمة", cls: "text-down-fg" };
}

export function ImportedPortfolioView({
  meta,
  onConnectionChange,
}: {
  meta: ImportedPortfolioSummary;
  /** Re-read the wallet meta after a link state change (connect / disconnect). */
  onConnectionChange?: () => void;
}) {
  const disconnected = meta.syncStatus === "DISCONNECTED";
  const { detail, error, isSyncing, refreshing, syncingNow, refreshManual, syncNow } = useImportedPortfolio(
    meta.accountId,
    200
  );
  const [hidden, setHidden] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [unlinkOpen, setUnlinkOpen] = useState(false);
  const [relinkOpen, setRelinkOpen] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [unlinkError, setUnlinkError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Display-only clock for "آخر تحديث منذ…" labels — reads nothing (no timers
  // that touch Firestore or Binance).
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Safety net: a wallet that arrives already disconnected (another tab, a
  // reload) must not keep a live session alive from a previous session.
  useEffect(() => {
    if (disconnected) liveManager.dispose();
  }, [disconnected]);

  const handleUnlink = useCallback(async () => {
    setUnlinking(true);
    setUnlinkError(null);
    try {
      await exchangesApi.disconnect(meta.accountId);
      // Kill sockets, keepalive timers and leadership BEFORE the re-render, so
      // no request can be issued against a connection that no longer exists.
      liveManager.dispose();
      setUnlinkOpen(false);
      onConnectionChange?.();
    } catch (e) {
      setUnlinkError(e instanceof ExchangeApiError ? e.message : "تعذر إلغاء الاقتران.");
    } finally {
      setUnlinking(false);
    }
  }, [meta.accountId, onConnectionChange]);

  // Permanent wipe — same socket/leadership teardown as unlink, then the whole
  // wallet disappears from the server; `onConnectionChange` re-reads the meta
  // (now gone) and the page returns to the no-wallet state.
  const handleDelete = useCallback(async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await exchangesApi.purge(meta.accountId);
      liveManager.dispose();
      setDeleteOpen(false);
      onConnectionChange?.();
    } catch (e) {
      setDeleteError(e instanceof ExchangeApiError ? e.message : "تعذر حذف بيانات المحفظة.");
    } finally {
      setDeleting(false);
    }
  }, [meta.accountId, onConnectionChange]);

  const lastUpdatedMs = detail?.latestSnapshot?.timestamp ?? meta.lastSuccessfulSync ?? null;
  const freshness = disconnected ? null : freshnessOf(lastUpdatedMs, now);

  const st = statusOf(meta.syncStatus);
  const loadingDetail = detail == null;
  const busy = refreshing || syncingNow || isSyncing;
  const exchangeName = exchangeTypeLabel(meta.exchangeType);

  return (
    <div className="space-y-3">
      <PageHeader
        eyebrow="Portfolio"
        icon={<WalletIcon />}
        title="المحفظة"
        description={
          <>
            حساب محفظة <b className="text-foreground">{accountTypeLabel(meta.accountType)}</b> على منصة{" "}
            <b className="text-foreground">{exchangeName}</b>
            {meta.accountName ? <> · {meta.accountName}</> : null}
            {disconnected ? (
              <> — الاقتران ملغى، تُعرض آخر بيانات محفوظة</>
            ) : (
              <>
                {" "}
                — آخر تحديث:{" "}
                <b dir="ltr" className="text-zinc-200">
                  {lastUpdatedMs != null ? timeAgo(lastUpdatedMs, now) : "لم يُحدَّث بعد"}
                </b>
              </>
            )}
          </>
        }
        right={
          <>
            <Status label={st.label} tone={st.tone} pulse={st.pulse} />
            {freshness ? (
              <span className={`rounded-panel px-2 py-1 text-2xs font-bold ${freshness.cls} bg-surface-2/60 ring-1 ring-line/50`}>
                {freshness.label}
              </span>
            ) : null}
            {disconnected ? (
              <button
                type="button"
                onClick={() => setRelinkOpen(true)}
                className="flex h-8 items-center gap-1.5 rounded-panel bg-gold/10 px-3 text-xs font-bold text-gold-fg ring-1 ring-gold/40 transition-colors hover:bg-gold/20"
              >
                <LinkIcon className="h-3.5 w-3.5" />
                ربط {exchangeName}
              </button>
            ) : null}
            <WalletActionsMenu
              items={
                [
                  ...(!disconnected
                    ? [
                        {
                          key: "refresh",
                          label: "تحديث البيانات",
                          icon: <RefreshIcon className="h-4 w-4" />,
                          disabled: busy,
                          onSelect: () => void refreshManual(),
                        },
                        ...(!isSyncing
                          ? [
                              {
                                key: "resync",
                                label: "إعادة مزامنة كاملة",
                                icon: <RotateIcon className="h-4 w-4" />,
                                disabled: busy,
                                onSelect: () => void syncNow("INITIAL"),
                              },
                            ]
                          : []),
                        {
                          key: "unlink",
                          label: "إلغاء الاقتران",
                          icon: <LogoutIcon className="h-4 w-4" />,
                          disabled: unlinking,
                          onSelect: () => {
                            setUnlinkError(null);
                            setUnlinkOpen(true);
                          },
                        },
                      ]
                    : []),
                  {
                    key: "delete",
                    label: "حذف المحفظة",
                    icon: <TrashIcon className="h-4 w-4" />,
                    danger: true,
                    disabled: deleting,
                    onSelect: () => {
                      setDeleteError(null);
                      setDeleteOpen(true);
                    },
                  },
                ] as WalletActionItem[]
              }
            />
          </>
        }
      />

      {disconnected ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-panel border border-line bg-surface-1/40 px-3 py-2.5 text-xs">
          <div className="space-y-0.5">
            <p className="font-bold text-zinc-200">هذه المحفظة غير مرتبطة بـ{exchangeName}</p>
            <p className="text-2xs leading-5 text-muted">
              تم حذف مفاتيح API ولا يجري أي اتصال بالمنصة. البيانات المعروضة محفوظة من
              آخر مزامنة ناجحة، ورأس المال الابتدائي (خط الأساس) محفوظ — أعد الربط
              بمفتاح جديد لاستئناف التحديث دون فقدان الأداء التاريخي.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setRelinkOpen(true)}
            className="rounded-panel bg-gold/10 px-3 py-1.5 text-2xs font-bold text-gold-fg ring-1 ring-gold/40 transition-colors hover:bg-gold/20"
          >
            إعادة الربط
          </button>
        </div>
      ) : null}

      {!disconnected && (meta.lastError || error) ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-panel border border-down/25 bg-down/10 px-3 py-2 text-xs font-medium text-down-fg">
          <span>
            {meta.lastError ?? error}
            {detail ? " — يتم عرض آخر بيانات ناجحة." : ""}
          </span>
          <button
            type="button"
            onClick={() => void refreshManual()}
            disabled={busy}
            className="rounded-panel border border-down/30 px-2 py-1 text-2xs font-bold text-down-fg transition-colors hover:bg-down/15"
          >
            إعادة المحاولة
          </button>
        </div>
      ) : null}

      <ImportedOverview
        meta={meta}
        detail={detail}
        hidden={hidden}
        onToggle={() => setHidden((v) => !v)}
        nowMs={now}
      />

      <ImportedMetricGrid meta={meta} detail={detail} loading={loadingDetail} nowMs={now} />

      <ImportedOpenPositions accountId={meta.accountId} snapshot={detail} liveEnabled={!disconnected} />

      <ImportedCashFlow meta={meta} detail={detail} loading={loadingDetail} nowMs={now} />

      <ImportedPerformance meta={meta} detail={detail} loading={loadingDetail} />

      <ImportedHistory detail={detail} loading={loadingDetail} nowMs={now} />

      <BinanceUnlinkModal
        open={unlinkOpen}
        exchangeName={exchangeName}
        busy={unlinking}
        error={unlinkError}
        onClose={() => setUnlinkOpen(false)}
        onConfirm={() => void handleUnlink()}
      />

      <BinanceRelinkModal
        open={relinkOpen}
        accountId={meta.accountId}
        exchangeName={exchangeName}
        onClose={() => setRelinkOpen(false)}
        onRelinked={() => {
          setRelinkOpen(false);
          onConnectionChange?.();
        }}
      />

      <BinanceDeleteModal
        open={deleteOpen}
        exchangeName={exchangeName}
        busy={deleting}
        error={deleteError}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}