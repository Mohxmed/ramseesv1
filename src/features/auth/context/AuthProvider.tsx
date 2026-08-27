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
  LoginCredentials,
  RegisterCredentials,
  AuthError,
} from "../types";

type AuthContextValue = AuthState & {
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const auth = getAuthInstance();
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(mapUser(firebaseUser));
      setLoading(false);
    });
    return unsubscribe;
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

  const clearError = useCallback(() => setError(null), []);

  const value: AuthContextValue = {
    user,
    loading,
    isAuthenticated: user !== null,
    login,
    register,
    loginWithGoogle,
    logout,
    error,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
