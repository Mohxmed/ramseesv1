"use client";

import { Modal } from "@/components/ui";

/**
 * Permanent wipe confirmation.
 *
 * This is the irreversible counterpart to unlink: unlink destroys only the
 * stored API key and freezes the wallet (data stays). Purge removes the key
 * AND every owned record — ledger, performance history, baseline, snapshots —
 * and returns the user to a no-wallet state. The copy is deliberately blunt
 * about exactly what disappears so the decision is never made on a guess.
 */
export function BinanceDeleteModal({
  open,
  exchangeName,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  open: boolean;
  exchangeName: string;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={busy ? () => undefined : onClose}
      title={`حذف بيانات محفظة ${exchangeName} نهائيًا؟`}
    >
      <div className="space-y-3">
        <p className="text-2xs leading-5 text-muted">
          سيُحذف كل ما يخص هذه المحفظة من خوادمنا — لا يمكن التراجع بعد
          التأكيد.
        </p>

        <ul className="space-y-1.5 rounded-panel border border-down/25 bg-down/5 px-3 py-2.5 text-2xs leading-5 text-down-fg">
          <li>
            • تُحذف مفاتيح API المخزّنة نهائيًا من الخادم، ويتوقف كل اتصال
            بالمنصة فورًا.
          </li>
          <li>
            • يُحذف سجل العمليات والصفقات، الأرصدة، المراكز والطلبات المفتوحة،
            اللقطات، سجل الأداء ورأس المال الابتدائي (خط الأساس).
          </li>
        </ul>

        <ul className="space-y-1.5 rounded-panel border border-line/70 bg-surface-2/30 px-3 py-2.5 text-2xs leading-5 text-muted">
          <li>
            • تعود صفحة المحفظة إلى حالتها الأولى، ويمكنك إنشاء محفظة يدوية أو
            الربط من جديد من الصفر.
          </li>
          <li>
            • لا تتأثر ببياناتك الأخرى كالأهداف والتحليلات — تُحتسب عند توفر
            المحفظة.
          </li>
        </ul>

        {error ? (
          <p className="rounded-panel bg-down/10 px-3 py-2 text-xs font-medium text-down-fg">
            {error}
          </p>
        ) : null}

        <div className="flex items-center justify-end gap-2 border-t border-line/70 pt-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-panel border border-line px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:text-zinc-200 disabled:opacity-50"
          >
            تراجع
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="rounded-panel bg-down/15 px-3 py-1.5 text-xs font-semibold text-down-fg ring-1 ring-down/40 transition-colors hover:bg-down/25 disabled:opacity-60"
          >
            {busy ? "جارٍ الحذف…" : "حذف نهائي"}
          </button>
        </div>
      </div>
    </Modal>
  );
}