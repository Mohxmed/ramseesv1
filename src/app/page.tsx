import Link from "next/link";
import Image from "next/image";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-1">
      <Image
        src="/favicon.avif"
        alt="شعار RAMSEES"
        width={80}
        height={80}
        className="h-20 w-20 rounded-card object-cover"
      />
      <h1 className="mt-4 text-4xl font-bold text-zinc-50">RAMSEES</h1>
      <p className="mt-2 text-lg text-muted">
        نظام شخصي لتداول وتحليل البيتكوين
      </p>
      <div className="mt-8 flex gap-4">
        <Link
          href="/login"
          className="rounded-panel bg-gold/90 px-6 py-2.5 text-sm font-bold text-background transition-colors hover:bg-gold-fg"
        >
          تسجيل الدخول
        </Link>
        <Link
          href="/dashboard"
          className="rounded-panel border border-line px-6 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-surface-2"
        >
          لوحة التحكم
        </Link>
      </div>
    </div>
  );
}
