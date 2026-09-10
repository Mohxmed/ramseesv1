import type {
  ImportedAccountDetailDto,
  ImportedOpRow,
  OpCategory,
  OpFilter,
} from "./types";

/**
 * Operations feed — the imported wallet's auto-recorded operations, split into
 * clear sections: أرباح المراكز / خسائر المراكز / رسوم الصفقات (تشمل الضرائب
 * والتمويل والأقساط) / الودائع والسحب والتحويلات / أخرى. Every row carries a
 * signed `pnl` (the money effect) and is bucketed by its nature first, then by
 * the PnL sign.
 *
 * Futures closes are reported twice: once in the trade feed (userTrades, per
 * fill with an explicit realizedPnlUsd) and once in the income feed
 * (REALIZED_PNL). The trade history is scoped per-symbol (so partial), and the
 * income feed is complete but can miss closes — we merge both and dedupe closes
 * that appear in both feeds so a realized PnL is never counted twice.
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

export const OP_FILTERS: { key: OpFilter; label: string }[] = [
  { key: "all", label: "الكل" },
  { key: "profit", label: "أرباح مراكز" },
  { key: "loss", label: "خسائر مراكز" },
  { key: "fee", label: "رسوم الصفقات" },
  { key: "flow", label: "ودائع وسحب" },
  { key: "other", label: "أخرى" },
];

/** Bucket by nature (flows first), then realized PnL sign. */
export function bucketOf(
  type: string,
  incomeType: string | null,
  pnl: number | null
): OpCategory {
  if (type === "DEPOSIT" || type === "WITHDRAWAL" || type === "TRANSFER") return "flow";
  if (incomeType != null) {
    if (/REALIZED_PNL/i.test(incomeType)) {
      if (pnl == null) return "other";
      return pnl > 0 ? "profit" : pnl < 0 ? "loss" : "other";
    }
    // Commissions, taxes, funding and insurance are all wallet costs → رسوم
    // الصفقات (rebates reduce them). Everything else (bonuses, claims, …)
    // stays "أخرى".
    if (/COMMISSION/i.test(incomeType) || /TAX/i.test(incomeType) || /REBATE/i.test(incomeType) || /FUNDING/i.test(incomeType) || /INSURANCE/i.test(incomeType)) return "fee";
  }
  // Spot trade fills carry their own realized PnL when the platform reports it.
  if (type === "TRADE") {
    if (pnl == null) return "other";
    return pnl > 0 ? "profit" : pnl < 0 ? "loss" : "other";
  }
  return "other";
}

export function buildOps(detail: ImportedAccountDetailDto | null): ImportedOpRow[] {
  if (!detail) return [];
  const isFutures = detail.account?.accountType === "FUTURES";
  // Futures closes with a realized PnL carry it authoritatively in the trade
  // feed (userTrades). A matching REALIZED_PNL income row is the same close —
  // we keep the trade fill and mark the income row as informational ("أخرى").
  const closingFills = isFutures
    ? detail.trades.filter((tr) => tr.realizedPnlUsd != null && tr.realizedPnlUsd !== 0)
    : [];
  const isDupeClose = (income: number, incomeTs: number) =>
    closingFills.some(
      (tr) =>
        Math.abs(Math.abs(tr.realizedPnlUsd!) - Math.abs(income)) < 1e-6 &&
        Math.abs(tr.timestamp - incomeTs) <= 120_000
    );
  const rows: ImportedOpRow[] = [
    ...detail.transactions.map((t) => {
      const incomeType = t.incomeType ?? null;
      const income = t.income ?? null;
      // Flow rows (deposits/withdrawals) have no exchange income; their signed
      // money effect is the amount itself. Everything else keeps the income.
      const pnl = income ?? (t.type === "DEPOSIT" ? t.amount : t.type === "WITHDRAWAL" ? -t.amount : null);
      const incomeLabel = incomeType != null ? INCOME_LABELS[incomeType] : undefined;
      let category = bucketOf(t.type, incomeType, pnl);
      if (isFutures && incomeType === "REALIZED_PNL" && income != null && isDupeClose(income, t.timestamp)) {
        category = "other";
      }
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
        category,
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
        // Futures fills only close a position when the platform reports a
        // realized PnL; fills with zero are opens/partials → informational.
        // Spot fills carry their own realized PnL when available.
        category: isFutures && (pnl == null || pnl === 0) ? "other" : bucketOf("TRADE", null, pnl),
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
  /** Wallet costs — commissions, taxes, funding, insurance — signed. */
  fees: number;
  /** Deposits + transfers-in − withdrawals − transfers-out (signed net). */
  flow: number;
  count: number;
  profitCount: number;
  lossCount: number;
  feeCount: number;
  flowCount: number;
}

export function computeStatement(ops: ImportedOpRow[]): OpStatement {
  const st: OpStatement = {
    profit: 0,
    loss: 0,
    fees: 0,
    flow: 0,
    count: 0,
    profitCount: 0,
    lossCount: 0,
    feeCount: 0,
    flowCount: 0,
  };
  for (const o of ops) {
    if (o.pnl == null) continue;
    // Informational rows (futures fills with no realized PnL, closes mirrored
    // from both feeds, bonuses/claims, …) never feed the statement.
    if (o.category === "other") continue;
    st.count += 1;
    switch (o.category) {
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