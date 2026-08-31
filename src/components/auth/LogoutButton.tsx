"use client";

import { useAuth } from "@/features/auth/hooks/useAuth";

export function LogoutButton() {
  const { logout, loading } = useAuth();

  return (
    <button
      type="button"
      onClick={() => logout()}
      disabled={loading}
      className="rounded-panel border border-line px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-surface-2 disabled:opacity-50"
    >
      {loading ? "جاري..." : "تسجيل الخروج"}
    </button>
  );
}
