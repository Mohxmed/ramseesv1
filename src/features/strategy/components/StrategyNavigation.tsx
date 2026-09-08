"use client";

import { usePathname, useRouter } from "next/navigation";
import { Tabs } from "@/components/ui";
import {
  NetworkIcon,
  LayersIcon,
  CalculatorIcon,
} from "@/components/icons/icons";

const NAV_TABS = [
  {
    value: "/strategy",
    label: "المركز",
    icon: <NetworkIcon className="h-4 w-4" />,
  },
  {
    value: "/strategy/numbers",
    label: "أرقام الاستراتيجية",
    icon: <LayersIcon className="h-4 w-4" />,
  },
  {
    value: "/strategy/risk-calculator",
    label: "حاسبة المخاطر",
    icon: <CalculatorIcon className="h-4 w-4" />,
  },
];

/**
 * Secondary navigation strip shared by all three Strategy pages so the user
 * can jump between the center, Strategy Numbers and the risk calculator.
 */
export function StrategyNavigation() {
  const pathname = usePathname();
  const router = useRouter();

  const value = NAV_TABS.some((t) => t.value === pathname)
    ? pathname
    : "/strategy";

  return (
    <div className="mb-6 flex items-center justify-between gap-3 rounded-panel border border-line bg-surface-1/50 px-3 py-1.5">
      <Tabs
        value={value}
        onChange={(v) => router.push(v)}
        items={NAV_TABS}
        variant="scrollable"
        slim
      />
    </div>
  );
}