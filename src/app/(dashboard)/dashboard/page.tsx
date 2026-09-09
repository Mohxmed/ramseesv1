"use client";

import { PageHeader } from "@/components/ui/index";
import { DashboardIcon } from "@/components/icons/icons";
import {
  useMarketMovers,
} from "@/features/dashboard/hooks/useMarketMovers";
import { MarketMoversSection } from "@/features/dashboard/components/MarketMoversSection";
import { WalletSnippet } from "@/features/portfolio/components/WalletSnippet";
import { StrategySnippet } from "@/features/strategy/components/StrategySnippet";
import { GoalsSnippet } from "@/features/goals/components/GoalsSnippet";
import { CrossMarketSection } from "@/features/market-influence/components/CrossMarketSection";

export default function DashboardPage() {
  const movers = useMarketMovers();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Overview"
        icon={<DashboardIcon className="h-5 w-5 text-muted" />}
        title="لوحة التحكم"
        description="أداء محفظتك وأهدافك الشهرية وأرقام استراتيجيتك النشطة في لمحة واحدة."
      />

      <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-3">
        <WalletSnippet />
        <GoalsSnippet />
        <StrategySnippet />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <MarketMoversSection direction="up" state={movers} />
        <MarketMoversSection direction="down" state={movers} />
      </div>

      <CrossMarketSection />
    </div>
  );
}