"use client";

import { num } from "./design-tokens";

/** Route-level error fallback shown by app/error.tsx boundary stacks. */
export function AppErrorCard({
  message = "حدث خطأ غير متوقع أثناء عرض هذه الصفحة.",
  onReset,
  resetLabel = "إعادة المحاولة",
  code,
}: {
  message?: string;
  onReset?: () => void;
  resetLabel?: string;
  /** Stable error identifier (e.g. Next.js error.digest). */
  code?: string;
}) {
  return (
    <div role="alert" className="flex min-h-[50vh] items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-card border border-down/30 bg-surface-1/60 p-8 text-center shadow-pop">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-down/30 bg-down/10 text-lg font-bold text-down-fg">
          !
        </div>
        <h1 className="mt-4 text-base font-bold text-zinc-50">حدث خطأ</h1>
        <p className="mt-2 text-xs leading-6 text-zinc-400">{message}</p>
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            className="mt-5 rounded-md bg-up/80 px-5 py-2 text-xs font-bold text-background transition-colors hover:bg-up-fg"
          >
            {resetLabel}
          </button>
        )}
        {code && (
          <p className={`${num} mt-5 text-3xs text-zinc-600`} dir="ltr">
            Error ID: {code}
          </p>
        )}
      </div>
    </div>
  );
}