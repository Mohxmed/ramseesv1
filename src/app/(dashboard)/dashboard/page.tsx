"use client";

import { useAuth } from "@/features/auth/hooks/useAuth";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { PageHeader, Card, Badge } from "@/components/ui/index";
import { DashboardIcon } from "@/components/icons/icons";
import {
  useMarketMovers,
} from "@/features/dashboard/hooks/useMarketMovers";
import { MarketMoversSection } from "@/features/dashboard/components/MarketMoversSection";
import { WalletSnippet } from "@/features/portfolio/components/WalletSnippet";
import { GoldenTargetSnippet } from "@/features/golden-target/components/GoldenTargetSnippet";

export default function DashboardPage() {
  const { user } = useAuth();
  const movers = useMarketMovers();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Overview"
        icon={<DashboardIcon className="h-5 w-5 text-muted" />}
        title="لوحة التحكم"
        description="نظرة عامة على النظام والوصول السريع إلى الميزات."
        right={<Badge tone="good">نشط</Badge>}
      />

      <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-3">
        <WalletSnippet />
        <GoldenTargetSnippet />
        <Card
          title="الحساب"
          actions={<Badge tone="quiet">متصل</Badge>}
          bodyClassName="flex flex-1 flex-col justify-between gap-4"
        >
          <p className="truncate text-xs text-muted">
            مرحبًا، {user?.displayName ?? user?.email ?? "مستخدم"}
          </p>
          <div className="mt-3">
            <LogoutButton />
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <MarketMoversSection direction="up" state={movers} />
        <MarketMoversSection direction="down" state={movers} />
      </div>
    </div>
  );
}