"use client";

import type { ScalpDataHealth, ScalpDecisionView, ScalpingFeature } from "../../types";
import type { FuturesState } from "../../../bitcoin/futures/types";
import { Section, Tag, Dot } from "./TradingPrimitives";
import { classifyFreshness, FRESHNESS_META, formatAge } from "../freshness";

type Doctors = "ONLINE" | "DEGRADED" | "OFFLINE" | "STARTING";

function derive(health: ScalpDataHealth): { code: Doctors; label: string; tone: "good" | "warn" | "short" | "neutral" } {
  switch (health.status) {
    case "ready":
      return { code: "ONLINE", label: "متصل", tone: "good" };
    case "stale":
      return { code: "DEGRADED", label: "متأخر", tone: "warn" };
    case "disconnected":
      return { code: "DEGRADED", label: "غير متصل", tone: "warn" };
    case "error":
      return { code: "OFFLINE", label: "خطأ", tone: "short" };
    default:
      return { code: "STARTING", label: "جارٍ التشغيل", tone: "neutral" };
  }
}

function SourceRow({ name, ageMs }: { name: string; ageMs: number | null | undefined }) {
  const fresh = classifyFreshness(ageMs);
  const meta = FRESHNESS_META[fresh];
  const toneM: "good" | "warn" | "neutral" = fresh === "LIVE" ? "good" : fresh === "STALE" ? "warn" : "neutral";
  return (
    <div className="flex items-center justify-between rounded-panel border border-line bg-surface-2/40 px-2.5 py-1.5">
      <span className="text-2xs text-zinc-300">{name}</span>
      <span className="flex items-center gap-2">
        <Tag tone={toneM}>
          <Dot tone={toneM} />
          {meta.label}
        </Tag>
        <span className="font-mono text-2xs tabular-nums text-muted" dir="ltr">
          {formatAge(ageMs)}
        </span>
      </span>
    </div>
  );
}

export function SystemStatus({
  health,
  decision,
  features,
  futuresFeed,
  futuresState,
}: {
  health: ScalpDataHealth;
  decision?: ScalpDecisionView | null;
  features?: ScalpingFeature[];
  futuresFeed?: { live: boolean; stale: boolean; latency: number | null } | null;
  futuresState?: FuturesState | null;
}) {
  const s = derive(health);
  const spotAge = decision?.marketState?.health?.priceAgeMs ?? null;

  const familyFresh = (keys: string[]): number | null => {
    const ages = (features ?? [])
      .filter((f) => keys.includes(f.key) && f.freshnessMs != null)
      .map((f) => f.freshnessMs as number);
    return ages.length ? Math.min(...ages) : null;
  };

  const flowAge = familyFresh(["aggressive-flow", "volume-delta", "micro-momentum"]);
  const bookAge = familyFresh(["book-imbalance"]);
  const derivativesAge = familyFresh(["oi-positioning", "funding-futures", "liquidation-flow"]);
  const structureAge = familyFresh(["sr-distance", "market-regime"]);
  const futuresAge = futuresState?.freshnessMs ?? null;

  return (
    <Section
      title="حالة النظام"
      eyebrow="08 · System"
      actions={
        <Tag tone={s.tone}>
          <Dot tone={s.tone} pulse={s.code === "ONLINE"} />
          {s.code}
        </Tag>
      }
    >
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <SourceRow name="السعر الفوري" ageMs={spotAge} />
        <SourceRow name="التدفق / الحجم" ageMs={flowAge} />
        <SourceRow name="دفتر الأوامر" ageMs={bookAge} />
        <SourceRow name="المشتقات / المراكز" ageMs={derivativesAge} />
        <SourceRow name="الهيكل / النظام" ageMs={structureAge} />
        <SourceRow
          name="العقود الآجلة"
          ageMs={futuresFeed?.stale ? 200_000 : futuresAge}
        />
      </div>

      {s.code !== "ONLINE" && (
        <div
          className={`mt-3 rounded-panel border px-3 py-2 text-2xs leading-relaxed ${
            s.code === "OFFLINE" ? "border-down/40 bg-down/10 text-down-fg" : "border-warn/40 bg-warn/10 text-warn-fg"
          }`}
        >
          {s.code === "OFFLINE"
            ? "خطأ في مصادر البيانات — تعذّر تحديث بيانات السوق."
            : s.code === "DEGRADED"
            ? "البيانات متأخرة أو غير متصلة — لا تُنتج إشارة جديدة الآن (لا عرض ثقة زائفة). عند استعادة الاتصال تُستأنف الإشارات تلقائياً."
            : "جارٍ تجهيز مصادر البيانات المباشرة…"}
        </div>
      )}
    </Section>
  );
}
