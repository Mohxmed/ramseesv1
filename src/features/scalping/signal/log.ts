import type { SignalRecord } from "../types";

/**
 * Signal logger — keeps a bounded in-memory history of generated signals for
 * later outcome labelling / backtesting. It never fabricates outcomes; the
 * `actualOutcome` and `realizedReturnPct` fields are for a future backtester
 * to fill by measuring forward prices.
 *
 * Bounded (ring) to prevent unbounded growth; if a persistent store is added
 * later, this is the single integration point.
 */

const MAX_RECORDS = 500;

const records: SignalRecord[] = [];

export function recordSignal(rec: SignalRecord): void {
  records.push(rec);
  if (records.length > MAX_RECORDS) {
    records.splice(0, records.length - MAX_RECORDS);
  }
}

export function getSignalRecords(): readonly SignalRecord[] {
  return records;
}

export function clearSignalRecords(): void {
  records.length = 0;
}
