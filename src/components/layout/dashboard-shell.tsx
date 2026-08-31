"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { Sidebar } from "./sidebar";
import { MenuIcon, CloseIcon, PanelLeftIcon } from "@/components/icons/icons";

const DESKTOP_COLLAPSED_KEY = "ramsees:sidebar-collapsed";

export function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Restore desktop collapsed preference on mount
  useEffect(() => {
    setCollapsed(localStorage.getItem(DESKTOP_COLLAPSED_KEY) === "1");
  }, []);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (mobileOpen) {
      const original = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = original;
      };
    }
  }, [mobileOpen]);

  // Close drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Escape closes mobile drawer
  useEffect(() => {
    if (!mobileOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  // Redirect to login when unauthenticated (defense-in-depth; ProtectedRoute also guards)
  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, router]);

  function toggleCollapse() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(DESKTOP_COLLAPSED_KEY, next ? "1" : "0");
      return next;
    });
  }

  return (
    <div className="flex min-h-screen w-full">
      {/* Desktop sidebar */}
      <aside
        className={`hidden shrink-0 border-l border-line bg-surface-1/40 transition-[width] duration-300 ease-out lg:block ${
          collapsed ? "w-[68px]" : "w-64"
        }`}
      >
        <div className="sticky top-0 h-screen overflow-hidden">
          <Sidebar
            collapsed={collapsed}
            onToggleCollapse={toggleCollapse}
          />
        </div>
      </aside>

      {/* Mobile drawer */}
      <div
        className={`fixed inset-0 z-40 lg:hidden ${
          mobileOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
        aria-hidden={!mobileOpen}
      >
        {/* Overlay */}
        <div
          onClick={() => setMobileOpen(false)}
          className={`absolute inset-0 bg-black/60 transition-opacity duration-300 ${
            mobileOpen ? "opacity-100" : "opacity-0"
          }`}
        />
        {/* Drawer */}
        <div
          className={`absolute inset-y-0 right-0 flex w-72 flex-col bg-surface-1 shadow-2xl transition-transform duration-300 ease-out ${
            mobileOpen ? "translate-x-0" : "translate-x-full"
          }`}
          role="dialog"
          aria-modal="true"
          aria-label="القائمة"
        >
          <div className="flex justify-end p-2">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="rounded-panel p-2 text-muted hover:bg-surface-2 hover:text-zinc-100"
              aria-label="إغلاق القائمة"
            >
              <CloseIcon className="h-5 w-5" />
            </button>
          </div>
          <div className="min-h-0 flex-1">
            <Sidebar
              collapsed={false}
              onToggleCollapse={toggleCollapse}
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
        </div>
      </div>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-surface-1/90 px-4 py-3 backdrop-blur lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-panel p-2 text-zinc-300 hover:bg-surface-2"
            aria-label="فتح القائمة"
          >
            <MenuIcon className="h-6 w-6" />
          </button>
          <Image
            src="/favicon.jpg"
            alt="شعار RAMSEES"
            width={28}
            height={28}
            className="h-7 w-7 rounded-md object-cover"
          />
          <span className="text-sm font-bold text-zinc-50">RAMSEES</span>
        </header>

        {/* Desktop collapse toggle (floating) */}
        <div className="hidden lg:block">
          <button
            type="button"
            onClick={toggleCollapse}
            className="fixed bottom-4 left-4 z-20 hidden items-center gap-2 rounded-panel border border-line bg-surface-1 px-3 py-2 text-xs font-medium text-zinc-300 shadow-pop transition-colors hover:bg-surface-2 lg:flex"
            aria-label={collapsed ? "توسيع الشريط" : "طي الشريط"}
          >
            <PanelLeftIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <main className="flex-1 overflow-x-hidden p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
