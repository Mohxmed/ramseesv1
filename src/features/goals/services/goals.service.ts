import {
  collection,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import type { GoalsData, GoalsDocument } from "../types";

function progressDocRef(userId: string) {
  const db = getDb();
  return doc(collection(db, "users", userId, "goals"), "progress");
}

function serialize(data: GoalsData) {
  return {
    ...data,
    updatedAt: Timestamp.fromDate(data.updatedAt),
    strategyRef: data.strategyRef,
    moves: data.moves.map((m) => ({
      ...m,
      completedAt: m.completedAt ? Timestamp.fromDate(m.completedAt) : null,
    })),
  };
}

function deserialize(id: string, userId: string, data: Record<string, unknown>) {
  const raw = data as unknown as {
    currentMove: number;
    completedMoves: number;
    currentValue: number;
    startingValue: number;
    perMoveGrowthPercent: number;
    strategyRef: { name: string; version: string } | null;
    moves: Array<{
      move: number;
      targetValue: number;
      startingValue?: number;
      endingValue?: number;
      growthPercentage?: number;
      completed: boolean;
      completedAt?: Timestamp | null;
    }>;
    updatedAt: Timestamp;
  };

  return {
    id,
    userId,
    currentMove: raw.currentMove,
    completedMoves: raw.completedMoves,
    currentValue: raw.currentValue,
    startingValue: raw.startingValue,
    perMoveGrowthPercent: raw.perMoveGrowthPercent,
    strategyRef: raw.strategyRef,
    moves: raw.moves.map((m) => ({
      ...m,
      completedAt: m.completedAt ? m.completedAt.toDate() : undefined,
    })),
    updatedAt: raw.updatedAt.toDate(),
  } as GoalsDocument;
}

export const goalsService = {
  async getProgress(userId: string): Promise<GoalsDocument | null> {
    const ref = progressDocRef(userId);
    const snapshot = await getDoc(ref);
    if (!snapshot.exists()) return null;
    return deserialize(snapshot.id, userId, snapshot.data());
  },

  async saveProgress(userId: string, data: GoalsData): Promise<void> {
    const ref = progressDocRef(userId);
    await setDoc(ref, {
      ...serialize(data),
      createdAt: serverTimestamp(),
      userId,
    });
  },
};