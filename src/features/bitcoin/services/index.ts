import type { BtcPriceDocument, BtcMarketDataDocument } from "../types";
import { COLLECTIONS, getDocument } from "@/lib/firebase/firestore";

export const bitcoinService = {
  async getLatestPrice(): Promise<BtcPriceDocument | null> {
    return getDocument<BtcPriceDocument>(COLLECTIONS.bitcoin, "latest-price");
  },

  async getMarketData(): Promise<BtcMarketDataDocument | null> {
    return getDocument<BtcMarketDataDocument>(
      COLLECTIONS.bitcoin,
      "market-data"
    );
  },
};
