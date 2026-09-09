/**
 * Portfolio — Portfolio / Wallet Tracking
 *
 * Single source of truth: the ledger (transactions subcollection). The meta doc
 * holds aggregated, always-current numbers so 10k+ transactions never need full
 * re-reads; aggregates are recomputed inside the Firestore transaction that
 * writes each ledger entry (never on the client render path).
 */

export type PortfolioTxType = "deposit" | "withdrawal" | "trade" | "adjustment";
export type PortfolioImpact = "increase" | "decrease";

/**
 * How the wallet's data is produced:
 *  - `manual`  → the owner records every operation by hand (legacy flow).
 *  - `binance` → the wallet is imported from an exchange and every operation
 *    is recorded automatically during server-side syncs.
 */
export type PortfolioSource = "manual" | "binance";

export const PORTFOLIO_TX_TYPE_LABELS: Record<PortfolioTxType, string> = {
  deposit: "إيداع",
  withdrawal: "سحب",
  trade: "صفقة تداول",
  adjustment: "تعديل",
};

export const PORTFOLIO_IMPACT_LABELS: Record<PortfolioImpact, string> = {
  increase: "زيادة (+)",
  decrease: "نقص (−)",
};

/** Ledger entry — each row changes the balance exactly once (immutable). */
export interface PortfolioTransaction {
  id: string;
  type: PortfolioTxType;
  impact: PortfolioImpact;
  /** Absolute magnitude, always > 0. */
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  /** Signed effect on the balance (impact decides the sign). */
  pnl: number;
  /** Relative to balanceBefore, percent (null when balanceBefore is 0). */
  pnlPercent: number | null;
  symbol?: string;
  description?: string;
  /** User-chosen event time (ms). */
  timestamp: number;
  /** System recorded time (ms). */
  createdAt: number;
}

/** Aggregated portfolio state — mirrored 1:1 from `portfolio/meta`. */
export interface PortfolioSummary {
  source: "manual";
  initialBalance: number;
  currentBalance: number;
  peakBalance: number;
  totalPnl: number;
  totalPnlPercent: number;
  /** Negative %, from the stored peak to now. */
  currentDrawdown: number;
  /** Negative %, deepest drawdown ever recorded. */
  maxDrawdown: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  totalProfit: number;
  totalLoss: number;
  avgWin: number | null;
  avgLoss: number | null;
  bestTrade: number;
  worstTrade: number;
  profitFactor: number | null;
  transactionCount: number;
  createdAt: number;
  updatedAt: number;
}

/** Aggregated state of an imported (exchange-driven) wallet — same meta doc. */
export interface ImportedPortfolioSummary {
  source: "binance";
  exchangeType: string;
  accountType: string;
  accountId: string;
  accountName: string;
  importedAt: number;
  createdAt: number;
  updatedAt: number;
  syncStatus: "HEALTHY" | "SYNCING" | "ERROR" | "CONNECTING" | "DISCONNECTED";
  lastSuccessfulSync: number | null;
  lastAttemptedSync: number | null;
  lastError: string | null;
  lastErrorAt: number | null;
  financials: ExchangeFinancialsDto;
}

export type PortfolioMeta = PortfolioSummary | ImportedPortfolioSummary;

/** A single auto-recorded operation shown in the imported wallet's table. */
export interface ImportedOpRow {
  id: string;
  kind: "transaction" | "trade";
  typeLabel: string;
  symbol: string | null;
  side: "BUY" | "SELL" | null;
  amount: number;
  asset: string | null;
  usdValue: number | null;
  fee: number;
  realizedPnlUsd: number | null;
  status: string | null;
  timestamp: number;
}

/** `GET /api/portfolio/exchanges/[id]` — what the imported wallet view reads. */
export interface ImportedAccountDetailDto {
  account: {
    id: string;
    name: string;
    accountType: string;
    exchangeType: string;
    status: string;
    lastSuccessfulSync: number | null;
    lastAttemptedSync: number | null;
    lastError: string | null;
    lastErrorAt: number | null;
    financials: ExchangeFinancialsDto;
  };
  transactions: Array<{
    id: string;
    type: string;
    asset: string;
    amount: number;
    usdValue: number;
    fee: number;
    status: string | null;
    timestamp: number;
  }>;
  trades: Array<{
    id: string;
    symbol: string;
    side: "BUY" | "SELL";
    quantity: number;
    price: number;
    quoteAmount: number;
    fee: number;
    feeAsset: string | null;
    realizedPnlUsd: number | null;
    timestamp: number;
  }>;
  syncInProgress: boolean;
}

/** Input accepted by the ledger layer when appending a manual transaction. */
export interface AddTransactionInput {
  type: PortfolioTxType;
  impact: PortfolioImpact;
  amount: number;
  symbol?: string;
  description?: string;
  /** event time in ms (user-selected). */
  timestamp: number;
}

/* ─── Performance periods ─────────────────────────────────────────── */

export type PerformancePeriod = "1D" | "7D" | "30D" | "90D" | "1Y" | "ALL";

export const PERFORMANCE_PERIOD_MS: Record<Exclude<PerformancePeriod, "ALL">, number> = {
  "1D": 24 * 60 * 60 * 1000,
  "7D": 7 * 24 * 60 * 60 * 1000,
  "30D": 30 * 24 * 60 * 60 * 1000,
  "90D": 90 * 24 * 60 * 60 * 1000,
  "1Y": 365 * 24 * 60 * 60 * 1000,
};

export const PERFORMANCE_PERIODS: PerformancePeriod[] = ["1D", "7D", "30D", "90D", "1Y", "ALL"];

/* ─── Series (chart inputs) ───────────────────────────────────────── */

export interface EquityPoint {
  t: number;
  balance: number;
  /** drawdown % at that point (negative), computed from running peak. */
  dd: number;
}

export interface PeriodMetrics {
  growthPct: number | null;
  startBalance: number | null;
}

/* ─── Exchange accounts (server-synced, read via /api/portfolio/exchanges) ── */

export interface ExchangePermissionsDto {
  readOnly: boolean;
  tradingEnabled: boolean;
  withdrawalsEnabled: boolean;
  transfersEnabled: boolean;
}

export interface ExchangeCapabilitiesDto {
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

export interface ExchangeFinancialsDto {
  baselineEquity: number;
  baselineAt: number | null;
  currentEquity: number;
  lastValuedAt: number | null;
  netDeposits: number;
  netWithdrawals: number;
  totalFees: number;
  realizedPnl: number;
  unrealizedPnl: number;
}

export interface ExchangeAccountDto {
  id: string;
  userId: string;
  exchangeType: string;
  accountType: string;
  name: string;
  status: string;
  securityMode: string;
  permissions: ExchangePermissionsDto;
  capabilities: ExchangeCapabilitiesDto;
  displayCapabilities: { spot: boolean; futures: boolean };
  exchangeUid: string;
  lastSuccessfulSync: number | null;
  lastAttemptedSync: number | null;
  lastError: string | null;
  lastErrorAt: number | null;
  createdAt: number;
  updatedAt: number;
  disabledAt: number | null;
  financials: ExchangeFinancialsDto;
}

export interface ExchangeDescriptorDto {
  exchangeType: string;
  displayName: string;
  capabilities: ExchangeCapabilitiesDto;
}

export interface ExchangeSyncStatusDto {
  accountId: string;
  running: boolean;
  jobId: string | null;
  jobsCount: number;
  lastSuccessfulSync: number | null;
  lastAttemptedSync: number | null;
  lastError: string | null;
  lastErrorAt: number | null;
  financials: ExchangeFinancialsDto;
  latestSnapshot: {
    totalEquity: number;
    realizedPnl: number;
    unrealizedPnl: number;
    totalPnl: number;
    timestamp: number;
  } | null;
  checkedAt: number;
}