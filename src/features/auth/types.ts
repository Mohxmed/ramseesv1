import { type User } from "firebase/auth";

export type AuthUser = Pick<User, "uid" | "email" | "displayName" | "photoURL">;

/**
 * Auth resolution status. `unknown` until Firebase reports back; `error` only
 * when the resolution exceeds the auth timeout (never a permanent state).
 */
export type AuthStatus =
  | "unknown"
  | "authenticated"
  | "unauthenticated"
  | "error";

export type AuthState = {
  user: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
};

export type LoginCredentials = {
  email: string;
  password: string;
};

export type RegisterCredentials = LoginCredentials & {
  confirmPassword: string;
};

export type AuthError = {
  code: string;
  message: string;
};
