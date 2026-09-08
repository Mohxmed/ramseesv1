import type { ReactNode } from "react";
import { ThemeGate } from "@/components/ui";
import { NumbersPage } from "@/features/strategy/components/NumbersPage";

export default function StrategyNumbersRoute(): ReactNode {
  return (
    <ThemeGate>
      <NumbersPage />
    </ThemeGate>
  );
}