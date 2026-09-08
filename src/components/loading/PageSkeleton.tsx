import {
  Skeleton,
  SkeletonChart,
  SkeletonList,
  SkeletonMetric,
  SkeletonTable,
  SkeletonText,
} from "@/components/ui/skeleton";

export interface PageSkeletonProps {
  title?: boolean;
  metrics?: number;
  chart?: boolean;
  tables?: boolean;
  lists?: number;
}

/**
 * Route-level loading layout (used by `loading.tsx` and initial page gates).
 * Server-safe markup; reserves near-final shapes so navigation never flashes.
 */
export function PageSkeleton({
  title = true,
  metrics = 4,
  chart = true,
  tables = false,
  lists = 0,
}: PageSkeletonProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="space-y-6"
    >
      {title && (
        <div className="space-y-2.5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-64" />
          <SkeletonText lines={2} className="w-3/4" />
        </div>
      )}

      {metrics > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: metrics }).map((_, i) => (
            <SkeletonMetric key={i} />
          ))}
        </div>
      )}

      {chart && <SkeletonChart className="h-72" />}

      {tables && <SkeletonTable rows={4} />}

      {lists > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {Array.from({ length: lists }).map((_, i) => (
            <SkeletonList key={i} items={3} />
          ))}
        </div>
      )}
    </div>
  );
}