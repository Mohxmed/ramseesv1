import type { ComponentType } from "react";
import {
  DashboardIcon,
  SettingsIcon,
  BitcoinIcon,
  DecisionIcon,
  StrategyIcon,
  ScalpIcon,
  MarketIcon,
  LinkIcon,
  type IconProps,
} from "@/components/icons/icons";

export type NavItem = {
  label: string;
  href: string;
  icon: ComponentType<IconProps>;
};

export const NAVIGATION: NavItem[] = [
  {
    label: "لوحة التحكم",
    href: "/dashboard",
    icon: DashboardIcon,
  },
  {
    label: "مركز تحليل بيتكوين",
    href: "/bitcoin",
    icon: BitcoinIcon,
  },
  {
    label: "المضاربة الفورية",
    href: "/scalping",
    icon: ScalpIcon,
  },
  {
    label: "الحالة العامة للسوق",
    href: "/market",
    icon: MarketIcon,
  },
  {
    label: "ارتباط التأخر المتعدد",
    href: "/multi-asset",
    icon: LinkIcon,
  },
  {
    label: "مركز القرارات",
    href: "/decision-center",
    icon: DecisionIcon,
  },
  {
    label: "الاستراتيجيات",
    href: "/strategies",
    icon: StrategyIcon,
  },
  {
    label: "الإعدادات",
    href: "/settings",
    icon: SettingsIcon,
  },
];
