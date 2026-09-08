/**
 * Scenario snapshots for the risk calculator.
 *
 * A saved scenario keeps a full copy of every input so historical scenarios
 * are never retroactively affected by later strategy edits.
 */

import type { Direction, OrderType } from "../types/strategy";
import { uid } from "./versioning";

export interface CalculatorSnapshot {
  strategyId: string | null;
  strategyName: string | null;
  versionLabel: string | null;
  direction: Direction;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  positionSize: number;
  quantity: number;
  leverage: number;
  entryOrderType: OrderType;
  tpOrderType: OrderType;
  slOrderType: OrderType;
  makerFee: number;
  takerFee: number;
  slippagePercent: number;
  accountBalance: number;
  asset: string;
  createdAt: number;
}

export interface SavedScenario {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  snapshot: CalculatorSnapshot;
}

export interface ScenarioFieldValues {
  strategyId: string | null;
  strategyName: string | null;
  versionLabel: string | null;
  direction: Direction;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  positionSize: number;
  quantity: number;
  leverage: number;
  entryOrderType: OrderType;
  tpOrderType: OrderType;
  slOrderType: OrderType;
  makerFee: number;
  takerFee: number;
  slippagePercent: number;
  accountBalance: number;
  asset: string;
}

export function buildSnapshot(fields: ScenarioFieldValues): CalculatorSnapshot {
  return {
    ...fields,
    createdAt: Date.now(),
  };
}

/** Suggested readable name for a saved scenario. */
export function scenarioNameSuggestion(snapshot: CalculatorSnapshot): string {
  const direction = snapshot.direction === "LONG" ? "شراء" : "بيع";
  const token = snapshot.strategyName
    ? `${snapshot.strategyName} ${snapshot.versionLabel ?? ""}`
    : "مخصص";
  return `سيناريو ${direction} — ${token}`;
}

export function createSavedScenario(
  name: string,
  snapshot: CalculatorSnapshot
): SavedScenario {
  const now = Date.now();
  return {
    id: uid("scn"),
    name: name.trim() || scenarioNameSuggestion(snapshot),
    createdAt: now,
    updatedAt: now,
    snapshot,
  };
}