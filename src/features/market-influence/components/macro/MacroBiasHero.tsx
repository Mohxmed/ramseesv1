"use client";

import type {
  CrossMarketState,
  DecouplingStatus,
  MacroRegimeLevel,
  MarketInfluenceFactor,
} from "@/features/market-influence/intelligence";
import { Badge, Dot, Progress, Score } from "@/components/ui/index";
import { ArrowDownRightIcon, ArrowUpRightIcon } from "@/components/icons/icons";
import { classMeta } from "../format";
import { REGIME_META } from "./format";

function VixCard({ vix }: { vix: MarketInfluenceFactor | null }) {
  const level = vix?.price;
  const chg = vix?.change24hPct;
  const z = vix?.zScore;
  const volRegime = vix ? volOf(vix) : null;

  return (
    <div className="rounded-card border border-line bg-surface-1/40 p-5">
      <div className="flex items-center justify-between">
        <div className="text-3xs font-semibold uppercase tracking-[0.18em] text-muted">
          مؤشر التقلب VIX
        </div>
        {volRegime ? (
          <Badge tone={volRegime.tone}>{volRegime.label}</Badge>
        ) : null}
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="font-mono text-4xl font-black tabular-nums leading-none text-zinc-100" dir="ltr">
          {level != null && Number.isFinite(level) ? level.toFixed(2) : "—"}
        </span>
        {chg != null ? (
          <span
            className={`flex items-center gap-0.5 font-mono text-sm font-bold tabular-nums ${
              chg >= 0 ? "text-down-fg" : "text-up-fg"
            }`}
            dir="ltr"
          >
            {chg >= 0 ? <ArrowUpRightIcon className="h-3.5 w-3.5" /> : <ArrowDownRightIcon className="h-3.5 w-3.5" />}
            {chg >= 0 ? "+" : ""}
            {chg.toFixed(2)}
          </span>
        ) : null}
      </div>
      <div className="mt-2 text-2xs text-muted">
        {z != null ? (
          <>
            انحراف عن متوسطه:{" "}
            <span className={`font-mono tabular-nums ${z > 0 ? "text-warn-fg" : "text-good"}`} dir="ltr">
              {z >= 0 ? "+" : ""}
              {z.toFixed(2)}z
            </span>
          </>
        ) : (
          "لا قراءة زائدة متاحة"
        )}
      </div>
      <div className="mt-4 space-y-1">
        <div className="flex items-center justify-between text-2xs text-muted">
          <span>التأثير الصافي على BTC</span>
          <span className="font-mono tabular-nums text-zinc-200" dir="ltr">
            {vix?.impactScore != null ? `${vix.impactScore >= 0 ? "+" : ""}${vix.impactScore.toFixed(0)}` : "—"}
          </span>
        </div>
        <Progress
          pct={vix?.impactScore != null ? Math.min(100, Math.abs(vix.impactScore) * 1.4) : 0}
          tone={vix?.impactScore != null && vix.impactScore > 0 ? "good" : vix?.impactScore != null && vix.impactScore < 0 ? "warn" : "neutral"}
        />
      </div>
      <p className="mt-3 text-2xs leading-relaxed text-muted">
        {volHint(volRegime)} ارتفاع VIX يشير إلى نفور من المخاطرة يرفع كلفة الأصول المتقلبة مثل BTC.
      </p>
    </div>
  );
}

function volOf(vix: MarketInfluenceFactor): { label: string; tone: "up" | "down" | "neutral" | "warn" } {
  const z = vix.zScore;
  const m = vix.momentum;
  if (z != null) {
    if (z >= 1) return { label: "مرتفع", tone: "down" };
    if (z >= 0.4) return { label: "متزايد", tone: "warn" };
    if (z <= -0.6) return { label: "منخفض", tone: "up" };
  }
  if (m != null) {
    if (m > 0.4) return { label: "متزايد", tone: "warn" };
    if (m < -0.4) return { label: "منخفض", tone: "up" };
  }
  return { label: "محايد", tone: "neutral" };
}

function volHint(vol: { label: string; tone: string } | null): string {
  if (!vol) return "";
  switch (vol.label) {
    case "مرتفع":
      return "السوق في حالة خوف مرتفع — أسواق المضاربين حساسة جدًا حاليًا.";
    case "متزايد":
      return "التقلب في تصاعد — الحذر على المراكز مطلوب.";
    case "منخفض":
      return "التقلب منخفض — ظروف مواتية نسبيًا للمضاربة.";
    default:
      return "";
  }
}

function BiasCard({
  state,
  decoupling,
}: {
  state: CrossMarketState;
  decoupling: DecouplingStatus | null;
}) {
  const cls = classMeta(state.scoreClass);

  return (
    <div className="rounded-card border border-line bg-surface-1/40 p-5">
      <div className="flex items-center justify-between">
        <div className="text-3xs font-semibold uppercase tracking-[0.18em] text-muted">
          الانحياز الكلي للـ BTC
        </div>
        <Badge tone={cls.tone}>{cls.label}</Badge>
      </div>
      <div className="mt-3 flex items-baseline gap-3">
        <Score value={state.score} tone={cls.tone} size="lg" />
        <div className="flex flex-col">
          <span className="text-xs font-bold text-zinc-200">
            {state.bias === "bullish" ? "صاعد" : state.bias === "bearish" ? "هابط" : "محايد"}
          </span>
          <span className="text-2xs text-muted">
            من {state.supportive + state.pressure} عامل نشط
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Dot tone={decoupling?.decoupled ? "warn" : "good"} pulse={!!decoupling?.decoupled} />
          <span className="text-2xs text-zinc-300">
            {decoupling?.decoupled
              ? "فك ارتباط BTC عن الأسهم قيد الرصد"
              : decoupling
              ? "مرتبط بالأسهم (عامل بيتا مرتفع)"
              : "لا بيانات ارتباط كافية"}
          </span>
        </div>
      </div>

      <div className="mt-4 space-y-2 border-t border-line/70 pt-3">
        <div className="flex items-center justify-between text-2xs">
          <span className="text-muted">المحاذاة</span>
          <span className="font-mono tabular-nums text-zinc-200" dir="ltr">
            {Math.round(state.alignment * 100)}%
          </span>
        </div>
        <div className="flex items-center justify-between text-2xs">
          <span className="text-muted">الثقة</span>
          <span className="font-mono tabular-nums text-zinc-200" dir="ltr">
            {Math.round(state.confidence * 100)}%
          </span>
        </div>
        <div className="flex items-center justify-between text-2xs">
          <span className="text-muted">التغطية</span>
          <span className="font-mono tabular-nums text-zinc-200" dir="ltr">
            {Math.round(state.coverage * 100)}%
          </span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {state.strongestSupport ? (
          <Badge tone="up">
            دعم: {state.strongestSupport.nameAr}{" "}
            <span className="font-mono tabular-nums" dir="ltr">
              +{state.strongestSupport.impact.toFixed(0)}
            </span>
          </Badge>
        ) : null}
        {state.strongestPressure ? (
          <Badge tone="down">
            ضغط: {state.strongestPressure.nameAr}{" "}
            <span className="font-mono tabular-nums" dir="ltr">
              {state.strongestPressure.impact.toFixed(0)}
            </span>
          </Badge>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Spec #2 — prominent VIX + BTC macro bias block at the top of the page.
 */
export function MacroBiasHero({
  state,
  vix,
  decoupling,
  regimeLevel,
}: {
  state: CrossMarketState;
  vix: MarketInfluenceFactor | null;
  decoupling: DecouplingStatus | null;
  regimeLevel: MacroRegimeLevel;
}) {
  const meta = REGIME_META[regimeLevel];
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <VixCard vix={vix} />
      <BiasCard state={state} decoupling={decoupling} />
      <div className="rounded-card border border-line bg-surface-1/40 p-5">
        <div className="text-3xs font-semibold uppercase tracking-[0.18em] text-muted">
          الحالة الكبرى للسوق
        </div>
        <div className="mt-3 text-2xl font-black text-zinc-100">{meta.label}</div>
        <Badge tone={meta.tone} className="mt-1">
          {meta.short}
        </Badge>
        <div className="mt-4 flex items-center gap-1.5">
          {(
            ["STRONG_RISK_ON", "RISK_ON", "NEUTRAL", "RISK_OFF", "STRONG_RISK_OFF"] as const
          ).map((lvl) => (
            <div key={lvl} className="flex-1">
              <div
                className={
                  lvl === regimeLevel
                    ? "h-1.5 rounded-full bg-zinc-100"
                    : "h-1.5 rounded-full bg-line"
                }
              />
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-2xs text-muted">
          <span>إقبال</span>
          <span>نفور</span>
        </div>
        <p className="mt-4 text-2xs leading-relaxed text-muted">
          قراءة مركّبة من الأسهم، الدولار، العوائد، التقلب والسيولة. درجة فوق 25
          تعني سيولة ترتد للأصول الخطرة، وتحت 25− تعني سيولة تنسحب نحو الملاذات.
        </p>
      </div>
    </div>
  );
}