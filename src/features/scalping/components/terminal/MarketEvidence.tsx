"use client";

import type { ScalpingFeature } from "../../types";
import { Section, Tag, Collapse, Dot, TONE_BAR, TONE_TEXT } from "./TradingPrimitives";

type CategoryKey =
  | "price"
  | "liquidity"
  | "flow"
  | "volatility"
  | "derivatives"
  | "liquidation"
  | "structure"
  | "regime";

const CATEGORIES: { key: CategoryKey; label: string; members: string[] }[] = [
  { key: "price", label: "السعر والزخم", members: ["micro-momentum"] },
  { key: "liquidity", label: "السيولة / دفتر الأوامر", members: ["book-imbalance"] },
  { key: "flow", label: "تدفق الأوامر", members: ["aggressive-flow", "volume-delta"] },
  { key: "volatility", label: "التقلب", members: ["short-volatility"] },
  { key: "derivatives", label: "المشتقات / المراكز", members: ["oi-positioning", "funding-futures"] },
  { key: "liquidation", label: "التصفية", members: ["liquidation-flow"] },
  { key: "structure", label: "الهيكل / المستويات", members: ["sr-distance"] },
  { key: "regime", label: "النظام", members: ["market-regime"] },
];

function byKey(features: ScalpingFeature[], key: string): ScalpingFeature | undefined {
  return features.find((f) => f.key === key);
}

export function MarketEvidence({ features }: { features: ScalpingFeature[] }) {
  return (
    <Section
      title="الأدلّة حسب التصنيف"
      eyebrow="06 · Evidence"
      actions={
        <span className="text-2xs text-muted">
          مساهمة كل صنف من محرّك الميزّات الفعلي
        </span>
      }
    >
      <div className="space-y-2">
        {CATEGORIES.map((cat) => {
          const members = cat.members
            .map((k) => byKey(features, k))
            .filter((f): f is ScalpingFeature => Boolean(f && f.normalized != null && f.score > 0));

          if (members.length === 0) {
            return (
              <div
                key={cat.key}
                className="flex items-center justify-between rounded-panel border border-line bg-surface-2/40 px-3 py-2"
              >
                <span className="text-2xs text-muted">{cat.label}</span>
                <span className="text-2xs text-muted">لا قراءة كافية</span>
              </div>
            );
          }

          const dirTone: "long" | "short" | "neutral" = members.some((f) => f.direction === "bullish")
            ? "long"
            : members.some((f) => f.direction === "bearish")
            ? "short"
            : "neutral";
          const maxScore = Math.max(...members.map((f) => f.score));

          return (
            <Collapse
              key={cat.key}
              summary={
                <span className="flex w-full items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <Dot tone={dirTone} />
                    {cat.label}
                  </span>
                  <span className="flex items-center gap-2">
                    <Tag tone={dirTone}>
                      {dirTone === "long" ? "يدعم الشراء" : dirTone === "short" ? "يدعم البيع" : "محايد"}
                    </Tag>
                    <span className="font-mono text-2xs tabular-nums text-muted" dir="ltr">
                      {maxScore.toFixed(0)}
                    </span>
                  </span>
                </span>
              }
            >
              <div className="space-y-2 pt-1">
                {cat.members.map((k) => {
                  const f = byKey(features, k);
                  if (!f) return null;
                  const tone: "long" | "short" | "neutral" =
                    f.direction === "bullish" ? "long" : f.direction === "bearish" ? "short" : "neutral";
                  return (
                    <div key={k} className="rounded-panel border border-line bg-surface-2/40 px-2.5 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-2xs font-semibold text-zinc-200">{f.label}</span>
                        <span className={`font-mono text-2xs tabular-nums ${TONE_TEXT[tone]}`} dir="ltr">
                          {tone === "long" ? "صاعد" : tone === "short" ? "هابط" : "محايد"} · سكور {f.score}
                        </span>
                      </div>
                      <div className="mt-1.5">
                        <div
                          className={`h-1 w-full overflow-hidden rounded-full bg-line ${TONE_BAR[tone]}`}
                          style={{ opacity: 1 }}
                        >
                          <div
                            className={`h-full rounded-full ${TONE_BAR[tone]}`}
                            style={{ width: `${f.score}%` }}
                          />
                        </div>
                      </div>
                      <div className="mt-1.5 text-2xs leading-relaxed text-muted">{f.description}</div>
                    </div>
                  );
                })}
              </div>
            </Collapse>
          );
        })}
      </div>

      <p className="mt-3 text-2xs leading-relaxed text-muted">
        تصنيف العرض فقط: المصطلحات والقيم كلها من محرّك الميزّات ({features.length} متغيراً). كل
        صنف يبني القراءة من نفس المصدر، فلا قيمة تُعرض مرتين في مواضع مختلفة.
      </p>
    </Section>
  );
}
