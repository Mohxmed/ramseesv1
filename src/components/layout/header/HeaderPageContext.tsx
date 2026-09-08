"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { NAVIGATION } from "@/config/navigation";

/**
 * Current page title derived from the shared navigation config — drives the
 * breadcrumb in the header so it always tracks "where I am" without new props.
 *
 * Sub-routes of a section (e.g. `/strategy/numbers`) fall back to the longest
 * matching top-level section so the breadcrumb stays truthful without adding
 * every nested route to the sidebar.
 */
export function HeaderPageContext() {
  const pathname = usePathname();

  const label = useMemo(() => {
    const exact = NAVIGATION.find((item) => item.href === pathname);
    if (exact) return exact.label;
    const section = [...NAVIGATION]
      .sort((a, b) => b.href.length - a.href.length)
      .find((item) => pathname.startsWith(`${item.href}/`));
    return section?.label ?? "لوحة التحكم";
  }, [pathname]);

  return (
    <h1 className="truncate text-sm font-semibold text-zinc-100" aria-label={`الصفحة الحالية: ${label}`}>
      {label}
    </h1>
  );
}