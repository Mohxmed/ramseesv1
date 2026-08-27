export const APP_CONFIG = {
  name: "RAMSEES",
  description: "نظام شخصي لتداول وتحليل البيتكوين",
  version: "0.1.0",
  currency: "BTC" as const,
} as const;

export const NAVIGATION = [
  { label: "لوحة التحكم", href: "/dashboard" },
  { label: "الهدف الذهبي", href: "/golden-target" },
  { label: "الإعدادات", href: "/settings" },
] as const;
