"use client";

import { useAuth } from "@/features/auth/hooks/useAuth";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { PageHeader } from "@/components/ui/index";
import { DashboardIcon, UserIcon } from "@/components/icons/icons";
import {
  useMarketMovers,
} from "@/features/dashboard/hooks/useMarketMovers";
import { MarketMoversSection } from "@/features/dashboard/components/MarketMoversSection";
import { WalletSnippet } from "@/features/portfolio/components/WalletSnippet";
import { GoldenTargetSnippet } from "@/features/golden-target/components/GoldenTargetSnippet";

const cardCls =
  "flex flex-col rounded-card border border-line bg-surface-1/40 p-5 transition-colors hover:border-zinc-600 hover:bg-surface-1/70";

export default function DashboardPage() {
  const { user } = useAuth();
  const movers = useMarketMovers();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Overview"
        icon={<DashboardIcon className="h-5 w-5 text-muted" />}
        title="لوحة التحكم"
        description="أداء محفظتك وهدفك الذهبي وحالة حسابك في لمحة واحدة."
      />

      <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-3">
        <WalletSnippet />
        <GoldenTargetSnippet />

        <div className={cardCls}>
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-panel bg-surface-2/40 text-muted ring-1 ring-line">
              <UserIcon className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-zinc-100">الحساب</h3>
              <p className="text-2xs text-muted">حسابك على المنصة</p>
            </div>
          </div>

          <div className="mt-6 flex flex-1 flex-col justify-between">
            <div>
              <p className="truncate text-xl font-bold text-zinc-100">
                {user?.displayName ?? user?.email ?? "مستخدم"}
              </p>
              {user?.email ? (
                <p className="mt-1 truncate text-2xs text-muted">{user.email}</p>
              ) : null}
            </div>
            <div className="mt-5">
              <LogoutButton />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <MarketMoversSection direction="up" state={movers} />
        <MarketMoversSection direction="down" state={movers} />
      </div>
    </div>
  );
}