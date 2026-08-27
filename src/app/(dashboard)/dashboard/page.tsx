"use client";

import { useAuth } from "@/features/auth/hooks/useAuth";
import { LogoutButton } from "@/components/auth/LogoutButton";

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-100">لوحة التحكم</h1>
      <p className="mt-2 text-sm text-zinc-500">
        نظرة عامة على النظام والوصول السريع إلى الميزات.
      </p>

      <div className="mt-8 rounded-lg border border-zinc-800 bg-zinc-900/40 p-6">
        <h3 className="mb-4 text-lg font-semibold text-zinc-100">الحساب</h3>
        <div className="space-y-2">
          <p className="text-sm text-zinc-400">
            مرحبًا، {user?.displayName ?? user?.email ?? "مستخدم"}
          </p>
        </div>
        <div className="mt-4">
          <LogoutButton />
        </div>
      </div>
    </div>
  );
}
