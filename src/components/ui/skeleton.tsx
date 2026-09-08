/**
 * Skeleton primitives — near-final shapes that reserve exact space so layouts
 * never shift while data loads. Use these instead of spinners every place a
 * dashboard/main page waits on data. All blocks are `motion-reduce` safe.
 */

function cx(
  ...classes: (string | undefined | false | null)[]
): string {
  return classes.filter(Boolean).join(" ");
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cx(
        "animate-pulse rounded-panel bg-surface-2/50 motion-reduce:animate-none",
        className
      )}
    />
  );
}

export function SkeletonText({
  lines = 1,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div aria-hidden className={cx("space-y-1.5", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cx(
            "h-3",
            i === lines - 1 && lines > 1 ? "w-2/3" : "w-full"
          )}
        />
      ))}
    </div>
  );
}

export function SkeletonNumber({ className }: { className?: string }) {
  return <Skeleton className={cx("h-8 w-28", className)} />;
}

export function SkeletonAvatar({ className }: { className?: string }) {
  return <Skeleton className={cx("h-10 w-10 rounded-full", className)} />;
}

export function SkeletonMetric({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cx(
        "rounded-card border border-line/60 bg-surface-1/40 p-4",
        className
      )}
    >
      <div className="space-y-3">
        <Skeleton className="h-2.5 w-1/3" />
        <Skeleton className="h-6 w-1/2" />
      </div>
    </div>
  );
}

export function SkeletonCard({
  className,
  rows = 3,
}: {
  className?: string;
  rows?: number;
}) {
  return (
    <div
      aria-hidden
      className={cx(
        "rounded-card border border-line/60 bg-surface-1/40 p-5",
        className
      )}
    >
      <div className="mb-4 flex items-center justify-between gap-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-14" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-full" />
        ))}
        <Skeleton className="h-3 w-2/3" />
      </div>
    </div>
  );
}

const CHART_BAR_COUNTS = [35, 55, 42, 70, 48, 62, 38, 74, 52, 66, 44, 58];

export function SkeletonChart({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cx(
        "relative overflow-hidden rounded-card border border-line/60 bg-surface-1/40 p-4",
        className
      )}
    >
      <div className="absolute inset-4 flex items-end gap-1.5">
        {CHART_BAR_COUNTS.map((h, i) => (
          <div
            key={i}
            className="w-full animate-pulse rounded-sm bg-surface-2/60 motion-reduce:animate-none"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </div>
  );
}

export function SkeletonTable({
  rows = 5,
  columns = 4,
  className,
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  const rowCells = () =>
    Array.from({ length: columns }).map((_, c) => (
      <Skeleton key={c} className={c === 0 ? "h-3 w-1/4" : "h-3 flex-1"} />
    ));
  return (
    <div
      aria-hidden
      className={cx(
        "rounded-card border border-line/60 bg-surface-1/40 p-4",
        className
      )}
    >
      <div className="flex gap-4 pb-3">{rowCells()}</div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 border-t border-line/50 py-2.5">
          {rowCells()}
        </div>
      ))}
    </div>
  );
}

export function SkeletonList({
  items = 4,
  className,
}: {
  items?: number;
  className?: string;
}) {
  return (
    <div aria-hidden className={cx("space-y-2", className)}>
      {Array.from({ length: items }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between gap-4 rounded-panel border border-line/50 bg-surface-1/40 p-3"
        >
          <div className="flex flex-1 items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-2/4" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          </div>
          <Skeleton className="h-6 w-16" />
        </div>
      ))}
    </div>
  );
}