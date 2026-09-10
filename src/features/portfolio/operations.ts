import type {
  ImportedAccountDetailDto,
  ImportedOpRow,
  OpCategory,
  OpFilter,
} from "./types";

/**
 * Operations feed — the imported wallet's auto-recorded operations, split into
 * clear sections: أرباح المراكز / خسائر المراكز / رسوم الصفقات / الضرائب /
 * التمويل / الودائع والسحب. Every row carries a signed `pnl` (the money
 * effect) and is bucketed by its nature first, then by the PnL sign.
 *
 * The income feed is the authoritative economic ledger for futures: REALIZED_PNL
 * rows cover every closed position (without the per-symbol scoping of the trade
 * history), so trade fills are informational only on that path.
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

/** Income-type labels shown as the row title (more specific than the bucket). */
const INCOME_LABELS: Record<string, string> = {
  REALIZED_PNL: "ربح/خسارة المركز",
  COMMISSION: "عمولة التداول",
  FUNDING_FEE: "رسوم التمويل",
  TAX: "ضريبة",
  TAX_PNL: "ضريبة الأرباح",
  TAX_COMMISSION: "ضريبة العمولات",
  INSURANCE_CLEAR: "تسوية صندوق التأمين",
  CONTRACT_REBATE: "خصم العقود",
  COMMISSION_REBATE: "استرداد العمولة",
  WELCOME_BONUS: "مكافأة ترحيبية",
  TRANSFER: "تحويل",
  INTERNAL_TRANSFER: "تحويل داخلي",
  EXTERNAL_TRANSFER: "تحويل خارجي",
  CROSS_COLLATERAL_TRANSFER: "تحويل ضمانات",
  COIN_SWAP_DEPOSIT: "تحويل عملة",
  COIN_SWAP_WITHDRAW: "تحويل عملة",
};

export const OP_FILTERS: { key: OpFilter; label: string; tone: "good" | "down" | "gold" | "warn" | "up" | "neutral" }[] = [
  { key: "all", label: "الكل", tone: "neutral" },
  { key: "profit", label: "أرباح مراكز", tone: "good" },
  { key: "loss", label: "خسائر مراكز", tone: "down" },
  { key: "fee", label: "رسوم الصفقات", tone: "gold" },
  { key: "tax", label: "الضرائب", tone: "warn" },
  { key: "funding", label: "التمويل", tone: "up" },
  { key: "flow", label: "ودائع وسحب", tone: "neutral" },
  { key: "other", label: "أخرى", tone: "neutral" },
];

/** Bucket by nature first (flow / funding / tax / fees), then by PnL sign. */
export function bucketOf(
  type: string,
  incomeType: string | null,
  pnl: number | null
): OpCategory {
  if (type === "DEPOSIT" || type === "WITHDRAWAL" || type === "TRANSFER") return "flow";
  if (type === "FUNDING" || incomeType === "FUNDING_FEE") return "funding";
  if (incomeType != null) {
    if (/TAX/i.test(incomeType)) return "tax";
    if (/COMMISSION/i.test(incomeType) || /REBATE/i.test(incomeType)) return "fee";
    if (/REALIZED_PNL/i.test(incomeType)) {
      if (pnl == null) return "other";
      return pnl > 0 ? "profit" : pnl < 0 ? "loss" : "other";
    }
  }
  if (type === "TRADE") {
    if (pnl == null) return "other";
    return pnl > 0 ? "profit" : pnl < 0 ? "loss" : "other";
  }
  return "other";
}

export function buildOps(detail: ImportedAccountDetailDto | null): ImportedOpRow[] {
  if (!detail) return [];
  const isFutures = detail.account?.accountType === "FUTURES";
  const rows: ImportedOpRow[] = [
    ...detail.transactions.map((t) => {
      const incomeType = t.incomeType ?? null;
      const income = t.income ?? null;
      // Flow rows (deposits/withdrawals) have no exchange income; their signed
      // money effect is the amount itself. Everything else keeps the income.
      const pnl = income ?? (t.type === "DEPOSIT" ? t.amount : t.type === "WITHDRAWAL" ? -t.amount : null);
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
        income,
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
        // For futures, realized PnL is reported authoritatively by the income
        // feed (REALIZED_PNL rows cover every closed position, without the
        // per-symbol scoping of the trade history). Trade fills stay visible
        // as informational rows so their PnL is not double-counted.
        category: isFutures ? "other" : bucketOf("TRADE", null, pnl),
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
  /** Gross position profits (positive REALIZED_PNL / realized PnL). */
  profit: number;
  /** Gross position losses as a positive magnitude. */
  loss: number;
  /** Trade fees / commissions — signed (negative = paid). */
  fees: number;
  /** Taxes paid (negative). */
  tax: number;
  /** Funding — signed net (received − paid). */
  fundingNet: number;
  /** Deposits − withdrawals (signed net flow). */
  flow: number;
  count: number;
  profitCount: number;
  lossCount: number;
  feeCount: number;
  taxCount: number;
  fundingCount: number;
  flowCount: number;
}

export function computeStatement(ops: ImportedOpRow[]): OpStatement {
  const st: OpStatement = {
    profit: 0,
    loss: 0,
    fees: 0,
    tax: 0,
    fundingNet: 0,
    flow: 0,
    count: 0,
    profitCount: 0,
    lossCount: 0,
    feeCount: 0,
    taxCount: 0,
    fundingCount: 0,
    flowCount: 0,
  };
  for (const o of ops) {
    if (o.pnl == null) continue;
    // Informational rows (e.g. futures trade fills, whose PnL is authoritative
    // in the REALIZED_PNL income feed) never feed the statement.
    if (o.category === "other") continue;
    st.count += 1;
    switch (o.category) {
      case "tax":
        st.tax += o.pnl;
        st.taxCount += 1;
        break;
      case "funding":
        st.fundingNet += o.pnl;
        st.fundingCount += 1;
        break;
      case "fee":
        st.fees += o.pnl;
        st.feeCount += 1;
        break;
      case "flow":
        st.flow += o.pnl;
        st.flowCount += 1;
        break;
      case "profit":
        st.profit += o.pnl;
        st.profitCount += 1;
        break;
      case "loss":
        st.loss += Math.abs(o.pnl);
        st.lossCount += 1;
        break;
      default:
        break;
    }
  }
  return st;
}