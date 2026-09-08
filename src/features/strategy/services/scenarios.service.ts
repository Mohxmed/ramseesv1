import { collection, deleteDoc, doc, getDocs, setDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import type { SavedScenario } from "../lib/scenario";
import { SCENARIO_COLLECTION } from "../lib/constants";

function scenariosCol(userId: string) {
  return collection(getDb(), "users", userId, SCENARIO_COLLECTION);
}

function scenarioDoc(userId: string, id: string) {
  return doc(getDb(), "users", userId, SCENARIO_COLLECTION, id);
}

/**
 * Firestore persistence for saved calculator scenarios. Each scenario keeps a
 * full immutable snapshot of the inputs so later strategy edits never change
 * what was actually calculated at save time.
 */
export const scenariosService = {
  async list(userId: string): Promise<SavedScenario[]> {
    const snapshot = await getDocs(scenariosCol(userId));
    return snapshot.docs.map((d) => d.data() as unknown as SavedScenario);
  },

  async save(userId: string, scenario: SavedScenario): Promise<void> {
    await setDoc(scenarioDoc(userId, scenario.id), scenario as unknown as Record<string, unknown>);
  },

  async remove(userId: string, id: string): Promise<void> {
    await deleteDoc(scenarioDoc(userId, id));
  },
};