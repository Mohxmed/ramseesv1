import { type User } from "firebase/auth";

export type AuthUser = Pick<User, "uid" | "email" | "displayName" | "photoURL">;

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
