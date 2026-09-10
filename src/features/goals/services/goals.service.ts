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
  const num = (k: string, fallback = 0) =>
    typeof data[k] === "number" && Number.isFinite(data[k])
      ? (data[k] as number)
      : fallback;
  const rawMoves = Array.isArray(data.moves) ? data.moves : [];
  const moves = rawMoves.map((m, i) => {
    const raw = (m ?? {}) as Record<string, unknown>;
    const toDate = (v: unknown): Date | undefined =>
      v instanceof Timestamp
        ? v.toDate()
        : typeof v === "number" && Number.isFinite(v)
          ? new Date(v)
          : undefined;
    return {
      move: typeof raw.move === "number" ? raw.move : i + 1,
      targetValue:
        typeof raw.targetValue === "number" && Number.isFinite(raw.targetValue)
          ? raw.targetValue
          : 0,
      startingValue: typeof raw.startingValue === "number" ? raw.startingValue : undefined,
      endingValue: typeof raw.endingValue === "number" ? raw.endingValue : undefined,
      growthPercentage:
        typeof raw.growthPercentage === "number" ? raw.growthPercentage : undefined,
      completed: Boolean(raw.completed),
      completedAt: toDate(raw.completedAt),
    };
  });
  const updatedAtRaw = data.updatedAt;
  const updatedAt =
    updatedAtRaw instanceof Timestamp
      ? updatedAtRaw.toDate()
      : typeof updatedAtRaw === "number" && Number.isFinite(updatedAtRaw)
        ? new Date(updatedAtRaw)
        : new Date();
  const strategyRef =
    data.strategyRef && typeof data.strategyRef === "object"
      ? {
          name: String((data.strategyRef as { name?: unknown }).name ?? ""),
          version: String((data.strategyRef as { version?: unknown }).version ?? ""),
        }
      : null;

  return {
    id,
    userId,
    currentMove: num("currentMove", 1),
    completedMoves: num("completedMoves", 0),
    currentValue: num("currentValue", 0),
    startingValue: num("startingValue", 0),
    perMoveGrowthPercent: num("perMoveGrowthPercent", 10),
    strategyRef,
    moves,
    updatedAt,
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