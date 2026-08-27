"use client";

import Link from "next/link";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { useStrategies } from "@/features/decision/hooks/useStrategies";

export default function DashboardPage() {
  const { user } = useAuth();
  const { strategies } = useStrategies();

  const available = strategies.filter((s) => s.enabled).length;

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-100">لوحة التحكم</h1>
      <p className="mt-2 text-sm text-zinc-500">
        نظرة عامة على النظام والوصول السريع إلى الميزات.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link
          href="/strategies"
          className="group rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 transition-colors hover:border-zinc-600"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-100">الاستراتيجيات</h3>
            <span className="text-lg">🧩</span>
          </div>
          <div className="mt-4 flex items-end justify-between">
            <div className="text-3xl font-bold text-zinc-100">{strategies.length}</div>
            <span className="text-[11px] text-zinc-500">
              {available} مفعّلة / {strategies.length - available} معطّلة
            </span>
          </div>
          <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-zinc-500">الدقة</div>
            <div className="mt-0.5 text-lg font-bold text-zinc-100">0%</div>
            <div className="text-[10px] text-zinc-500">لم تتوفر نتائج بعد</div>
          </div>
        </Link>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
          <h3 className="text-sm font-semibold text-zinc-100">مركز القرارات</h3>
          <p className="mt-2 text-xs text-zinc-500">
            تقييم مباشر لاستراتيجيتك بناءً على بيانات السوق الحية.
          </p>
          <Link
            href="/decision-center"
            className="mt-3 inline-block rounded-md border border-zinc-700 bg-zinc-800/60 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:border-zinc-500"
          >
            فتح مركز القرارات
          </Link>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
          <h3 className="text-sm font-semibold text-zinc-100">الحساب</h3>
          <p className="mt-2 truncate text-xs text-zinc-400">
            مرحبًا، {user?.displayName ?? user?.email ?? "مستخدم"}
          </p>
          <div className="mt-3">
            <LogoutButton />
          </div>
        </div>
      </div>
    </div>
  );
}
