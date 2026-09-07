import type { FactorCategory, FactorTier, SourceTier } from "./intelligence/types";

/**
 * Factor registry — single source of truth for which external markets we
 * monitor, how we fetch them, and how heavily they weigh into the score.
 *
 * Never hard-coded in UI components: the engine + API route read this list.
 */

export type Provider = "yahoo" | "fred" | "derived" | "unavailable";

export interface FactorDef {
  id: string;
  nameAr: string;
  nameEn: string;
  category: FactorCategory;
  tier: FactorTier;
  weight: number;
  unit: "point" | "percent";
  source: SourceTier;
  provider: Provider;
  fetch: { yahooSymbol?: string; fredId?: string; derived?: boolean };
  tooltip: string;
}

export const FACTOR_DEFS: FactorDef[] = [
  {
    id: "dxy",
    nameAr: "مؤشر الدولار",
    nameEn: "DXY",
    category: "dollar",
    tier: "primary",
    weight: 1.0,
    unit: "point",
    source: "realtime",
    provider: "yahoo",
    fetch: { yahooSymbol: "DX-Y.NYB" },
    tooltip:
      "مؤشر الدولار يقيس قوة الدولار مقابل سلة عملات. ارتفاعه التاريخي يضغط على الأصول المرتفعة المخاطر مثل BTC عبر قنوات السيولة والاستثمار.",
  },
  {
    id: "nasdaq",
    nameAr: "ناسداك 100",
    nameEn: "NASDAQ 100",
    category: "equities",
    tier: "primary",
    weight: 0.9,
    unit: "point",
    source: "realtime",
    provider: "yahoo",
    fetch: { yahooSymbol: "^NDX" },
    tooltip:
      "مؤشر أكبر 100 شركة تكنولوجية — وكيل شهية المخاطرة عالمياً والأكثر ارتباطاً تاريخياً بحركة BTC.",
  },
  {
    id: "sp500",
    nameAr: "S&P 500",
    nameEn: "S&P 500",
    category: "equities",
    tier: "primary",
    weight: 0.8,
    unit: "point",
    source: "realtime",
    provider: "yahoo",
    fetch: { yahooSymbol: "^GSPC" },
    tooltip:
      "مؤشر السوق الأمريكي الواسع. حركته تعكس الحالة العامة للسيولة والثقة في الأصول الخطرة.",
  },
  {
    id: "us10y",
    nameAr: "عائد 10 سنوات",
    nameEn: "US 10Y Yield",
    category: "rates",
    tier: "primary",
    weight: 0.85,
    unit: "percent",
    source: "realtime",
    provider: "yahoo",
    fetch: { yahooSymbol: "^TNX" },
    tooltip:
      "عائد سندات الخزانة الأمريكية لأجل 10 سنوات. عادةً ترتفع مع توقعات رفع الفائدة أو التضخم، مما يضغط على أصول مثل BTC.",
  },
  {
    id: "vix",
    nameAr: "مؤشر التقلب",
    nameEn: "VIX",
    category: "volatility",
    tier: "primary",
    weight: 0.85,
    unit: "point",
    source: "realtime",
    provider: "yahoo",
    fetch: { yahooSymbol: "^VIX" },
    tooltip:
      "مؤشر التقلب CBOE — يقيس الخوف المتوقع في السوق. ارتفاعه يشير لنفور من المخاطرة يدفع الاستثمار بعيداً عن BTC.",
  },
  {
    id: "gold",
    nameAr: "الذهب",
    nameEn: "Gold",
    category: "commodities",
    tier: "primary",
    weight: 0.55,
    unit: "point",
    source: "realtime",
    provider: "yahoo",
    fetch: { yahooSymbol: "GC=F" },
    tooltip:
      "الذهب كأصل ملاذ بديل للدولار. أحياناً يرتبط إيجاباً بـ BTC كملاذ ضد التضخم، وأحياناً يتنافس معه على نفس التدفقات.",
  },
  {
    id: "liquidity",
    nameAr: "السيولة (الميزانية الفيدرالية)",
    nameEn: "Fed Balance Sheet",
    category: "liquidity",
    tier: "primary",
    weight: 0.6,
    unit: "point",
    source: "periodic",
    provider: "fred",
    fetch: { fredId: "WALCL" },
    tooltip:
      "إجمالي أصول الاحتياطي الفيدرالي — الوكيل القياسي للسيولة العالمية. توسعها يساند الأصول الخطرة، وانكماشها يضغط عليها.",
  },
  {
    id: "m2",
    nameAr: "المعروض النقدي M2",
    nameEn: "US M2 Supply",
    category: "liquidity",
    tier: "primary",
    weight: 0.55,
    unit: "point",
    source: "periodic",
    provider: "fred",
    fetch: { fredId: "M2SL" },
    tooltip:
      "المعروض النقدي الأمريكي الواسع M2 — مؤشر كمية السيولة في النظام المالي، يتغير أسبوعياً.",
  },
  {
    id: "rut2000",
    nameAr: "راسل 2000",
    nameEn: "Russell 2000",
    category: "equities",
    tier: "secondary",
    weight: 0.6,
    unit: "point",
    source: "realtime",
    provider: "yahoo",
    fetch: { yahooSymbol: "^RUT" },
    tooltip:
      "مؤشر الشركات الصغيرة الأمريكية — الأكثر حساسية لسيولة السوق وشهية المخاطرة المحلية.",
  },
  {
    id: "us2y",
    nameAr: "عائد سنتين",
    nameEn: "US 2Y Yield",
    category: "rates",
    tier: "secondary",
    weight: 0.5,
    unit: "percent",
    source: "periodic",
    provider: "fred",
    fetch: { fredId: "DGS2" },
    tooltip:
      "عائد سندات السنتين — الأنسب لقياس توقعات مسار أسعار الفائدة القصيرة (سياسة الاحتياطي الفيدرالي).",
  },
  {
    id: "eurusd",
    nameAr: "يورو/دولار",
    nameEn: "EUR/USD",
    category: "fx",
    tier: "secondary",
    weight: 0.45,
    unit: "point",
    source: "realtime",
    provider: "yahoo",
    fetch: { yahooSymbol: "EURUSD=X" },
    tooltip:
      "زوج العملة الأوروبية مقابل الدولار — عملة الدولار نفسه من زاوية أخرى؛ انخفاضه يعكس قوة الدولار.",
  },
  {
    id: "usdjpy",
    nameAr: "دولار/ين",
    nameEn: "USD/JPY",
    category: "fx",
    tier: "secondary",
    weight: 0.4,
    unit: "point",
    source: "realtime",
    provider: "yahoo",
    fetch: { yahooSymbol: "JPY=X" },
    tooltip:
      "الين عملة تمويل شهيرة (carry). ارتفاعه ينذر بتفكيك مراكز المخاطرة الممولة بالين — ضغط على BTC.",
  },
  {
    id: "oil",
    nameAr: "النفط (WTI)",
    nameEn: "Oil WTI",
    category: "commodities",
    tier: "secondary",
    weight: 0.3,
    unit: "point",
    source: "realtime",
    provider: "yahoo",
    fetch: { yahooSymbol: "CL=F" },
    tooltip:
      "خام غرب تكساس — مؤشر التضخم وأسعار الطاقة. تقلبه ينتقل أحياناً إلى أسواق الأصول الخطرة.",
  },
  {
    id: "spread",
    nameAr: "فارق 10-2 سنة",
    nameEn: "10Y − 2Y Spread",
    category: "rates",
    tier: "secondary",
    weight: 0.55,
    unit: "percent",
    source: "computed",
    provider: "derived",
    fetch: { derived: true },
    tooltip:
      "فارق العوائد 10 سنوات ناقص سنتين — مؤشر المعنويات الاقتصادية. انعكاسه (سلبي) سبق أن أنذر بركود وأثر سلباً على الأصول الخطرة.",
  },
  /* Unsupported honestly-listed factors (monitored but no reliable free source). */
  {
    id: "etf-flows",
    nameAr: "تدفقات صناديق BTC ETF",
    nameEn: "BTC ETF Net Flow",
    category: "liquidity",
    tier: "primary",
    weight: 0.8,
    unit: "point",
    source: "unsupported",
    provider: "unavailable",
    fetch: {},
    tooltip: "صافي تدفقات صناديق بيتكوين المتداولة — لا مصدر مجاني موثوق متاح حاليًا؛ يظهر كغير متاح ولا يدخل الحساب.",
  },
  {
    id: "stablecoin-supply",
    nameAr: "معروض العملات المستقرة",
    nameEn: "Stablecoin Supply",
    category: "liquidity",
    tier: "secondary",
    weight: 0.5,
    unit: "point",
    source: "unsupported",
    provider: "unavailable",
    fetch: {},
    tooltip: "إجمالي معروض العملات المستقرة — مؤشر سيولة الدخول إلى العملات الرقمية؛ غير متاح حاليًا كمصدر موثوق.",
  },
];

export const FACTOR_BY_ID: Record<string, FactorDef> = Object.fromEntries(
  FACTOR_DEFS.map((f) => [f.id, f])
);

/** Factors that actually produce data (real monitors). */
export const MONITORED_IDS = FACTOR_DEFS.filter((f) => f.provider !== "unavailable").map(
  (f) => f.id
);