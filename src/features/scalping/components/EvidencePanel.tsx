"use client";

import type { ScalpingFeature, ScalpingSignal } from "../types";
import { classifyFreshness, FRESHNESS_META, formatAge } from "./freshness";

function DriverRow({ f }: { f: ScalpingFeature }) {
  const fresh = classifyFreshness(f.freshnessMs);
  const meta = FRESHNESS_META[fresh];
  const dirCls = f.direction === "bullish" ? "text-emerald-400" : f.direction === "bearish" ? "text-red-400" : "text-zinc-500";
  const barCls = f.direction === "bullish" ? "bg-emerald-500" : f.direction === "bearish" ? "bg-red-500" : "bg-zinc-600";
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[11px] font-semibold text-zinc-200">{f.label}</span>
        <span className={`rounded border px-1.5 py-0.5 text-[9px] font-bold ${meta.chip}`}>
          {meta.label} · {formatAge(f.freshnessMs)}
        </span>
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <span className={`text-[11px] font-bold ${dirCls}`}>
          {f.direction === "bullish" ? "يدعم الشراء" : f.direction === "bearish" ? "يدعم البيع" : "محايد"}
        </span>
        <span className="font-mono text-[10px] text-zinc-400" dir="ltr">
          سكور {f.score} · ثقة {f.confidence}%
        </span>
      </div>
      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-zinc-800">
        <div className={`h-full rounded-full ${barCls}`} style={{ width: `${f.score}%` }} />
      </div>
      <div className="mt-1 truncate text-[9px] text-zinc-600" title={f.description}>{f.description}</div>
    </div>
  );
}

function DriverBlock({
  title,
  tone,
  features,
  empty,
}: {
  title: string;
  tone: "bullish" | "bearish";
  features: ScalpingFeature[];
  empty: string;
}) {
  const list = features
    .filter((f) => f.direction === tone && f.normalized != null && f.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  return (
    <div>
      <div className={`mb-2 text-[10px] font-bold ${tone === "bullish" ? "text-emerald-300" : "text-red-300"}`}>
        {title}
      </div>
      {list.length ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {list.map((f) => (
            <DriverRow key={f.key} f={f} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3 text-center text-[10px] text-zinc-600">
          {empty}
        </div>
      )}
    </div>
  );
}

/** Why the composite points the way it does — real feature contributions. */
export function EvidencePanel({
  features,
  signal,
}: {
  features: ScalpingFeature[];
  signal?: ScalpingSignal | null;
}) {
  const warnings = signal?.warnings ?? [];
  const invalidation = signal?.invalidation ?? [];
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold text-zinc-100">الأدلّة — لماذا يشير المجمّع بهذا الاتجاه؟</h2>
        <span className="text-[10px] text-zinc-500">
          مساهمة كل متغير من محرّك الميزّات الفعلي (ليست قيمًا معروضة بشكل منفصل)
        </span>
      </div>

      <div className="space-y-4">
        <DriverBlock title="تدعم الشراء (LONG)" tone="bullish" features={features} empty="لا متغيرات تدعم الشراء حاليًا" />
        <DriverBlock title="تدعم البيع (SHORT)" tone="bearish" features={features} empty="لا متغيرات تدعم البيع حاليًا" />
      </div>

      {(warnings.length > 0 || invalidation.length > 0) && (
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {warnings.length > 0 && (
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3">
              <div className="mb-1 text-[10px] font-bold text-amber-300">تحذيرات</div>
              <ul className="space-y-1">
                {warnings.map((w, i) => (
                  <li key={i} className="text-[10px] leading-relaxed text-amber-200/90">▲ {w}</li>
                ))}
              </ul>
            </div>
          )}
          {invalidation.length > 0 && (
            <div className="rounded-xl border border-red-500/25 bg-red-500/5 p-3">
              <div className="mb-1 text-[10px] font-bold text-red-300">شروط الإبطال</div>
              <ul className="space-y-1">
                {invalidation.map((w, i) => (
                  <li key={i} className="text-[10px] leading-relaxed text-red-200/90">✕ {w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
