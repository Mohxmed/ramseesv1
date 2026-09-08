import { num } from "./design-tokens";

/** Compact error card used for per-module / per-panel failures. */
export function ErrorBox({
  message = "تعذّر تحميل البيانات.",
  onRetry,
  code,
  className,
}: {
  message?: string;
  onRetry?: () => void;
  code?: string;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={`rounded-card border border-down/30 bg-down/5 p-5 text-center ${
        className ?? ""
      }`}
    >
      <p className="text-sm font-semibold text-zinc-200">{message}</p>
      {onRetry && (
        <RetryButton onRetry={onRetry} className="mt-3" />
      )}
      {code && (
        <p className={`${num} mt-3 text-3xs text-zinc-600`} dir="ltr">
          {code}
        </p>
      )}
    </div>
  );
}

/** Secondary retry action with an in-flight ("Retrying…") state. */
export function RetryButton({
  onRetry,
  label = "إعادة المحاولة",
  inFlightLabel = "جارٍ المحاولة…",
  inFlight = false,
  className,
}: {
  onRetry: () => void;
  label?: string;
  inFlightLabel?: string;
  inFlight?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onRetry}
      disabled={inFlight}
      className={`rounded-md border border-down/40 bg-down/10 px-4 py-1.5 text-xs font-bold text-down-fg transition-colors hover:bg-down/20 disabled:opacity-50 ${
        className ?? ""
      }`}
    >
      {inFlight ? inFlightLabel : label}
    </button>
  );
}

/** "Updated X ago / cached / stale" honesty chip for non-live data. */
export function FreshnessChip({
  updatedAtMs,
  nowMs,
  label = "آخر تحديث",
}: {
  updatedAtMs: number | null;
  nowMs: number;
  label?: string;
}) {
  if (updatedAtMs == null) return null;
  const ageMs = Math.max(0, nowMs - updatedAtMs);
  const text =
    ageMs < 1_000
      ? "الآن"
      : ageMs < 60_000
        ? `قبل ${Math.max(1, Math.round(ageMs / 1000))} ث`
        : `قبل ${Math.max(1, Math.round(ageMs / 60_000))} د`;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-chip border border-line/70 bg-surface-2/40 px-2 py-0.5 text-2xs font-medium text-muted">
      <span className="h-1.5 w-1.5 rounded-full bg-warn" />
      {label} · {text}
    </span>
  );
}