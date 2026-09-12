/**
 * SERVER-ONLY — builds the account "detail" payload shared by the GET detail
 * route and the manual-refresh (POST /refresh) route so both endpoints return
 * byte-identical shapes. The UI reads this body once on open and once per
 * manual refresh — never on a timer.
 *
 * Baseline rule: everything dated before `financials.baselineAt` is withheld.
 * The baseline IS the wallet's starting point, so showing operations that do
 * not feed any of its numbers would contradict the P&L on the same screen.
 * The rows are only hidden from the payload — never deleted from Firestore.
 */

import {
  getBalances,
  getRunningSync,
  getSnapshots,
  listReconciliationEvents,
} from "./portfolioDb";
import { getOpenOrders, getPositions, getTransactions, getTrades } from "./queries";
import { sinceBaseline } from "./engine/baseline";
import type { StoredAccount } from "./models";

export async function buildAccountDetailBody(
  uid: string,
  account: StoredAccount,
  opts: { limit?: number } = {}
) {
  const limit = Number.isFinite(opts.limit) ? Math.min(Math.max(Math.floor(opts.limit ?? 50), 1), 500) : 50;
  const since = account.financials?.baselineAt ?? null;

  const [balances, positions, openOrders, allTransactions, allTrades, running, allSnapshots, recon] = await Promise.all([
    getBalances(uid, account.id),
    getPositions(uid, account.id),
    getOpenOrders(uid, account.id),
    getTransactions(uid, account.id, { limit }),
    getTrades(uid, account.id, { limit }),
    getRunningSync(uid, account.id),
    getSnapshots(uid, account.id, { limit }),
    listReconciliationEvents(uid, account.id, 10),
  ]);

  const transactions = sinceBaseline(allTransactions, since);
  const trades = sinceBaseline(allTrades, since);
  const snapshots = sinceBaseline(allSnapshots, since);

  const latest = snapshots[snapshots.length - 1] ?? null;
  return {
    account,
    balances: balances.map((b) => ({
      asset: b.asset,
      free: b.free,
      locked: b.locked,
      total: b.total,
      available: b.available,
      usdValue: b.usdValue,
      price: b.price ?? null,
      valuedAt: b.valuedAt,
    })),
    positions: positions.map((p) => ({
      symbol: p.symbol,
      side: p.side,
      quantity: p.quantity,
      entryPrice: p.entryPrice,
      markPrice: p.markPrice,
      liquidationPrice: p.liquidationPrice ?? null,
      leverage: p.leverage,
      margin: p.margin,
      unrealizedPnl: p.unrealizedPnl,
      realizedPnl: p.realizedPnl,
      notional: p.notional,
      timestamp: p.timestamp,
    })),
    openOrders,
    transactions: transactions.map((t) => ({
      id: t.id,
      type: t.type,
      asset: t.asset,
      amount: t.amount,
      usdValue: t.usdValue,
      fee: t.fee,
      feeAsset: t.feeAsset ?? null,
      income:
        t.metadata != null && typeof t.metadata["income"] === "number"
          ? (t.metadata["income"] as number)
          : null,
      incomeType:
        t.metadata != null && typeof t.metadata["incomeType"] === "string"
          ? (t.metadata["incomeType"] as string)
          : null,
      status: t.status ?? null,
      timestamp: t.timestamp,
      externalId: t.externalTransactionId ?? null,
    })),
    trades: trades.map((tr) => ({
      id: tr.id,
      symbol: tr.symbol,
      side: tr.side,
      quantity: tr.quantity,
      price: tr.price,
      quoteAmount: tr.quoteAmount,
      fee: tr.fee,
      feeAsset: tr.feeAsset ?? null,
      realizedPnlUsd: tr.realizedPnlUsd ?? null,
      timestamp: tr.timestamp,
      orderId: tr.externalOrderId ?? null,
    })),
    latestSnapshot: latest
      ? {
          timestamp: latest.timestamp,
          totalEquity: latest.totalEquity,
          realizedPnl: latest.realizedPnl,
          unrealizedPnl: latest.unrealizedPnl,
          totalPnl: latest.totalPnl,
        }
      : null,
    snapshots: snapshots.map((s) => ({
      timestamp: s.timestamp,
      totalEquity: s.totalEquity,
      cashValue: s.cashValue,
      assetValue: s.assetValue,
      unrealizedPnl: s.unrealizedPnl,
      realizedPnl: s.realizedPnl,
      totalPnl: s.totalPnl,
      deposits: s.deposits,
      withdrawals: s.withdrawals,
      fees: s.fees,
    })),
    reconciliationEvents: recon,
    syncInProgress: running != null,
  };
}