"use client";

import {
  createContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { getAuthInstance } from "@/lib/firebase/auth";
import { authService } from "../services/auth.service";
import { getAuthErrorMessage } from "@/lib/utils/auth-errors";
import type {
  AuthUser,
  AuthState,
  AuthStatus,
  LoginCredentials,
  RegisterCredentials,
} from "../types";
import { recordBootStep } from "@/features/boot/diagnostics";

/** Max time Firebase may take to resolve the initial session before we fail. */
const AUTH_RESOLVE_TIMEOUT_MS = 8_000;

type AuthContextValue = AuthState & {
  status: AuthStatus;
  authError: string | null;
  retry: () => void;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  error: string | null;
  clearError: () => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

function mapUser(user: User | null): AuthUser | null {
  if (!user) return null;
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("unknown");
  const [error, setError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const auth = getAuthInstance();
    let settled = false;

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      settled = true;
      setUser(mapUser(firebaseUser));
      setStatus(firebaseUser ? "authenticated" : "unauthenticated");
      setAuthError(null);
    });

    // Never hang: if Firebase cannot resolve the session, surface a real error
    // so the boot layer can offer a retry instead of an eternal spinner.
    const timer = window.setTimeout(() => {
      if (settled) return;
      setStatus("error");
      setAuthError(
        "تعذّر التحقق من الجلسة في الوقت المتوقع — تحقق من اتصال الإنترنت وحاول مجددًا."
      );
    }, AUTH_RESOLVE_TIMEOUT_MS);

    return () => {
      unsubscribe();
      window.clearTimeout(timer);
    };
  }, [attempt]);

  useEffect(() => {
    if (status === "authenticated" || status === "unauthenticated") {
      recordBootStep("authResolved");
    }
  }, [status]);

  const retry = useCallback(() => {
    setStatus("unknown");
    setAuthError(null);
    setError(null);
    setAttempt((a) => a + 1);
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    try {
      setError(null);
      await authService.login(credentials);
    } catch (err: unknown) {
      const message = getAuthErrorMessage(
        (err as { code?: string }).code ?? "unknown"
      );
      setError(message);
      throw err;
    }
  }, []);

  const register = useCallback(async (credentials: RegisterCredentials) => {
    try {
      setError(null);
      await authService.register(credentials);
    } catch (err: unknown) {
      const message = getAuthErrorMessage(
        (err as { code?: string }).code ?? "unknown"
      );
      setError(message);
      throw err;
    }
  }, []);

  const loginWithGoogle = useCallback(async () => {
    try {
      setError(null);
      await authService.loginWithGoogle();
    } catch (err: unknown) {
      const message = getAuthErrorMessage(
        (err as { code?: string }).code ?? "unknown"
      );
      setError(message);
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      setError(null);
      await authService.logout();
    } catch (err: unknown) {
      const message = getAuthErrorMessage(
        (err as { code?: string }).code ?? "unknown"
      );
      setError(message);
      throw err;
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
    setAuthError(null);
  }, []);

  const loading = status === "unknown";

  const value: AuthContextValue = {
    user,
    loading,
    isAuthenticated: status === "authenticated",
    status,
    authError,
    retry,
    login,
    register,
    loginWithGoogle,
    logout,
    error,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
