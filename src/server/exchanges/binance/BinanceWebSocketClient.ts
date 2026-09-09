/**
 * SERVER-ONLY — never import from client components.
 *
 * BinanceWebSocketClient — user-data stream for balance/order/trade updates.
 *
 * Design contract (§12):
 *  - REST remains the source of truth — this stream only ADDS real-time hints.
 *  - On any disconnect the client signals onDisconnect() so the caller runs a
 *    REST reconciliation pass, then reconnects with exponential backoff +
 *    jitter and re-subscribes (fresh listenKey).
 *  - listenKey lifecycle: POST to create, PUT keep-alive every 30 min.
 */

import WebSocket from "ws";
import { setTimeout as sleep } from "node:timers/promises";
import { ExchangeError } from "../core/ExchangeErrors";
import type { ExchangeCredentials } from "../core/ExchangeAdapter";
import type { BinanceRestClient } from "./BinanceRestClient";

export const BINANCE_WS_USER_URL = "wss://stream.binance.com:9443/ws";

export interface BinanceUserDataMessage {
  e?: string; // event type
}

export interface BinanceWsHandlers {
  onOutboundAccountPosition?(assets: Array<{ a: string; f: string; l: string }>): void;
  onExecutionReport?(report: Record<string, unknown>): void;
  onBalanceUpdate?(update: { a: string; d: string }): void;
  onDisconnect?(): void;
}

export class BinanceWebSocketClient {
  private sock: WebSocket | null = null;
  private listenKey: string | null = null;
  private closed = false;
  private backoffBase = 1_000;
  private keepAlive: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly rest: BinanceRestClient,
    private readonly handlers: BinanceWsHandlers
  ) {}

  async start(creds: ExchangeCredentials): Promise<void> {
    this.closed = false;
    await this.openSocket(creds);
  }

  private async createListenKey(creds: ExchangeCredentials): Promise<string> {
    const res = await this.rest.signedPost<{ listenKey: string }>(
      creds,
      "/api/v3/userDataStream",
      {},
      { futures: false }
    );
    if (!res?.listenKey) throw ExchangeError.mapping({ stage: "listenKey" });
    return res.listenKey;
  }

  private async keepAliveListenKey(creds: ExchangeCredentials): Promise<void> {
    if (!this.listenKey || this.closed) return;
    try {
      await this.rest.signedPut<Record<string, unknown>>(
        creds,
        "/api/v3/userDataStream",
        { listenKey: this.listenKey },
        { futures: false }
      );
    } catch {
      // A failed keep-alive (expired listenKey) forces a reconnect path.
    }
  }

  private async openSocket(creds: ExchangeCredentials): Promise<void> {
    if (this.closed) return;
    try {
      this.listenKey = await this.createListenKey(creds);
    } catch {
      this.scheduleReconnect(creds, "listenKey:create");
      return;
    }

    const ws = new WebSocket(`${BINANCE_WS_USER_URL}/${this.listenKey}`);
    this.sock = ws;

    ws.on("open", () => {
      this.backoffBase = 1_000;
      this.startKeepAlive(creds);
    });

    ws.on("message", (data) => {
      this.dispatch(data);
    });

    ws.on("close", () => {
      this.stopKeepAlive();
      this.sock = null;
      try {
        this.handlers.onDisconnect?.();
      } catch {
        /* handler errors are non-fatal */
      }
      this.scheduleReconnect(creds, "ws:close");
    });

    ws.on("error", () => {
      if (ws.readyState !== WebSocket.OPEN) {
        try {
          ws.close();
        } catch {
          /* ignore */
        }
      }
    });
  }

  private dispatch(data: WebSocket.RawData): void {
    let msg: BinanceUserDataMessage;
    try {
      msg = JSON.parse(data.toString()) as BinanceUserDataMessage;
    } catch {
      return;
    }
    if (!msg || typeof msg !== "object" || !msg.e) return;
    try {
      switch (msg.e) {
        case "outboundAccountPosition": {
          const payload = msg as BinanceUserDataMessage & { B?: Array<{ a: string; f: string; l: string }> };
          this.handlers.onOutboundAccountPosition?.(payload.B ?? []);
          break;
        }
        case "executionReport":
          this.handlers.onExecutionReport?.(msg as Record<string, unknown>);
          break;
        case "balanceUpdate": {
          const payload = msg as BinanceUserDataMessage & { a?: string; d?: string };
          if (payload.a && payload.d) this.handlers.onBalanceUpdate?.({ a: payload.a, d: payload.d });
          break;
        }
        default:
          break;
      }
    } catch {
      /* a handler failure must never kill the socket */
    }
  }

  private scheduleReconnect(creds: ExchangeCredentials, reason: string): void {
    if (this.closed) return;
    const wait = Math.min(this.backoffBase, 15_000) * Math.random(); // full jitter
    this.backoffBase = Math.min(this.backoffBase * 2, 15_000);
    this.reconnectTimer = setTimeout(() => {
      void this.openSocket(creds).catch(() => this.scheduleReconnect(creds, reason));
    }, wait);
  }

  private startKeepAlive(creds: ExchangeCredentials): void {
    this.stopKeepAlive();
    this.keepAlive = setInterval(() => {
      void this.keepAliveListenKey(creds);
    }, 30 * 60_000);
  }

  private stopKeepAlive(): void {
    if (this.keepAlive) {
      clearInterval(this.keepAlive);
      this.keepAlive = null;
    }
  }

  async stop(): Promise<void> {
    this.closed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopKeepAlive();
    if (this.sock && this.sock.readyState === WebSocket.OPEN) {
      await new Promise<void>((resolve) => {
        if (!this.sock) return resolve();
        this.sock.once("close", () => resolve());
        this.sock.close();
        // Safety: the close may not fire if the socket is wedged.
        sleep(300).then(resolve);
      });
    }
    this.sock = null;
    this.listenKey = null;
    this.backoffBase = 1_000;
  }
}