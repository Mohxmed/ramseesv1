/**
 * Base WebSocket Exchange Adapter
 *
 * Shared WebSocket lifecycle management following aggr.trade patterns.
 * Concrete adapters extend this and implement normalizeTrade/normalizeLiquidation.
 */

import type { ExchangeAdapter, ExchangeStatus, NormalizedTrade } from "../types";

export abstract class BaseExchangeAdapter implements ExchangeAdapter {
  abstract readonly id: string;
  abstract readonly label: string;
  abstract readonly market: "spot" | "perpetual" | "futures";

  protected ws: WebSocket | null = null;
  protected status: ExchangeStatus = "disconnected";
  protected latency = 0;
  protected reconnectCount = 0;
  protected subscribedSymbols = new Set<string>();
  protected pingInterval: ReturnType<typeof setInterval> | null = null;
  protected reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  protected lastPong = 0;

  /** Ingest callback — set by the engine to feed trades into the flow. */
  onTrade: ((trade: NormalizedTrade) => void) | null = null;

  // Subclass hooks
  protected abstract getWsUrl(): string;
  protected abstract getSubscribeMsg(symbol: string): unknown;
  protected abstract getUnsubscribeMsg(symbol: string): unknown;
  protected abstract getPingMsg(): unknown | null;
  protected abstract getPingIntervalMs(): number;
  protected abstract handleMessage(data: unknown): void;

  abstract normalizeTrade(data: unknown): NormalizedTrade[];
  abstract normalizeLiquidation(data: unknown): NormalizedTrade[];

  // ── Lifecycle ──────────────────────────────────────────────────────

  connect(): void {
    if (this.ws) return;
    this.status = "connecting";
    this.createWs();
  }

  disconnect(): void {
    this.status = "disconnected";
    this.clearTimers();
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.close();
      this.ws = null;
    }
  }

  subscribe(symbol: string): void {
    this.subscribedSymbols.add(symbol);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send(this.getSubscribeMsg(symbol));
    }
  }

  unsubscribe(symbol: string): void {
    this.subscribedSymbols.delete(symbol);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send(this.getUnsubscribeMsg(symbol));
    }
  }

  getStatus(): ExchangeStatus {
    return this.status;
  }

  getLatency(): number {
    return this.latency;
  }

  // ── WebSocket internals ────────────────────────────────────────────

  protected createWs(): void {
    const url = this.getWsUrl();
    const ws = new WebSocket(url);

    ws.onopen = () => {
      this.status = "connected";
      this.lastPong = Date.now();
      // Subscribe pending symbols
      for (const symbol of this.subscribedSymbols) {
        this.send(this.getSubscribeMsg(symbol));
      }
      // Start ping
      this.startPing();
    };

    ws.onmessage = (event) => {
      this.lastPong = Date.now();
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        this.handleMessage(data);
      } catch {
        // Binary or unparseable — ignore
      }
    };

    ws.onerror = () => {
      this.status = "error";
    };

    ws.onclose = () => {
      this.status = "disconnected";
      this.stopPing();
      this.ws = null;
      this.scheduleReconnect();
    };

    this.ws = ws;
  }

  protected send(msg: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  protected startPing(): void {
    this.stopPing();
    const interval = this.getPingIntervalMs();
    if (interval > 0) {
      this.pingInterval = setInterval(() => {
        const msg = this.getPingMsg();
        if (msg) this.send(msg);
        // Timeout detection
        if (Date.now() - this.lastPong > interval * 3) {
          this.ws?.close();
        }
      }, interval);
    }
  }

  protected stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  protected scheduleReconnect(): void {
    this.reconnectCount++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectCount), 30_000);
    this.status = "reconnecting";
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.createWs();
    }, delay);
  }

  protected clearTimers(): void {
    this.stopPing();
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  /** Emit a trade through the ingest callback. */
  protected emitTrade(trade: NormalizedTrade): void {
    this.onTrade?.(trade);
  }
}
