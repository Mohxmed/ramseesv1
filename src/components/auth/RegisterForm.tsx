"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "@/features/auth/hooks/useAuth";

export function RegisterForm() {
  const { register, loading, error, clearError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLocalError(null);

    if (password !== confirmPassword) {
      setLocalError("كلمتا المرور غير متطابقتين.");
      return;
    }

    if (password.length < 6) {
      setLocalError("كلمة المرور يجب أن تحتوي على 6 أحرف على الأقل.");
      return;
    }

    try {
      await register({ email, password, confirmPassword });
    } catch {
      // error is handled by AuthProvider
    }
  }

  const displayError = localError ?? error;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {displayError && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {displayError}
        </div>
      )}

      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
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
            setLocalError(null);
          }}
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          dir="ltr"
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
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
            setLocalError(null);
          }}
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          dir="ltr"
        />
      </div>

      <div>
        <label
          htmlFor="confirmPassword"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          تأكيد كلمة المرور
        </label>
        <input
          id="confirmPassword"
          type="password"
          required
          value={confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.target.value);
            clearError();
            setLocalError(null);
          }}
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          dir="ltr"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {loading ? "جاري إنشاء الحساب..." : "إنشاء حساب"}
      </button>
    </form>
  );
}
