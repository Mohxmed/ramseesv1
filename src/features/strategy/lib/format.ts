/** Display number formatting helpers (western digits, mono-numeric LTR). */

const usd0 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function formatMoney(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return "—";
  return decimals === 0 ? usd0.format(value) : `$${numberFixed(value, decimals)}`;
}

function numberFixed(value: number, decimals: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatNumber(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return "—";
  return numberFixed(value, decimals);
}

export function formatPercent(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return "—";
  return `${numberFixed(value, decimals)}%`;
}

export function formatPrice(value: number, decimals = 2): string {
  return formatNumber(value, decimals);
}

export function formatQty(value: number, decimals = 8): string {
  return formatNumber(value, decimals);
}

export function formatRR(rr: number): string {
  if (!Number.isFinite(rr)) return "—";
  return `1:${numberFixed(rr, 2)}`;
}

export function formatDistance(value: number, withSign = true): string {
  if (!Number.isFinite(value)) return "—";
  return `${withSign ? "+" : ""}${numberFixed(value, 2)}%`;
}