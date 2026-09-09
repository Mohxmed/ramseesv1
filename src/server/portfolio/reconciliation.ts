/**
 * SERVER-ONLY — never import from client components.
 *
 * Reconciliation engine — validates that the persisted portfolio is
 * internally consistent and matches the exchange's own accounting every sync.
 * Any drift beyond tolerance emits a RECONCILIATION_WARNING (surfaced in the
 * UI as a warning, never auto-silenced).
 */

export type ReconciliationVerdict =
  | { status: "OK"; message: null }
  | { status: "RECONCILIATION_WARNING"; message: string };

export interface ReconciliationInput {
  accountType: string;
  baselineEquity: number;
  deposits: number;
  withdrawals: number;
  fees: number;
  realizedPnl: number;
  actualEquity: number;
  toleranceUsd?: number;
  tolerancePct?: number;
}

/** Pure — no I/O. Compares the equity equation against the actual snapshot. */
export function reconcileEquity(input: ReconciliationInput): ReconciliationVerdict {
  const { accountType, baselineEquity, deposits, withdrawals, fees, realizedPnl, actualEquity } = input;
  const toleranceUsd = input.toleranceUsd ?? 2;
  const tolerancePct = input.tolerancePct ?? 0.01;

  // Spot accounts have no reliable per-trade realized PnL (no average-cost
  // engine yet) — the equation explains flows only, so unexplained drift on
  // spot is the "mystery" channel; futures PnL is known exactly.
  const expectedEquity = baselineEquity + deposits - withdrawals - fees + realizedPnl;
  const difference = expectedEquity - actualEquity;
  const tolerance = Math.max(toleranceUsd, Math.abs(expectedEquity) * tolerancePct);

  if (Math.abs(difference) <= tolerance) {
    return { status: "OK", message: null };
  }
  return {
    status: "RECONCILIATION_WARNING",
    message:
      `${accountType} إعتماداً على السجل: المتوقع ${expectedEquity.toFixed(2)}$،`
      + ` الفعلي ${actualEquity.toFixed(2)}$ — فرق ${difference.toFixed(2)}$ (التسامح ${tolerance.toFixed(2)}$).`,
  };
}

/** Balance-level check: every persisted asset should still exist upstream. */
export function reconcileAssets(input: {
  persisted: readonly { asset: string; free: number; locked: number }[];
  fresh: readonly { asset: string; free: number; locked: number }[];
}): ReconciliationVerdict {
  const freshMap = new Map(input.fresh.map((b) => [b.asset.toUpperCase(), b]));
  const missing: string[] = [];
  const deltas: string[] = [];
  for (const p of input.persisted) {
    const f = freshMap.get(p.asset.toUpperCase());
    const pTotal = p.free + p.locked;
    const fTotal = f ? f.free + f.locked : 0;
    if (!f) {
      missing.push(p.asset);
    } else if (Math.abs(pTotal - fTotal) > 1e-6) {
      deltas.push(`${p.asset}: ${pTotal} → ${fTotal}`);
    }
  }
  if (missing.length === 0 && deltas.length === 0) {
    return { status: "OK", message: null };
  }
  const parts = [
    missing.length > 0 ? `أصول اختفت من الجانب الآخر: ${missing.join("، ")}` : "",
    deltas.length > 0 ? `تغيّر المبالغ: ${deltas.join("؛ ")}` : "",
  ].filter(Boolean);
  return { status: "RECONCILIATION_WARNING", message: parts.join(". ") };
}