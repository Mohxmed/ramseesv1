import type {
  ImportedAccountDetailDto,
  ImportedOpRow,
  OpCategory,
  OpFilter,
  OpImpact,
  OpKind,
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

/* ─── Unified RAMSEES classification layer ───────────────────────────────
 * One data-driven mapping from raw Binance/exchange types to the normalized
 * `OpKind` enum. The UI keys every label/filter off the enum — never off raw
 * strings or Arabic text. New exchange types are added here (a new rule), the
 * enum and the rest of the app stay stable. Unknown raw types land under
 * `other` (label = raw type) so no operation ever disappears.
 */

export const OPKIND_LABELS: Record<OpKind, string> = {
  deposit: "إيداع",
  withdrawal: "سحب",
  transfer: "تحويل",
  trade: "تداول",
  fee: "رسوم",
  funding: "تمويل",
  settlement: "تسوية",
  liquidation: "تصفية",
  pnl: "أرباح وخسائر",
  reward: "مكافآت",
  convert: "تحويل أصل",
  other: "أخرى",
};

/** The main filter bar order (matches the user-facing classification). */
export const OP_KIND_OPTIONS: (OpKind | "all")[] = [
  "all",
  "deposit",
  "withdrawal",
  "transfer",
  "trade",
  "fee",
  "funding",
  "settlement",
  "liquidation",
  "pnl",
  "reward",
  "convert",
  "other",
];

export interface OpTypeRule {
  /** Raw (sub)type token matched case-insensitively (substring by default). */
  raw: string;
  kind: OpKind;
  /** Simple Arabic label shown as the detailed type name. */
  label: string;
  /** Match the whole raw (sub)type exactly (safety for short tokens like ADL). */
  exact?: boolean;
}

/**
 * Ordered mapping rules (most specific first). Important seams:
 *  - INSURANCE_CLEAR / Insurances are SETTLEMENT — they are *never* treated as
 *    a user liquidation (`LIQUIDATION`) unless the raw type literally says so.
 *  - FUNDING_FEE → funding; only explicit LIQUIDATION / ADL tokens → liquidation.
 *  - COIN_SWAP* → convert; INTERNAL/EXTERNAL/CROSS_COLLATERAL_TRANSFER → transfer.
 */
export const OP_TYPE_RULES: OpTypeRule[] = [
  /* تسويات */
  { raw: "INSURANCE_CLEAR", kind: "settlement", label: "تسوية صندوق التأمين" },
  { raw: "INSURANCE", kind: "settlement", label: "تسوية تأمينية" },
  { raw: "DELIVERED_SETTLEMENT", kind: "settlement", label: "تسوية العقد المُسلَّم" },
  { raw: "SETTLEMENT", kind: "settlement", label: "تسوية" },
  /* تصفية — فقط إشارات صريحة */
  { raw: "LIQUIDATION_TRANSFER", kind: "liquidation", label: "تصفية الحساب" },
  { raw: "LIQUIDATION", kind: "liquidation", label: "تصفية" },
  { raw: "AUTO_DELEVERAGE", kind: "liquidation", label: "تقليل مركز تلقائي (ADL)" },
  { raw: "ADL", kind: "liquidation", label: "تقليل مركز تلقائي (ADL)", exact: true },
  /* أرباح وخسائر */
  { raw: "REALIZED_PNL", kind: "pnl", label: "ربح/خسارة محققة" },
  { raw: "UNREALIZED_PNL", kind: "pnl", label: "ربح/خسارة غير محققة" },
  /* مكافآت */
  { raw: "COMMISSION_REBATE_CROSS", kind: "reward", label: "استرداد عمولة (ضمانات)" },
  { raw: "COMMISSION_REBATE", kind: "reward", label: "استرداد العمولة" },
  { raw: "CONTRACT_REBATE", kind: "reward", label: "خصم العقود" },
  { raw: "REFERRAL_KICKBACK", kind: "reward", label: "عمولة الإحالة" },
  { raw: "WELCOME_BONUS", kind: "reward", label: "مكافأة ترحيبية" },
  { raw: "ACTIVITY_BONUS", kind: "reward", label: "مكافأة نشاط" },
  { raw: "REBATE", kind: "reward", label: "استرداد" },
  { raw: "KICKBACK", kind: "reward", label: "عمولة" },
  { raw: "BONUS", kind: "reward", label: "مكافأة" },
  { raw: "REWARD", kind: "reward", label: "مكافأة" },
  /* تمويل — قبل "FEE" كي لا تبتلعه رسوم الصفقات */
  { raw: "FUNDING", kind: "funding", label: "رسوم/دخل تمويل" },
  /* رسوم */
  { raw: "COMMISSION", kind: "fee", label: "عمولة تداول" },
  { raw: "TAX", kind: "fee", label: "ضريبة" },
  { raw: "FEE", kind: "fee", label: "رسوم" },
  /* تحويل/تبديل أصول */
  { raw: "COIN_SWAP_DEPOSIT", kind: "convert", label: "تحويل/تبديل عملة (داخل)" },
  { raw: "COIN_SWAP_WITHDRAW", kind: "convert", label: "تحويل/تبديل عملة (خارج)" },
  { raw: "COIN_SWAP", kind: "convert", label: "تحويل/تبديل عملة" },
  { raw: "SWAP", kind: "convert", label: "تبديل أصل" },
  { raw: "CONVERT", kind: "convert", label: "تحويل أصل" },
  /* تحويلات */
  { raw: "INTERNAL_TRANSFER", kind: "transfer", label: "تحويل داخلي" },
  { raw: "EXTERNAL_TRANSFER", kind: "transfer", label: "تحويل خارجي" },
  { raw: "CROSS_COLLATERAL_TRANSFER", kind: "transfer", label: "تحويل ضمانات" },
  { raw: "TRANSFER", kind: "transfer", label: "تحويل" },
  /* إيداعات / سحوبات */
  { raw: "WITHDRAWAL", kind: "withdrawal", label: "سحب" },
  { raw: "DEPOSIT", kind: "deposit", label: "إيداع" },
  /* تداول */
  { raw: "TRADE", kind: "trade", label: "صفقة" },
];

function matchRule(needle: string, r: OpTypeRule): boolean {
  return r.exact ? needle === r.raw : needle.includes(r.raw);
}

/** Map a raw exchange type (+ optional income sub-type) to { kind, label }. */
export function classifyOp(
  type: string,
  incomeType: string | null
): { kind: OpKind; label: string } {
  const needle = (incomeType ?? type ?? "").toUpperCase();
  for (const r of OP_TYPE_RULES) {
    if (matchRule(needle, r)) return { kind: r.kind, label: r.label };
  }
  // Unknown raw types stay visible under "أخرى", preserving the raw type.
  return { kind: "other", label: type || "غير معروف" };
}

/** The matched detailed-type token (stable key for sub-filters), or null. */
function subTypeOf(type: string, incomeType: string | null): string | null {
  const needle = (incomeType ?? type ?? "").toUpperCase();
  for (const r of OP_TYPE_RULES) {
    if (matchRule(needle, r)) return r.kind === "other" ? null : r.raw;
  }
  return null;
}

/** Money direction derived from the signed money effect (never from text). */
export function impactOf(pnl: number | null): OpImpact {
  if (pnl == null || pnl === 0) return "neutral";
  return pnl > 0 ? "in" : "out";
}

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
      const classed = classifyOp(t.type, incomeType);
      let category = bucketOf(t.type, incomeType, pnl);
      if (isFutures && incomeType === "REALIZED_PNL" && income != null && isDupeClose(income, t.timestamp)) {
        category = "other";
      }
      return {
        id: `tx:${t.id}`,
        kind: "transaction" as const,
        typeLabel: incomeLabel ?? classed.label ?? TX_LABELS[t.type] ?? t.type,
        symbol: null,
        side: null,
        amount: t.amount,
        asset: t.asset || null,
        usdValue: t.usdValue || null,
        price: null,
        orderId: t.externalId ?? null,
        fee: t.fee,
        income,
        realizedPnlUsd: null,
        status: t.status ?? null,
        timestamp: t.timestamp,
        pnl,
        category,
        opType: classed.kind,
        rawType: t.type ?? null,
        rawSubType: incomeType,
        subType: subTypeOf(t.type, incomeType),
        impact: impactOf(pnl),
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
        price: tr.price || null,
        orderId: tr.orderId ?? null,
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
        opType: "trade" as const,
        rawType: "TRADE",
        rawSubType: null,
        subType: null,
        impact: impactOf(pnl),
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