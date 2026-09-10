export default function Loading() {
  return (
    <div className="space-y-3">
      <div className="h-20 rounded-card border border-line bg-surface-1/40" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-card border border-line bg-surface-1/40" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-card border border-line bg-surface-1/40" />
    </div>
  );
}