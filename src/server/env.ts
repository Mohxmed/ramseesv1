/**
 * SERVER-ONLY — typed, validated accessors for the environment variables the
 * exchange / host layer depends on.
 *
 * Rules this honors:
 *   - Validation is LAZY (function calls, never import-time), so `next dev`
 *     and the unit test suite stay runnable without a production .env.
 *   - Accessors fail fast with an actionable Arabic/English message instead of
 *     silently degrading: a misconfigured production reads a loud error at
 *     startup, not a subtle wrong default at 3am.
 *   - Unset-but-optional values keep a documented default — only *broken*
 *     values (present but invalid) throw.
 *   - Secrets are never logged; validator messages echo the variable name and
 *     the problem, never the value.
 */

function readStr(name: string): string | undefined {
  const v = process.env[name];
  return typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
}

/**
 * Minimum spacing between Binance requests (ms). Optional; defaults to 120ms
 * when unset. Present-but-invalid values throw (fail fast) instead of the old
 * silent fallback that masked a typo like "120ms".
 */
export function exchangeRateLimitMs(): number {
  const raw = readStr("EXCHANGE_RATE_LIMIT_MS");
  if (raw === undefined) return 120;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) {
    throw new Error("EXCHANGE_RATE_LIMIT_MS must be a positive number (milliseconds).");
  }
  return n;
}

/** HTX (Huobi) public stream URL. Optional; defaults to the production endpoint. */
export function htxUpstreamUrl(): string {
  const raw = process.env.HTX_UPSTREAM_URL;
  if (raw === undefined || raw.trim() === "") return "wss://api.huobi.pro/ws";
  const v = raw.trim();
  if (!/^wss?:\/\/.+/.test(v)) {
    throw new Error("HTX_UPSTREAM_URL must be a valid ws:// or wss:// URL.");
  }
  return v;
}

export type FirebaseConfig =
  | { type: "explicit"; account: unknown }
  | { type: "implicit" };

/**
 * Resolve the Firebase service-account configuration. Explicit wins over
 * implicit ADC. A *set but invalid* value throws with the exact problem so a
 * typo in a secret-manager var surfaces immediately instead of failing deep in
 * the Admin SDK with an opaque error.
 */
export function firebaseConfig(): FirebaseConfig {
  const path = readStr("FIREBASE_SERVICE_ACCOUNT_PATH");
  if (path !== undefined) {
    return { type: "explicit", account: { path } };
  }
  const json = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (json !== undefined && json.trim() !== "") {
    try {
      const parsed = JSON.parse(json) as unknown;
      if (typeof parsed !== "object" || parsed === null) {
        throw new Error("parsed to a non-object");
      }
      return { type: "explicit", account: parsed };
    } catch {
      throw new Error("FIREBASE_SERVICE_ACCOUNT is set but is not valid JSON.");
    }
  }
  return { type: "implicit" };
}

/**
 * The vault master key (32 bytes) for exchange-credential encryption. Optional
 * in dev; validated here so a production deploy without it fails loudly.
 * Returns null when unset — the vault itself throws the user-facing error.
 */
export function exchangeEncryptionKey(): string | null {
  const raw = readStr("EXCHANGE_CREDENTIALS_ENC_KEY");
  if (raw === undefined) return null;
  const ok =
    /^[0-9a-fA-F]{64}$/.test(raw) ||
    /^[A-Za-z0-9+/]{43}=$/.test(raw) ||
    /^[A-Za-z0-9+/]{44}$/.test(raw) ||
    raw.length === 32;
  if (!ok) {
    throw new Error(
      "EXCHANGE_CREDENTIALS_ENC_KEY must be 32 bytes (64 hex, 44 base64, or a 32-char raw string)."
    );
  }
  return raw;
}