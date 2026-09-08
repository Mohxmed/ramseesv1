"use client";

import Image from "next/image";
import { num } from "@/components/ui/design-tokens";

/** Startup failure — a real, recoverable state, never a blank screen. */
export function BootFailure({
  errorId,
  onRetry,
}: {
  errorId: string | null;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-zinc-950"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(239,68,68,0.06),transparent_55%)]" />

      <div className="relative w-full max-w-sm px-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center overflow-hidden rounded-card border border-down/30 bg-surface-1 shadow-pop">
          <Image
            src="/favicon.jpg"
            alt=""
            width={56}
            height={56}
            priority
            className="h-full w-full object-cover"
          />
        </div>

        <h1 className="mt-6 text-xl font-bold text-zinc-50">تعذّر تشغيل التطبيق</h1>
        <p className="mt-2 text-xs leading-6 text-zinc-400">
          لم نتمكن من التحقق من الجلسة أو تجهيز الواجهة خلال المهلة المقررة.
          غالبًا يكون السبب بطء الاتصال أو خلل مؤقت.
        </p>

        <button
          type="button"
          onClick={onRetry}
          className="mt-6 rounded-md bg-up/80 px-6 py-2.5 text-sm font-bold text-background transition-colors hover:bg-up-fg"
        >
          إعادة المحاولة
        </button>

        {errorId && (
          <p className={`${num} mt-6 text-3xs text-zinc-600`} dir="ltr">
            Error ID: {errorId}
          </p>
        )}
      </div>
    </div>
  );
}