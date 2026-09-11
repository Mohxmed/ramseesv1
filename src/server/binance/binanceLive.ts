/**
 * SERVER-ONLY — Binance live-session plumbing.
 *
 * Unlike the sync layer (which pulls buckets of history into Firestore), this
 * module serves the LIVE path the socket manager consumes:
 *   - short-lived FUTURES listen keys (created server-side, kept alive
 *     server-side, delivered to the browser as an ephemeral session token),
 *   - an authoritative REST snapshot of the account (equity + open positions)
 *     used to seed the socket store and reconcile after a disconnection.
 *
 * Rules this honors:
 *   - It never writes. The API secret only ever exists as the per-call vault
 *     decrypted creds object passed in by the route.
 *   - The listenKey is an ephemeral non-secret session handle (expires in ~60
 *     minutes, refreshed every 30 via PUT) — NOT a credential; it cannot move
 *     funds and only authorizes the user-data stream of its owner.
 */

import { BinanceRestClient } from "@/server/exchanges/binance/BinanceRestClient";
import {
  mapPositionRisk,
  type RawPositionRisk,
} from "@/server/exchanges/binance/BinanceMapper";
import { ExchangeError, type ExchangeCredentials } from "@/server/exchanges/core";

const rest = new BinanceRestClient();

/** POST /fapi/v1/listenKey — a fresh User Data stream session token. */
export async function createFuturesListenKey(creds: ExchangeCredentials): Promise<string> {
  const res = await rest.signedPost<{ listenKey: string }>(
    creds,
    "/fapi/v1/listenKey",
    {},
    { futures: true }
  );
  if (!res?.listenKey) throw ExchangeError.mapping({ stage: "listenKey:create" });
  return res.listenKey;
}

/** PUT /fapi/v1/listenKey — keeps an existing session alive (the WS stays up). */
export async function keepAliveFuturesListenKey(
  creds: ExchangeCredentials,
  listenKey: string
): Promise<void> {
  await rest.signedPut<Record<string, unknown>>(
    creds,
    "/fapi/v1/listenKey",
    { listenKey },
    { futures: true }
  );
}

/** Raw /fapi/v1/account — the single-call source for equity numbers. */
interface RawFuturesAccount {
  totalWalletBalance?: string;
  totalUnrealizedProfit?: string;
  totalMarginBalance?: string;
  availableBalance?: string;
  assets?: unknown[];
}

export interface FuturesLivePosition {
  symbol: string;
  side: "LONG" | "SHORT";
  quantity: number;
  entryPrice: number;
  markPrice: number;
  liquidationPrice: number | null;
  leverage: number;
  margin: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number | null;
  notional: number;
  timestamp: number;
  pricedLive: true;
  valuedAt: number;
}

export interface FuturesLiveState {
  equity: number;
  walletBalance: number;
  unrealizedPnl: number;
  availableBalance: number;
  positions: FuturesLivePosition[];
  aggregate: {
    unrealizedPnl: number;
    margin: number;
    notional: number;
    count: number;
  };
  at: number;
}

export function emptyFuturesLiveState(at = Date.now()): FuturesLiveState {
  return {
    equity: 0,
    walletBalance: 0,
    unrealizedPnl: 0,
    availableBalance: 0,
    positions: [],
    aggregate: { unrealizedPnl: 0, margin: 0, notional: 0, count: 0 },
    at,
  };
}

/** Signed REST snapshot — equity, balances and open positions in one shot. */
export async function fetchFuturesLiveState(creds: ExchangeCredentials): Promise<FuturesLiveState> {
  const [acct, rawPositions] = await Promise.all([
    rest.signedGet<RawFuturesAccount>(creds, "/fapi/v1/account", {}, { futures: true }),
    rest.signedGet<RawPositionRisk[]>(creds, "/fapi/v2/positionRisk", {}, { futures: true }),
  ]);
  const at = Date.now();

  const toNum = (v: string | undefined): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  const equity = toNum(acct?.totalMarginBalance);
  const walletBalance = toNum(acct?.totalWalletBalance);
  const unrealized = toNum(acct?.totalUnrealizedProfit);
  const available = toNum(acct?.availableBalance);

  let margin = 0;
  let notional = 0;
  const positions: FuturesLivePosition[] = [];
  for (const r of rawPositions ?? []) {
    const p = mapPositionRisk(r);
    if (!p) continue;
    const pnl = p.unrealizedPnl;
    const unrealizedPnlPct = p.margin > 0 ? (pnl / p.margin) * 100 : null;
    margin += p.margin;
    notional += p.notional;
    positions.push({
      symbol: p.symbol,
      side: p.side,
      quantity: p.quantity,
      entryPrice: p.entryPrice,
      markPrice: p.markPrice,
      liquidationPrice: p.liquidationPrice,
      leverage: p.leverage,
      margin: p.margin,
      unrealizedPnl: pnl,
      unrealizedPnlPct,
      notional: p.notional,
      timestamp: p.timestamp,
      pricedLive: true,
      valuedAt: at,
    });
  }

  return {
    equity,
    walletBalance,
    unrealizedPnl: unrealized,
    availableBalance: available,
    positions,
    aggregate: {
      unrealizedPnl: positions.reduce((s, p) => s + p.unrealizedPnl, 0),
      margin,
      notional,
      count: positions.length,
    },
    at,
  };
}