import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950">
      <h1 className="text-4xl font-bold text-zinc-50">RAMSEES</h1>
      <p className="mt-2 text-lg text-zinc-400">
        نظام شخصي لتداول وتحليل البيتكوين
      </p>
      <div className="mt-8 flex gap-4">
        <Link
          href="/login"
          className="rounded-md bg-zinc-100 px-6 py-2.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-300"
        >
          تسجيل الدخول
        </Link>
        <Link
          href="/dashboard"
          className="rounded-md border border-zinc-700 px-6 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800"
        >
          لوحة التحكم
        </Link>
      </div>
    </div>
  );
}
