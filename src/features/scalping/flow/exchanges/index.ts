/**
 * Exchange Adapter Registry
 *
 * Assembles all exchange adapters following the exchange priority:
 * Binance Futures → Bybit → OKX → Bitget → MEXC → Hyperliquid →
 * Binance Spot → Coinbase Spot → Gate.io → KuCoin → Kraken → Deribit →
 * Upbit → HTX → Bitstamp → Bitfinex.
 *
 * The newly added exchanges use the short display codes GT / KC / KR / DR /
 * UP / HT / BS / BI (see ADAPTER_LABELS).
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
import { GateioAdapter } from "./gateio";
import { KucoinAdapter } from "./kucoin";
import { KrakenAdapter } from "./kraken";
import { DeribitAdapter } from "./deribit";
import { UpbitAdapter } from "./upbit";
import { HtxAdapter } from "./htx";
import { BitstampAdapter } from "./bitstamp";
import { BitfinexAdapter } from "./bitfinex";

export type AdapterId =
  | "binance_futures"
  | "bybit"
  | "okx"
  | "bitget"
  | "mexc"
  | "hyperliquid"
  | "binance_spot"
  | "coinbase"
  | "gateio"
  | "kucoin"
  | "kraken"
  | "deribit"
  | "upbit"
  | "htx"
  | "bitstamp"
  | "bitfinex";

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
    new GateioAdapter(),
    new KucoinAdapter(),
    new KrakenAdapter(),
    new DeribitAdapter(),
    new UpbitAdapter(),
    new HtxAdapter(),
    new BitstampAdapter(),
    new BitfinexAdapter(),
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
  gateio: "GT",
  kucoin: "KC",
  kraken: "KR",
  deribit: "DR",
  upbit: "UP",
  htx: "HT",
  bitstamp: "BS",
  bitfinex: "BI",
};
