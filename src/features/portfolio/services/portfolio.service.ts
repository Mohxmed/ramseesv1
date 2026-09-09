import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  OrderByDirection,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  startAfter,
  Timestamp,
  limit,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import type {
  AddTransactionInput,
  PortfolioSummary,
  PortfolioTransaction,
} from "../types";

/**
 * Portfolio ledger service — the ONLY module that reads/writes Firestore for
 * portfolio data. Mirrors the golden-target/strategies service pattern
 * (`users/{uid}/portfolio/...`) and enforces the single-source-of-truth rule:
 * every balance change is a ledger entry written atomically together with the
 * re-aggregated summary in one Firestore transaction.
 */

const META_ID = "meta";
const LEDGER_ID = "ledger";
const COLLECTION_NAME = "transactions";
export const PORTFOLIO_TX_PAGE = 100;

function metaRef(userId: string) {
  return doc(collection(getDb(), "users", userId, "portfolio"), META_ID);
}

// Firestore path segments must alternate collection/document, so a transactions
// COLLECTION needs an odd number of segments. `users/{uid}/portfolio/{??}` at
// segment 4 would be a DOCUMENT — hence the fixed `ledger` container doc:
// `users/{uid}/portfolio/ledger/transactions` (5 segments) is the collection.
function txCol(userId: string) {
  return collection(
    getDb(),
    "users",
    userId,
    "portfolio",
    LEDGER_ID,
    COLLECTION_NAME
  );
}

/* ─── Validation ──────────────────────────────────────────────────── */

export class PortfolioError extends Error {}

function assertFinitePositive(value: number, field: string): void {
  if (!Number.isFinite(value) || Number.isNaN(value) || value <= 0) {
    throw new PortfolioError(`قيمة ${field} غير صالحة — يجب أن تكون رقماً موجباً.`);
  }
}

function assertImpacted(input: AddTransactionInput): void {
  assertFinitePositive(input.amount, "المبلغ");
  if (!["deposit", "withdrawal", "trade", "adjustment"].includes(input.type)) {
    throw new PortfolioError("نوع العملية غير معروف.");
  }
  if (!["increase", "decrease"].includes(input.impact)) {
    throw new PortfolioError("نوع التأثير غير معروف.");
  }
  if (!Number.isFinite(input.timestamp) || input.timestamp <= 0) {
    throw new PortfolioError("التاريخ والوقت غير صالحين.");
  }
}

/* ─── (De)serialization ───────────────────────────────────────────── */

function deserializeMeta(raw: Record<string, unknown>): PortfolioSummary {
  const num = (k: string, fallback = 0) => {
    const v = raw[k];
    return typeof v === "number" && Number.isFinite(v) ? v : fallback;
  };
  const nullable = (k: string) => {
    const v = raw[k];
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  };
  const toMs = (v: unknown) => (v instanceof Timestamp ? v.toDate().getTime() : 0);
  return {
    initialBalance: num("initialBalance"),
    currentBalance: num("currentBalance"),
    peakBalance: num("peakBalance"),
    totalPnl: num("totalPnl"),
    totalPnlPercent: num("totalPnlPercent"),
    currentDrawdown: num("currentDrawdown"),
    maxDrawdown: num("maxDrawdown"),
    totalTrades: num("totalTrades"),
    winningTrades: num("winningTrades"),
    losingTrades: num("losingTrades"),
    totalProfit: num("totalProfit"),
    totalLoss: num("totalLoss"),
    avgWin: nullable("avgWin"),
    avgLoss: nullable("avgLoss"),
    bestTrade: num("bestTrade"),
    worstTrade: num("worstTrade"),
    profitFactor: nullable("profitFactor"),
    transactionCount: num("transactionCount"),
    createdAt: toMs(raw.createdAt),
    updatedAt: toMs(raw.updatedAt),
  };
}

function deserializeTx(id: string, raw: Record<string, unknown>): PortfolioTransaction {
  const num = (k: string, fallback = 0) => {
    const v = raw[k];
    return typeof v === "number" && Number.isFinite(v) ? v : fallback;
  };
  const nullable = (k: string) => {
    const v = raw[k];
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  };
  const toMs = (v: unknown) => (v instanceof Timestamp ? v.toDate().getTime() : 0);
  return {
    id,
    type: (raw.type as PortfolioTransaction["type"]) ?? "adjustment",
    impact: (raw.impact as PortfolioTransaction["impact"]) ?? "increase",
    amount: num("amount"),
    balanceBefore: num("balanceBefore"),
    balanceAfter: num("balanceAfter"),
    pnl: num("pnl"),
    pnlPercent: nullable("pnlPercent"),
    symbol: typeof raw.symbol === "string" ? raw.symbol : undefined,
    description: typeof raw.description === "string" ? raw.description : undefined,
    timestamp: toMs(raw.timestamp),
    createdAt: toMs(raw.createdAt),
  };
}

/* ─── Write path (single source of truth) ─────────────────────────── */

function buildTxDoc(input: AddTransactionInput, balanceBefore: number, balanceAfter: number, txId: string) {
  const pnl = balanceAfter - balanceBefore;
  const pnlPercent = balanceBefore > 0 ? (pnl / balanceBefore) * 100 : null;
  const symbol = input.symbol ? String(input.symbol).trim() : "";
  const description = input.description ? String(input.description).trim() : "";
  return {
    id: txId,
    type: input.type,
    impact: input.impact,
    amount: input.amount,
    balanceBefore,
    balanceAfter,
    pnl,
    pnlPercent,
    // Firestore rejects `undefined` field values — omit the key entirely.
    ...(symbol ? { symbol } : {}),
    ...(description ? { description } : {}),
    timestamp: Timestamp.fromDate(new Date(input.timestamp)),
    createdAt: serverTimestamp(),
  };
}

type MetaAccum = Pick<
  PortfolioSummary,
  | "initialBalance"
  | "peakBalance"
  | "maxDrawdown"
  | "totalTrades"
  | "winningTrades"
  | "losingTrades"
  | "totalProfit"
  | "totalLoss"
  | "bestTrade"
  | "worstTrade"
  | "transactionCount"
>;

function buildMetaDoc(
  prev: MetaAccum | null,
  balanceAfter: number,
  signed: number,
  input: AddTransactionInput
) {
  const initialBalance = prev ? prev.initialBalance : balanceAfter;
  const peakBalance = Math.max(prev ? prev.peakBalance : balanceAfter, balanceAfter);
  const currentDrawdown = peakBalance > 0 ? ((balanceAfter - peakBalance) / peakBalance) * 100 : 0;
  const maxDrawdown = Math.min(prev ? prev.maxDrawdown : 0, currentDrawdown);

  // `-Infinity`/`Infinity` are used only as "unset" sentinels while replaying the
  // ledger (refreshMeta); they are never written to Firestore.
  const p: MetaAccum = prev ?? {
    initialBalance: balanceAfter,
    peakBalance: balanceAfter,
    maxDrawdown: 0,
    transactionCount: 0,
    totalTrades: 0,
    winningTrades: 0,
    losingTrades: 0,
    totalProfit: 0,
    totalLoss: 0,
    bestTrade: -Infinity,
    worstTrade: Infinity,
  };

  let trades = p.totalTrades;
  let wins = p.winningTrades;
  let losses = p.losingTrades;
  let totalProfit = p.totalProfit;
  let totalLoss = p.totalLoss;
  let bestTrade = p.bestTrade;
  let worstTrade = p.worstTrade;

  if (input.type === "trade") {
    trades += 1;
    if (signed > 0) {
      wins += 1;
      totalProfit += signed;
      if (!Number.isFinite(bestTrade) || signed > bestTrade) bestTrade = signed;
    } else if (signed < 0) {
      losses += 1;
      totalLoss += -signed;
      if (!Number.isFinite(worstTrade) || signed < worstTrade) worstTrade = signed;
    }
  }

  const avgWin = wins > 0 ? totalProfit / wins : null;
  const avgLoss = losses > 0 ? -totalLoss / losses : null;
  const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : null;

  const meta: Record<string, unknown> = {
    initialBalance,
    currentBalance: balanceAfter,
    peakBalance,
    totalPnl: balanceAfter - initialBalance,
    totalPnlPercent: initialBalance > 0 ? ((balanceAfter - initialBalance) / initialBalance) * 100 : 0,
    currentDrawdown,
    maxDrawdown,
    totalTrades: trades,
    winningTrades: wins,
    losingTrades: losses,
    totalProfit,
    totalLoss,
    avgWin,
    avgLoss,
    bestTrade: Number.isFinite(bestTrade) ? bestTrade : 0,
    worstTrade: Number.isFinite(worstTrade) ? worstTrade : 0,
    profitFactor,
    transactionCount: (prev ? prev.transactionCount : 0) + 1,
    updatedAt: serverTimestamp(),
  };
  if (!prev) {
    meta.createdAt = serverTimestamp();
  }
  return meta;
}

export const portfolioService = {
  /**
   * Create the portfolio with initial capital. Records a deposit ledger entry
   * so the ledger remains the single source of truth.
   */
  async createPortfolio(userId: string, initialBalance: number): Promise<void> {
    assertFinitePositive(initialBalance, "رأس المال الابتدائي");
    const input: AddTransactionInput = {
      type: "deposit" as const,
      impact: "increase" as const,
      amount: initialBalance,
      description: "رأس المال الابتدائي",
      timestamp: Date.now(),
    };

    await this.recordTransaction(userId, input, { allowCreate: true });
  },

  /**
   * Append a manual transaction. Runs as a Firestore transaction:
   *  1. reads the current balance
   *  2. validates (no negative balance, valid amount)
   *  3. writes the immutable ledger entry (balanceBefore/After)
   *  4. re-aggregates + updates the summary doc atomically
   */
  async recordTransaction(
    userId: string,
    input: AddTransactionInput,
    opts: { allowCreate?: boolean } = {}
  ): Promise<void> {
    assertImpacted(input);
    const signed = input.impact === "increase" ? input.amount : -input.amount;

    await runTransaction(getDb(), async (trx) => {
      const mRef = metaRef(userId);
      const metaSnap = await trx.get(mRef);
      const prev: PortfolioSummary | null = metaSnap.exists() ? deserializeMeta(metaSnap.data()) : null;

      if (!metaSnap.exists() && !opts.allowCreate) {
        throw new PortfolioError("أنشئ المحفظة أولاً قبل إضافة العمليات.");
      }

      const balanceBefore = prev ? prev.currentBalance : 0;
      const balanceAfter = balanceBefore + signed;

      // Integrity guards — never allow negative balance, NaN, or a zero-flow row.
      if (!Number.isFinite(balanceAfter) || Number.isNaN(balanceAfter)) {
        throw new PortfolioError("حساب الرصيد أنتج قيمة غير صالحة.");
      }
      if (balanceAfter < 0) {
        throw new PortfolioError(
          `الرصيد لا يكفي لهذه العملية — المتاح ${balanceBefore.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}$.`
        );
      }
      if (balanceAfter === balanceBefore) {
        throw new PortfolioError("هذه العملية لا تغير الرصيد — تحقق من المبلغ ونوع التأثير.");
      }

      const txId = doc(txCol(userId)).id; // unique id → duplicate-safe
      const txRef = doc(txCol(userId), txId);
      const txDoc = buildTxDoc(input, balanceBefore, balanceAfter, txId);
      const meta = buildMetaDoc(prev, balanceAfter, signed, input);

      await trx.set(txRef, txDoc);
      await trx.set(
        mRef,
        { ...meta, userId },
        { merge: opts.allowCreate ? false : true }
      );
    });
  },

  /* ─── Realtime listeners ────────────────────────────────────────── */

  /** One-shot read of the summary doc (used by the boot data warm-up). */
  async fetchSummary(userId: string): Promise<PortfolioSummary | null> {
    const snap = await getDoc(metaRef(userId));
    return snap.exists() ? deserializeMeta(snap.data()) : null;
  },

  subscribeMeta(userId: string, onNext: (summary: PortfolioSummary | null) => void): () => void {
    return onSnapshot(metaRef(userId), (snap) => {
      onNext(snap.exists() ? deserializeMeta(snap.data()) : null);
    });
  },

  /**
   * Realtime listener over the newest `howMany` transactions (ordered desc).
   * Returns the unsubscribe fn and the docs count (for has-more detection).
   */
  subscribeTransactions(
    userId: string,
    howMany: number,
    onNext: (txs: PortfolioTransaction[], hasMore: boolean, count: number) => void
  ): () => void {
    const q = query(txCol(userId), orderBy("timestamp", "desc" as OrderByDirection), limit(howMany));
    return onSnapshot(q, (snap) => {
      const txs = snap.docs.map((d) => deserializeTx(d.id, d.data()));
      const hasMore = snap.size >= howMany;
      onNext(txs, hasMore, snap.size);
    });
  },

  /** Load an older page of transactions (by timestamp cursor). */
  async loadOlder(
    userId: string,
    beforeTimestamp: number,
    howMany: number,
    txIds: Set<string>
  ): Promise<{ txs: PortfolioTransaction[]; hasMore: boolean }> {
    const q = query(
      txCol(userId),
      orderBy("timestamp", "desc" as OrderByDirection),
      startAfter(Timestamp.fromDate(new Date(beforeTimestamp))),
      limit(howMany)
    );
    const snap = await getDocs(q);
    const txs: PortfolioTransaction[] = [];
    for (const d of snap.docs) {
      const t = deserializeTx(d.id, d.data());
      if (!txIds.has(t.id)) txs.push(t);
    }
    return { txs, hasMore: txIds.size > 0 || snap.size >= howMany };
  },

  /** Full-writeback (used only for future analytics migrations, not the UI). */
  async refreshMeta(userId: string): Promise<void> {
    // Recompute the summary from the whole ledger (bounded paging).
    const all: PortfolioTransaction[] = [];
    let cursor: { timestamp: number } | null = null;
    for (;;) {
      let q = query(txCol(userId), orderBy("timestamp", "desc"), limit(1000));
      if (cursor) {
        q = query(
          txCol(userId),
          orderBy("timestamp", "desc"),
          startAfter(Timestamp.fromDate(new Date(cursor.timestamp))),
          limit(1000)
        );
      }
      const snap = await getDocs(q);
      for (const d of snap.docs) all.push(deserializeTx(d.id, d.data()));
      if (snap.size < 1000 || all.length === 0) break;
      cursor = { timestamp: all[all.length - 1].timestamp };
    }
    // Sorting asc by timestamp and replaying the ledger recomputes the summary.
    const asc = all.sort((a, b) => a.timestamp - b.timestamp);
    let summary: Record<string, unknown> | null = null;
    for (const t of asc) {
      const signed = t.balanceAfter - t.balanceBefore;
      const input: AddTransactionInput = {
        type: t.type,
        impact: signed >= 0 ? "increase" : "decrease",
        amount: Math.abs(signed),
        timestamp: t.timestamp,
      };
      // Safe cast: buildMetaDoc returns all MetaAccum keys by construction.
      summary = buildMetaDoc(summary as MetaAccum | null, t.balanceAfter, signed, input);
    }
    if (summary) {
      await setDoc(metaRef(userId), summary, { merge: true });
    }
  },
};