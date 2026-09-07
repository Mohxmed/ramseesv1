"use client";

import { useMemo, useState } from "react";
import { PageHeader, Status, Tooltip } from "@/components/ui";
import { PlusIcon, WalletIcon } from "@/components/icons/icons";
import { usePortfolio } from "../hooks/usePortfolio";
import { buildEquitySeries } from "../utils";
import { PortfolioSummary } from "./PortfolioSummary";
import { PerformancePanel } from "./PerformancePanel";
import { DrawdownPanel } from "./DrawdownPanel";
import { PortfolioStats } from "./PortfolioStats";
import { TransactionTable } from "./TransactionTable";
import { AddTransactionModal } from "./AddTransactionModal";
import { CreatePortfolioModal } from "./CreatePortfolioModal";

export function PortfolioPage() {
  const {
    loading,
    error,
    meta,
    transactions,
    hasMore,
    retry,
    saving,
    saveState,
    createPortfolio,
    recordTransaction,
    loadOlder,
  } = usePortfolio();

  const [addOpen, setAddOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [addFormNonce, setAddFormNonce] = useState(0);
  const [createFormNonce, setCreateFormNonce] = useState(0);
  const [defaultTxTs, setDefaultTxTs] = useState(0);
  const [nowMs] = useState(() => Date.now());

  const equityPoints = useMemo(() => {
    if (!meta) return [];
    return buildEquitySeries({
      transactionsDesc: transactions,
      currentBalance: meta.currentBalance,
      peakBalance: meta.peakBalance,
      currentDrawdown: meta.currentDrawdown,
      initialBalance: meta.initialBalance,
      sinceMs: 0,
      nowMs,
    });
  }, [meta, transactions, nowMs]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-20 rounded-card border border-line bg-surface-1/40" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-card border border-line bg-surface-1/40" />
          ))}
        </div>
        <div className="h-72 animate-pulse rounded-card border border-line bg-surface-1/40" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <PageHeader
          eyebrow="Portfolio"
          icon={<WalletIcon />}
          title="المحفظة"
          description="تتبع رصيدك وصفقاتك وإيداعاتك من مكان واحد."
        />
        <div className="flex flex-col items-center gap-3 rounded-card border border-down/30 bg-down/5 p-10 text-center">
          <p className="text-sm font-semibold text-down-fg">{error}</p>
          <button
            type="button"
            onClick={retry}
            className="rounded-panel border border-line px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:text-zinc-200"
          >
            إعادة المحاولة
          </button>
        </div>
      </div>
    );
  }

  if (!meta) {
    return (
      <div className="space-y-4">
        <PageHeader
          eyebrow="Portfolio"
          icon={<WalletIcon />}
          title="المحفظة"
          description="تتبع رصيدك وصفقاتك وإيداعاتك من مكان واحد."
        />
        <div className="flex flex-col items-center gap-4 rounded-card border border-line bg-surface-1/40 px-6 py-14 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-panel bg-up/10 text-up-fg ring-1 ring-up/30">
            <WalletIcon className="h-8 w-8" />
          </span>
          <div>
            <h2 className="text-base font-bold text-zinc-100">المحفظة جاهزة للبدء</h2>
            <p className="mx-auto mt-1 max-w-sm text-xs leading-6 text-muted">
              أنشئ محفظتك برأس مال ابتدائي، وسنوثّق كل عملية لاحقة في سجل واحد — تظهر
              المؤشرات والمخططات مباشرة من بياناتك الحقيقية.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setCreateFormNonce((n) => n + 1);
              setCreateOpen(true);
            }}
            className="rounded-panel bg-up/15 px-4 py-2 text-sm font-semibold text-up-fg ring-1 ring-up/40 transition-colors hover:bg-up/20"
          >
            إنشاء المحفظة
          </button>
        </div>
        <CreatePortfolioModal
          key={createFormNonce}
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          saving={saving}
          error={saveState === "error" ? error : null}
          onSubmit={createPortfolio}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Portfolio"
        icon={<WalletIcon />}
        title="المحفظة"
        description="تتبع رصيدك وصفقاتك وإيداعاتك من مكان واحد."
        right={
          <>
            <Status
              label={saving ? "جارٍ الحفظ…" : "محدَّث لحظياً"}
              tone={saving ? "warn" : saveState === "error" ? "down" : "good"}
              pulse={saving}
            />
            <Tooltip title="إضافة عملية جديدة">
              <button
                type="button"
                onClick={() => {
                  setDefaultTxTs(Date.now());
                  setAddFormNonce((n) => n + 1);
                  setAddOpen(true);
                }}
                disabled={saving}
                className="flex h-8 items-center gap-1.5 rounded-panel bg-up/15 px-3 text-xs font-bold text-up-fg ring-1 ring-up/40 transition-colors hover:bg-up/20 disabled:opacity-60"
              >
                <PlusIcon className="h-3.5 w-3.5" />
                إضافة عملية
              </button>
            </Tooltip>
          </>
        }
      />

      <PortfolioSummary summary={meta} />

      <PerformancePanel summary={meta} transactions={transactions} />

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <DrawdownPanel summary={meta} points={equityPoints} />
        </div>
        <div className="lg:col-span-3">
          <PortfolioStats summary={meta} />
        </div>
      </div>

      <TransactionTable
        transactions={transactions}
        hasMore={hasMore}
        loading={saving}
        onLoadOlder={() => void loadOlder()}
      />

      <AddTransactionModal
        key={addFormNonce}
        open={addOpen}
        onClose={() => setAddOpen(false)}
        saving={saving}
        error={saveState === "error" ? error : null}
        defaultTimestampMs={defaultTxTs}
        onSubmit={recordTransaction}
      />
    </div>
  );
}