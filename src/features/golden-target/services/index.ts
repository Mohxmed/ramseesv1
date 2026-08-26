import type { GoldenTargetDocument, GoldenTargetSnapshot } from "../types";
import { COLLECTIONS, getDocument } from "@/lib/firebase/firestore";

export const goldenTargetService = {
  async getGoldenTarget(userId: string): Promise<GoldenTargetDocument | null> {
    return getDocument<GoldenTargetDocument>(
      COLLECTIONS.goldenTargets,
      userId
    );
  },

  async getGoldenTargetHistory(userId: string): Promise<GoldenTargetSnapshot | null> {
    return getDocument<GoldenTargetSnapshot>(
      COLLECTIONS.goldenTargets,
      userId
    );
  },
};
