"use client";

import { useState, type FormEvent } from "react";
import { TextField } from "@mui/material";
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
        <TextField
          id="email"
          type="email"
          required
          fullWidth
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            clearError();
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
          }}
          className="mt-1"
          slotProps={{ htmlInput: { autoComplete: "current-password" } }}
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-panel bg-gold/90 px-4 py-2 text-sm font-bold text-background hover:bg-gold-fg disabled:opacity-50"
      >
        {loading ? "جاري تسجيل الدخول..." : "تسجيل الدخول"}
      </button>
    </form>
  );
}
