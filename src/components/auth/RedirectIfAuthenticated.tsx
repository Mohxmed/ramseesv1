"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import { useAuth } from "@/features/auth/hooks/useAuth";
import {
  useBootSession,
  type UseBootSessionInput,
} from "@/features/boot/useBootSession";
import {
  subscribeBootMode,
  getBootModeSnapshot,
  getBootModeServerSnapshot,
} from "@/features/boot/restore";
import { useBootDataWarmup } from "@/features/boot/warmup";
import { BootScreen } from "@/components/boot/BootScreen";
import { BootFailure } from "@/components/boot/BootFailure";

/** Prevents already-authenticated users from seeing login/register. */
export function RedirectIfAuthenticated({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, user, status, retry } = useAuth();
  const router = useRouter();
  const mode = useSyncExternalStore(
    subscribeBootMode,
    getBootModeSnapshot,
    getBootModeServerSnapshot
  );

  const sessionStatus: UseBootSessionInput["sessionStatus"] =
    status === "unknown"
      ? "unknown"
      : status === "error"
        ? "error"
        : "resolved";

  // Wait for the account's Firestore data only when there is an authenticated
  // user; unauthenticated boots skip the data gate as soon as auth resolves.
  const warmupReady = useBootDataWarmup(user?.uid ?? null);
  const dataReady = user != null ? warmupReady === true : status !== "unknown";

  const { phase, tasks, errorId, restart } = useBootSession({
    mode,
    sessionStatus,
    dataReady,
  });

  useEffect(() => {
    if (status !== "unknown" && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [status, isAuthenticated, router]);

  if (phase === "ready" && !isAuthenticated) {
    return <>{children}</>;
  }

  if (phase === "ready") {
    // Authenticated — redirect to dashboard is already in flight.
    return null;
  }

  if (phase === "error") {
    return (
      <BootFailure
        errorId={errorId}
        onRetry={() => {
          retry();
          restart();
        }}
      />
    );
  }

  return <BootScreen tasks={tasks} mode={mode} phase={phase} />;
}