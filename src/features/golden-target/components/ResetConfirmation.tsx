"use client";

type ResetConfirmationProps = {
  saving: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ResetConfirmation({
  saving,
  onConfirm,
  onCancel,
}: ResetConfirmationProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onCancel}
    >
      <div
        className="animate-pop-in w-full max-w-sm rounded-2xl border border-red-900/50 bg-zinc-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-zinc-50">إعادة تعيين الهدف الذهبي</h2>
        <p className="mt-2 text-sm text-zinc-400">
          سيتم إعادة تعيين كل التقدم إلى البداية: الحركة الحالية ستكون 1، القيمة
          2، وعدد الحركات المكتملة 0. لا يمكن التراجع عن هذا الإجراء.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onConfirm}
            disabled={saving}
            className="flex-1 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-500 disabled:opacity-40"
          >
            {saving ? "جارٍ الحفظ..." : "تأكيد إعادة التعيين"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}
