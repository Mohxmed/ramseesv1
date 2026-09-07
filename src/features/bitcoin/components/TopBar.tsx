"use client";

import { useNow } from "../hooks/useNow";
import { formatAgo } from "../intelligence";
import { formatPercent, formatPrice } from "../utils";
import { Badge, Status } from "@/components/ui/index";

function sessionClock(nowMs: number): string {
  const startOfUtcDay = nowMs - (nowMs % 86_400_000);
  const elapsedMs = Math.max(0, nowMs - startOfUtcDay);
  const h = Math.floor(elapsedMs / 3_600_000);
  const m = Math.floor((elapsedMs % 3_600_000) / 60_000);
  return `${h}س ${m}د`;
}

export function TopBar({
  price,
  change24h,
  live,
  updatedAt,
  loading,
  onRefresh,
}: {
  price: number | null;
  change24h: number | null;
  live: boolean | null;
  updatedAt: number | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  const now = useNow(1000);
  const up24h = change24h != null && change24h > 0;

  return (
    <section className="rounded-card border border-line bg-surface-1/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-2xs text-muted">
            BTC/USDT — مركز القيادة والتحليل الاستراتيجي (Binance)
          </p>
          <div className="mt-1 flex flex-wrap items-end gap-3">
            <span dir="ltr" className="text-3xl font-extrabold tabular-nums text-zinc-50">
              {formatPrice(price)}
            </span>
            {change24h != null && (
              <Badge tone={up24h ? "up" : "down"} ltr>
                {formatPercent(change24h)} (24س)
              </Badge>
            )}
          </div>
          <p className="mt-1 text-2xs text-muted">
            {updatedAt != null ? `آخر تحديث ${formatAgo(Math.floor((now - updatedAt) / 1000))}` : "بانتظار أول تحديث…"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-col items-end gap-1">
            <Status
              label={
                live === true
                  ? "بث مباشر (WebSocket)"
                  : live === null
                  ? "جارٍ الاتصال بالبث"
                  : "بث غير متصل — بيانات REST"
              }
              tone={live === true ? "good" : live === null ? "warn" : "down"}
              pulse={live === true}
            />
            <span className="text-2xs text-muted">
              جلسة اليوم (UTC): <span className="font-semibold text-zinc-300">{sessionClock(now)}</span>
            </span>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="rounded-md border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100 disabled:opacity-50"
          >
            {loading ? "جارٍ التحديث..." : "تحديث البيانات"}
          </button>
        </div>
      </div>
    </section>
  );
}