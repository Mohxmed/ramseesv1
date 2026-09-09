import "server-only";
import { cert, getApps, initializeApp, type ServiceAccount } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

/**
 * Firebase Admin bootstrap — SERVER-ONLY.
 *
 * Used by the portfolio API routes to (a) verify Firebase ID tokens and
 * (b) read/write Firestore with elevated (rules-bypassing) permissions, which
 * is what lets the app keep exchange credentials out of client-reachable
 * paths. Nothing here is ever bundled client-side (`import "server-only"`).
 *
 * Credentials resolution order:
 *   1. FIREBASE_SERVICE_ACCOUNT_PATH — path to a downloaded service-account JSON
 *      (never commit this file; .gitignore covers *-firebase-adminsdk-*.json)
 *   2. FIREBASE_SERVICE_ACCOUNT — the JSON payload itself (env/secret manager)
 *   3. GOOGLE_APPLICATION_CREDENTIALS / gcloud ADC — implicit environment
 *
 * The app is a singleton: `initializeApp` is called exactly once.
 */

let app: ReturnType<typeof initializeApp> | null = null;

function resolveCredentials():
  | { type: "explicit"; account: ServiceAccount }
  | { type: "implicit" } {
  const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (path) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const loaded = require(path) as ServiceAccount;
      return { type: "explicit", account: loaded };
    } catch {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT_PATH is set but the file could not be loaded."
      );
    }
  }
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const parsed = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT) as ServiceAccount;
      return { type: "explicit", account: parsed };
    } catch {
      throw new Error("FIREBASE_SERVICE_ACCOUNT is set but is not valid JSON.");
    }
  }
  return { type: "implicit" };
}

export function getAdminApp() {
  if (app) return app;
  const existing = getApps()[0];
  if (existing) {
    app = existing;
    return existing;
  }
  const creds = resolveCredentials();
  app =
    creds.type === "explicit"
      ? initializeApp({ credential: cert(creds.account) })
      : initializeApp(); // ADC / GOOGLE_APPLICATION_CREDENTIALS
  return app;
}

export function getAdminAuth() {
  return getAuth(getAdminApp());
}

export function getAdminDb() {
  return getFirestore(getAdminApp());
}