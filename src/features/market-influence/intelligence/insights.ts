import type { CrossInsight, MarketInfluenceFactor } from "./types";
import { biasOf } from "./aggregation";

const fmt = (v: number) => (v >= 0 ? "+" : "") + v.toFixed(0);
const sevRank = (s: CrossInsight["severity"]): number =>
  s === "critical" ? 0 : s === "warning" ? 1 : 2;

export type Leader = { factorId: string; impact: number; nameAr: string } | null;

/**
 * Dynamic Arabic explanations — every sentence is derived from real computed
 * numbers in the current state; none are hard-coded verdicts.
 */
export function buildInsights(
  factors: Record<string, MarketInfluenceFactor>,
  score: number | null,
  alignment: number,
  conflictLevel: string,
  strongestSupport: Leader,
  strongestPressure: Leader
): CrossInsight[] {
  const out: CrossInsight[] = [];
  const f = factors;

  const push = (severity: CrossInsight["severity"], text: string) =>
    out.push({ severity, text });

  // 1) Dollar — the classic top headwind/tailwind.
  const dxy = f.dxy?.impactScore;
  if (dxy != null && dxy <= -25) {
    push(
      dxy <= -45 ? "critical" : "warning",
      `قوة الدولار حاليًا أكبر عامل ضغط خارجي على BTC (تأثير ${fmt(dxy)}). كل ارتفاع إضافي في DXY يثقل على الأصول الخطرة في البيئة الحالية.`
    );
  } else if (dxy != null && dxy >= 25) {
    push(
      "info",
      `ضعف الدولار حاليًا داعم لـ BTC (تأثير ${fmt(dxy)}) — تراجع DXY يقلل الضغط الخارجي عادةً.`
    );
  }

  // 2) Rates.
  const us10y = f.us10y?.impactScore;
  const spread = f.spread?.impactScore;
  if (us10y != null && us10y <= -20) {
    push(
      "warning",
      `ارتفاع عوائد السندات الأمريكية (10 سنوات، تأثير ${fmt(us10y)}) يرفع تكلفة الفرصة البديلة ويفرّغ التمويل من الأصول الخطرة.`
    );
  }
  if (spread != null && spread <= -18) {
    push(
      "info",
      `فارق العوائد 10-2 سنة يتحرك في اتجاه سلبي (تأثير ${fmt(spread)}) — تشديد المنحنى يضغط على شهية المخاطرة.`
    );
  }

  // 3) Equities offset / tailwind.
  const eqNdx = f.nasdaq?.impactScore;
  const eqSp = f.sp500?.impactScore;
  const eqSum = (eqNdx ?? 0) + (eqSp ?? 0) * 0.6;
  const scoreAbs = score == null ? 0 : Math.abs(score);
  if (eqNdx != null && eqSum >= 25) {
    push(
      "info",
      eqSum >= 45 && scoreAbs >= 30
        ? `زخم الأسهم الأمريكية (ناسداك ${fmt(eqNdx ?? 0)}, S&P ${fmt(eqSp ?? 0)}) يدعم BTC بقوة ويخفّف مفعول الضغوط الأخرى.`
        : `زخم الأسهم الأمريكية يخفف جزئيًا من الضغط الخارجي على BTC (ناسداك ${fmt(eqNdx ?? 0)}).`
    );
  } else if (eqNdx != null && eqNdx <= -20) {
    push(
      "warning",
      `ضعف الأسهم الأمريكية (ناسداك ${fmt(eqNdx)}) يسحب BTC معه في بيئة خطر-خارجية متقلصة.`
    );
  }

  // 4) Volatility.
  const vixDir = f.vix?.direction;
  const vixImpact = f.vix?.impactScore;
  const vixAcc = f.vix?.acceleration;
  if (vixDir === "up" && vixImpact != null && vixImpact < 0) {
    push(
      vixImpact <= -45 ? "critical" : "warning",
      `تسارع مؤشر التقلب (VIX، تأثير ${fmt(vixImpact)}) يشير إلى ارتفاع النفور من المخاطرة في السوق.`
    );
  } else if (vixDir === "down" && vixImpact != null && vixImpact > 0) {
    push(
      "info",
      "تقلب السوق في هبوط — بيئة هادئة نسبيًا تُفضّل استقرار الأصول الخطرة."
    );
  } else if (vixAcc != null && vixAcc > 0.4) {
    push(
      "info",
      "مؤشر التقلب يضيف زخمًا تصاعديًا — راقب وصوله إلى مستويات تشديد جديدة."
    );
  }

  // 5) Correlation shifts / flips.
  const shifted = Object.values(factors)
    .filter(
      (x) =>
        x.corrStatus === "flip" ||
        x.corrStatus === "break" ||
        x.corrStatus === "shift"
    )
    .sort(
      (a, b) =>
        Math.abs(b.impactScore ?? 0) - Math.abs(a.impactScore ?? 0)
    );
  if (shifted.length > 0) {
    const top = shifted[0];
    const kind =
      top.corrStatus === "flip"
        ? "انقلبت"
        : top.corrStatus === "break"
        ? "انكسرت"
        : "تغيّرت";
    push(
      top.corrStatus === "break" ? "warning" : "info",
      `العلاقة بين ${top.nameAr} وBTC ${kind} في الأفق القصير مقابل الطويل — المحرك يستخدم الارتباط التكيفي، لا الثابت.`
    );
  }

  // 6) Liquidity.
  const liq = f.liquidity?.change24hPct;
  if (liq != null && liq > 0.15) {
    push(
      "info",
      `توسّع ميزانية الاحتياطي الفيدرالي (${liq.toFixed(2)}%) يدعم بيئة السيولة المناسبة للأصول الخطرة.`
    );
  } else if (liq != null && liq < -0.15) {
    push(
      "warning",
      "انكماش ميزانية الاحتياطي الفيدرالي يشير إلى تقلّص السيولة العالمية — بيئة أشد على BTC."
    );
  }

  // 7) Conflict / alignment.
  if (conflictLevel === "high") {
    push(
      "warning",
      "الإشارات عبر الأسواق متعارضة بوضوح (داعمون وضاغطون أقوياء معًا) — الثقة بأي اتجاه أحادي يجب أن تكون منخفضة."
    );
  } else if (alignment >= 0.72) {
    const dir = biasOf(score ?? 0);
    push(
      "info",
      dir === "bullish"
        ? `إشارات الأسواق الخارجية متوافقة بشكل كبير في اتجاه داعم (توافق ${Math.round(alignment * 100)}%).`
        : dir === "bearish"
        ? `إشارات الأسواق الخارجية متوافقة بشكل كبير في اتجاه ضاغط (توافق ${Math.round(alignment * 100)}%).`
        : `إشارات الأسواق محايدة لكنها متوافقة (توافق ${Math.round(alignment * 100)}%).`
    );
  }

  // 8) Leaders always shown (contextual, never a trade recommendation).
  if (strongestSupport && strongestPressure) {
    push(
      "info",
      `أكبر داعم خارجي: ${strongestSupport.nameAr} (${fmt(strongestSupport.impact)}) · أكبر ضاغط خارجي: ${strongestPressure.nameAr} (${fmt(strongestPressure.impact)}). هذه علامة سياقية وليست إشارة دخول.`
    );
  }

  return out.slice(0, 6).sort((a, b) => sevRank(a.severity) - sevRank(b.severity));
}