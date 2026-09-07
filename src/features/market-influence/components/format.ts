import type { Tone } from "@/components/ui/overlay";
import type {
  CorrStatus,
  CrossScoreClass,
  FactorStatus,
  Role,
} from "@/features/market-influence/intelligence";

/** Number → compact string (kept LTR digits). */
export function fmtNum(v: number | null | undefined, digits = 2): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const a = Math.abs(v);
  if (a >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(2)}B`;
  if (a >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (a >= 100_000) return `${(v / 1000).toFixed(0)}K`;
  return v.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

/** Signed percent. */
export function fmtPct(v: number | null | undefined, digits = 2): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(digits)}%`;
}

export function fmtSigned(v: number | null | undefined, digits = 0): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(digits)}`;
}

/** Correlation → display tone (sign-independent magnitude classes). */
export function corrTone(v: number | null | undefined): Tone {
  if (v == null) return "quiet";
  const a = Math.abs(v);
  if (a >= 0.45) return "good";
  if (a >= 0.15) return "warn";
  return "quiet";
}

export function corrLabel(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toFixed(2);
}

export function statusMeta(s: FactorStatus): {
  label: string;
  tone: "good" | "warn" | "down" | "quiet";
  pulse?: boolean;
} {
  switch (s) {
    case "live":
      return { label: "مباشر", tone: "good", pulse: true };
    case "near":
      return { label: "قريب", tone: "good" };
    case "delayed":
      return { label: "متأخر", tone: "warn" };
    case "stale":
      return { label: "قديم", tone: "down" };
    default:
      return { label: "غير متاح", tone: "quiet" };
  }
}

export function roleMeta(r: Role | null): { label: string; tone: Tone } {
  switch (r) {
    case "support":
      return { label: "داعم", tone: "up" };
    case "pressure":
      return { label: "ضاغط", tone: "down" };
    default:
      return { label: "محايد", tone: "neutral" };
  }
}

export function corrStatusMeta(s: CorrStatus): { label: string; tone: Tone } {
  switch (s) {
    case "flip":
      return { label: "انقلاب الارتباط", tone: "warn" };
    case "break":
      return { label: "انكسار الارتباط", tone: "down" };
    case "shift":
      return { label: "تحول الارتباط", tone: "warn" };
    default:
      return { label: "مستقر", tone: "quiet" };
  }
}

export function classMeta(
  cls: CrossScoreClass
): { label: string; tone: "up" | "down" | "neutral" } {
  switch (cls) {
    case "EXTREME_BULLISH":
      return { label: "شديد الدعم", tone: "up" };
    case "STRONG_BULLISH":
      return { label: "دعم قوي", tone: "up" };
    case "BULLISH":
      return { label: "داعم", tone: "up" };
    case "BEARISH":
      return { label: "ضاغط", tone: "down" };
    case "STRONG_BEARISH":
      return { label: "ضغط قوي", tone: "down" };
    case "EXTREME_BEARISH":
      return { label: "شديد الضغط", tone: "down" };
    default:
      return { label: "محايد", tone: "neutral" };
  }
}

/** Relative time in Arabic. */
export function timeAgo(nowMs: number, t: number | null): string {
  if (t == null) return "—";
  const s = Math.max(0, Math.floor((nowMs - t) / 1000));
  if (s < 60) return `قبل ${s}ث`;
  const m = Math.floor(s / 60);
  if (m < 60) return `قبل ${m}د`;
  const h = Math.floor(m / 60);
  if (h < 24) return `قبل ${h}س`;
  const d = Math.floor(h / 24);
  return `قبل ${d}يوم`;
}

export function impactTone(v: number | null): Tone {
  if (v == null) return "quiet";
  if (v >= 25) return "up";
  if (v <= -25) return "down";
  return "neutral";
}