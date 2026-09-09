"use client";

import { useMemo, useState } from "react";
import { PageHeader, Status, Tooltip } from "@/components/ui";
import { PlusIcon, LinkIcon, WalletIcon } from "@/components/icons/icons";
import { usePortfolio } from "../hooks/usePortfolio";
import { buildEquitySeries } from "../utils";
import type { ImportedPortfolioSummary, PortfolioSummary, PortfolioTxType } from "../types";
import { BalanceHero } from "./BalanceHero";
import { PerformancePanel } from "./PerformancePanel";
import { DrawdownPanel } from "./DrawdownPanel";
import { PortfolioStats } from "./PortfolioStats";
import { TransactionTable } from "./TransactionTable";
import { ImportedPortfolioView } from "./ImportedPortfolioView";
import { ImportPortfolioModal } from "./ImportPortfolioModal";
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
  const [importOpen, setImportOpen] = useState(false);
  const [addFormNonce, setAddFormNonce] = useState(0);
  const [createFormNonce, setCreateFormNonce] = useState(0);
  const [importFormNonce, setImportFormNonce] = useState(0);
  const [defaultTxTs, setDefaultTxTs] = useState(0);
  const [initialTxType, setInitialTxType] = useState<PortfolioTxType>("deposit");
  const [nowMs] = useState(() => Date.now());

  const imported: ImportedPortfolioSummary | null =
    meta?.source === "binance" ? (meta as ImportedPortfolioSummary) : null;

  const equityPoints = useMemo(() => {
    const m = meta;
    if (!m || m.source !== "manual") return [];
    return buildEquitySeries({
      transactionsDesc: transactions,
      currentBalance: m.currentBalance,
      peakBalance: m.peakBalance,
      currentDrawdown: m.currentDrawdown,
      initialBalance: m.initialBalance,
      sinceMs: 0,
      nowMs,
    });
  }, [meta, transactions, nowMs]);

  const openAdd = (type: PortfolioTxType) => {
    setDefaultTxTs(Date.now());
    setInitialTxType(type);
    setAddFormNonce((n) => n + 1);
    setAddOpen(true);
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-20 rounded-card border border-line bg-surface-1/40" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-card border border-line bg-surface-1/40" />
          ))}
        </div>
        <div className="h-40 animate-pulse rounded-card border border-line bg-surface-1/40" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3">
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
      <div className="space-y-3">
        <PageHeader
          eyebrow="Portfolio"
          icon={<WalletIcon />}
          title="المحفظة"
          description="تتبع رصيدك وصفقاتك وإيداعاتك من مكان واحد."
        />
        <div className="grid gap-3 md:grid-cols-2">
          <button
            type="button"
            onClick={() => {
              setCreateFormNonce((n) => n + 1);
              setCreateOpen(true);
            }}
            className="group flex flex-col gap-3 rounded-card border p-5 text-start transition-colors hover:border-gold/40"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-panel bg-up/10 text-up-fg ring-1 ring-up/30">
              <PlusIcon className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-sm font-bold text-zinc-100">محفظة يدوية</span>
              <span className="mt-1 block text-2xs leading-5 text-muted">
                أنشئ المحفظة برأس مال ابتدائي وسجّل كل عملية بنفسك (إيداع، سحب، صفقة)
                — تظهر المؤشرات والمخططات مباشرة من بياناتك.
              </span>
            </span>
            <span className="text-2xs font-bold text-gold-fg">إنشاء المحفظة ←</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setImportFormNonce((n) => n + 1);
              setImportOpen(true);
            }}
            className="group flex flex-col gap-3 rounded-card border p-5 text-start transition-colors hover:border-gold/40"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-panel bg-gold/10 text-gold-fg ring-1 ring-gold/30">
              <LinkIcon className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-sm font-bold text-zinc-100">استيراد تلقائي من منصة</span>
              <span className="mt-1 block text-2xs leading-5 text-muted">
                اربط حساب Binance فيُستورد كامل سجل عملياتك (بنقرات API) وتُسجَّل
                كل عملية لاحقة تلقائيًا — بدون رصيد بداية تقديري.
              </span>
            </span>
            <span className="text-2xs font-bold text-gold-fg">اختيار المنصة ←</span>
          </button>
        </div>
        <p className="text-2xs text-muted">
          <b className="font-semibold text-zinc-300">ملاحظة:</b> المحفظة واحدة لكل مستخدم —
          ستظهر هذه الشاشة مرة واحدة فقط عند عدم وجود محفظة.
        </p>

        <CreatePortfolioModal
          key={createFormNonce}
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          saving={saving}
          error={saveState === "error" ? error : null}
          onSubmit={createPortfolio}
        />
        <ImportPortfolioModal
          key={importFormNonce}
          open={importOpen}
          onClose={() => setImportOpen(false)}
          onImported={() => setImportOpen(false)}
        />
      </div>
    );
  }

  if (imported) {
    return <ImportedPortfolioView meta={imported} />;
  }

  const manual = meta as PortfolioSummary;

  return (
    <div className="space-y-3">
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
                onClick={() => openAdd("deposit")}
                disabled={saving}
                className="flex h-8 items-center gap-1.5 rounded-panel bg-gold/10 px-3 text-xs font-bold text-gold-fg ring-1 ring-gold/40 transition-colors hover:bg-gold/20 disabled:opacity-60"
              >
                <PlusIcon className="h-3.5 w-3.5" />
                إضافة عملية
              </button>
            </Tooltip>
          </>
        }
      />

      <BalanceHero summary={manual} onOpenAdd={openAdd} />

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PerformancePanel summary={manual} transactions={transactions} />
        </div>
        <div className="space-y-3">
          <PortfolioStats summary={manual} />
          <DrawdownPanel summary={manual} points={equityPoints} />
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
        initialType={initialTxType}
        onSubmit={recordTransaction}
      />
    </div>
  );
}