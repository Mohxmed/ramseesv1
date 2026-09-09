/**
 * SERVER-ONLY — never import from client components.
 *
 * Canonical (exchange-agnostic) data model for the Portfolio Aggregation
 * layer. Every adapter maps RAW exchange data into these shapes; the rest of
 * the system (sync engine, portfolio engine, UI) only ever reads these types.
 * Adding Bybit/OKX/MEXC later means adding an adapter — never touching these.
 */

export type ExchangeType = "BINANCE"; // future: "BYBIT" | "OKX" | "MEXC"
export const EXCHANGE_TYPES: readonly ExchangeType[] = ["BINANCE"];

/** Per-exchange account/wallet granularity varies; the adapter owns mapping. */
export type AccountType =
  | "SPOT"
  | "FUTURES"
  | "MARGIN"
  | "UNIFIED"
  | "FUNDING"
  | "TRADING";

export type AssetWalletType = "SPOT" | "FUNDING" | "TRADING" | "EARN" | "LOCKED";

export type ConnectionStatus =
  | "CONNECTING"
  | "CONNECTED"
  | "SYNCING"
  | "HEALTHY"
  | "DEGRADED"
  | "ERROR"
  | "DISCONNECTED"
  | "REAUTH_REQUIRED";

export const CONNECTION_STATUSES: readonly ConnectionStatus[] = [
  "CONNECTING",
  "CONNECTED",
  "SYNCING",
  "HEALTHY",
  "DEGRADED",
  "ERROR",
  "DISCONNECTED",
  "REAUTH_REQUIRED",
];

/** Connection-level security posture. IP allowlisting is future work. */
export type SecurityMode = "unrestricted" | "restricted";

export interface ExchangePermissions {
  readOnly: boolean;
  tradingEnabled: boolean;
  withdrawalsEnabled: boolean;
  transfersEnabled: boolean;
}

/** Declared platform capabilities — the UI only shows what a platform offers. */
export interface ExchangeCapabilities {
  supportsSpot: boolean;
  supportsFutures: boolean;
  supportsMargin: boolean;
  supportsDeposits: boolean;
  supportsWithdrawals: boolean;
  supportsTrades: boolean;
  supportsOrders: boolean;
  supportsWebSocket: boolean;
  supportsFunding: boolean;
  supportsPositions: boolean;
  supportsPnl: boolean;
  supportsAccountSnapshots: boolean;
}

export interface ExchangeAccountInfo {
  id: string;
  name: string;
  permissions: ExchangePermissions;
}

export interface ConnectionTestResult {
  ok: boolean;
  accountInfo: ExchangeAccountInfo | null;
}

/* ─── Canonical financial records ──────────────────────────────────── */

export interface ExchangeBalance {
  exchange: ExchangeType;
  accountType: AccountType;
  walletType: AssetWalletType;
  asset: string;
  free: number;
  locked: number;
  total: number;
  available: number;
  /** USD valuation at `valuedAt` (0 when the price provider has no rate). */
  usdValue: number;
  price: number | null;
  valuedAt: number;
}

export type CanonicalTxType =
  | "DEPOSIT"
  | "WITHDRAWAL"
  | "TRADE"
  | "FEE"
  | "FUNDING"
  | "TRANSFER"
  | "ADJUSTMENT";

export type TxStatus = "PENDING" | "CONFIRMED" | "FAILED" | "CANCELLED";

export interface ExchangeTransaction {
  /** Uniqueness key component (see sync idempotency: externalId+exchange+accountId). */
  externalId: string;
  exchange: ExchangeType;
  accountType: AccountType;
  type: CanonicalTxType;
  asset: string;
  amount: number;
  usdValue: number;
  fee: number;
  feeAsset: string | null;
  /** EVENT time (UTC ms) — never the sync time. */
  timestamp: number;
  /** Upstream reference (ID, tx hash, block ref…). */
  externalTransactionId: string | null;
  status: TxStatus;
  metadata: Record<string, unknown> | null;
}

export type TradeSide = "BUY" | "SELL";

export interface ExchangeTrade {
  externalTradeId: string;
  externalOrderId: string | null;
  symbol: string;
  side: TradeSide;
  quantity: number;
  price: number;
  quoteAmount: number;
  fee: number;
  feeAsset: string | null;
  /** USD realized PnL (exchange-reported or derived) — may be null. */
  realizedPnlUsd: number | null;
  isMaker: boolean | null;
  /** EVENT time (UTC ms). */
  timestamp: number;
  metadata: Record<string, unknown> | null;
}

export type PositionSide = "LONG" | "SHORT";

export interface ExchangePosition {
  symbol: string;
  side: PositionSide;
  quantity: number;
  entryPrice: number;
  markPrice: number;
  liquidationPrice: number | null;
  leverage: number;
  margin: number;
  unrealizedPnl: number;
  realizedPnl: number;
  notional: number;
  /** UTC ms of the underlying / valuation time. */
  timestamp: number;
}

export type OrderType =
  | "LIMIT"
  | "MARKET"
  | "STOP_LIMIT"
  | "STOP_MARKET"
  | "TAKE_PROFIT"
  | "TAKE_PROFIT_MARKET"
  | "TAKE_PROFIT_LIMIT"
  | "TRAILING_STOP"
  | "OTHER";
export type OrderStatus = "OPEN" | "FILLED" | "PARTIALLY_FILLED" | "CANCELED" | "REJECTED" | "EXPIRED" | "OTHER";

export interface ExchangeOrder {
  externalOrderId: string;
  symbol: string;
  side: TradeSide;
  type: OrderType;
  status: OrderStatus;
  quantity: number;
  filledQuantity: number;
  avgPrice: number | null;
  limitPrice: number | null;
  stopPrice: number | null;
  /** UTC ms. */
  timestamp: number;
  updatedAt: number | null;
}

/** Optional platform account-history snapshots (Binance does not expose one). */
export interface ExchangeAccountSnapshot {
  timestamp: number;
  totalEquity: number;
  cashValue: number;
  assetValue: number;
  balances: Array<{ asset: string; free: number; locked: number; total: number; usdValue: number }>;
}

/** Data window for incremental syncs (UTC ms; [from, to) semantics). */
export interface ExchangeDataWindow {
  fromMs: number | null;
  toMs: number | null;
  /** Optional symbol scope (some platforms require per-symbol history queries). */
  symbols?: string[];
}

/** Idempotency key — the DB derives stable doc ids from this. */
export interface SyncKey {
  exchange: ExchangeType;
  accountId: string;
  externalId: string;
}

export function syncKeyOf(exchange: ExchangeType, accountId: string, externalId: string): SyncKey {
  return { exchange, accountId, externalId };
}

export const flipSide = (s: TradeSide): TradeSide => (s === "BUY" ? "SELL" : "BUY");