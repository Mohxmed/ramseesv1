"use client";

import { useMarketData } from "@/features/bitcoin/store/market-context";
import { formatPercent, formatPrice } from "@/features/bitcoin/utils";
import { num } from "@/components/ui/design-tokens";
import {
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  BitcoinIcon,
} from "@/components/icons/icons";

/**
 * Live BTC quote strip for the header — price read directly on the surface,
 * a live pulse, and the 24h change as a tinted chip instead of a flat
 * "pair = price" pill.
 */
export function MarketContext() {
  const { livePrice, overview } = useMarketData();
  const price = livePrice ?? overview?.price ?? null;
  const change = overview?.change24hPercent ?? null;
  const up = (change ?? 0) >= 0;

  return (
    <div
      dir="ltr"
      className={`${num} flex items-center gap-2.5 rounded-full border border-line/80 bg-surface-2/30 py-1 pl-2 pr-3`}
      aria-label="سعر BTC/USDT"
    >
      <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-3/70">
        <BitcoinIcon className="h-4 w-4 text-[#f7931a]" />
        {price != null && (
          <span
            aria-hidden
            className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full bg-up-fg ring-2 ring-surface-1"
          />
        )}
      </span>

      <div className="flex flex-col leading-none">
        <span className="text-2xs font-semibold text-muted">BTC / USDT</span>
        <span className="mt-0.5 text-base font-extrabold tracking-tight text-zinc-50">
          {price != null ? formatPrice(price) : "—"}
        </span>
      </div>

      <span
        className={`flex items-center gap-0.5 rounded-full px-2 py-1 text-[11px] font-bold ${
          change == null
            ? "text-muted"
            : up
              ? "bg-up/10 text-up-fg"
              : "bg-down/10 text-down-fg"
        }`}
        title="تغير آخر 24 ساعة"
      >
        {change == null ? null : up ? (
          <ArrowUpRightIcon className="h-3 w-3" />
        ) : (
          <ArrowDownRightIcon className="h-3 w-3" />
        )}
        {change != null ? formatPercent(change) : "—"}
      </span>
      <span className="text-2xs font-medium text-muted">24h</span>
    </div>
  );
}