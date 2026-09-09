/**
 * SERVER-ONLY — never import from client components.
 *
 * BinanceAdapter — implements ExchangeAdapter for Binance (Spot + USDⓈ-M
 * Futures). It is the ONLY module that knows about Binance endpoints; the rest
 * of the system talks to it through the generic interface. Pure WRITE-NOTHING
 * transport: every method returns canonical models.
 * It next-day supports WebSocket user-data via BinanceWebSocketClient.
 */

import { ExchangeError } from "../core/ExchangeErrors";
import type {
  ExchangeAdapter,
  ExchangeCredentials,
  ExchangeUserDataHandlers,
} from "../core/ExchangeAdapter";
import type {
  AccountType,
  ConnectionTestResult,
  ExchangeAccountInfo,
  ExchangeBalance,
  ExchangeCapabilities,
  ExchangeDataWindow,
  ExchangeOrder,
  ExchangePosition,
  ExchangeTrade,
  ExchangeTransaction,
  ExchangeType,
} from "../core/ExchangeTypes";
import {
  BinanceRestClient,
} from "./BinanceRestClient";
import { BinanceWebSocketClient } from "./BinanceWebSocketClient";
import {
  assertSpotAccountPayload,
  detectPermissions,
  mapDeposit,
  mapFuturesBalances,
  mapFuturesIncome,
  mapFuturesTrade,
  mapPositionRisk,
  mapSpotBalances,
  mapSpotOrder,
  mapSpotTrade,
  mapWithdrawal,
  type RawDeposit,
  type RawFuturesBalance,
  type RawFuturesIncome,
  type RawFuturesTrade,
  type RawPositionRisk,
  type RawSpotAccount,
  type RawSpotOrder,
  type RawSpotTrade,
  type RawWithdrawal,
} from "./BinanceMapper";

export const BINANCE_ACCOUNT_TYPES: readonly AccountType[] = ["SPOT", "FUTURES"];

/** 7-day hard limit Binance imposes on single myTrades/allOrders queries. */
const TRADE_CHUNK_MS = 7 * 24 * 60 * 60 * 1000;
const DEPOSIT_CHUNK_MS = 30 * 24 * 60 * 60 * 1000;
const PAGE_SIZE = 1000;
/** Hard cap per fetch — a runaway history (years × symbols) can never hang. */
const SAFE_MAX_ROWS = 50_000;

const BINANCE_CAPABILITIES: ExchangeCapabilities = {
  supportsSpot: true,
  supportsFutures: true,
  supportsMargin: false,
  supportsDeposits: true,
  supportsWithdrawals: true,
  supportsTrades: true,
  supportsOrders: true,
  supportsWebSocket: true,
  supportsFunding: true,
  supportsPositions: true,
  supportsPnl: false, // Binance does not expose a bulk historical PnL feed
  supportsAccountSnapshots: false,
};

interface AccountKey {
  exchange: ExchangeType;
  accountId: string;
  accountType: AccountType;
}

export class BinanceAdapter implements ExchangeAdapter {
  readonly exchangeType: ExchangeType = "BINANCE";
  readonly capabilities: ExchangeCapabilities = BINANCE_CAPABILITIES;

  private readonly rest: BinanceRestClient;
  private ws: BinanceWebSocketClient | null = null;

  constructor(opts: { rest?: BinanceRestClient } = {}) {
    this.rest = opts.rest ?? new BinanceRestClient();
  }

  async testConnection(creds: ExchangeCredentials): Promise<ConnectionTestResult> {
    // 1) system status (public) — cheap reachability probe
    const status = await this.rest.publicGet<{ status: number; msg?: string }>("/api/v3/system/status");
    if (status !== undefined && status?.status !== 0) {
      throw new ExchangeError("binance system degraded", {
        kind: "CONNECTION",
        code: "UPSTREAM_DEGRADED",
        context: { systemStatus: status?.status },
      });
    }
    // 2) signed account probe — validates key + secret + permissions. A valid
    //    spot-inaccessible key (futures-only) falls back to an fapi read so
    //    futures users aren't rejected for not enabling spot.
    try {
      const raw = await this.rest.signedGet<RawSpotAccount>(
        creds,
        "/api/v3/account",
        {},
        { futures: false }
      );
      const acct = assertSpotAccountPayload(raw);
      const permissions = detectPermissions(acct);
      const info: ExchangeAccountInfo = {
        id: acct.updateTime != null ? String(acct.updateTime) : "",
        name: "Binance",
        permissions,
      };
      return { ok: true, accountInfo: info };
    } catch (err) {
      if (err instanceof ExchangeError && err.kind === "AUTHENTICATION") throw err;
      if (err instanceof ExchangeError && ["PERMISSION", "VALIDATION", "UNSUPPORTED"].includes(err.kind)) {
        try {
          // Futures-only key → the spot read is not allowed, but fapi is.
          const futures = await this.rest.signedGet<RawFuturesBalance[]>(
            creds,
            "/fapi/v2/balance",
            {},
            { futures: true }
          );
          if (Array.isArray(futures)) {
            return {
              ok: true,
              accountInfo: {
                id: "",
                name: "Binance (Futures)",
                permissions: {
                  readOnly: true,
                  tradingEnabled: false,
                  withdrawalsEnabled: false,
                  transfersEnabled: false,
                },
              },
            };
          }
        } catch {
          // fall through — report the spot probe failure below
        }
      }
      if (err instanceof ExchangeError && err.kind === "VALIDATION") {
        throw ExchangeError.auth("invalid api key or signature", { httpStatus: 400 });
      }
      throw err;
    }
  }

  async getAccountInfo(creds: ExchangeCredentials): Promise<ExchangeAccountInfo> {
    const raw = await this.rest.signedGet<RawSpotAccount>(creds, "/api/v3/account");
    const acct = assertSpotAccountPayload(raw);
    return { id: "", name: "Binance", permissions: detectPermissions(acct) };
  }

  async getBalances(creds: ExchangeCredentials, accountType: AccountType): Promise<ExchangeBalance[]> {
    const key = {
      exchange: this.exchangeType,
      accountId: creds.extra?.accountId ?? "",
      accountType,
    } as AccountKey;
    if (accountType === "SPOT") {
      const raw = await this.rest.signedGet<RawSpotAccount>(creds, "/api/v3/account");
      const acct = assertSpotAccountPayload(raw);
      return mapSpotBalances(acct.balances ?? [], key);
    }
    if (accountType === "FUTURES") {
      // A spot-only key legitimately cannot read fapi endpoints — that is a
      // "no futures access" signal, not a sync failure (403/-2015/400).
      return this.futuresSafe<ExchangeBalance[]>(async () => {
        const raw = await this.rest.signedGet<RawFuturesBalance[]>(
          creds,
          "/fapi/v2/balance",
          {},
          { futures: true }
        );
        return mapFuturesBalances(raw ?? [], key);
      }, []);
    }
    return [];
  }

  async getPositions(creds: ExchangeCredentials, accountType: AccountType): Promise<ExchangePosition[]> {
    if (accountType !== "FUTURES") return [];
    return this.futuresSafe<ExchangePosition[]>(async () => {
      const raw = await this.rest.signedGet<RawPositionRisk[]>(
        creds,
        "/fapi/v2/positionRisk",
        {},
        { futures: true }
      );
      const out: ExchangePosition[] = [];
      for (const r of raw ?? []) {
        const pos = mapPositionRisk(r);
        if (pos) out.push(pos);
      }
      return out;
    }, []);
  }

  async getOpenOrders(creds: ExchangeCredentials, accountType: AccountType): Promise<ExchangeOrder[]> {
    if (accountType === "SPOT") {
      const raw = await this.rest.signedGet<RawSpotOrder[]>(creds, "/api/v3/openOrders");
      return (raw ?? []).map((r) => mapSpotOrder(r));
    }
    if (accountType === "FUTURES") {
      return this.futuresSafe<ExchangeOrder[]>(async () => {
        const raw = await this.rest.signedGet<RawSpotOrder[]>(
          creds,
          "/fapi/v1/openOrders",
          {},
          { futures: true }
        );
return (raw ?? []).map((r) => mapSpotOrder(r));
      }, []);
    }
    return [];
  }

  /** Historical orders require a symbol — returns [] until a symbol scope is given. */
  async getOrders(_creds: ExchangeCredentials, accountType: AccountType, window?: ExchangeDataWindow): Promise<ExchangeOrder[]> {
    if (!window?.symbols?.length) return [];
    const out: ExchangeOrder[] = [];
    for (const symbol of window.symbols) {
      try {
        const rows = await this.fetchChunked<RawSpotOrder>(
          async (from, to) => {
            const path = accountType === "FUTURES" ? "/fapi/v1/allOrders" : "/api/v3/allOrders";
            const raw = await this.rest.signedGet<RawSpotOrder[]>(
              _creds,
              path,
              { symbol, startTime: from, endTime: to, limit: PAGE_SIZE },
              { futures: accountType === "FUTURES" }
            );
            return { items: raw ?? [], hasMore: (raw ?? []).length >= PAGE_SIZE };
          },
          window.fromMs,
          window.toMs,
          TRADE_CHUNK_MS,
          (r) => r.time
        );
        out.push(...rows.map((r) => mapSpotOrder(r)));
      } catch (err) {
        void this.skipSymbol(err, symbol);
      }
    }
    return out;
  }

  async getTrades(creds: ExchangeCredentials, accountType: AccountType, window?: ExchangeDataWindow): Promise<ExchangeTrade[]> {
    const out: ExchangeTrade[] = [];
    const symbols = window?.symbols?.length ? window.symbols : [];
    const path = accountType === "FUTURES" ? "/fapi/v1/userTrades" : "/api/v3/myTrades";

    for (const symbol of symbols) {
      try {
        const rows = await this.fetchChunked<RawSpotTrade | RawFuturesTrade>(
          async (from, to) => {
            const raw = await this.rest.signedGet<Array<RawSpotTrade | RawFuturesTrade>>(
              creds,
              path,
              { symbol, startTime: from, endTime: to, limit: PAGE_SIZE },
              { futures: accountType === "FUTURES" }
            );
            return { items: raw ?? [], hasMore: (raw ?? []).length >= PAGE_SIZE };
          },
          window?.fromMs ?? null,
          window?.toMs ?? null,
          TRADE_CHUNK_MS,
          (r) => r.time
        );
        for (const r of rows) {
          out.push(
            accountType === "FUTURES"
? mapFuturesTrade(r as RawFuturesTrade)
            : mapSpotTrade(r as RawSpotTrade)
          );
        }
      } catch (err) {
        void this.skipSymbol(err, symbol);
      }
    }
    out.sort((a, b) => a.timestamp - b.timestamp);
    return out;
  }

  async getDeposits(creds: ExchangeCredentials, window?: ExchangeDataWindow): Promise<ExchangeTransaction[]> {
    const key = {
      exchange: this.exchangeType,
      accountId: creds.extra?.accountId ?? "",
      accountType: "SPOT" as AccountType,
    } as AccountKey;
    const rows = await this.fetchChunked<RawDeposit>(
      async (from, to) => {
        const raw = await this.rest.signedGet<RawDeposit[]>(
          creds,
          "/sapi/v1/capital/deposit/hisrec",
          { startTime: from, endTime: to }
        );
        return { items: raw ?? [], hasMore: false };
      },
      window?.fromMs ?? null,
      window?.toMs ?? null,
      DEPOSIT_CHUNK_MS,
      (r) => r.insertTime
    );
    return rows.map((r) => mapDeposit(r, key));
  }

  async getWithdrawals(creds: ExchangeCredentials, window?: ExchangeDataWindow): Promise<ExchangeTransaction[]> {
    const key = {
      exchange: this.exchangeType,
      accountId: creds.extra?.accountId ?? "",
      accountType: "SPOT" as AccountType,
    } as AccountKey;
    const rows = await this.fetchChunked<RawWithdrawal>(
      async (from, to) => {
        const raw = await this.rest.signedGet<RawWithdrawal[]>(
          creds,
          "/sapi/v1/capital/withdraw/history",
          { startTime: from, endTime: to }
        );
        return { items: raw ?? [], hasMore: false };
      },
      window?.fromMs ?? null,
      window?.toMs ?? null,
      DEPOSIT_CHUNK_MS,
      (r) => r.applyTime
    );
    return rows.map((r) => mapWithdrawal(r, key));
  }

  async getFundingHistory(creds: ExchangeCredentials, accountType: AccountType, window?: ExchangeDataWindow): Promise<ExchangeTransaction[]> {
    if (accountType !== "FUTURES") return [];
    const key = {
      exchange: this.exchangeType,
      accountId: creds.extra?.accountId ?? "",
      accountType,
    } as AccountKey;
    return this.futuresSafe<ExchangeTransaction[]>(async () => {
      const rows = await this.fetchChunked<RawFuturesIncome>(
        async (from, to) => {
          const raw = await this.rest.signedGet<RawFuturesIncome[]>(
            creds,
            "/fapi/v1/income",
            { incomeType: "FUNDING_FEE", startTime: from, endTime: to, limit: PAGE_SIZE },
            { futures: true }
          );
          return { items: raw ?? [], hasMore: (raw ?? []).length >= PAGE_SIZE };
        },
        window?.fromMs ?? null,
        window?.toMs ?? null,
        TRADE_CHUNK_MS,
        (r) => r.time
      );
      return rows.map((r) => mapFuturesIncome(r, key));
    }, []);
  }

  subscribeToUserData(creds: ExchangeCredentials, handlers: ExchangeUserDataHandlers): () => void {
    if (this.ws) {
      // Only one live user-data stream per adapter instance.
      void this.ws.stop().catch(() => undefined);
    }
    const ws = new BinanceWebSocketClient(this.rest, {
      onDisconnect: () => handlers.onDisconnect?.(),
      onOutboundAccountPosition: (assets) => {
        try {
          const accountId = creds.extra?.accountId ?? "";
          const balances: ExchangeBalance[] = assets.map((a) => ({
            exchange: this.exchangeType,
            accountId,
            accountType: "SPOT",
            walletType: "SPOT",
            asset: a.a,
            free: Number(a.f),
            locked: Number(a.l),
            total: Number(a.f) + Number(a.l),
            available: Number(a.f),
            usdValue: 0,
            price: null,
            valuedAt: Date.now(),
          }));
          handlers.onBalancesChange?.(balances);
        } catch {
          /* WS-derived hints are additive; failures must not propagate */
        }
      },
    });
    this.ws = ws;
    void ws.start(creds).catch(() => undefined);
    return () => {
      void ws.stop().catch(() => undefined);
      if (this.ws === ws) this.ws = null;
    };
  }

  disconnect(): void {
    if (this.ws) {
      void this.ws.stop().catch(() => undefined);
      this.ws = null;
    }
  }

  /**
   * Generic time-window paging: splits [from..to) into fixed-size chunks
   * (Binance 7-day query limits) and pages inside each chunk by advancing
   * startTime past the newest row — overlap is deduplicated by id idempotency.
   * Hard-capped (SAFE_MAX_ROWS) so a huge history can never run away.
   */
  private async fetchChunked<T>(
    fetchRange: (from: number, to: number) => Promise<{ items: T[]; hasMore: boolean }>,
    fromMs: number | null,
    toMs: number | null,
    chunkMs: number,
    extractTime: (row: T) => number
  ): Promise<T[]> {
    const out: T[] = [];
    const end = toMs ?? Date.now();
    let start = fromMs ?? 0;
    if (end <= start) return out;
    while (start < end) {
      const chunkEnd = Math.min(start + chunkMs, end);
      let cursor = start;
      for (;;) {
        const { items, hasMore } = await fetchRange(cursor, chunkEnd);
        out.push(...items);
        if (out.length >= SAFE_MAX_ROWS) return out.slice(0, SAFE_MAX_ROWS);
        if (!hasMore || items.length === 0) break;
        const last = items[items.length - 1];
        const next = extractTime(last) + 1;
        if (!Number.isFinite(next) || next <= cursor) break; // progress guard
        cursor = next;
      }
      start = chunkEnd;
    }
    return out;
  }

  /**
   * Futures surfaces are OPTIONAL (a spot-only key cannot read fapi). Such
   * failures degrade to empty — never abort a whole sync. Genuine network /
   * rate-limit errors still propagate via `throw err`.
   */
  private async futuresSafe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof ExchangeError && err.kind !== "NETWORK" && err.kind !== "RATE_LIMIT" && err.kind !== "CONNECTION") {
        return fallback;
      }
      throw err;
    }
  }

  /** Per-symbol tolerance: one bad symbol must not kill the whole history. */
  private skipSymbol(err: unknown, symbol: string): void {
    void err;
    void symbol;
  }
}