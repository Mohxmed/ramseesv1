/**
 * /api/portfolio/exchanges/[id]/positions-live
 *
 * GET → live open-positions overlay for the wallet page. Stored positions
 * (written during syncs) are book-ended with a fresh Binance USDⓈ-M futures
 * mark price — one public ticker call, no credentials, no rate limit risk —
 * so unrealized P&L moves every poll instead of only after a full exchange
 * sync. Symbols the public feed does not list keep their last synced
 * markPrice/P&L so a poll never fails because of one asset.
 */

import { NextResponse } from "next/server";
import { authenticateRequest } from "@/server/auth";
import { routeErrorResponse, requireOwnedAccount } from "@/server/portfolio/apiHelpers";
import { getPositions } from "@/server/portfolio/queries";
import { BINANCE_FUTURES_URL } from "@/server/exchanges/binance/BinanceRestClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface FuturesTick {
  symbol?: string;
  price?: string;
}

const TICKER_URL = `${BINANCE_FUTURES_URL}/fapi/v1/ticker/price`;

/** One public request returns every USDⓈ-M futures mark price. */
async function fetchFuturesPrices(symbols: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (symbols.length === 0) return out;
  try {
    const res = await fetch(TICKER_URL, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(6_000),
    });
    if (!res.ok) return out;
    const json = (await res.json()) as FuturesTick[];
    for (const row of json) {
      const price = Number(row?.price);
      if (row?.symbol != null && Number.isFinite(price) && price > 0) {
        out.set(row.symbol.toUpperCase(), price);
      }
    }
  } catch {
    // A transient feed error keeps the last synced valuation — never throw.
  }
  return out;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const uid = await authenticateRequest(req);
    const { id } = await params;
    const account = await requireOwnedAccount(uid, id);

    const stored = await getPositions(uid, account.id);
    if (stored.length === 0) {
      return NextResponse.json({
        positions: [],
        aggregate: { unrealizedPnl: 0, margin: 0, notional: 0, count: 0 },
        live: true,
        at: Date.now(),
      });
    }

    const prices = await fetchFuturesPrices(stored.map((p) => p.symbol.toUpperCase()));
    const at = Date.now();

    let unrealizedPnl = 0;
    let margin = 0;
    let notional = 0;

    const positions = stored.map((p) => {
      const symbol = p.symbol.toUpperCase();
      const livePrice = prices.get(symbol);
      const pricedLive = livePrice != null;
      const markPrice = pricedLive ? livePrice : p.markPrice;
      const pnl = pricedLive
        ? p.side === "LONG"
          ? (markPrice - p.entryPrice) * p.quantity
          : (p.entryPrice - markPrice) * p.quantity
        : p.unrealizedPnl;
      const unrealizedPnlPct = p.margin > 0 ? (pnl / p.margin) * 100 : null;

      margin += p.margin;
      notional += p.notional;
      unrealizedPnl += pnl;

      return {
        symbol,
        side: p.side,
        quantity: p.quantity,
        entryPrice: p.entryPrice,
        markPrice,
        liquidationPrice: p.liquidationPrice ?? null,
        leverage: p.leverage,
        margin: p.margin,
        unrealizedPnl: pnl,
        unrealizedPnlPct,
        realizedPnl: p.realizedPnl,
        notional: p.notional,
        timestamp: p.timestamp,
        pricedLive,
        valuedAt: at,
      };
    });

    return NextResponse.json({
      positions,
      aggregate: { unrealizedPnl, margin, notional, count: positions.length },
      live: true,
      at,
    });
  } catch (err) {
    return routeErrorResponse(err);
  }
}