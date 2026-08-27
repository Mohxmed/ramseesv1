"use client";

import { useAuth } from "@/features/auth/hooks/useAuth";

export function LogoutButton() {
  const { logout, loading } = useAuth();

  return (
    <button
      type="button"
      onClick={() => logout()}
      disabled={loading}
      className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-700"
    >
      {loading ? "جاري..." : "تسجيل الخروج"}
    </button>
  );
}
