"use client";

import { BITCOIN_CONFIG } from "@/features/bitcoin/constants";
import { useMarketData } from "@/features/bitcoin/store/market-context";
import { formatPercent, formatPrice } from "@/features/bitcoin/utils";
import { num } from "@/components/ui/design-tokens";

/** Compact live BTC quote (price + 24h %). Future-ready: swap the source here. */
export function MarketContext() {
  const { livePrice, overview } = useMarketData();
  const price = livePrice ?? overview?.price ?? null;
  const change = overview?.change24hPercent ?? null;
  const up = (change ?? 0) >= 0;

  return (
    <div
      dir="ltr"
      className={`${num} flex items-center gap-2 rounded-panel border border-line/80 bg-surface-2/30 px-2.5 py-1 text-[11px]`}
      aria-label="سعر BTC/USDT"
    >
      <span className="font-bold text-zinc-100">
        {BITCOIN_CONFIG.PAIR.replace("USDT", "/USDT")}
      </span>
      <span className="h-3 w-px bg-line" />
      <span className="font-semibold text-zinc-200">
        {price != null ? formatPrice(price) : "—"}
      </span>
      <span className={change == null ? "text-muted" : up ? "text-up-fg" : "text-down-fg"}>
        {change != null ? formatPercent(change) : "—"}
      </span>
    </div>
  );
}