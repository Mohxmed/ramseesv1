"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "@/features/auth/hooks/useAuth";

export function LoginForm() {
  const { login, loading, error, clearError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await login({ email, password });
    } catch {
      // error is handled by AuthProvider
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-panel border border-down/40 bg-down/10 p-3 text-sm text-down-fg">
          {error}
        </div>
      )}

      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-zinc-300"
        >
          البريد الإلكتروني
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            clearError();
          }}
          className="mt-1 block w-full rounded-panel border border-line bg-surface-2/60 px-3 py-2 text-sm text-zinc-100 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          dir="ltr"
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="block text-sm font-medium text-zinc-300"
        >
          كلمة المرور
        </label>
        <input
          id="password"
          type="password"
          required
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            clearError();
          }}
          className="mt-1 block w-full rounded-panel border border-line bg-surface-2/60 px-3 py-2 text-sm text-zinc-100 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          dir="ltr"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-panel bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-300 disabled:opacity-50"
      >
        {loading ? "جاري تسجيل الدخول..." : "تسجيل الدخول"}
      </button>
    </form>
  );
}
