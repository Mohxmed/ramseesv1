"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { NAVIGATION } from "@/config/navigation";

/**
 * Current page title derived from the shared navigation config — drives the
 * breadcrumb in the header so it always tracks "where I am" without new props.
 */
export function HeaderPageContext() {
  const pathname = usePathname();

  const label = useMemo(
    () => NAVIGATION.find((item) => item.href === pathname)?.label ?? "لوحة التحكم",
    [pathname]
  );

  return (
    <h1 className="truncate text-sm font-semibold text-zinc-100" aria-label={`الصفحة الحالية: ${label}`}>
      {label}
    </h1>
  );
}