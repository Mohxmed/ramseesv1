import {
  type AccountType,
  type ConnectionTestResult,
  type ExchangeAccountInfo,
  type ExchangeBalance,
  type ExchangeCapabilities,
  type ExchangeDataWindow,
  type ExchangeOrder,
  type ExchangePosition,
  type ExchangeTrade,
  type ExchangeTransaction,
  type ExchangeType,
} from "./ExchangeTypes";

/**
 * SERVER-ONLY — never import from client components.
 *
 * The one contract every exchange implements. Adapters translate RAW exchange
 * data → canonical models; they are the ONLY modules allowed to know about a
 * specific exchange. The sync engine / portfolio engine / UI never branch on
 * `exchange === "binance"` — they call through this interface.
 *
 * All accounts are READ-ONLY portfolio sync. Execution is out of scope.
 */

export interface ExchangeAdapter {
  readonly exchangeType: ExchangeType;
  readonly capabilities: ExchangeCapabilities;

  /** Validate credentials + detect account permissions (least-privilege check). */
  testConnection(creds: ExchangeCredentials): Promise<ConnectionTestResult>;

  getAccountInfo(creds: ExchangeCredentials): Promise<ExchangeAccountInfo>;

  /** Current balance snapshot per account/wallet type. */
  getBalances(creds: ExchangeCredentials, accountType: AccountType): Promise<ExchangeBalance[]>;

  getPositions(creds: ExchangeCredentials, accountType: AccountType): Promise<ExchangePosition[]>;

  getOpenOrders(creds: ExchangeCredentials, accountType: AccountType): Promise<ExchangeOrder[]>;

  /** Historical orders within an optional time window. */
  getOrders(creds: ExchangeCredentials, accountType: AccountType, window?: ExchangeDataWindow): Promise<ExchangeOrder[]>;

  /** Historical trades (fills) within an optional time window. */
  getTrades(creds: ExchangeCredentials, accountType: AccountType, window?: ExchangeDataWindow): Promise<ExchangeTrade[]>;

  getDeposits(creds: ExchangeCredentials, window?: ExchangeDataWindow): Promise<ExchangeTransaction[]>;

  getWithdrawals(creds: ExchangeCredentials, window?: ExchangeDataWindow): Promise<ExchangeTransaction[]>;

  /** Income history (funding payments, commissions, taxes, realized PnL…). */
  getIncomeHistory(creds: ExchangeCredentials, accountType: AccountType, window?: ExchangeDataWindow): Promise<ExchangeTransaction[]>;

  /** Optional platform account-history snapshots. */
  getAccountSnapshots?(creds: ExchangeCredentials, window?: ExchangeDataWindow): Promise<unknown[]>;

  /**
   * Optional live user-data stream. Implementations handle reconnect +
   * re-subscribe internally; on disconnect the caller runs REST reconciliation.
   * Returns an unsubscribe function.
   */
  subscribeToUserData?(
    creds: ExchangeCredentials,
    handlers: ExchangeUserDataHandlers
  ): () => void;

  /** Release any live sockets/listeners. Safe to call multiple times. */
  disconnect(): void;
}

/** In-memory credentials handed to an adapter for the duration of one call. */
export interface ExchangeCredentials {
  apiKey: string;
  secret: string;
  /** Optional extra per-exchange tokens (passphrase etc.). */
  extra?: Record<string, string>;
}

export interface ExchangeUserDataHandlers {
  onBalancesChange?(balances: ExchangeBalance[]): void;
  onOrderUpdate?(order: ExchangeOrder): void;
  onTrade?(trade: ExchangeTrade): void;
  onPositionChange?(positions: ExchangePosition[]): void;
  onDisconnect?(): void;
}