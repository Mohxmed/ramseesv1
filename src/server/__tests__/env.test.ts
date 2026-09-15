import { afterEach, describe, expect, it } from "vitest";
import {
  exchangeRateLimitMs,
  htxUpstreamUrl,
  firebaseConfig,
  exchangeEncryptionKey,
} from "../env";

const keep: Record<string, string | undefined> = {};

function stash(...names: string[]) {
  for (const n of names) keep[n] = process.env[n];
}
function restore() {
  for (const [n, v] of Object.entries(keep)) {
    if (v === undefined) delete process.env[n];
    else process.env[n] = v;
  }
}

const ENV = ["EXCHANGE_RATE_LIMIT_MS", "HTX_UPSTREAM_URL", "FIREBASE_SERVICE_ACCOUNT", "EXCHANGE_CREDENTIALS_ENC_KEY"];

afterEach(() => {
  restore();
  for (const n of ENV) delete keep[n];
});

describe("exchangeRateLimitMs", () => {
  it("defaults to 120ms when unset", () => {
    stash(...ENV);
    delete process.env.EXCHANGE_RATE_LIMIT_MS;
    expect(exchangeRateLimitMs()).toBe(120);
  });

  it("parses a valid positive number", () => {
    stash(...ENV);
    process.env.EXCHANGE_RATE_LIMIT_MS = "250";
    expect(exchangeRateLimitMs()).toBe(250);
  });

  it("throws on present-but-invalid values instead of silently defaulting", () => {
    stash(...ENV);
    process.env.EXCHANGE_RATE_LIMIT_MS = "120ms";
    expect(() => exchangeRateLimitMs()).toThrow(/EXCHANGE_RATE_LIMIT_MS/);
    process.env.EXCHANGE_RATE_LIMIT_MS = "-5";
    expect(() => exchangeRateLimitMs()).toThrow(/EXCHANGE_RATE_LIMIT_MS/);
  });
});

describe("htxUpstreamUrl", () => {
  it("defaults to the production endpoint when unset", () => {
    stash(...ENV);
    delete process.env.HTX_UPSTREAM_URL;
    expect(htxUpstreamUrl()).toBe("wss://api.huobi.pro/ws");
  });

  it("accepts a ws/wss URL", () => {
    stash(...ENV);
    process.env.HTX_UPSTREAM_URL = "wss://api.huobi.pro/ws";
    expect(htxUpstreamUrl()).toBe("wss://api.huobi.pro/ws");
  });

  it("throws on a non-ws URL", () => {
    stash(...ENV);
    process.env.HTX_UPSTREAM_URL = "https://api.huobi.pro/ws";
    expect(() => htxUpstreamUrl()).toThrow(/HTX_UPSTREAM_URL/);
  });
});

describe("firebaseConfig", () => {
  it("reports implicit when nothing is configured", () => {
    stash(...ENV);
    delete process.env.FIREBASE_SERVICE_ACCOUNT;
    expect(firebaseConfig().type).toBe("implicit");
  });

  it("parses an explicit JSON credential block", () => {
    stash(...ENV);
    process.env.FIREBASE_SERVICE_ACCOUNT = '{"project_id":"demo"}';
    const cfg = firebaseConfig();
    expect(cfg.type).toBe("explicit");
    if (cfg.type === "explicit") {
      expect((cfg.account as { project_id?: string }).project_id).toBe("demo");
    }
  });

  it("throws a descriptive error on invalid JSON", () => {
    stash(...ENV);
    process.env.FIREBASE_SERVICE_ACCOUNT = "{not json";
    expect(() => firebaseConfig()).toThrow(/not valid JSON/);
  });
});

describe("exchangeEncryptionKey", () => {
  it("returns null when unset", () => {
    stash(...ENV);
    delete process.env.EXCHANGE_CREDENTIALS_ENC_KEY;
    expect(exchangeEncryptionKey()).toBeNull();
  });

  it("accepts a 64-char hex key", () => {
    stash(...ENV);
    process.env.EXCHANGE_CREDENTIALS_ENC_KEY = "b".repeat(64);
    expect(exchangeEncryptionKey()).toBe("b".repeat(64));
  });

  it("throws on a wrong-length key", () => {
    stash(...ENV);
    process.env.EXCHANGE_CREDENTIALS_ENC_KEY = "too-short";
    expect(() => exchangeEncryptionKey()).toThrow(/EXCHANGE_CREDENTIALS_ENC_KEY/);
  });
});