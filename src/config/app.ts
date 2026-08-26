export const APP_CONFIG = {
  name: "RAMSEES",
  description: "Personal Bitcoin Trading & Analysis System",
  version: "0.1.0",
  currency: "BTC" as const,
} as const;

export const NAVIGATION = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Golden Target", href: "/golden-target" },
  { label: "Settings", href: "/settings" },
] as const;
