import type { ReactNode } from "react";
import { ThemeGate } from "@/components/ui";
import { CalculatorPage } from "@/features/strategy/components/CalculatorPage";

export default function RiskCalculatorRoute(): ReactNode {
  return (
    <ThemeGate>
      <CalculatorPage />
    </ThemeGate>
  );
}