/**
 * Exchange Adapter Registry
 *
 * Assembles all exchange adapters following the exchange priority:
 * Binance Futures → Bybit → OKX → Bitget → MEXC → Hyperliquid →
 * Binance Spot → Coinbase Spot
 */

import type { ExchangeAdapter } from "../types";
import { BinanceFuturesAdapter } from "./binance-futures";
import { BybitAdapter } from "./bybit";
import { OkxAdapter } from "./okx";
import { BitgetAdapter } from "./bitget";
import { MexcAdapter } from "./mexc";
import { HyperliquidAdapter } from "./hyperliquid";
import { BinanceSpotAdapter } from "./binance-spot";
import { CoinbaseAdapter } from "./coinbase";

export type AdapterId =
  | "binance_futures"
  | "bybit"
  | "okx"
  | "bitget"
  | "mexc"
  | "hyperliquid"
  | "binance_spot"
  | "coinbase";

export function createAdapters(): ExchangeAdapter[] {
  return [
    new BinanceFuturesAdapter(),
    new BybitAdapter(),
    new OkxAdapter(),
    new BitgetAdapter(),
    new MexcAdapter(),
    new HyperliquidAdapter(),
    new BinanceSpotAdapter(),
    new CoinbaseAdapter(),
  ];
}

export const ADAPTER_LABELS: Record<string, string> = {
  binance_futures: "BIN",
  bybit: "BYBIT",
  okx: "OKX",
  bitget: "BITGET",
  mexc: "MEXC",
  hyperliquid: "HL",
  binance_spot: "BIN-S",
  coinbase: "COIN",
};
