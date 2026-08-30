"use client";

import { Badge, Status, Progress } from "../ui/primitives";
import { num } from "../ui/design-tokens";
import type { MarketHeaderData } from "./types";

const freshnessTone = {
  LIVE: "good",
  RECENT: "warn",
  STALE: "down",
  UNAVAILABLE: "quiet",
} as const;

/** Reusable market header: symbol, price, 24h change, regime + freshness. */
export function MarketHeader({ data }: { data: MarketHeaderData }) {
  const up = (data.change24hPct ?? 0) >= 0;
  return (
    <div className="rounded-card border border-line bg-surface-1/40 px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-zinc-100">{data.symbol}</span>
            <Badge tone="neutral">مضاربة فورية</Badge>
            {data.session ? (
              <span className="text-2xs text-muted">{data.session}</span>
            ) : null}
          </div>
          <div className="mt-2 flex items-baseline gap-3">
            <span className={`${num} text-3xl font-extrabold text-zinc-50`} dir="ltr">
              {data.price != null ? data.price.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"}
            </span>
            {data.change24hPct != null ? (
              <span className={`${num} text-sm font-bold ${up ? "text-up-fg" : "text-down-fg"}`} dir="ltr">
                {up ? "+" : ""}
                {data.change24hPct.toFixed(2)}%
              </span>
            ) : null}
          </div>
          {data.date ? <div className="mt-1 text-2xs text-muted">{data.date}</div> : null}
        </div>

        <div className="flex flex-col items-end gap-2">
          {data.regime ? (
            <div className="flex items-center gap-2">
              <Badge tone="up">{data.regime}</Badge>
              {data.regimeConfidence != null ? (
                <span className={`${num} text-2xs text-muted`} dir="ltr">
                  {data.regimeConfidence.toFixed(0)}%
                </span>
              ) : null}
            </div>
          ) : null}
          {data.freshness ? (
            <Status tone={freshnessTone[data.freshness]} label={data.freshness} pulse={data.freshness === "LIVE"} />
          ) : null}
        </div>
      </div>

      {data.bias != null ? (
        <div className="mt-4">
          <Progress pct={data.bias} tone={data.bias >= 55 ? "up" : data.bias <= 45 ? "down" : "warn"} />
        </div>
      ) : null}
    </div>
  );
}
