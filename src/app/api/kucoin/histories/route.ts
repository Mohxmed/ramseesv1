/**
 * Same-origin proxy for the KuCoin REST `histories` fallback feed.
 *
 * Like the token endpoint, KuCoin's market data endpoints omit
 * `Access-Control-Allow-Origin` in the browser (CORS-blocked). Proxy the GET
 * here so the browser's REST fallback path works and can carry data when the
 * WebSocket hiccups.
 */
import { NextResponse } from "next/server";

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const usdt = url.searchParams.get("symbol");
  if (!usdt) {
    return NextResponse.json({ error: "symbol required" }, { status: 400 });
  }
  const symbol = usdt.replace(/-USDT$/, "-USDT");
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    let res: Response;
    try {
      res = await fetch(`https://api.kucoin.com/api/v1/market/histories?symbol=${symbol}`, {
        signal: ctrl.signal,
        next: { revalidate: 3 },
      });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      return NextResponse.json({ error: `kucoin ${res.status}` }, { status: 502 });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
