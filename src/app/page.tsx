import Link from "next/link";
import Image from "next/image";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-1">
      <Image
        src="/favicon.jpg"
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
          className="rounded-panel bg-zinc-100 px-6 py-2.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-300"
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
