"use client";

import type { GoalsMove } from "../types";
import { formatGrowth, formatNumber } from "../utils";

/**
 * فتّح الكارد — read-only status of the current goal card. The card's progress
 * comes entirely from the live wallet: it completes itself automatically once
 * the wallet crosses the target. No value entry, ever.
 */

type ProgressCheckProps = {
  move: GoalsMove;
  perMoveGrowthPercent: number;
  liveWalletValue: number | null;
  walletLabel?: string | null;
  valueLabel?: string;
  onClose: () => void;
};

export function ProgressCheck({
  move,
  perMoveGrowthPercent,
  liveWalletValue,
  walletLabel,
  valueLabel,
  onClose,
}: ProgressCheckProps) {
  const landed = move.completed;
  const walletOk = liveWalletValue != null && liveWalletValue > 0;
  const pct = walletOk && move.targetValue > 0
    ? Math.min(100, Math.max(0, (liveWalletValue / move.targetValue) * 100))
    : 0;
  const reached = walletOk ? liveWalletValue >= move.targetValue : false;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="animate-pop-in w-full max-w-md rounded-lift border border-line bg-surface-1 p-6 shadow-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-zinc-50">
              الكارد {String(move.move).padStart(2, "0")}
            </h2>
            <p className="mt-1 text-sm text-muted">
              يكتمل تلقائيًا من رصيد{" "}
              {walletLabel || "المحفظة"} — دون إدخال أي قيمة
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-panel p-1 text-muted hover:bg-surface-2 hover:text-zinc-300"
            aria-label="إغلاق"
          >
            ✕
          </button>
        </div>

        {landed ? (
          <div className="animate-pop-in rounded-panel border border-up/40 bg-up/10 p-4 text-sm text-up-fg">
            <p className="font-semibold">✓ الكارد مكتمل</p>
            <p className="mt-1 text-2xs text-zinc-300">
              من {formatNumber(move.startingValue ?? 0)} إلى{" "}
              {formatNumber(move.endingValue ?? 0)} جرت تجاوز هدف الكارد بنجاح.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-panel border border-line/70 bg-surface-2/25 p-3">
                <p className="text-2xs text-muted">الهدف</p>
                <p dir="ltr" className="mt-1 font-mono tabular-nums text-lg font-bold leading-none text-zinc-100">
                  {formatNumber(move.targetValue)} $
                </p>
              </div>
              <div className="rounded-panel border border-line/70 bg-surface-2/25 p-3">
                <p className="text-2xs text-muted">{valueLabel ?? "رصيد المحفظة الحالي"}</p>
                <p
                  dir="ltr"
                  className={`mt-1 font-mono tabular-nums text-lg font-bold leading-none ${
                    reached ? "text-up-fg" : "text-zinc-100"
                  }`}
                >
                  {walletOk ? `${formatNumber(liveWalletValue)} $` : "—"}
                </p>
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between text-2xs">
                <span className="text-muted">التقدم نحو الهدف</span>
                <span dir="ltr" className="font-mono tabular-nums font-bold text-zinc-200">
                  {pct.toFixed(0)}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-line">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    reached ? "bg-up" : "bg-gold"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>

            <div className="rounded-panel border border-line/70 bg-surface-2/25 p-3 text-center">
              <p className="text-2xs text-muted">النمو المطلوب لإتمام الكارد</p>
              <p className="mt-1 text-2xl font-bold text-gold-fg">
                {formatGrowth(perMoveGrowthPercent)}
              </p>
            </div>

            {reached ? (
              <div className="animate-pop-in rounded-panel border border-up/40 bg-up/10 p-4 text-sm text-up-fg">
                <p>
                  <span className="font-semibold">✓ الهدف محقق</span> — تجاوز
                  رصيد المحفظة هدف هذا الكارد وسيُحتسب مكتملًا تلقائيًا.
                </p>
              </div>
            ) : (
              <div className="animate-pop-in rounded-panel border border-line/70 bg-surface-2/25 p-4 text-sm text-zinc-300">
                <p>
                  <span className="font-semibold">لم يصل بعد</span> — تقدم هذا
                  الكارد يعتمد على رصيد محفظتك الحالي.{" "}
                  {walletOk
                    ? `سينتقل تلقائيًا عند بلوغ ${formatNumber(move.targetValue)} $`
                    : "اربط محفظتك أو سجّل رصيدك لتفعيل التقدم التلقائي."}
                </p>
              </div>
            )}
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-panel border border-line px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-surface-2"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}