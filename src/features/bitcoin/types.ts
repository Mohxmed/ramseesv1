import { type Timestamp } from "@/types/common";

export type BtcPrice = {
  price: number;
  currency: "USD";
  timestamp: Date;
};

export type BtcPriceDocument = BtcPrice & Timestamp;

export type BtcCandle = {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: Date;
};

export type BtcMarketData = {
  price: number;
  change24h: number;
  change24hPercent: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  timestamp: Date;
};

export type BtcMarketDataDocument = BtcMarketData & Timestamp;

export type BtcTimeframe = "1m" | "5m" | "15m" | "1h" | "4h" | "1d" | "1w";
