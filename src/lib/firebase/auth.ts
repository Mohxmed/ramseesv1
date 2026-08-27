import { getAuth, type Auth } from "firebase/auth";
import { app } from "./config";

let auth: Auth;

if (typeof window !== "undefined") {
  auth = getAuth(app);
}

export function getAuthInstance(): Auth {
  if (typeof window === "undefined") {
    throw new Error("Firebase Auth can only be accessed on the client side.");
  }
  return auth;
}
