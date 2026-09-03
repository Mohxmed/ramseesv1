/**
 * HTX (Huobi) inflate WebSocket proxy — Vercel serverless route.
 *
 * HTX serves its public stream (wss://api.huobi.pro/ws) as GZIP-compressed
 * binary frames that a browser cannot inflate. Vercel does NOT run our custom
 * `server.mjs`, so there is no `/htx-ws` endpoint there. This route uses
 * Vercel's WebSocket support (experimental_upgradeWebSocket on Node.js
 * Functions / Fluid compute) to:
 *   1. connect upstream to HTX on the client's behalf,
 *   2. inflate each gzip frame with zlib,
 *   3. forward plain-text JSON to the browser,
 *   4. answer HTX server pings upstream and re-subscribe on reconnect.
 *
 * The browser opens its socket to the same-origin /api/htx — no extra port
 * needed, and it works transparently on Vercel.
 *
 * Note: only works on the Vercel runtime (which injects the upgrade handler).
 * For self-hosted (node server.mjs) the adapter should point at /htx-ws instead.
 */
import { gunzipSync } from "node:zlib";
import WebSocket from "ws";
import { experimental_upgradeWebSocket } from "@vercel/functions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HTX_UPSTREAM = process.env.HTX_UPSTREAM_URL || "wss://api.huobi.pro/ws";

/** Convert an inbound ws RawData into a Buffer (handles Buffer/text/ArrayBuffer/view/array). */
function toBuffer(data: unknown): Buffer {
  if (Buffer.isBuffer(data)) return data;
  if (typeof data === "string") return Buffer.from(data);
  if (Array.isArray(data)) return Buffer.concat(data.map((d) => toBuffer(d)));
  if (data instanceof Uint8Array) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  }
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  return Buffer.from(String(data));
}

/** One upstream HTX socket per accepted client, with reconnect + re-subscribe. */
function attachHtxUpstream(client: WebSocket) {
  let up: WebSocket | null = null;
  let closed = false;
  let backoff = 500;
  let lastSub = "";

  const open = () => {
    if (closed || up) return;
    let next: WebSocket;
    try {
      next = new WebSocket(HTX_UPSTREAM);
    } catch {
      scheduleReconnect();
      return;
    }
    up = next;

    next.on("open", () => {
      backoff = 500;
      if (lastSub) next.send(lastSub);
    });

    next.on("message", (raw) => {
      let json: string;
      try {
        const buf = toBuffer(raw);
        try {
          json = gunzipSync(buf).toString("utf8");
        } catch {
          json = buf.toString("utf8");
        }
      } catch {
        return;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(json);
      } catch {
        return;
      }
      // Answer HTX server pings upstream; never forward them to the client.
      if (parsed && typeof parsed === "object" && "ping" in (parsed as Record<string, unknown>)) {
        const ping = Number((parsed as { ping?: unknown }).ping);
        if (Number.isFinite(ping) && next.readyState === WebSocket.OPEN) {
          try {
            next.send(JSON.stringify({ pong: ping }));
          } catch {
            /* ignore */
          }
        }
        return;
      }
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(json);
        } catch {
          /* client gone */
        }
      }
    });

    next.on("close", () => {
      up = null;
      scheduleReconnect();
    });

    next.on("error", () => {
      try {
        next.close();
      } catch {
        /* ignore */
      }
    });
  };

  const scheduleReconnect = () => {
    if (closed) return;
    setTimeout(open, backoff);
    backoff = Math.min(backoff * 2, 15_000);
  };

  open();

  return {
    forward(raw: WebSocket.RawData) {
      try {
        const text = toBuffer(raw).toString("utf8");
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed === "object" && "sub" in (parsed as Record<string, unknown>)) {
          lastSub = text;
        }
        if (up && up.readyState === WebSocket.OPEN) up.send(text);
      } catch {
        /* non-JSON noise from client — ignore */
      }
    },
    close() {
      closed = true;
      try {
        up?.close();
      } catch {
        /* ignore */
      }
    },
  };
}

export async function GET(): Promise<Response> {
  return experimental_upgradeWebSocket((client) => {
    const upstream = attachHtxUpstream(client);
    client.on("message", (raw) => upstream.forward(raw));
    client.on("close", () => upstream.close());
    client.on("error", () => upstream.close());
  });
}
