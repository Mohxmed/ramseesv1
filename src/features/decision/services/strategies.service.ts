import { collection, deleteDoc, doc, getDocs, setDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import type { Strategy } from "../types";

function strategiesCol(userId: string) {
  return collection(getDb(), "users", userId, "strategies");
}

function strategyDoc(userId: string, id: string) {
  return doc(getDb(), "users", userId, "strategies", id);
}

/**
 * Firestore-backed persistence for user strategies.
 *
 * Each strategy is stored as its own document under `users/{uid}/strategies/{id}`.
 * Timestamps are plain numbers (ms), so no server-timestamp conversion is needed.
 * Callers must already have the strategy id set (a uid-style id).
 */
export const strategiesService = {
  async list(userId: string): Promise<Strategy[]> {
    const snapshot = await getDocs(strategiesCol(userId));
    return snapshot.docs.map((d) => d.data() as unknown as Strategy);
  },

  async save(userId: string, strategy: Strategy): Promise<void> {
    await setDoc(strategyDoc(userId, strategy.id), strategy as unknown as Record<string, unknown>);
  },

  async remove(userId: string, id: string): Promise<void> {
    await deleteDoc(strategyDoc(userId, id));
  },
};
