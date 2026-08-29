"use client";

import type { ScalpingFeature, ScalpDecisionView } from "../types";
import type { FuturesState } from "../../bitcoin/futures/types";
import type { FuturesFeedView } from "./FuturesStatePanel";
import { classifyFreshness, FRESHNESS_META, formatAge } from "./freshness";

function SourceRow({
  icon,
  name,
  ageMs,
  hint,
}: {
  icon: string;
  name: string;
  ageMs: number | null | undefined;
  hint?: string;
}) {
  const fresh = classifyFreshness(ageMs);
  const meta = FRESHNESS_META[fresh];
  return (
    <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/40 px-2.5 py-1.5">
      <span className="text-xs">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[11px] font-semibold text-zinc-200">{name}</div>
        {hint ? <div className="truncate text-[9px] text-zinc-600">{hint}</div> : null}
      </div>
      <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-bold ${meta.chip}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
        {meta.label}
      </span>
      <span className="font-mono text-[9px] text-zinc-500" dir="ltr">
        {formatAge(ageMs)}
      </span>
    </div>
  );
}

export function DataQualityStrip({
  features,
  decision,
  futuresFeed,
  futuresState,
}: {
  features: ScalpingFeature[];
  decision?: ScalpDecisionView | null;
  futuresFeed?: FuturesFeedView | null;
  futuresState?: FuturesState | null;
}) {
  // Representative freshness per source family: the freshest feature in each.
  const familyFresh = (keys: string[]): number | null => {
    const ages = features
      .filter((f) => keys.includes(f.key) && f.freshnessMs != null)
      .map((f) => f.freshnessMs as number);
    return ages.length ? Math.min(...ages) : null;
  };

  const spotAge = decision?.marketState?.health?.priceAgeMs ?? null;
  const flowAge = familyFresh(["aggressive-flow", "volume-delta", "micro-momentum"]);
  const bookAge = familyFresh(["book-imbalance", "spread"]);
  const structureAge = familyFresh(["sr-distance", "trend-strength", "futures-oi-momentum"]);
  const futuresAge = futuresState?.freshnessMs ?? null;

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-bold text-zinc-200">جودة البيانات (لحظي)</h2>
        <span className="text-[10px] text-zinc-500">
          عمر المصدر الحقيقي — قديم لا يُعرض كحاضر أبدًا
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <SourceRow icon="◇" name="السعر الفوري" ageMs={spotAge} hint="التيك اللحظي" />
        <SourceRow icon="⇄" name="التدفق/الحجم" ageMs={flowAge} hint="حجم/تيك aggressor" />
        <SourceRow icon="▦" name="دفتر الأوامر" ageMs={bookAge} hint="عمق + سبريد" />
        <SourceRow icon="∿" name="البنيان/الهيكل" ageMs={structureAge} hint="مستويات/اتجاه/عقود" />
        <SourceRow icon="⌁" name="العقود الآجلة" ageMs={futuresAge} hint={futuresFeed?.latency != null ? `زمن الرحلة ${futuresFeed.latency}ms` : "التغذية اللحظية"} />
        <SourceRow icon="⚙" name="التغذية WS" ageMs={futuresFeed?.live ? 0 : futuresFeed?.stale ? FRESHEST_STALE_MS : null} hint="المحفظة اللحظية" />
      </div>
    </div>
  );
}

const FRESHEST_STALE_MS = 200_000;
