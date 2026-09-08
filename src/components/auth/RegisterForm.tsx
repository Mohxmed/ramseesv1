"use client";

import { useState, type FormEvent } from "react";
import { TextField } from "@mui/material";
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
        <div className="rounded-panel border border-down/40 bg-down/10 p-3 text-sm text-down-fg">
          {displayError}
        </div>
      )}

      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-zinc-300"
        >
          البريد الإلكتروني
        </label>
        <TextField
          id="email"
          type="email"
          required
          fullWidth
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            clearError();
            setLocalError(null);
          }}
          className="mt-1"
          slotProps={{ htmlInput: { autoComplete: "email" } }}
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="block text-sm font-medium text-zinc-300"
        >
          كلمة المرور
        </label>
        <TextField
          id="password"
          type="password"
          required
          fullWidth
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            clearError();
            setLocalError(null);
          }}
          className="mt-1"
          slotProps={{ htmlInput: { autoComplete: "new-password" } }}
        />
      </div>

      <div>
        <label
          htmlFor="confirmPassword"
          className="block text-sm font-medium text-zinc-300"
        >
          تأكيد كلمة المرور
        </label>
        <TextField
          id="confirmPassword"
          type="password"
          required
          fullWidth
          value={confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.target.value);
            clearError();
            setLocalError(null);
          }}
          className="mt-1"
          slotProps={{ htmlInput: { autoComplete: "new-password" } }}
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-panel bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-300 disabled:opacity-50"
      >
        {loading ? "جاري إنشاء الحساب..." : "إنشاء حساب"}
      </button>
    </form>
  );
}
