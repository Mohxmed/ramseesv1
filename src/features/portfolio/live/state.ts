/**
 * Pure state helpers for the Binance live layer.
 *
 * No I/O, no React, no manager side effects: everything here is a function of
 * its inputs so the tricky bits (event merging, mark-price P&L, subscription
 * diffing) stay unit-testable in isolation. The manager owns WHEN this state
 * advances; these functions decide HOW.
 */

export type PositionSide = "LONG" | "SHORT";

/** One open perpetuals position held in memory by the live manager. */
export interface LiveStorePosition {
  symbol: string;
  side: PositionSide;
  quantity: number;
  entryPrice: number;
  markPrice: number | null;
  liquidationPrice: number | null;
  leverage: number;
  margin: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number | null;
  notional: number;
  /** UTC ms of the last authoritative (account-event or REST) update. */
  updatedAt: number;
  /** UTC ms of the most recent mark tick. */
  markAt: number | null;
}

export interface LiveStoreState {
  equity: number;
  walletBalance: number;
  unrealizedPnl: number;
  availableBalance: number;
  positions: LiveStorePosition[];
  /** UTC ms the store was last written. */
  lastUpdateAt: number | null;
  /** UTC ms of the last REST reconciliation. */
  lastReconcileAt: number | null;
  /** Mark-price tick counts per symbol (dev instrumentation). */
  markTicks: Record<string, number>;
}

export type LiveStatus =
  | "idle"
  | "connecting"
  | "live"
  | "reconnecting"
  | "degraded"
  | "error"
  | "disposed";

/**
 * One event []-tuple from a FUTURES ACCOUNT_UPDATE (`a.P`): every cell is a
 * string, positions are keyed in the same order Binance sends them.
 */
export type RawPositionTuple = [
  symbol: string,
  positionAmt: string,
  entryPrice: string,
  accumulatedRealized: string,
  unrealizedPnl: string,
  marginType: string,
  isolatedWallet: string,
  positionSide: string,
];

/** One event []-tuple from ACCOUNT_UPDATE balances (`a.B`). */
export type RawBalanceTuple = [
  asset: string,
  walletBalance: string,
  crossWalletBalance: string,
  balanceChange: string,
];

export interface RawAccountUpdateEvent {
  /** Transaction time (UTC ms). */
  T: number;
  a?: { B?: RawBalanceTuple[]; P?: RawPositionTuple[] };
}

export function emptyLiveStore(): LiveStoreState {
  return {
    equity: 0,
    walletBalance: 0,
    unrealizedPnl: 0,
    availableBalance: 0,
    positions: [],
    lastUpdateAt: null,
    lastReconcileAt: null,
    markTicks: {},
  };
}

export function positionKey(symbol: string, side: PositionSide): string {
  return `${symbol}:${side}`;
}

/** P&L for a position from mark vs entry — restated here so it is testable. */
export function positionPnl(pos: LiveStorePosition): number {
  const m = pos.markPrice;
  if (m == null || !Number.isFinite(m) || pos.quantity <= 0) return 0;
  if (pos.side === "LONG") return (m - pos.entryPrice) * pos.quantity;
  return (pos.entryPrice - m) * pos.quantity;
}

const toNum = (v: string, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/**
 * Merge an ACCOUNT_UPDATE into the store.
 *
 *  - Position tuples (`a.P`): the signed amount is authoritative for
 *    direction in both one-way ("BOTH") and hedge ("LONG"/"SHORT") modes.
 *    qty=0 closes the position. Out-of-order events (older `T` than the
 *    position we already hold) are ignored per symbol. Existing mark/liquidation
 *    fields survive a re-slot.
 *  - Balance tuples (`a.B`) are intentionally ignored: futures balance deltas
 *    from events are not equity — equity comes from the authoritative REST
 *    /fapi/v1/account snapshot on session/reconcile/manual-refresh.
 */
export function mergeAccountUpdate(state: LiveStoreState, ev: RawAccountUpdateEvent): void {
  const t = toNum(String(ev.T), 0);
  if (t <= 0 || !ev.a || !Array.isArray(ev.a.P)) return;

  const slots: Array<{
    symbol: string;
    side: PositionSide;
    qd: number;
    ep: number;
    pnl: number;
    t: number;
  }> = [];
  const closes: Array<{ symbol: string; side: PositionSide }> = [];

  for (const tuple of ev.a.P) {
    if (!Array.isArray(tuple) || tuple.length < 5) continue;
    const symbol = String(tuple[0]).toUpperCase();
    const signed = toNum(String(tuple[1]));
    const qd = Math.abs(signed);
    // positionSide column (index 7, default "BOTH") decides which side a close
    // belongs to; a sign-less zero can only be a closure of the named side.
    const ps = tuple.length > 7 ? String(tuple[7]).toUpperCase() : "BOTH";
    // Sign of the amount is the canonical direction (works in one-way AND hedge
    // modes); a zero amount has no sign, so a close falls back to positionSide.
    const side: PositionSide =
      qd > 0 ? (signed > 0 ? "LONG" : "SHORT") : ps === "SHORT" ? "SHORT" : "LONG";
    if (qd === 0) {
      closes.push({ symbol, side });
      continue;
    }
    slots.push({ symbol, side, qd, ep: toNum(String(tuple[2])), pnl: toNum(String(tuple[4])), t });
  }

  for (const slot of slots) {
    const key = positionKey(slot.symbol, slot.side);
    const idx = state.positions.findIndex((p) => positionKey(p.symbol, p.side) === key);
    if (idx >= 0 && state.positions[idx].updatedAt > slot.t) continue; // stale event
    const prev = idx >= 0 ? state.positions[idx] : null;
    const next: LiveStorePosition = {
      symbol: slot.symbol,
      side: slot.side,
      quantity: slot.qd,
      entryPrice: slot.ep,
      markPrice: prev?.markPrice ?? null,
      liquidationPrice: prev?.liquidationPrice ?? null,
      leverage: prev?.leverage ?? 0,
      margin: prev?.margin ?? 0,
      unrealizedPnl: slot.pnl,
      unrealizedPnlPct: prev && prev.margin > 0 ? (slot.pnl / prev.margin) * 100 : null,
      notional: prev?.notional ?? 0,
      updatedAt: slot.t,
      markAt: prev?.markAt ?? null,
    };
    if (idx >= 0) state.positions[idx] = next;
    else state.positions.push(next);
  }

  for (const close of closes) {
    const key = positionKey(close.symbol, close.side);
    state.positions = state.positions.filter((p) => positionKey(p.symbol, p.side) !== key);
  }

  state.lastUpdateAt = Math.max(state.lastUpdateAt ?? 0, t);
}

/**
 * Apply one @markPrice@1s tick to a symbol. The mark is authoritative; the
 * P&L is recomputed client-side so the live ROI column tracks the mark even
 * between account events (ACCOUNT_UPDATE carries no mark price).
 */
export function applyMarkPrice(
  state: LiveStoreState,
  lowercaseSymbol: string,
  mark: number,
  at: number
): void {
  if (!Number.isFinite(mark) || mark <= 0) return;
  const symbol = lowercaseSymbol.toUpperCase();
  state.markTicks[symbol] = (state.markTicks[symbol] ?? 0) + 1;
  let touchedAny = false;
  for (const p of state.positions) {
    if (p.symbol !== symbol) continue;
    p.markPrice = mark;
    p.markAt = at;
    const pnl = positionPnl(p);
    p.unrealizedPnl = pnl;
    p.unrealizedPnlPct = p.margin > 0 ? (pnl / p.margin) * 100 : null;
    touchedAny = true;
  }
  if (touchedAny) state.lastUpdateAt = at;
}

/** The aggregate panel numbers from a store snapshot. */
export function aggregateOf(state: LiveStoreState): {
  unrealizedPnl: number;
  margin: number;
  notional: number;
  count: number;
} {
  let margin = 0;
  let notional = 0;
  let count = 0;
  for (const p of state.positions) {
    if (p.quantity <= 0) continue;
    margin += p.margin;
    notional += p.notional;
    count++;
  }
  const unrealizedPnl = state.positions.reduce((s, p) => (p.quantity > 0 ? s + p.unrealizedPnl : s), 0);
  return { unrealizedPnl, margin, notional, count };
}

/** Open (non-zero-qty) symbols — the combined mark-price subscription set. */
export function openSymbols(state: LiveStoreState): string[] {
  return Array.from(
    new Set(state.positions.filter((p) => p.quantity > 0).map((p) => p.symbol))
  ).sort();
}

/** True when a re-subscribe is required (order-insensitive compare). */
export function markStreamNeedsUpdate(current: string[], next: string[]): boolean {
  if (current.length !== next.length) return true;
  const a = [...current].sort();
  const b = [...next].sort();
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return true;
  }
  return false;
}