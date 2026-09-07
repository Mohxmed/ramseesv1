"use client";

import { useState } from "react";
import {
  useSystemStatus,
  type SystemLiveState,
} from "@/features/system/useSystemStatus";
import { timeLabel } from "@/features/bitcoin/utils";
import { Dot, Popover, type Tone } from "@/components/ui";
import { num } from "@/components/ui/design-tokens";
import { ClockIcon, WifiIcon } from "@/components/icons/icons";

const STATE_META: Record<SystemLiveState, { tone: Tone; label: string }> = {
  live: { tone: "good", label: "متصل (LIVE)" },
  degraded: { tone: "warn", label: "جزئي (DEGRADED)" },
  offline: { tone: "down", label: "غير متصل" },
  connecting: { tone: "quiet", label: "جارٍ الاتصال" },
};

/** Compact connection status pill; click opens source diagnostics. */
export function SystemStatus() {
  const status = useSystemStatus();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  const meta = STATE_META[status.state];
  const latency =
    status.latencyMs != null ? `${Math.round(status.latencyMs)}ms` : "—";

  return (
    <>
      <button
        type="button"
        onClick={(e) => setAnchorEl(e.currentTarget)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="حالة النظام"
        className="flex h-8 items-center gap-1.5 rounded-panel border border-line/80 bg-surface-2/30 px-2 text-2xs font-semibold text-zinc-300 transition-colors hover:bg-surface-2"
      >
        <Dot tone={meta.tone} pulse={status.state === "live"} />
        <span className="hidden lg:inline">{meta.label}</span>
        <span className={`${num} hidden text-muted xl:inline`}>
          · {status.connectedSources}/{status.totalSources} · {latency}
        </span>
      </button>

      <Popover
        open={open}
        onClose={() => setAnchorEl(null)}
        anchorEl={anchorEl}
        width={320}
      >
        <div className="space-y-0">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-bold text-zinc-100">حالة النظام</h3>
            <span className="inline-flex items-center gap-1.5 text-2xs font-semibold text-zinc-300">
              <Dot tone={meta.tone} pulse={status.state === "live"} />
              {meta.label}
            </span>
          </div>

          <div className="space-y-0.5">
            {status.sources.map((s) => (
              <div
                key={s.key}
                className="flex items-center justify-between gap-2 py-1 text-2xs"
              >
                <span className="flex min-w-0 items-center gap-2 text-zinc-300">
                  <Dot tone={s.connected ? "good" : "down"} />
                  <span className="truncate">{s.label}</span>
                </span>
                <span className={`${num} text-muted`}>
                  {s.latencyMs != null ? `${Math.round(s.latencyMs)}ms` : s.connected ? "متصل" : "غير متصل"}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-line/70 pt-2 text-2xs">
            <span className="flex items-center gap-1.5 text-muted">
              <ClockIcon className="h-3.5 w-3.5" />
              آخر تحديث
            </span>
            <span className={`${num} text-zinc-200`} dir="ltr">
              {status.lastUpdate ? timeLabel(status.lastUpdate) : "—"}
            </span>
          </div>

          {status.stale && (
            <p className="mt-2 rounded-panel bg-warn/10 px-2 py-1.5 text-2xs font-medium text-warn-fg">
              بعض مصادر البيانات متأخرة (STALE) — جارٍ استعادة الاتصال.
            </p>
          )}

          <p className="mt-2 flex items-center gap-1.5 text-3xs text-muted">
            <WifiIcon className="h-3 w-3" />
            المصادر تُشتق من خط بيانات السوق المشترك — لا اتصالات إضافية.
          </p>
        </div>
      </Popover>
    </>
  );
}