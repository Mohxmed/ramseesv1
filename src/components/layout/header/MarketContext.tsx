"use client";

import { useEffect, useRef, useState } from "react";
import { useMarketData } from "@/features/bitcoin/store/market-context";
import { formatPercent, formatPrice } from "@/features/bitcoin/utils";
import { num } from "@/components/ui/design-tokens";
import { ArrowDownRightIcon, ArrowUpRightIcon, BitcoinIcon } from "@/components/icons/icons";

/**
 * Live BTC ticker — a compact Binance-style quote chip: symbol, live price,
 * 24h change. The price digit pulses green when the last tick went up and red
 * when it went down (CSS keyframes re-fire on every tick via a re-keyed span).
 */
export function MarketContext() {
  const { livePrice, overview } = useMarketData();
  const price = livePrice ?? overview?.price ?? null;
  const change = overview?.change24hPercent ?? null;
  const up = (change ?? 0) >= 0;

  const prev = useRef<number | null>(null);
  const [flash, setFlash] = useState<"up" | "down">("up");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (price == null) {
      prev.current = null;
      return;
    }
    const before = prev.current;
    prev.current = price;
    if (before == null || price === before) return;
    setFlash(price > before ? "up" : "down");
    setTick((t) => t + 1);
  }, [price]);

  return (
    <div
      dir="ltr"
      className={`${num} flex h-8 items-center gap-2 rounded-full border border-line/80 bg-surface-2/40 py-1 pl-2 pr-2.5`}
      aria-label="سعر BTC/USDT"
    >
      <span className="relative flex h-5 w-5 shrink-0 items-center justify-center">
        <BitcoinIcon className="h-4 w-4 text-[#f7931a]" />
        <span
          aria-hidden
          className={`absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-up-fg ring-2 ring-surface-1 ${
            price == null ? "opacity-30" : "animate-pulse"
          }`}
        />
      </span>

      <span className="text-[11px] font-semibold leading-none text-muted">
        BTC/USDT
      </span>

      <span
        key={tick}
        className={`text-sm font-bold leading-none text-zinc-50 ${
          tick > 0 ? (flash === "up" ? "animate-price-up" : "animate-price-down") : ""
        }`}
      >
        {price != null ? formatPrice(price) : "—"}
      </span>

      <span
        className={`flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-bold leading-none ${
          change == null
            ? "text-muted"
            : up
              ? "bg-up/10 text-up-fg"
              : "bg-down/10 text-down-fg"
        }`}
      >
        {change == null ? null : up ? <ArrowUpRightIcon className="h-3 w-3" /> : <ArrowDownRightIcon className="h-3 w-3" />}
        {change != null ? formatPercent(change) : "—"}
      </span>
    </div>
  );
}