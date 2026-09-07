const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Compact Arabic relative time ("الآن", "قبل 5 د", …). */
export function timeAgo(ts: number, now: number = Date.now()): string {
  const diff = Math.max(0, now - ts);
  if (diff < MINUTE) return "الآن";
  if (diff < HOUR) return `قبل ${Math.floor(diff / MINUTE)} د`;
  if (diff < DAY) return `قبل ${Math.floor(diff / HOUR)} س`;
  return `قبل ${Math.floor(diff / DAY)} يوم`;
}