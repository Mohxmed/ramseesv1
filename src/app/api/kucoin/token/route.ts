/**
 * Same-origin proxy for the KuCoin public WebSocket token handshake.
 *
 * The browser cannot fetch KuCoin's `bullet-public` POST directly because the
 * server omits `Access-Control-Allow-Origin` (CORS-blocked). WebSocket
 * connections are NOT CORS-bound, but they need this token + endpoint first.
 * Running the handshake server-side here (same origin) sidesteps CORS entirely:
 * the browser calls /api/kucoin/token and then opens the socket itself.
 */
import { NextResponse } from "next/server";

interface KucoinEndpoint {
  data?: {
    token?: string;
    instanceServers?: { endpoint?: string }[];
  };
}

export async function GET(): Promise<Response> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    let res: Response;
    try {
      res = await fetch("https://api.kucoin.com/api/v1/bullet-public", {
        method: "POST",
        signal: ctrl.signal,
        next: { revalidate: 30 },
      });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      return NextResponse.json({ error: `kucoin ${res.status}` }, { status: 502 });
    }
    const body = (await res.json()) as KucoinEndpoint;
    const server = body?.data?.instanceServers?.[0];
    const token = body?.data?.token;
    if (!server?.endpoint || !token) {
      return NextResponse.json({ error: "no kucoin ws endpoint/token" }, { status: 502 });
    }
    return NextResponse.json({ endpoint: server.endpoint, token });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
