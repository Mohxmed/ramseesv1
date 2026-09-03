/**
 * Unified Next.js custom server.
 *
 * Serves the Next.js app AND hosts the HTX (Huobi) inflate WebSocket proxy on
 * the SAME origin/port at /htx-ws, so the browser data adapters need no extra
 * process or port.
 *
 * Why: HTX serves its public stream as GZIP-compressed binary WebSocket frames
 * which a browser has no way to inflate. This server connects upstream on the
 * client's behalf, inflates each frame with zlib, and forwards plain-text JSON
 * to the browser over /htx-ws.
 *
 * Run:
 *   dev (NODE_ENV != production): node server.mjs
 *   prod: NODE_ENV=production node server.mjs   (after `next build`)
 */

import http from "node:http";
import zlib from "node:zlib";
import next from "next";
import { WebSocketServer, WebSocket } from "ws";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);
const HTX_UPSTREAM = process.env.HTX_UPSTREAM_URL || "wss://api.huobi.pro/ws";

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const server = http.createServer((req, res) => {
  void handle(req, res);
});

// ── HTX inflate WebSocket proxy: /htx-ws ───────────────────────────

const htxWs = new WebSocketServer({ server, path: "/htx-ws" });

/**
 * One upstream HTX socket per browser client, with reconnection + re-subscribe
 * so a dropped upstream never silently stops the trade stream.
 */
function attachHtxUpstream(client) {
  let up = null;
  let closed = false;
  let backoff = 500;
  let lastSub = "";

  const open = () => {
    if (closed) return;
    up = new WebSocket(HTX_UPSTREAM);

    up.addEventListener("open", () => {
      backoff = 500;
      if (lastSub && up.readyState === WebSocket.OPEN) up.send(lastSub);
    });

    up.addEventListener("message", (ev) => {
      let json;
      try {
        const raw = ev.data;
        const buf = Buffer.isBuffer(raw)
          ? Buffer.from(raw)
          : Buffer.isArrayBuffer(raw)
            ? Buffer.from(raw)
            : Buffer.isView(raw)
              ? Buffer.from(raw.buffer, raw.byteOffset, raw.byteLength)
              : ArrayBuffer.isView(raw)
                ? Buffer.from(raw)
                : Buffer.from(typeof raw === "string" ? raw : "");
        // HTX compresses every frame with gzip; a handful of frames can arrive
        // plain-text, so fall back to UTF-8 rather than dropping them.
        try {
          json = zlib.gunzipSync(buf).toString("utf8");
        } catch {
          json = buf.toString("utf8");
        }
      } catch {
        return; // not a readable frame — ignore
      }

      let parsed;
      try {
        parsed = JSON.parse(json);
      } catch {
        return;
      }

      // HTX server ping → answer upstream; never forward to the client.
      if (parsed && typeof parsed === "object" && "ping" in parsed) {
        if (typeof parsed.ping === "number" && up?.readyState === WebSocket.OPEN) {
          try {
            up.send(JSON.stringify({ pong: parsed.ping }));
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

    up.addEventListener("close", () => {
      up = null;
      if (closed) return;
      setTimeout(open, backoff);
      backoff = Math.min(backoff * 2, 15_000);
    });

    up.addEventListener("error", () => {
      try {
        up?.close();
      } catch {
        /* ignore */
      }
    });
  };

  open();

  return {
    forward(raw) {
      try {
        const text = typeof raw === "string" ? raw : raw.toString("utf8");
        const parsed = JSON.parse(text);
        if (parsed && parsed.sub) lastSub = text;
        if (up && up.readyState === WebSocket.OPEN) up.send(text);
      } catch {
        /* non-JSON noise from the client — ignore */
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

htxWs.on("connection", (client) => {
  const upstream = attachHtxUpstream(client);
  client.on("message", (raw) => upstream.forward(raw));
  client.on("close", () => upstream.close());
  client.on("error", () => upstream.close());
});

app.prepare().then(() => {
  server.listen(port, hostname, () => {
    console.log(
      `> ${dev ? "Next.js dev" : "Next.js"} server ready on http://${hostname}:${port} (${dev ? "development" : "production"})`
    );
    console.log(`> HTX inflate proxy listening at ws://${hostname}:${port}/htx-ws`);
  });
});
