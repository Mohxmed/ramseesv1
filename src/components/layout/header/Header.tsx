"use client";

import { HeaderBrand } from "./HeaderBrand";
import { HeaderPageContext } from "./HeaderPageContext";
import { MarketContext } from "./MarketContext";
import { SystemStatus } from "./SystemStatus";
import { NotificationCenter } from "./NotificationCenter";
import { UserMenu } from "./UserMenu";
import { MenuIcon } from "@/components/icons/icons";
import { HeaderStrategyLink } from "./HeaderStrategyLink";
import { HeaderWalletLink } from "./HeaderWalletLink";

/**
 * Unified app header (RTL).
 *
 * Physical layout, right → left:
 *   [User Menu] [Notifications] [System Status] [Wallet] │
 *   [Market Context] │ [☰ (mobile)] [Brand] │ [Page title]
 *
 * The right cluster is composition-ready for control center use: system
 * health, notifications, the portfolio wallet and the account menu live here,
 * the brand + page context on the left. Responsive so the header never
 * crowds on small screens.
 */
export function Header({ onOpenMobileNav }: { onOpenMobileNav: () => void }) {
  return (
    <header className="sticky top-0 z-30 h-12 shrink-0 border-b border-line bg-surface-1/85 backdrop-blur">
      <div className="flex h-full items-center gap-1.5 px-2 sm:gap-2 sm:px-4">
        {/* Right cluster — user (outermost), notifications, system status, strategy, wallet */}
        <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
          <UserMenu />
          <NotificationCenter />
          <SystemStatus />
          <HeaderStrategyLink />
          <HeaderWalletLink />
        </div>

        {/* Center — live market context (hidden on small screens) */}
        <div className="mx-3 hidden min-w-0 flex-1 items-center justify-center md:flex">
          <MarketContext />
        </div>
        <div className="min-w-0 flex-1 md:hidden" aria-hidden />

        {/* Left cluster — nav button, brand, current page title */}
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={onOpenMobileNav}
            className="rounded-panel p-1.5 text-zinc-300 transition-colors hover:bg-surface-2 lg:hidden"
            aria-label="فتح القائمة"
          >
            <MenuIcon className="h-5 w-5" />
          </button>
          <HeaderBrand />
          <span className="hidden h-4 w-px bg-line sm:block" aria-hidden />
          <div className="min-w-0">
            <HeaderPageContext />
          </div>
        </div>
      </div>
    </header>
  );
}