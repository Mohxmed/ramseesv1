"use client";

import { PageHeader } from "@/components/ui/index";
import { DashboardIcon } from "@/components/icons/icons";
import {
  useMarketMovers,
} from "@/features/dashboard/hooks/useMarketMovers";
import { MarketMoversSection } from "@/features/dashboard/components/MarketMoversSection";
import { WalletSnippet } from "@/features/portfolio/components/WalletSnippet";
import { GoldenTargetSnippet } from "@/features/golden-target/components/GoldenTargetSnippet";
import { StrategySnippet } from "@/features/strategy/components/StrategySnippet";
import { CrossMarketSection } from "@/features/market-influence/components/CrossMarketSection";

export default function DashboardPage() {
  const movers = useMarketMovers();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Overview"
        icon={<DashboardIcon className="h-5 w-5 text-muted" />}
        title="لوحة التحكم"
        description="أداء محفظتك وهدفك الذهبي وأرقام استراتيجيتك النشطة في لمحة واحدة."
      />

      <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-3">
        <WalletSnippet />
        <GoldenTargetSnippet />
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