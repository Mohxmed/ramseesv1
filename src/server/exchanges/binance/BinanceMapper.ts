/**
 * SERVER-ONLY — never import from client components.
 *
 * BinanceMapper — the ONLY place Binance raw payload shapes get translated
 * into canonical models. Pure + unit-testable (no I/O). Every mapped record
 * is validated through ExchangeNormalizer so malformed rows throw
 * ExchangeError(DATA_MAPPING) and are skipped by the sync pipeline.
 */

import { ExchangeError } from "../core/ExchangeErrors";
import {
  normalizeAsset,
  toAmount,
  toBoolean,
  toEpochMs,
  toNullableAmount,
  toOptionalString,
  toUsd,
} from "../core/ExchangeNormalizer";
import type {
  AssetWalletType,
  ExchangeBalance,
  ExchangeOrder,
  ExchangePosition,
  ExchangeTrade,
  ExchangeTransaction,
} from "../core/ExchangeTypes";
import type { ExchangePermissions } from "../core/ExchangeTypes";
import type { AccountType, ExchangeType, TxStatus } from "../core/ExchangeTypes";

/* ─── RAW shapes (spot / futures / sapi, as delivered by Binance) ──── */

export interface RawSpotBalance {
  asset: string;
  free: string;
  locked: string;
}

export interface RawSpotAccount {
  accountType?: string;
  balances: RawSpotBalance[];
  canTrade?: boolean;
  canWithdraw?: boolean;
  permissions?: string[];
  updateTime?: number;
}

export interface RawSpotTrade {
  symbol: string;
  id: number;
  orderId: number;
  price: string;
  qty: string;
  quoteQty: string;
  commission: string;
  commissionAsset: string;
  time: number;
  isBuyer: boolean;
  isMaker: boolean;
}

export interface RawSpotOrder {
  symbol: string;
  orderId: number;
  side: "BUY" | "SELL";
  type: string;
  status: string;
  price: string;
  stopPrice: string;
  origQty: string;
  executedQty: string;
  avgPrice?: string;
  time: number;
  updateTime: number;
}

export interface RawDeposit {
  id?: string;
  amount: string;
  coin: string;
  network?: string;
  status: number;
  address?: string;
  addressTag?: string;
  txId?: string;
  insertTime: number;
  walletType?: number;
}

export interface RawWithdrawal {
  id?: string;
  amount: string;
  transactionFee?: string;
  fee?: string;
  coin: string;
  network?: string;
  status: number;
  address?: string;
  addressTag?: string;
  txId?: string;
  applyTime: number;
  walletType?: number;
}

export interface RawFuturesBalance {
  asset: string;
  balance: string;
  crossWalletBalance: string;
  crossUnPnl: string;
  availableBalance: string;
  maxWithdrawAmount: string;
}

export interface RawPositionRisk {
  symbol: string;
  positionAmt: string;
  entryPrice: string;
  markPrice: string;
  unRealizedProfit: string;
  liquidationPrice: string;
  marginType: string;
  isolatedMargin: string;
  leverage: string;
  isAutoAddMargin: string;
  positionSide: string;
  notional: string;
  isolatedWallet: string;
  updateTime: number;
}

export interface RawFuturesIncome {
  symbol?: string;
  incomeType: string;
  income: string;
  asset: string;
  time: number;
  info?: string;
  tranId: number;
  tradeId?: string;
}

export interface RawFuturesTrade {
  symbol: string;
  id: number;
  orderId: number;
  side: "BUY" | "SELL";
  price: string;
  qty: string;
  quoteQty: string;
  realizedPnl: string;
  commission: string;
  commissionAsset: string;
  time: number;
  buyer?: boolean;
  maker?: boolean;
}

/* ─── Permissions / least-privilege detection ─────────────────────── */

export function detectPermissions(raw: RawSpotAccount): ExchangePermissions {
  const canTrade = toBoolean(raw.canTrade);
  const canWithdraw = toBoolean(raw.canWithdraw);
  return {
    readOnly: !canTrade && !canWithdraw,
    tradingEnabled: canTrade,
    withdrawalsEnabled: canWithdraw,
    transfersEnabled: false, // Binance does not expose transfer permission on read-only keys
  };
}

/* ─── Balances ─────────────────────────────────────────────────────── */

export function mapSpotBalances(
  raw: RawSpotBalance[],
  accountKey: { exchange: ExchangeType; accountId: string; accountType: AccountType }
): ExchangeBalance[] {
  const out: ExchangeBalance[] = [];
  for (const b of raw) {
    const asset = normalizeAsset(b.asset);
    const free = toAmount(b.free, `${asset}.free`);
    const locked = toAmount(b.locked, `${asset}.locked`);
    const total = free + locked;
    if (total <= 0) continue; // skip zero-balance noise
    out.push({
      exchange: accountKey.exchange,
      accountType: accountKey.accountType,
      walletType: "SPOT" as AssetWalletType,
      asset,
      free,
      locked,
      total,
      available: free,
      usdValue: 0,
      price: null,
      valuedAt: 0,
    });
  }
  return out;
}

export function mapFuturesBalances(
  raw: RawFuturesBalance[],
  accountKey: { exchange: ExchangeType; accountId: string; accountType: AccountType }
): ExchangeBalance[] {
  const out: ExchangeBalance[] = [];
  for (const b of raw) {
    const asset = normalizeAsset(b.asset);
    const wallet = toAmount(b.crossWalletBalance ?? b.balance, `${asset}.wallet`);
    const available = toAmount(b.availableBalance, `${asset}.available`);
    const total = wallet;
    if (total <= 0 && available <= 0) continue;
    out.push({
      exchange: accountKey.exchange,
      accountType: accountKey.accountType,
      walletType: "TRADING" as AssetWalletType,
      asset,
      free: available,
      locked: total - available,
      total,
      available,
      usdValue: 0,
      price: null,
      valuedAt: 0,
    });
  }
  return out;
}

/* ─── Trades ───────────────────────────────────────────────────────── */

export function mapSpotTrade(
  raw: RawSpotTrade,
): ExchangeTrade {
  const quote = toAmount(raw.quoteQty, "quoteQty");
  const fee = toAmount(raw.commission, "commission");
  return {
    externalTradeId: String(raw.id),
    externalOrderId: String(raw.orderId),
    symbol: String(raw.symbol).toUpperCase(),
    side: raw.isBuyer ? "BUY" : "SELL",
    quantity: toAmount(raw.qty, "qty"),
    price: toAmount(raw.price, "price"),
    quoteAmount: quote,
    fee,
    feeAsset: toOptionalString(raw.commissionAsset) ?? null,
    realizedPnlUsd: null, // Binance spot fills do not report realized PnL
    isMaker: toBoolean(raw.isMaker) || null,
    timestamp: toEpochMs(raw.time, "time"),
    metadata: { source: "binance_spot" },
  };
}

export function mapFuturesTrade(
  raw: RawFuturesTrade,
): ExchangeTrade {
  const quote = toAmount(raw.quoteQty, "quoteQty");
  const fee = toAmount(raw.commission, "commission");
  return {
    externalTradeId: String(raw.id),
    externalOrderId: String(raw.orderId),
    symbol: String(raw.symbol).toUpperCase(),
    side: raw.side === "SELL" ? "SELL" : "BUY",
    quantity: toAmount(raw.qty, "qty"),
    price: toAmount(raw.price, "price"),
    quoteAmount: quote,
    fee,
    feeAsset: toOptionalString(raw.commissionAsset) ?? null,
    realizedPnlUsd: toNullableAmount(raw.realizedPnl, "realizedPnl"),
    isMaker: raw.maker != null ? toBoolean(raw.maker) : null,
    timestamp: toEpochMs(raw.time, "time"),
    metadata: { source: "binance_futures" },
  };
}

/* ─── Orders ───────────────────────────────────────────────────────── */

const spotOrderStatusMap: Record<string, ExchangeOrder["status"]> = {
  NEW: "OPEN",
  PARTIALLY_FILLED: "PARTIALLY_FILLED",
  FILLED: "FILLED",
  CANCELED: "CANCELED",
  REJECTED: "REJECTED",
  EXPIRED: "EXPIRED",
};

const spotOrderTypeMap: Record<string, ExchangeOrder["type"]> = {
  LIMIT: "LIMIT",
  MARKET: "MARKET",
  STOP_LOSS: "STOP_LIMIT",
  STOP_LOSS_LIMIT: "STOP_LIMIT",
  TAKE_PROFIT: "TAKE_PROFIT",
  TAKE_PROFIT_LIMIT: "TAKE_PROFIT_LIMIT",
  LIMIT_MAKER: "LIMIT",
};

export function mapSpotOrder(
  raw: RawSpotOrder,
): ExchangeOrder {
  return {
    externalOrderId: String(raw.orderId),
    symbol: String(raw.symbol).toUpperCase(),
    side: raw.side === "SELL" ? "SELL" : "BUY",
    type: spotOrderTypeMap[raw.type] ?? "OTHER",
    status: spotOrderStatusMap[raw.status] ?? "OTHER",
    quantity: toAmount(raw.origQty, "origQty"),
    filledQuantity: toAmount(raw.executedQty, "executedQty"),
    avgPrice: toNullableAmount(raw.avgPrice, "avgPrice"),
    limitPrice: toNullableAmount(raw.price, "price"),
    stopPrice: toNullableAmount(raw.stopPrice, "stopPrice"),
    timestamp: toEpochMs(raw.time, "time"),
    updatedAt: toEpochMs(raw.updateTime, "updateTime"),
  };
}

/* ─── Positions (Futures) ──────────────────────────────────────────── */

export function mapPositionRisk(
  raw: RawPositionRisk,
): ExchangePosition | null {
  const quantity = toAmount(raw.positionAmt, "positionAmt");
  if (quantity === 0) return null;
  const entry = toAmount(raw.entryPrice, "entryPrice");
  return {
    symbol: String(raw.symbol).toUpperCase(),
    side: quantity > 0 ? "LONG" : "SHORT",
    quantity: Math.abs(quantity),
    entryPrice: entry,
    markPrice: toAmount(raw.markPrice, "markPrice"),
    liquidationPrice: toNullableAmount(raw.liquidationPrice, "liquidationPrice"),
    leverage: toAmount(raw.leverage, "leverage"),
    margin: toAmount(raw.isolatedMargin, "isolatedMargin"),
    unrealizedPnl: toAmount(raw.unRealizedProfit, "unRealizedProfit"),
    realizedPnl: 0,
    notional: toAmount(raw.notional, "notional"),
    timestamp: toEpochMs(raw.updateTime, "updateTime") || Date.now(),
  };
}

/* ─── Deposits / Withdrawals / Funding ────────────────────────────── */

function mapTxStatus(kind: "deposit" | "withdraw", status: number): TxStatus {
  if (kind === "deposit") {
    // 0 pending · 6 credited-but-not-withdrawable · 1 success
    if (status === 1) return "CONFIRMED";
    if (status === 0 || status === 6) return "PENDING";
    return "PENDING";
  }
  // withdraw statuses: 6 completed · 5 failure · 1 cancelled · 3 rejected · else pending
  if (status === 6) return "CONFIRMED";
  if (status === 5) return "FAILED";
  if (status === 1 || status === 3) return "CANCELLED";
  return "PENDING";
}

export function mapDeposit(
  raw: RawDeposit,
  accountKey: { exchange: ExchangeType; accountId: string; accountType: AccountType }
): ExchangeTransaction {
  const id = raw.id != null ? String(raw.id) : String(raw.insertTime ?? "dep");
  return {
    externalId: id,
    exchange: accountKey.exchange,
    accountType: accountKey.accountType,
    type: "DEPOSIT",
    asset: normalizeAsset(raw.coin),
    amount: toAmount(raw.amount, "amount"),
    usdValue: toUsd(toNullableAmount(raw.amount, "usdHint") ?? 0), // valued later by PriceProvider
    fee: 0,
    feeAsset: null,
    timestamp: toEpochMs(raw.insertTime, "insertTime"),
    externalTransactionId: toOptionalString(raw.txId),
    status: mapTxStatus("deposit", raw.status),
    metadata: {
      network: toOptionalString(raw.network),
      walletType: raw.walletType ?? null,
    },
  };
}

export function mapWithdrawal(
  raw: RawWithdrawal,
  accountKey: { exchange: ExchangeType; accountId: string; accountType: AccountType }
): ExchangeTransaction {
  const feeRaw = raw.transactionFee ?? raw.fee;
  return {
    externalId: raw.id != null ? String(raw.id) : String(raw.applyTime ?? "wd"),
    exchange: accountKey.exchange,
    accountType: accountKey.accountType,
    type: "WITHDRAWAL",
    asset: normalizeAsset(raw.coin),
    amount: toAmount(raw.amount, "amount"),
    usdValue: 0,
    fee: feeRaw != null ? toAmount(feeRaw, "transactionFee") : 0,
    feeAsset: feeRaw != null ? normalizeAsset(raw.coin) : null,
    timestamp: toEpochMs(raw.applyTime, "applyTime"),
    externalTransactionId: toOptionalString(raw.txId),
    status: mapTxStatus("withdraw", raw.status),
    metadata: {
      network: toOptionalString(raw.network),
      walletType: raw.walletType ?? null,
    },
  };
}

export function mapFuturesIncome(
  raw: RawFuturesIncome,
  accountKey: { exchange: ExchangeType; accountId: string; accountType: AccountType }
): ExchangeTransaction {
  const type = raw.incomeType === "FUNDING_FEE" ? "FUNDING" : "FEE";
  const income = toAmount(raw.income, "income");
  return {
    externalId: String(raw.tranId ?? `${raw.time}-${raw.incomeType}`),
    exchange: accountKey.exchange,
    accountType: accountKey.accountType,
    type,
    asset: normalizeAsset(raw.asset),
    // funding income is signed: positive = received, negative = paid
    amount: Math.abs(income),
    usdValue: 0,
    fee: type === "FEE" ? Math.abs(income) : 0,
    feeAsset: type === "FEE" ? normalizeAsset(raw.asset) : null,
    timestamp: toEpochMs(raw.time, "time"),
    externalTransactionId: raw.tradeId != null ? String(raw.tradeId) : null,
    status: "CONFIRMED",
    metadata: { incomeType: raw.incomeType, symbol: toOptionalString(raw.symbol) },
  };
}

export function assertSpotAccountPayload(raw: unknown): RawSpotAccount {
  if (!raw || typeof raw !== "object") throw ExchangeError.mapping({ stage: "spot account" });
  const acct = raw as RawSpotAccount;
  if (!Array.isArray(acct.balances)) throw ExchangeError.mapping({ stage: "spot balances" });
  return acct;
}