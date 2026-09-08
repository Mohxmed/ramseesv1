import { collection, deleteDoc, doc, getDocs, setDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import type { StrategyNumbers } from "../types/strategy";
import { STRATEGY_COLLECTION } from "../lib/constants";

function strategiesCol(userId: string) {
  return collection(getDb(), "users", userId, STRATEGY_COLLECTION);
}

function strategyDoc(userId: string, id: string) {
  return doc(getDb(), "users", userId, STRATEGY_COLLECTION, id);
}

/**
 * Firestore persistence for the versioned Strategy Numbers documents.
 *
 * One strategy per document under `users/{uid}/strategyNumbers/{id}` with the
 * full `versions[]` snapshot array embedded — so a strategy is always loaded
 * and stored atomically. Mirrors the decision `strategies.service`.
 */
export const strategyNumbersService = {
  async list(userId: string): Promise<StrategyNumbers[]> {
    const snapshot = await getDocs(strategiesCol(userId));
    return snapshot.docs.map((d) => d.data() as unknown as StrategyNumbers);
  },

  async save(userId: string, strategy: StrategyNumbers): Promise<void> {
    await setDoc(strategyDoc(userId, strategy.id), strategy as unknown as Record<string, unknown>);
  },

  async remove(userId: string, id: string): Promise<void> {
    await deleteDoc(strategyDoc(userId, id));
  },
};