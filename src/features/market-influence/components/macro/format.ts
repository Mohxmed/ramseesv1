import type { Tone } from "@/components/ui/overlay";
import type {
  MacroRegimeLevel,
  MarketInfluenceFactor,
  SeriesPoint,
} from "@/features/market-influence/intelligence";

export interface MacroRegimeMeta {
  label: string;
  short: string;
  tone: "up" | "down" | "neutral" | "warn";
}

export const REGIME_META: Record<MacroRegimeLevel, MacroRegimeMeta> = {
  STRONG_RISK_ON: {
    label: "إقبال قوي على المخاطرة",
    short: "RISK-ON قوي",
    tone: "up",
  },
  RISK_ON: {
    label: "إقبال على المخاطرة",
    short: "RISK-ON",
    tone: "up",
  },
  NEUTRAL: { label: "سوق محايد", short: "NEUTRAL", tone: "neutral" },
  RISK_OFF: {
    label: "نفور من المخاطرة",
    short: "RISK-OFF",
    tone: "down",
  },
  STRONG_RISK_OFF: {
    label: "نفور قوي من المخاطرة",
    short: "RISK-OFF قوي",
    tone: "down",
  },
};

export const REGIME_LEVELS: MacroRegimeLevel[] = [
  "STRONG_RISK_ON",
  "RISK_ON",
  "NEUTRAL",
  "RISK_OFF",
  "STRONG_RISK_OFF",
];

/** Short Arabic label for a tone-coded instrument move. */
export function dirLabel(dir: "up" | "down" | "flat" | null): { label: string; tone: Tone } {
  switch (dir) {
    case "up":
      return { label: "صاعد", tone: "up" };
    case "down":
      return { label: "هابط", tone: "down" };
    case "flat":
      return { label: "مستقر", tone: "neutral" };
    default:
      return { label: "غير متاح", tone: "quiet" };
  }
}

/** Semantics of a correlation magnitude. */
export function corrKind(v: number | null | undefined): { label: string; tone: Tone } {
  if (v == null) return { label: "غير متاح", tone: "quiet" };
  const a = Math.abs(v);
  if (a >= 0.6) return { label: "مرتبط بقوة", tone: a === v ? "warn" : "good" };
  if (a >= 0.35) return { label: "مرتبط", tone: v > 0 ? "good" : "warn" };
  if (a >= 0.15) return { label: "ارتباط ضعيف", tone: "warn" };
  return { label: "مستقل تقريباً", tone: "quiet" };
}

/** Human "سبب التغير" per factor — honest, derived from its own readings. */
export function factorReason(f: MarketInfluenceFactor): string {
  if (f.impactScore == null) return "لا قراءة — المصدر غير متاح حاليًا";
  const chg = f.change24hPct;
  const z = f.zScore;
  const dir = f.direction;
  const parts: string[] = [];

  if (dir === "up") parts.push("زخم صاعد في النافذة الأقصر");
  else if (dir === "down") parts.push("زخم هابط في النافذة الأقصر");
  else if (dir === "flat") parts.push("زخم شبه مستقر");

  if (chg != null)
    parts.push(
      `${chg >= 0 ? "ارتفاع" : "انخفاض"} ${Math.abs(chg).toFixed(1)}% خلال 24 س`
    );
  if (z != null)
    parts.push(
      Math.abs(z) >= 1.5
        ? `انحراف استثنائي (z=${z.toFixed(1)})`
        : Math.abs(z) >= 0.8
        ? `انحراف ملحوظ (z=${z.toFixed(1)})`
        : `حركة ضمن النطاق (z=${z.toFixed(1)})`
    );

  if (f.role === "support") parts.push("ويصبّ في صالح BTC");
  else if (f.role === "pressure") parts.push("ويشكّل ضغطًا على BTC");

  return parts.length > 0 ? parts.join("، ") : "قراءة محايدة";
}

/** Sparkline-friendly compact points (kept bounded for render). */
export function sparkPoints(points: SeriesPoint[]): { t: number; v: number }[] {
  const n = points.length;
  if (n <= 60) return points.map((p) => ({ t: p.t, v: p.v }));
  const step = Math.ceil(n / 60);
  const out: { t: number; v: number }[] = [];
  for (let i = 0; i < n; i += step) out.push({ t: points[i].t, v: points[i].v });
  return out;
}

/** Category → Market Map tab label. */
export const CATEGORY_LABEL: Record<string, string> = {
  equities: "الأسهم",
  dollar: "الدولار",
  rates: "العوائد",
  volatility: "التقلب",
  commodities: "السلع",
  fx: "العملات",
  liquidity: "السيولة",
};