import type { ReactNode } from "react";
import { StrategyNavigation } from "@/features/strategy/components/StrategyNavigation";

export default function StrategyLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <StrategyNavigation />
      {children}
    </div>
  );
}