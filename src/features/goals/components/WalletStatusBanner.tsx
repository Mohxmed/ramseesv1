"use client";

import { useState } from "react";
import { FreshnessChip } from "@/components/ui/status-cards";
import type { GoalsWalletContext } from "../types";

/**
 * Status strip for an imported (exchange) wallet on the goals page. Three
 * states: live (anchored to the exchange performance), first-sync pending
 * (ladder will re-anchor automatically), and sync dead (temporary constant
 * anchor until the exchange comes back). Also communicates that imported goals
 * are measured on the performance basis — deposits/withdrawals excluded — so
 * the anchor number is not "your equity" but "your trading result".
 */
export function WalletStatusBanner({
  wallet,
}: {
  wallet: GoalsWalletContext;
}) {
  const [nowMs] = useState(() => Date.now());

  if (wallet.source !== "binance") return null;

  const typeLabel = wallet.label ?? "المنصة";

  if (wallet.usable) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-card border border-line/70 bg-surface-2/25 px-4 py-3 text-xs text-zinc-300">
        <span className="inline-flex items-center gap-1.5 font-semibold text-up-fg">
          <span className="h-1.5 w-1.5 rounded-full bg-up" />
          الأهداف مرتبطة مباشرة بأداء {typeLabel}
        </span>
        <span className="text-2xs text-muted">
          يُقاس النمو بعد استبعاد الإيداعات والسحوبات — تتبع أرباح التداول فقط.
        </span>
        <div className="ms-auto">
          <FreshnessChip
            updatedAtMs={wallet.lastSuccessfulSync}
            nowMs={nowMs}
            label="آخر مزامنة"
          />
        </div>
      </div>
    );
  }

  if (wallet.syncStatus === "ERROR" || wallet.syncStatus === "DISCONNECTED") {
    return (
      <div className="flex items-center gap-3 rounded-card border border-down/40 bg-down/5 px-4 py-3 text-xs text-zinc-300">
        <span className="font-semibold text-down-fg">
          تعذر الوصول لرصيد {typeLabel}
        </span>
        <span className="text-muted">
          تُعرض الأهداف مؤقتًا على مرساة افتراضية حتى تعود المزامنة من المنصة.
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-card border border-gold/40 bg-warn/5 px-4 py-3 text-xs text-zinc-300">
      <span className="font-semibold text-gold-fg">
        في انتظار أول مزامنة من {typeLabel}
      </span>
      <span className="text-muted">
        سيُثبَّت سلم الأهداف على رصيدك الفعلي تلقائيًا بمجرد وصول أول تحديث من
        المنصة.
      </span>
    </div>
  );
}