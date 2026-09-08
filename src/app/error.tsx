"use client";

import { AppErrorCard } from "@/components/ui/app-error-card";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <AppErrorCard
      message={error.message || "تعذّر عرض التطبيق."}
      onReset={() => reset()}
      code={error.digest}
    />
  );
}