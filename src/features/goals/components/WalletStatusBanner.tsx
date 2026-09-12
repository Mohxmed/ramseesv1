"use client";

import { useState } from "react";
import { FreshnessChip } from "@/components/ui/status-cards";
import type { GoalsWalletContext } from "../types";
import { formatNumber } from "../utils";

/**
 * Status strip for the goals page wallet anchor. States:
 *  - no wallet at all   → prompt to link one
 *  - manual, no balance → prompt to record a balance
 *  - imported live      → ladder is anchored to the exchange balance
 *  - imported unlinked  → the user deliberately disconnected; the ladder keeps
 *                         its last known anchor (NOT an error)
 *  - imported dead sync → temporary constant anchor until sync recovers
 *  - imported pending   → first sync still running; ladder re-anchors on arrival
 */
export function WalletStatusBanner({
  wallet,
}: {
  wallet: GoalsWalletContext;
}) {
  const [nowMs] = useState(() => Date.now());

  if (wallet.source === null) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-card border border-line/70 bg-surface-2/25 px-4 py-3 text-xs text-zinc-300">
        <span className="font-semibold text-muted">لا توجد محفظة مرتبطة بعد</span>
        <span className="text-2xs text-muted">
          سجّل رصيدك اليدوي أو اربط منصة لتبدأ أهدافك — تُرسى على الرصيد الحالي
          وتُفتتح تلقائيًا مع نموه.
        </span>
      </div>
    );
  }

  if (wallet.source === "manual" && !wallet.usable) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-card border border-gold/40 bg-warn/5 px-4 py-3 text-xs text-zinc-300">
        <span className="font-semibold text-gold-fg">سجّل رصيد محفظتك اليدوية</span>
        <span className="text-2xs text-muted">
          تُعرض الأهداف مؤقتًا على مرساة افتراضية حتى تحدد رصيدك الحالي في صفحة
          المحفظة — ثم تُرسى عليه وتُفتتح تلقائيًا مع نموّه.
        </span>
      </div>
    );
  }

  if (wallet.source !== "binance") return null;

  const typeLabel = wallet.label ?? "المنصة";

  if (wallet.usable) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-card border border-line/70 bg-surface-2/25 px-4 py-3 text-xs text-zinc-300">
        <span className="inline-flex items-center gap-1.5 font-semibold text-up-fg">
          <span className="h-1.5 w-1.5 rounded-full bg-up" />
          الأهداف تُحسب تلقائيًا من رصيد {typeLabel}
        </span>
        <span className="text-2xs text-muted">
          كل دورة = 10% نمو على الرصيد السابق؛ أول دورة تُقيَّم من رصيد
          المنصة الأول{" "}
          {wallet.initialValue != null && wallet.initialValue > 0
            ? `($${formatNumber(wallet.initialValue)})`
            : ""}{" "}
          — بلا حفظ أو إعادة تعيين.
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

  // A deliberate unlink is not a failure — never report it as one.
  if (wallet.syncStatus === "DISCONNECTED") {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-card border border-line/70 bg-surface-2/25 px-4 py-3 text-xs text-zinc-300">
        <span className="font-semibold text-muted">
          اقتران {typeLabel} ملغى
        </span>
        <span className="text-2xs text-muted">
          تُحسب الأهداف على آخر رصيد محفوظ — أعد الربط من صفحة المحفظة لاستئناف
          التحديث التلقائي.
        </span>
      </div>
    );
  }

  if (wallet.syncStatus === "ERROR") {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-card border border-down/40 bg-down/5 px-4 py-3 text-xs text-zinc-300">
        <span className="font-semibold text-down-fg">
          تعذر الوصول لرصيد {typeLabel}
        </span>
        <span className="text-2xs text-muted">
          تُعرض الأهداف مؤقتًا على مرساة افتراضية حتى تعود المزامنة من المنصة.
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-card border border-gold/40 bg-warn/5 px-4 py-3 text-xs text-zinc-300">
      <span className="font-semibold text-gold-fg">
        في انتظار أول مزامنة من {typeLabel}
      </span>
      <span className="text-2xs text-muted">
        سيُرسى سلم الأهداف على رصيدك الفعلي تلقائيًا فور وصول أول تحديث من
        المنصة.
      </span>
    </div>
  );
}