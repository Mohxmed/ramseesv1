import type { ComponentType } from "react";
import {
  DashboardIcon,
  TargetIcon,
  SettingsIcon,
  BitcoinIcon,
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
    label: "الهدف الذهبي",
    href: "/golden-target",
    icon: TargetIcon,
  },
  {
    label: "مركز قيادة بيتكوين",
    href: "/bitcoin",
    icon: BitcoinIcon,
  },
  {
    label: "الإعدادات",
    href: "/settings",
    icon: SettingsIcon,
  },
];
