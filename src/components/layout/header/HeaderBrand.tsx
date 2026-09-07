"use client";

import Image from "next/image";
import Link from "next/link";

/** Brand mark (logo + RAMSEES wordmark). Wordmark collapses on small screens. */
export function HeaderBrand() {
  return (
    <Link
      href="/dashboard"
      className="flex shrink-0 items-center gap-2 rounded-panel px-1.5 py-1 transition-colors hover:bg-surface-2/60"
      aria-label="الانتقال إلى لوحة التحكم"
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md border border-line">
        <Image
          src="/favicon.jpg"
          alt="شعار RAMSEES"
          width={28}
          height={28}
          className="h-full w-full object-cover"
          priority
        />
      </span>
      <span className="hidden text-sm font-bold tracking-wide text-zinc-50 sm:block">
        RAMSEES
      </span>
    </Link>
  );
}