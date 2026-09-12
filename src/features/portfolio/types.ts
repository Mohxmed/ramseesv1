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

/**
 * Operations feed classification — the sections the user filters by, derived
 * live from each row's type / incomeType / realized PnL sign:
 *  - profit → أرباح المراكز (REALIZED_PNL > 0)
 *  - loss   → خسائر المراكز (REALIZED_PNL < 0)
 *  - fee    → رسوم الصفقات (commissions, taxes, funding, insurance — all
 *             wallet costs; rebates reduce them)
 *  - flow   → الودائع والسحب والتحويلات (deposits / withdrawals / transfers)
 *  - other  → الباقي (غير مصنّف)
 */
export type OpCategory = "profit" | "loss" | "fee" | "flow" | "other";
export type OpFilter = OpCategory | "all";

/**
 * RAMSEES unified operation classification — the normalized enum shown to the
 * user. Never derived from Arabic text: every raw Binance/exchange type is
 * mapped here (see `OP_TYPE_RULES` / `classifyOp` in operations.ts), and
 * unknown raw types fall back to `other` while keeping the raw type for
 * debugging. Extend the rules when new exchange types appear — the enum stays
 * stable so the whole UI (filters, labels, sub-filters) keeps working.
 */
export type OpKind =
  | "deposit"
  | "withdrawal"
  | "transfer"
  | "trade"
  | "fee"
  | "funding"
  | "settlement"
  | "liquidation"
  | "pnl"
  | "reward"
  | "convert"
  | "other";

/** Money direction of an operation, derived from its signed effect (never text). */
export type OpImpact = "in" | "out" | "neutral";

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
  /** Fill/transaction price (trades only; null when unknown). */
  price: number | null;
  /** Upstream reference (order id / tx hash) when available. */
  orderId: string | null;
  fee: number;
  /** Signed exchange income (funding paid/received, tax, commissions…). */
  income: number | null;
  realizedPnlUsd: number | null;
  status: string | null;
  timestamp: number;
  /** Signed money effect shown in the table (realized PnL for trades, income otherwise). */
  pnl: number | null;
  category: OpCategory;
  /** RAMSEES normalized classification (see `OpKind`). */
  opType: OpKind;
  /** Original raw exchange type (kept for debugging/audit; never for UI decisions). */
  rawType: string | null;
  /** Raw exchange sub-type (e.g. incomeType) when available. */
  rawSubType: string | null;
  /** The matched detailed type token (e.g. INSURANCE_CLEAR) — used by sub-filters. */
  subType: string | null;
  /** Money direction (from signed pnl). */
  impact: OpImpact;
}

/** Aggregate balance position of one asset held on the exchange. */
export interface ExchangeBalanceDto {
  asset: string;
  free: number;
  locked: number;
  total: number;
  available: number;
  usdValue: number;
  price: number | null;
  valuedAt: number;
}

/** Open futures/spot position (state mirror). */
export interface ExchangePositionDto {
  symbol: string;
  side: "LONG" | "SHORT";
  quantity: number;
  entryPrice: number;
  markPrice: number;
  liquidationPrice: number | null;
  leverage: number;
  margin: number;
  unrealizedPnl: number;
  realizedPnl: number;
  notional: number;
  timestamp: number;
}

/** Account equity snapshot taken at each sync (the performance-chart series). */
export interface ExchangeSnapshotDto {
  timestamp: number;
  totalEquity: number;
  cashValue: number;
  assetValue: number;
  unrealizedPnl: number;
  realizedPnl: number;
  totalPnl: number;
  deposits: number;
  withdrawals: number;
  fees: number;
}

/** Open position refreshed with a fresh futures mark price (no sync needed). */
export interface LivePositionDto extends ExchangePositionDto {
  /** Unrealized PnL relative to the position margin (%; null when margin = 0). */
  unrealizedPnlPct: number | null;
  /** True when markPrice comes from the live public futures ticker. */
  pricedLive: boolean;
  /** UTC ms of this poll. */
  valuedAt: number;
}

/** `POST /api/portfolio/exchanges/[id]/live-session`. */
export interface LiveSessionDto {
  /** Ephemeral FUTURES User Data token (null for non-futures accounts). */
  listenKey: string | null;
  at: number;
  snapshot: LiveStateDto;
}

/** Authoritative futures REST snapshot — `GET /api/portfolio/exchanges/[id]/live-state`. */
export interface LiveStateDto {
  equity: number;
  walletBalance: number;
  unrealizedPnl: number;
  availableBalance: number;
  positions: LivePositionDto[];
  aggregate: {
    unrealizedPnl: number;
    margin: number;
    notional: number;
    count: number;
  };
  live: boolean;
  at: number;
}

/** `GET /api/portfolio/exchanges/[id]/positions-live` (deprecated legacy shape). */
export interface LivePositionsDto {
  positions: LivePositionDto[];
  aggregate: {
    unrealizedPnl: number;
    margin: number;
    notional: number;
    count: number;
  };
  live: boolean;
  at: number;
  /** Optional equity fields surfaced by the live manager from /fapi/v1/account. */
  equity?: number;
  walletBalance?: number;
  availableBalance?: number;
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
  balances: ExchangeBalanceDto[];
  positions: ExchangePositionDto[];
  transactions: Array<{
    id: string;
    type: string;
    asset: string;
    amount: number;
    usdValue: number;
    fee: number;
    feeAsset: string | null;
    /** Signed income preserved by the mapper (funding, tax, commissions…). */
    income: number | null;
    incomeType: string | null;
    status: string | null;
    timestamp: number;
    /** Upstream reference (tx hash / block ref) when available. */
    externalId: string | null;
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
    /** Upstream order reference when available. */
    orderId: string | null;
  }>;
  latestSnapshot: {
    timestamp: number;
    totalEquity: number;
    realizedPnl: number;
    unrealizedPnl: number;
    totalPnl: number;
  } | null;
  snapshots: ExchangeSnapshotDto[];
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

/** One asset line of the baseline capital composition. */
export interface BaselineAssetDto {
  asset: string;
  amount: number;
  usdValue: number;
  price: number | null;
}

export interface ExchangeFinancialsDto {
  /** Initial capital — captured once at first activation, never auto-renewed. */
  baselineEquity: number;
  baselineAt: number | null;
  /** What the initial capital consisted of (absent on legacy links). */
  baselineAssets?: BaselineAssetDto[];
  baselineLocked?: boolean;
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