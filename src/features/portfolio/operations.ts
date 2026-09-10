import type {
  ImportedAccountDetailDto,
  ImportedOpRow,
  OpCategory,
  OpFilter,
} from "./types";

/**
 * Operations feed — the imported wallet's auto-recorded operations. Every row
 * is bucketed into one of the four categories the UI filters by (أرباح /
 * خسائر / ضرائب / تمويل) plus a catch-all, and carries a signed `pnl` figure:
 * trades use the exchange-reported realized PnL, exchange income rows (funding,
 * tax, commissions) use the signed income preserved by the mapper.
 */

const TX_LABELS: Record<string, string> = {
  DEPOSIT: "إيداع",
  WITHDRAWAL: "سحب",
  FEE: "رسوم",
  FUNDING: "تمويل",
  TRADE: "صفقة",
  TRANSFER: "تحويل",
  ADJUSTMENT: "تعديل",
};

/** REALIZED_PNL income rows are realized PnL events, not plain commissions. */
const INCOME_LABELS: Record<string, string> = {
  REALIZED_PNL: "صافي الربح المكتمل",
  COMMISSION: "عمولة التداول",
  FUNDING_FEE: "رسوم التمويل",
  TAX: "ضريبة",
  TAX_PNL: "ضريبة الأرباح",
  TAX_COMMISSION: "ضريبة العمولات",
  INSURANCE_CLEAR: "تسوية صندوق التأمين",
  CONTRACT_REBATE: "خصم العقود",
  COMMISSION_REBATE: "استرداد العمولة",
  WELCOME_BONUS: "مكافأة ترحيبية",
};

export const OP_FILTERS: { key: OpFilter; label: string; tone: "good" | "down" | "gold" | "neutral" | "up" }[] = [
  { key: "all", label: "الكل", tone: "neutral" },
  { key: "profit", label: "الأرباح", tone: "good" },
  { key: "loss", label: "الخسائر", tone: "down" },
  { key: "tax", label: "الضرائب", tone: "gold" },
  { key: "funding", label: "التمويل", tone: "up" },
];

/** Bucket by nature first (funding / tax), then by the PnL sign. */
export function bucketOf(
  type: string,
  incomeType: string | null,
  pnl: number | null
): OpCategory {
  if (type === "FUNDING" || incomeType === "FUNDING_FEE") return "funding";
  if (incomeType != null && /TAX/i.test(incomeType)) return "tax";
  if (pnl == null) return "other";
  if (pnl > 0) return "profit";
  if (pnl < 0) return "loss";
  return "other";
}

export function buildOps(detail: ImportedAccountDetailDto | null): ImportedOpRow[] {
  if (!detail) return [];
  const rows: ImportedOpRow[] = [
    ...detail.transactions.map((t) => {
      const pnl = t.income ?? null;
      const incomeType = t.incomeType ?? null;
      const incomeLabel = incomeType != null ? INCOME_LABELS[incomeType] : undefined;
      return {
        id: `tx:${t.id}`,
        kind: "transaction" as const,
        typeLabel: incomeLabel ?? TX_LABELS[t.type] ?? t.type,
        symbol: null,
        side: null,
        amount: t.amount,
        asset: t.asset || null,
        usdValue: t.usdValue || null,
        fee: t.fee,
        income: pnl,
        realizedPnlUsd: null,
        status: t.status ?? null,
        timestamp: t.timestamp,
        pnl,
        category: bucketOf(t.type, incomeType, pnl),
      };
    }),
    ...detail.trades.map((tr) => {
      const pnl = tr.realizedPnlUsd ?? null;
      return {
        id: `tr:${tr.id}`,
        kind: "trade" as const,
        typeLabel:
          tr.side === "SELL" ? "صفقة بيع" : tr.side === "BUY" ? "صفقة شراء" : "صفقة",
        symbol: tr.symbol || null,
        side: tr.side,
        amount: tr.quantity,
        asset: null,
        usdValue: tr.quoteAmount || null,
        fee: tr.fee,
        income: null,
        realizedPnlUsd: pnl,
        status: null,
        timestamp: tr.timestamp,
        pnl,
        category: bucketOf("TRADE", null, pnl),
      };
    }),
  ];
  return rows.sort((a, b) => b.timestamp - a.timestamp);
}

export function filterOps(ops: ImportedOpRow[], filter: OpFilter): ImportedOpRow[] {
  if (filter === "all") return ops;
  return ops.filter((o) => o.category === filter);
}

export interface OpStatement {
  /** Gross profits (positive realized PnL + positive income). */
  profit: number;
  /** Gross losses as a positive magnitude (abs of negative values). */
  loss: number;
  /** Taxes paid (cost; negative). */
  tax: number;
  /** Funding — signed net (received − paid). */
  fundingNet: number;
  count: number;
  profitCount: number;
  lossCount: number;
  taxCount: number;
  fundingCount: number;
}

export function computeStatement(ops: ImportedOpRow[]): OpStatement {
  const st: OpStatement = {
    profit: 0,
    loss: 0,
    tax: 0,
    fundingNet: 0,
    count: 0,
    profitCount: 0,
    lossCount: 0,
    taxCount: 0,
    fundingCount: 0,
  };
  for (const o of ops) {
    if (o.pnl == null) continue;
    st.count += 1;
    if (o.category === "tax") {
      st.tax += o.pnl;
      st.taxCount += 1;
      st.loss += Math.abs(o.pnl);
      continue;
    }
    if (o.category === "funding") {
      st.fundingNet += o.pnl;
      st.fundingCount += 1;
      if (o.pnl >= 0) st.profit += o.pnl;
      else st.loss += Math.abs(o.pnl);
      continue;
    }
    if (o.pnl > 0) {
      st.profit += o.pnl;
      st.profitCount += 1;
    } else if (o.pnl < 0) {
      st.loss += Math.abs(o.pnl);
      st.lossCount += 1;
    }
  }
  return st;
}