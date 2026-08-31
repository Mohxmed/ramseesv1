"use client";

import { MultiAssetCorrelationPanel } from "./components/MultiAssetCorrelationPanel";
import { useMultiAssetCorrelation } from "./hooks/useMultiAssetCorrelation";
import { PageHeader } from "@/components/ui/index";
import { LinkIcon } from "@/components/icons/icons";

/**
 * Multi-Asset Lead-Lag Correlation page — compares BTC's lead-lag against a
 * basket of high-liquidity altcoins (SOL / ETH / AVAX / NEAR / DOGE) using a
 * live multi-stream aggTrade WebSocket. Shows which asset is drifting from BTC
 * (the exploitable lag) via correlation, beta and spread.
 */
export function MultiAssetPage() {
  const snap = useMultiAssetCorrelation();
  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Lead-Lag Engine"
        icon={<LinkIcon className="h-5 w-5 text-muted" />}
        title="ارتباط التأخر متعدد الأصول"
        description="بيانات حية من Binance: ارتباط كل عملة مقابل BTC، بيتا، وتأخر السعر (منصة Web Worker — تحديث 20Hz)."
      />
      <MultiAssetCorrelationPanel snap={snap} />
    </div>
  );
}