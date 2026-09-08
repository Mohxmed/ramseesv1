"use client";

import { useEffect, useState } from "react";
import { useOnlineStatus } from "@/features/system/useOnlineStatus";

const RESTORED_PILL_MS = 2800;

/**
 * Global, unobtrusive offline indicator:
 *  - offline → persistent pill ("OFFLINE — showing cached data").
 *  - connection restored → transient pill that auto-dismisses.
 */
export function OfflineToast() {
  const { online, restoredAt } = useOnlineStatus();
  // Cheap clock so the "restored" pill derives (no timers fighting the rule
  // about synchronous setState inside effects).
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (!online) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [online]);

  const showRestored =
    online && restoredAt != null && now !== 0 && now - restoredAt <= RESTORED_PILL_MS;

  if (!online) {
    return (
      <div
        role="status"
        aria-live="assertive"
        className="fixed bottom-5 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-full border border-warn/40 bg-surface-1 px-4 py-2 text-2xs font-semibold text-warn-fg shadow-pop"
      >
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-warn" />
        غير متصل — عرض بيانات محفوظة، يعاد الاتصال تلقائيًا
      </div>
    );
  }

  if (showRestored) {
    return (
      <div
        role="status"
        aria-live="assertive"
        className="fixed bottom-5 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-full border border-up/40 bg-surface-1 px-4 py-2 text-2xs font-semibold text-up-fg shadow-pop"
      >
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-up" />
        تمت استعادة الاتصال — مزامنة البيانات…
      </div>
    );
  }

  return null;
}