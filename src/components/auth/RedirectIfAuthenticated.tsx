"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { BrandSplash } from "@/components/shared/BrandSplash";

export function RedirectIfAuthenticated({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [loading, isAuthenticated, router]);

  if (loading) {
    return <BrandSplash />;
  }

  if (isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
