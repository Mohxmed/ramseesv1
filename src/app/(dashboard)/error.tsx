"use client";

import { AppErrorCard } from "@/components/ui/app-error-card";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <AppErrorCard
      message={error.message || "تعذّر عرض هذه الصفحة."}
      onReset={() => reset()}
      code={error.digest}
    />
  );
}