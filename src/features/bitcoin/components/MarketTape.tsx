"use client";

import type {
  FuturesContext,
  MarketOverview,
  MarketState,
  OrderBookSnapshot,
  TechnicalIndicators,
} from "../types";
import { formatCompact, formatPercent, formatPrice } from "../utils";
import { Card } from "@/components/ui/index";

function Tile({
  label,
  value,
  tone,
  sub,
}: {
  label: string;
  value: string;
  tone?: string;
  sub?: string;
}) {
  const toneClass =
    tone === "up"
      ? "text-up-fg"
      : tone === "down"
      ? "text-down-fg"
      : tone === "warn"
      ? "text-warn-fg"
      : "text-zinc-100";
  return (
    <div className="rounded-panel border border-line bg-surface-2/30 px-3 py-2.5">
      <p className="text-2xs text-muted">{label}</p>
      <p className={`mt-0.5 text-sm font-bold leading-tight ${toneClass}`} dir="ltr">
        {value}
      </p>
      {sub && <p className="mt-0.5 text-2xs text-muted">{sub}</p>}
    </div>
  );
}

/**
 * 24h + derivatives market tape. The live price itself is owned by TopBar so
 * every number here is a distinct metric (no duplicated source value).
 */
export function MarketTape({
  overview,
  futures,
  marketState,
  orderBook,
  indicators,
}: {
  overview: MarketOverview | null;
  futures: FuturesContext | null;
  marketState: MarketState | null;
  orderBook: OrderBookSnapshot | null;
  indicators: TechnicalIndicators | null;
}) {
  const oiUsd =
    futures?.openInterest && futures.markPrice
      ? futures.openInterest * futures.markPrice
      : overview?.openInterest != null && overview.price > 0
      ? overview.openInterest * overview.price
      : null;
  const futVol = futures?.futuresVolume ?? overview?.futuresVolume ?? null;
  const funding = futures?.fundingRate ?? overview?.fundRate ?? null;
  const longShort = futures?.longShortRatio ?? overview?.longShortRatio ?? null;
  const longShare = futures?.longAccountShare ?? null;
  const vwap = indicators?.vwap.value ?? null;
  const price = marketState?.price ?? overview?.price ?? null;
  const vwapDev = price != null && vwap != null && vwap > 0 ? ((price / vwap) - 1) * 100 : null;

  return (
    <Card title="شريط السوق لحظيًا (24س + مشتقات)">
      {!overview && !futures ? (
        <p className="py-6 text-center text-2xs text-muted">بيانات السوق غير متاحة بعد</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Tile
            label="أعلى سعر (24س)"
            value={overview ? formatPrice(overview.high24h) : "—"}
            tone="up"
          />
          <Tile
            label="أدنى سعر (24س)"
            value={overview ? formatPrice(overview.low24h) : "—"}
            tone="down"
          />
          <Tile
            label="حجم التداول (24س)"
            value={overview?.volume24h ? `$${formatCompact(overview.volume24h)}` : "—"}
            sub="سوق فوري"
          />
          <Tile
            label="القيمة السوقية"
            value={overview?.marketCap ? `$${formatCompact(overview.marketCap)}` : "—"}
          />
          <Tile
            label="هيمنة بيتكوين"
            value={overview?.btcDominance != null ? formatPercent(overview.btcDominance, 2) : "—"}
          />
          <Tile
            label="معدل الفاندينغ (Funding)"
            value={funding != null ? formatPercent(funding, 4) : "—"}
            tone={funding != null && funding > 0 ? "warn" : funding != null && funding < 0 ? "up" : undefined}
            sub={futures?.fundingChange != null ? `التغيّر ${formatPercent(futures.fundingChange, 4)}` : undefined}
          />
          <Tile
            label="العقود المفتوحة (OI)"
            value={oiUsd ? `$${formatCompact(oiUsd)}` : "—"}
            sub={
              futures?.oiChange1h != null
                ? `تغيّر 1س ${formatPercent(futures.oiChange1h)}`
                : undefined
            }
          />
          <Tile
            label="الطويل/القصير (Long/Short)"
            value={longShort != null ? longShort.toFixed(2) : "—"}
            sub={longShare != null ? `حصة طويلة ${(longShare * 100).toFixed(0)}%` : undefined}
          />
          <Tile
            label="حجم العقود الآجلة"
            value={futVol ? `$${formatCompact(futVol)}` : "—"}
            sub="سوق عقود آجلة"
          />
          <Tile
            label="الأساس (Basis)"
            value={futures?.basis != null ? formatPercent(futures.basis, 3) : "—"}
          />
          <Tile
            label="الانتشار (Spread)"
            value={orderBook ? `${orderBook.spread.toFixed(2)} (${orderBook.spreadPercent.toFixed(3)}%)` : "—"}
            sub={orderBook ? `${formatPrice(orderBook.bestBid)} / ${formatPrice(orderBook.bestAsk)}` : undefined}
          />
          <Tile
            label="الانحراف عن VWAP"
            value={vwapDev != null ? `${vwapDev >= 0 ? "+" : ""}${vwapDev.toFixed(2)}%` : "—"}
            tone={vwapDev != null ? (vwapDev >= 0 ? "up" : "down") : undefined}
          />
        </div>
      )}
    </Card>
  );
}