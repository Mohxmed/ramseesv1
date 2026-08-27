import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  type UserCredential,
} from "firebase/auth";
import { getAuthInstance } from "@/lib/firebase/auth";
import type { LoginCredentials, RegisterCredentials } from "../types";

function getAuth() {
  return getAuthInstance();
}

export const authService = {
  async register(credentials: RegisterCredentials): Promise<UserCredential> {
    return createUserWithEmailAndPassword(
      getAuth(),
      credentials.email,
      credentials.password
    );
  },

  async login(credentials: LoginCredentials): Promise<UserCredential> {
    return signInWithEmailAndPassword(
      getAuth(),
      credentials.email,
      credentials.password
    );
  },

  async loginWithGoogle(): Promise<UserCredential> {
    const provider = new GoogleAuthProvider();
    return signInWithPopup(getAuth(), provider);
  },

  async logout(): Promise<void> {
    return signOut(getAuth());
  },
};
