const UNAVAILABLE = "غير متاح";

export function formatPrice(value: number | null | undefined, digits = 2): string {
  if (value == null || !isFinite(value)) return UNAVAILABLE;
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
  return `$${formatted}`;
}

export function formatCompact(value: number | null | undefined): string {
  if (value == null || !isFinite(value)) return UNAVAILABLE;
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatUsd(value: number | null | undefined): string {
  if (value == null || !isFinite(value)) return UNAVAILABLE;
  return `$${formatCompact(value)}`;
}

export function formatPercent(
  value: number | null | undefined,
  digits = 2
): string {
  if (value == null || !isFinite(value)) return UNAVAILABLE;
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

export function formatSigned(
  value: number | null | undefined,
  digits = 2
): string {
  if (value == null || !isFinite(value)) return UNAVAILABLE;
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}`;
}

export function formatBtc(value: number | null | undefined): string {
  if (value == null || !isFinite(value)) return UNAVAILABLE;
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value);
}

export function isUp(value: number | null | undefined): boolean {
  return value != null && value > 0;
}

export function timeLabel(ts: number | null | undefined, locale = "ar"): string {
  if (!ts) return UNAVAILABLE;
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(ts));
}
