import type {
  FactorCategory,
  FactorTier,
  MarketSessionKind,
  SourceTier,
} from "./intelligence/types";

/**
 * Factor registry — single source of truth for which external markets we
 * monitor, how we fetch them, and how heavily they weigh into the score.
 *
 * Never hard-coded in UI components: the engine + API route read this list.
 *
 * Live-data strategy (no API keys):
 *   - Binance REST          — BTC-USD reference (genuinely realtime, ~seconds)
 *   - Yahoo chart (5m/5d)   — indices/futures/FX: FX & DXY are near-live on
 *                             the feed; equity indices update real-time while
 *                             their market is open; gold/oil futures ~30min.
 *   - FRED CSV              — DGS2 / M2SL / WALCL (inherently periodic).
 *   - DefiLlama stablecoins — stablecoin supply, key-free, daily cadence.
 *   - derived               — 10Y−2Y spread on the ^TNX grid.
 */

export type Provider =
  | "yahoo"
  | "fred"
  | "derived"
  | "defillama"
  | "binance"
  | "finnhub"
  | "fmp"
  | "unavailable";

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
  /**
   * Trading-session model the asset's exchange follows. Indices/derived use
   * "equity"; futures use "future"; FX "fx"; periodic sources "periodic".
   */
  sessionKind: MarketSessionKind;
  fetch: {
    yahooSymbol?: string;
    /** Optional alternates used by fastMarketService when a Finnhub/FMP key
     *  is configured; unset symbols fall back to the key-free Yahoo fast path. */
    finnhubSymbol?: string;
    fmpSymbol?: string;
    fredId?: string;
    llama?: boolean;
    derived?: boolean;
  };
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
    sessionKind: "fx",
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
    sessionKind: "equity",
    fetch: { yahooSymbol: "^NDX", finnhubSymbol: "^NDX", fmpSymbol: "^NDX" },
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
    sessionKind: "equity",
    fetch: { yahooSymbol: "^GSPC", finnhubSymbol: "^GSPC", fmpSymbol: "^GSPC" },
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
    sessionKind: "equity",
    fetch: { yahooSymbol: "^TNX", finnhubSymbol: "^TNX", fmpSymbol: "^TNX" },
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
    sessionKind: "equity",
    fetch: { yahooSymbol: "^VIX", finnhubSymbol: "^VIX", fmpSymbol: "^VIX" },
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
    sessionKind: "future",
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
    sessionKind: "periodic",
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
    sessionKind: "periodic",
    fetch: { fredId: "M2SL" },
    tooltip:
      "المعروض النقدي الأمريكي الواسع M2 — مؤشر كمية السيولة في النظام المالي، يتغير شهرياً.",
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
    sessionKind: "equity",
    fetch: { yahooSymbol: "^RUT", finnhubSymbol: "^RUT", fmpSymbol: "^RUT" },
    tooltip:
      "مؤشر الشركات الصغيرة الأمريكية — الأكثر حساسية لسيولة السوق وشهية المخاطرة المحلية.",
  },
  {
    id: "nq-futures",
    nameAr: "عقود ناسداك المستقبلية",
    nameEn: "Nasdaq 100 Futures (NQ)",
    category: "equities",
    tier: "secondary",
    weight: 0.55,
    unit: "point",
    source: "realtime",
    provider: "yahoo",
    sessionKind: "future",
    fetch: { yahooSymbol: "NQ=F" },
    tooltip:
      "عقود مؤشر ناسداك 100 الآجلة (CME Globex) — تداول شبه مستمر يُظهر توقع السوق لحركة الأسهم التكنولوجية خارج جلسة المؤشر، ويعمل ليلاً وفى الإجازات. الخلاصة المجانية قد تكون متأخرة ~10 دقائق.",
  },
  {
    id: "es-futures",
    nameAr: "عقود S&P 500 المستقبلية",
    nameEn: "S&P 500 Futures (ES)",
    category: "equities",
    tier: "secondary",
    weight: 0.5,
    unit: "point",
    source: "realtime",
    provider: "yahoo",
    sessionKind: "future",
    fetch: { yahooSymbol: "ES=F" },
    tooltip:
      "عقود مؤشر S&P 500 الآجلة (CME Globex) — القراءة الشاملة لشهية المخاطرة الأمريكية على مدار الساعة خارج الجلسة النظامية للمؤشر.",
  },
  {
    id: "rty-futures",
    nameAr: "عقود راسل 2000 المستقبلية",
    nameEn: "Russell 2000 Futures (RTY)",
    category: "equities",
    tier: "secondary",
    weight: 0.4,
    unit: "point",
    source: "realtime",
    provider: "yahoo",
    sessionKind: "future",
    fetch: { yahooSymbol: "RTY=F" },
    tooltip:
      "عقود مؤشر راسل 2000 الآجلة — نافذة مبكرة لمعنويات الشركات الصغيرة والسيولة المحلية خارج جلسة المؤشر نفسه.",
  },
  {
    id: "vix-futures",
    nameAr: "عقود فيكس المستقبلية",
    nameEn: "VXX · VIX Futures",
    category: "volatility",
    tier: "secondary",
    weight: 0.5,
    unit: "point",
    source: "realtime",
    provider: "yahoo",
    // VXX lists on NYSE Arca → equity hours (a weekend is a CLOSED market,
    // not a stale futures feed). Kept under `volatility` category + future-like
    // naming so the futures layer reads as one board.
    sessionKind: "equity",
    fetch: { yahooSymbol: "VXX" },
    tooltip:
      "ETN يقف على العقود الآجلة القصيرة الأجل لمؤشر VIX (VXX) — التوقع الصريح للمضاربين على مستوى الخوف المستقبلي، وأسرع من المؤشر النقدي في التقاط النفور من المخاطرة. (لا يوفر Yahoo سلسلة VX=F مجانية؛ VXX هو البديل الحي الأدق.)",
  },
  {
    id: "us2y",
    nameAr: "عائد سنتين (يومي)",
    nameEn: "US 2Y Yield",
    category: "rates",
    tier: "secondary",
    weight: 0.5,
    unit: "percent",
    source: "periodic",
    provider: "fred",
    sessionKind: "periodic",
    fetch: { fredId: "DGS2" },
    tooltip:
      "عائد سندات السنتين (إصدار يومي من الاحتياطي الفيدرالي) — الأنسب لقياس توقعات مسار أسعار الفائدة القصيرة.",
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
    sessionKind: "fx",
    fetch: { yahooSymbol: "EURUSD=X", finnhubSymbol: "EURUSD", fmpSymbol: "EURUSD" },
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
    sessionKind: "fx",
    fetch: { yahooSymbol: "JPY=X", finnhubSymbol: "USDJPY", fmpSymbol: "USDJPY" },
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
    sessionKind: "future",
    fetch: { yahooSymbol: "CL=F" },
    tooltip:
      "خام غرب تكساس — مؤشر التضخم وأسعار الطاقة. تقلبه ينتقل أحياناً إلى أسواق الأصول الخطرة.",
  },
  {
    id: "stablecoin-supply",
    nameAr: "معروض العملات المستقرة",
    nameEn: "Stablecoin Supply",
    category: "liquidity",
    tier: "secondary",
    weight: 0.5,
    unit: "point",
    source: "periodic",
    provider: "defillama",
    sessionKind: "periodic",
    fetch: { llama: true },
    tooltip:
      "إجمالي قيمة العملات المستقرة المتداولة (DefiLlama) — وكيل سيولة الدخول إلى الأصول الرقمية؛ تحديث يومي مجاني مباشر.",
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
    sessionKind: "derived",
    fetch: { derived: true },
    tooltip:
      "فارق العوائد 10 سنوات ناقص سنتين — مؤشر المعنويات الاقتصادية. انعكاسه (سلبي) سبق أن أنذر بركود وأثر سلباً على الأصول الخطرة.",
  },
  {
    id: "us30y",
    nameAr: "عائد 30 سنة",
    nameEn: "US 30Y Yield",
    category: "rates",
    tier: "secondary",
    weight: 0.5,
    unit: "percent",
    source: "realtime",
    provider: "yahoo",
    sessionKind: "equity",
    fetch: { yahooSymbol: "^TYX", finnhubSymbol: "^TYX", fmpSymbol: "^TYX" },
    tooltip:
      "عائد سندات الخزانة لأجل 30 سنة — الطرف الطويل لمنحنى العائد. ارتفاعه يعكس مخاوف التضخم طويلة الأجل وتدهور أوضاع المالية العامة.",
  },
  {
    id: "real-yield",
    nameAr: "العائد الحقيقي 10 سنوات",
    nameEn: "Real 10Y Yield (TIPS)",
    category: "rates",
    tier: "secondary",
    weight: 0.45,
    unit: "percent",
    source: "periodic",
    provider: "fred",
    sessionKind: "periodic",
    fetch: { fredId: "DFII10" },
    tooltip:
      "عائد سندات الخزانة المحمية من التضخم (TIPS) — معدل العائد الحقيقي. ارتفاعه يكلف الأصول البديلة مثل BTC تكلفة فرصة مرتفعة.",
  },
  {
    id: "reverse-repo",
    nameAr: "تسهيل الريبو العكسي",
    nameEn: "Reverse Repo (ON RRP)",
    category: "liquidity",
    tier: "secondary",
    weight: 0.4,
    unit: "point",
    source: "periodic",
    provider: "fred",
    sessionKind: "periodic",
    fetch: { fredId: "RRPONTSYD" },
    tooltip:
      "حجم السيولة المحتجزة في تسهيل الريبو العكسي للفيدرالي — هبوطه يعني تدفق السيولة من السقف النقدي نحو الأصول الخطرة (إيجابي).",
  },
  {
    id: "tga",
    nameAr: "الرصيد العام للخزانة",
    nameEn: "Treasury General Account",
    category: "liquidity",
    tier: "secondary",
    weight: 0.35,
    unit: "point",
    source: "periodic",
    provider: "fred",
    sessionKind: "periodic",
    fetch: { fredId: "WTREGEN" },
    tooltip:
      "رصيد وزارة الخزانة الأمريكية لدى الفيدرالي — انخفاضه يضخ سيولة في النظام المصرفي، وارتفاعه الجمعي يسحبها.",
  },
  {
    id: "nfci",
    nameAr: "الأوضاع المالية NFCI",
    nameEn: "Financial Conditions (NFCI)",
    category: "liquidity",
    tier: "secondary",
    weight: 0.4,
    unit: "point",
    source: "periodic",
    provider: "fred",
    sessionKind: "periodic",
    fetch: { fredId: "NFCI" },
    tooltip:
      "مؤشر شيكاغو للأوضاع المالية — ارتفاعه يعني تقييداً مالياً يضغط على الأصول الخطرة، وانخفاضه يعني اتساعاً في السيولة.",
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
    sessionKind: "periodic",
    fetch: {},
    tooltip: "صافي تدفقات صناديق بيتكوين المتداولة — لا مصدر مجاني موثوق متاح حاليًا؛ يظهر كغير متاح ولا يدخل الحساب.",
  },
];

export const FACTOR_BY_ID: Record<string, FactorDef> = Object.fromEntries(
  FACTOR_DEFS.map((f) => [f.id, f])
);

/** Factors that actually produce data (real monitors). */
export const MONITORED_IDS = FACTOR_DEFS.filter((f) => f.provider !== "unavailable").map(
  (f) => f.id
);