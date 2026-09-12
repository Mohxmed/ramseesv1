"use client";

import { Modal } from "@/components/ui";

/**
 * Unlink confirmation.
 *
 * An unlink is irreversible in one direction only — the stored API key is
 * destroyed and cannot be recovered — while everything the user earned stays
 * put. The copy states both halves explicitly so the decision is never made on
 * a guess about what "إلغاء الاقتران" deletes.
 */
export function BinanceUnlinkModal({
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
      title={`إلغاء اقتران ${exchangeName}؟`}
    >
      <div className="space-y-3">
        <p className="text-2xs leading-5 text-muted">
          سيتوقف RAMSEES فورًا عن الوصول إلى حسابك على {exchangeName}.
        </p>

        <ul className="space-y-1.5 rounded-panel border border-down/25 bg-down/5 px-3 py-2.5 text-2xs leading-5 text-down-fg">
          <li>• تُحذف مفاتيح API المخزّنة نهائيًا من الخادم.</li>
          <li>
            • تتوقف كل المزامنات والبث المباشر — ولن يُرسل أي طلب إلى المنصة بعد
            الآن.
          </li>
        </ul>

        <ul className="space-y-1.5 rounded-panel border border-up/25 bg-up/5 px-3 py-2.5 text-2xs leading-5 text-up-fg">
          <li>
            • تبقى محفظتك وسجلّ عملياتها وأداؤها التاريخي كما هي — لا يُحذف شيء
            منها.
          </li>
          <li>
            • يمكنك إعادة الربط لاحقًا بمفتاح جديد، ورأس المال الابتدائي (خط
            الأساس) يبقى كما هو.
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
            {busy ? "جارٍ الفصل…" : "تأكيد إلغاء الاقتران"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
