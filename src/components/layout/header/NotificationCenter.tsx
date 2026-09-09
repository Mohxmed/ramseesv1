"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useNotifications } from "@/features/notifications/NotificationsProvider";
import { timeAgo } from "@/features/notifications/format";
import type { NotificationSeverity } from "@/features/notifications/types";
import { Popover, Dot, type Tone } from "@/components/ui";
import { BellIcon } from "@/components/icons/icons";

const SEVERITY_TONE: Record<NotificationSeverity, Tone> = {
  info: "neutral",
  success: "good",
  warn: "warn",
  error: "down",
};

/** Bell + unread badge; click opens the notifications popover. */
export function NotificationCenter() {
  const { items, loading, unreadCount, markRead, markAllRead } =
    useNotifications();
  const router = useRouter();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  function handleOpen(e: React.MouseEvent<HTMLButtonElement>) {
    setAnchorEl(e.currentTarget);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`الإشعارات${unreadCount ? ` — ${unreadCount} غير مقروءة` : ""}`}
        className="relative flex h-8 w-8 items-center justify-center rounded-panel text-zinc-300 transition-colors hover:bg-surface-2"
      >
        <BellIcon className="h-[18px] w-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-down px-1 text-[9px] font-bold leading-none text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      <Popover
        open={open}
        onClose={() => setAnchorEl(null)}
        anchorEl={anchorEl}
        width={340}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-zinc-100">الإشعارات</h3>
          {items.length > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="rounded-panel px-1.5 py-0.5 text-2xs font-semibold text-gold-fg transition-colors hover:bg-surface-2"
            >
              تحديد الكل كمقروء
            </button>
          )}
        </div>

        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-2xs text-muted">
              جارٍ تحميل الإشعارات...
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <BellIcon className="h-6 w-6 text-muted/60" />
              <p className="text-2xs text-muted">لا توجد إشعارات</p>
            </div>
          ) : (
            <ul className="-mx-2 space-y-0.5">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => {
                      markRead(n.id);
                      if (n.actionUrl) router.push(n.actionUrl);
                    }}
                    className={`flex w-full items-start gap-2.5 rounded-panel px-2 py-2 text-right transition-colors hover:bg-surface-2/60 ${
                      n.read ? "opacity-70" : "bg-surface-2/30"
                    }`}
                  >
                    <span className="mt-1 shrink-0">
                      <Dot tone={SEVERITY_TONE[n.severity]} pulse={!n.read} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span
                          className={`truncate text-xs ${
                            n.read ? "font-medium text-zinc-300" : "font-bold text-zinc-100"
                          }`}
                        >
                          {n.title}
                        </span>
                        <span className="shrink-0 text-3xs text-muted">
                          {timeAgo(n.timestamp)}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-2xs leading-4 text-muted">
                        {n.message}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Popover>
    </>
  );
}