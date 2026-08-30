"use client";

import { useMemo, useState } from "react";
import { useFeatureResearch } from "./hooks/useFeatureResearch";
import {
  Section,
  Tag,
  StatRow,
  Bar,
  Dot,
  Collapse,
  type Tone,
} from "../components/terminal/TradingPrimitives";
import { HORIZON_KEYS } from "./validation/versions";
import { FEATURE_SOURCES } from "./research/integrity";
import type {
  FeatureIntegrity,
  FeatureResearchRun,
  FeatureSplitMetrics,
  ValidationProfileId,
} from "./research/types";

const PROFILE_IDS: ValidationProfileId[] = ["CANDLE_CORE", "CORE_SLOW", "FULL"];

function isoDaysAgo(days: number): string {
  const d = new Date(Date.now() - days * 86_400_000);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

const fmt = (v: number | null | undefined, d = "-"): string =>
  v == null || !isFinite(v) ? d : v.toFixed(1);

const fmtPct = (v: number | null | undefined, d = "-"): string =>
  v == null || !isFinite(v) ? d : `${v.toFixed(1)}%`;

const pctBias = (acc: number | null | undefined): Tone => {
  if (acc == null) return "quiet";
  if (acc >= 55) return "good";
  if (acc >= 51) return "long";
  if (acc <= 45) return "short";
  if (acc <= 49) return "warn";
  return "neutral";
};

const statusTone: Record<string, Tone> = {
  AVAILABLE: "good",
  UNAVAILABLE: "short",
  STALE: "warn",
  MISSING: "warn",
  INVALID: "short",
  LOW_FREQUENCY: "neutral",
};

/** FEATURE RESEARCH dashboard — studies each feature's predictive value. */
export function ValidationFeatureLab() {
  const lab = useFeatureResearch();
  const [from, setFrom] = useState(isoDaysAgo(7));
  const [to, setTo] = useState(isoDaysAgo(0));
  const [profileId, setProfileId] = useState<ValidationProfileId>("CANDLE_CORE");
  const [featureVersion, setFeatureVersion] = useState("v1.0");

  const hasData = lab.result != null;
  const r = lab.result;

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-6" dir="rtl">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-2xs font-semibold uppercase tracking-[0.2em] text-muted">
            Feature Research Lab
          </div>
          <h1 className="text-xl font-bold text-zinc-100">مختبر بحث الخصائص</h1>
          <p className="mt-1 max-w-2xl text-xs text-muted">
            يدرس تاريخياً القيمة التنبؤية لكل خاصية على حدة قبل أن يستهلكها محرك القرار، عبر
            تقسيم قطار/تحقق/عينة خارجية، وبدون تسريب مستقبلي. لا يعدّل أوزان محرك القرار — يقيس فقط.
          </p>
        </div>
        <Tag tone="quiet" ltr>
          v{lab.engineVersion} · {lab.datasetVersion}
        </Tag>
      </header>

      {lab.error ? (
        <div className="rounded-panel border border-down/40 bg-down/10 p-3 text-xs text-down-fg">
          {lab.error}
        </div>
      ) : null}

      {/* Control */}
      <LayerResearchControl
        from={from}
        to={to}
        profileId={profileId}
        featureVersion={featureVersion}
        loading={lab.loading}
        persistence={lab.persistence.status}
        onChange={{ setFrom, setTo, setProfileId, setFeatureVersion }}
        onRun={() =>
          lab.run({
            from: new Date(from).getTime(),
            to: new Date(`${to}T23:59:59`).getTime(),
            profileId,
            featureVersion,
          })
        }
      />

      {hasData && r ? (
        <>
          <LayerDataCoverage r={r} />
          <LayerFeatureStatus r={r} />
          <LayerProfile r={r} />
          <LayerFeaturePerformance r={r} />
          <LayerAblation r={r} />
          <LayerRegime r={r} />
          <LayerHorizonAndConfidence r={r} />
        </>
      ) : (
        <div className="rounded-card border border-dashed border-line p-8 text-center text-sm text-muted">
          حدّد النطاق والملف ثم اضغط «تشغيل بحث الخصائص» لتحميل البيانات ودراسة كل خاصية.
        </div>
      )}

      {/* Historical runs */}
      <Section title="سجلّات الأبحاث" eyebrow="Feature Research Runs">
        {lab.runs.length === 0 ? (
          <p className="text-xs text-muted">لا توجد سجلّات بعد.</p>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {lab.runs.map((run) => (
              <button
                key={run.runId}
                onClick={() => lab.selectRun(run.runId)}
                className="rounded-panel border border-line bg-surface-1/40 px-4 py-3 text-left hover:border-surface-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-2xs font-bold text-zinc-200 ltr">{run.runId}</span>
                  <Tag tone={run.bestOosEdge60Pp != null && run.bestOosEdge60Pp > 0 ? "good" : "warn"} ltr>
                    {fmt(run.bestOosEdge60Pp)} إيدج
                  </Tag>
                </div>
                <div className="mt-1 text-2xs text-muted">
                  {run.profileId} · {run.engineVersion} · {run.featureVersion} · {run.availableCount} متاح /{" "}
                  {run.unavailableCount} غير متاح · {new Date(run.createdAt).toLocaleString()}
                </div>
              </button>
            ))}
          </div>
        )}
        {lab.selected ? (
          <Collapse summary={`عرض مقارنة الإصدارات — ${lab.selected.runId}`}>
            <VersionComparison r={lab.selected} />
          </Collapse>
        ) : null}
      </Section>
    </div>
  );
}

function LayerResearchControl(props: {
  from: string;
  to: string;
  profileId: ValidationProfileId;
  featureVersion: string;
  loading: boolean;
  persistence: "idle" | "saving" | "saved" | "error";
  onChange: {
    setFrom: (v: string) => void;
    setTo: (v: string) => void;
    setProfileId: (v: ValidationProfileId) => void;
    setFeatureVersion: (v: string) => void;
  };
  onRun: () => void;
}) {
  const busy = props.loading || props.persistence === "saving";
  return (
    <Section title="إعدادات البحث" eyebrow="Control">
      <div className="grid gap-3 md:grid-cols-5">
        <label className="block">
          <span className="text-[10px] text-zinc-500">من</span>
          <input
            type="date"
            dir="ltr"
            value={props.from}
            onChange={(e) => props.onChange.setFrom(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200"
          />
        </label>
        <label className="block">
          <span className="text-[10px] text-zinc-500">إلى</span>
          <input
            type="date"
            dir="ltr"
            value={props.to}
            onChange={(e) => props.onChange.setTo(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200"
          />
        </label>
        <label className="block">
          <span className="text-[10px] text-zinc-500">ملف التحقق</span>
          <select
            value={props.profileId}
            onChange={(e) => props.onChange.setProfileId(e.target.value as ValidationProfileId)}
            className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200"
          >
            {PROFILE_IDS.map((p) => (
              <option key={p} value={p}>
                {p.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-[10px] text-zinc-500">إصدار الخصائص</span>
          <input
            dir="ltr"
            value={props.featureVersion}
            onChange={(e) => props.onChange.setFeatureVersion(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200"
          />
        </label>
        <div className="flex items-end">
          <button
            onClick={props.onRun}
            disabled={busy}
            className="w-full rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs font-bold text-amber-300 hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? (
              props.persistence === "saving"
                ? "جارٍ الحفظ…"
                : "جارٍ البحث…"
            ) : props.persistence === "saved"
            ? "✓ تم — تشغيل مجدّد"
            : "تشغيل بحث الخصائص"}
          </button>
        </div>
      </div>
    </Section>
  );
}

/* Layer 1 — DATA COVERAGE */
function LayerDataCoverage({ r }: { r: FeatureResearchRun }) {
  const sources = Object.values(r.integrity.sources);
  return (
    <Section title="تغطية البيانات" eyebrow="Data Coverage">
      <div className="mb-3 flex flex-wrap gap-2">
        {Object.entries(r.integrity.statusCounts).map(([k, n]) => (
          <Tag key={k} tone={statusTone[k] ?? "quiet"}>
            {k}: {n}
          </Tag>
        ))}
        <Tag tone={r.integrity.ok ? "good" : "warn"}>{r.integrity.ok ? "تكامل سليم" : "عجز في التكامل"}</Tag>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-right text-[11px]">
          <thead>
            <tr className="text-[9px] uppercase tracking-wider text-zinc-500">
              <th className="py-1 pr-2">المصدر</th>
              <th>الحالة</th>
              <th>عينات</th>
              <th>التغطية</th>
              <th>مزامنة</th>
              <th>السبب</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((s) => (
              <tr key={s.source} className="border-t border-zinc-800/60">
                <td className="py-1.5 pr-2 font-mono ltr text-zinc-300">{s.source}</td>
                <td>
                  <Tag tone={s.available ? "good" : "short"}>{s.available ? "متاح" : "غير متاح"}</Tag>
                </td>
                <td className="font-mono ltr">{s.samples}/{s.total}</td>
                <td className="pr-3"><Bar pct={s.coverage * 100} tone={s.available ? "good" : "quiet"} className="w-24" /></td>
                <td className="font-mono ltr text-zinc-400">{s.timeAligned ? "نعم" : "لا"}</td>
                <td className="text-zinc-500">{s.reason === "none" ? "—" : s.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

/* Layer 2 — FEATURE STATUS */
function LayerFeatureStatus({ r }: { r: FeatureResearchRun }) {
  const feats = Object.values(r.integrity.features) as FeatureIntegrity[];
  return (
    <Section title="حالة الخصائص" eyebrow="Feature Status">
      <div className="overflow-x-auto">
        <table className="w-full text-right text-[11px]">
          <thead>
            <tr className="text-[9px] uppercase tracking-wider text-zinc-500">
              <th className="py-1 pr-2">الخاصية</th>
              <th>الحالة</th>
              <th>المصدر</th>
              <th>العينات</th>
              <th>التغطية</th>
              <th>السبب/ملاحظة</th>
            </tr>
          </thead>
          <tbody>
            {feats.map((f) => (
              <tr key={f.key} className="border-t border-zinc-800/60">
                <td className="py-1.5 pr-2">
                  <span className="font-bold text-zinc-200">{f.label}</span>
                  <span className="ml-1 font-mono text-[9px] text-zinc-500 ltr">{f.key}</span>
                </td>
                <td><Tag tone={statusTone[f.status] ?? "quiet"}>{f.status}</Tag></td>
                <td className="font-mono text-[9px] text-zinc-400 ltr">{f.source}</td>
                <td className="font-mono ltr text-zinc-400">{f.sampleCount}/{f.total}</td>
                <td className="pr-3"><Bar pct={f.coverage * 100} tone={f.available ? "good" : "quiet"} className="w-24" /></td>
                <td className="text-zinc-500">
                  {f.status === "UNAVAILABLE" ? (
                    <Tag tone="short">غير متاح — لم يُختبر</Tag>
                  ) : f.reason !== "none" ? (
                    <span className="text-amber-400">{f.reason}</span>
                  ) : (
                    <span className="text-emerald-400">جاهز</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

/* Layer 3 — VALIDATION PROFILE */
function LayerProfile({ r }: { r: FeatureResearchRun }) {
  const p = r.profile;
  return (
    <Section title="ملف التحقق" eyebrow="Validation Profile">
      <div className="flex flex-wrap items-center gap-2">
        <Tag tone="long">{p.id.replace(/_/g, " ")}</Tag>
        <Tag tone={p.clean ? "good" : "warn"}>{p.clean ? "ملف نظيف" : "يحتوي استثناءات"}</Tag>
        <span className="text-[11px] text-zinc-400">{p.description}</span>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <div>
          <div className="mb-1 text-[10px] text-zinc-500">الخصائص المضمنة ({p.features.length})</div>
          <div className="flex flex-wrap gap-1.5">
            {p.features.map((k) => (
              <Tag key={k} tone="good">{FEATURE_SOURCES[k]?.label ?? k}</Tag>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1 text-[10px] text-zinc-500">المستثناة ({Object.keys(p.excluded).length})</div>
          {Object.keys(p.excluded).length === 0 ? (
            <span className="text-[11px] text-zinc-600">لا يوجد</span>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(p.excluded).map(([k, reason]) => (
                <Tag key={k} tone="short">
                  {FEATURE_SOURCES[k]?.label ?? k} ← {reason}
                </Tag>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        <StatRow label="أفضل إيدج 60s" value={`${fmt(r.bestOosEdge60Pp)} نقطة`} tone={r.bestOosEdge60Pp != null && r.bestOosEdge60Pp > 0 ? "good" : "warn"} strong />
        <StatRow label="أفضل خاصية 30s" value={r.bestFeaturesHorizon["30s"] ?? "—"} ltr />
        <StatRow label="أفضل خاصية 60s" value={r.bestFeaturesHorizon["60s"] ?? "—"} ltr />
        <StatRow label="أفضل خاصية 120s" value={r.bestFeaturesHorizon["120s"] ?? "—"} ltr />
      </div>
    </Section>
  );
}

/* Layer 4 — FEATURE PERFORMANCE (train/val/oos) */
function LayerFeaturePerformance({ r }: { r: FeatureResearchRun }) {
  const feats = Object.values(r.features);
  return (
    <Section title="أداء الخصائص" eyebrow="Feature Performance">
      <div className="overflow-x-auto">
        <table className="w-full text-right text-[11px]">
          <thead>
            <tr className="text-[9px] uppercase tracking-wider text-zinc-500">
              <th className="py-1 pr-2">الخاصية</th>
              <th>قطار %</th>
              <th>تحقق %</th>
              <th>خارج العينة %</th>
              <th>إيدج 60s</th>
              <th>أفضل أفق</th>
              <th>متوسط MFE</th>
              <th>متوسط MAE</th>
            </tr>
          </thead>
          <tbody>
            {feats.map((fs) => (
              <FeaturePerfRow key={fs.key} fs={fs} />
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function FeaturePerfRow({ fs }: { fs: FeatureSplitMetrics }) {
  const oos = fs.outOfSample;
  const train = fs.train;
  const val = fs.validation;
  const unavailable = !oos && !train && !val;
  if (unavailable) {
    return (
      <tr className="border-t border-zinc-800/60">
        <td className="py-1.5 pr-2">
          <span className="font-bold text-zinc-300">{FEATURE_SOURCES[fs.key]?.label ?? fs.key}</span>
        </td>
        <td colSpan={7}>
          <Tag tone="short">NOT TESTED / UNAVAILABLE</Tag>
          <span className="mr-1 text-[10px] text-zinc-500">لا يوجد مصدر تاريخي حقيقي لهذه الخاصية</span>
        </td>
      </tr>
    );
  }
  return (
    <tr className="border-t border-zinc-800/60">
      <td className="py-1.5 pr-2">
        <span className="font-bold text-zinc-200">{FEATURE_SOURCES[fs.key]?.label ?? fs.key}</span>
      </td>
      <td className="font-mono ltr">{fmtPct(train?.accuracy60)}</td>
      <td className="font-mono ltr">{fmtPct(val?.accuracy60)}</td>
      <td className="font-mono ltr">
        <span className={pctBias(fs.oosAccuracy60) === "good" ? "text-emerald-400" : pctBias(fs.oosAccuracy60) === "short" ? "text-red-400" : "text-zinc-300"}>
          {fmtPct(fs.oosAccuracy60)}
        </span>
      </td>
      <td className="font-mono ltr">
        <Tag tone={fs.oosEdge60Pp != null && fs.oosEdge60Pp > 0 ? "good" : fs.oosEdge60Pp != null ? "short" : "quiet"}>{fmt(fs.oosEdge60Pp)}</Tag>
      </td>
      <td className="font-mono ltr text-zinc-400">{fs.oosHorizonBest ?? "—"}</td>
      <td className="font-mono ltr text-emerald-400">{fmt(oos?.averageMFE)}%</td>
      <td className="font-mono ltr text-red-400">{fmt(oos?.averageMAE)}%</td>
    </tr>
  );
}

/* Layer 5 — ABLATION */
function LayerAblation({ r }: { r: FeatureResearchRun }) {
  const entries = r.ablation.entries;
  const baseline = entries.find((e) => e.label === "ALL");
  return (
    <Section title="نتائج الاستبعاد" eyebrow="Ablation Results">
      <div className="overflow-x-auto">
        <table className="w-full text-right text-[11px]">
          <thead>
            <tr className="text-[9px] uppercase tracking-wider text-zinc-500">
              <th className="py-1 pr-2">المتغير</th>
              <th>دقة 30s</th>
              <th>دقة 60s</th>
              <th>دقة 120s</th>
              <th>إيدج 60s</th>
              <th>Δ مقابل ALL</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.label} className={e.label === "ALL" ? "border-t border-zinc-700 bg-zinc-800/20" : "border-t border-zinc-800/60"}>
                <td className="py-1.5 pr-2 font-bold text-zinc-200 ltr">{e.label}</td>
                <td className="font-mono ltr">{fmtPct(e.accuracy["30s"])}</td>
                <td className="font-mono ltr">{fmtPct(e.accuracy["60s"])}</td>
                <td className="font-mono ltr">{fmtPct(e.accuracy["120s"])}</td>
                <td className="font-mono ltr">{fmt(e.edge60Pp)}</td>
                <td className="font-mono ltr">
                  {e.delta60Pp == null ? "—" : (
                    <span className={e.delta60Pp > 0 ? "text-red-400" : e.delta60Pp < 0 ? "text-emerald-400" : "text-zinc-400"}>
                      {e.delta60Pp > 0 ? "+" : ""}{e.delta60Pp.toFixed(1)}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {baseline?.biggestGain ? (
        <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
          <Tag tone="good">أثمن خاصية (إزالتها أضعف كثيراً): {baseline.biggestGain.feature} ({fmt(baseline.biggestGain.delta60Pp)})</Tag>
          {baseline.biggestLoss ? (
            <Tag tone="short">أكثر خاصية تُضعف عند إزالتها تحسناً: {baseline.biggestLoss.feature} ({fmt(baseline.biggestLoss.delta60Pp)})</Tag>
          ) : null}
        </div>
      ) : null}
      <div className="mt-3">
        <div className="mb-1 text-[10px] text-zinc-500">الاختيار التدريجي (إيدج 60s على مجموعة متزايدة)</div>
        {r.incremental.length > 0 ? (
          <div className="space-y-1">
            {r.incremental.map((s) => (
              <div key={s.step} className="flex items-center gap-3">
                <span className="w-8 text-[10px] text-zinc-500 ltr">#{s.step}</span>
                <span className="w-40 truncate text-[11px] text-zinc-300">{s.label}</span>
                <Bar pct={s.oosEdge60 != null ? 50 + s.oosEdge60 : null} tone={s.oosEdge60 != null && s.oosEdge60 > 0 ? "good" : "warn"} className="max-w-xs flex-1" />
                <span className="font-mono text-[11px] text-zinc-300 ltr">{fmt(s.oosEdge60)}</span>
              </div>
            ))}
          </div>
        ) : (
          <span className="text-[11px] text-zinc-600">لا توجد خصائص مؤهلة — لا بيانات حقيقية.</span>
        )}
      </div>
    </Section>
  );
}

/* Layer 6 — REGIME PERFORMANCE */
function LayerRegime({ r }: { r: FeatureResearchRun }) {
  const regimeMap = useMemo(() => {
    const map: Record<string, { feature: string; samples: number; accuracy: number | null }[]> = {};
    for (const fs of Object.values(r.features)) {
      const oos = fs.outOfSample;
      if (!oos) continue;
      for (const [rg, g] of Object.entries(oos.byRegime)) {
        (map[rg] ??= []).push({ feature: oos.key, samples: g.samples, accuracy: g.accuracy });
      }
    }
    return map;
  }, [r.features]);
  const regimes = Object.keys(regimeMap).sort();
  return (
    <Section title="الأداء حسب النظام السوقي" eyebrow="Regime Performance">
      {regimes.length === 0 ? (
        <p className="text-xs text-zinc-500">لا توجد بيانات نظام سوقي كافية.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {regimes.map((rg) => (
            <div key={rg} className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-bold text-zinc-200">{rg.replace(/_/g, " ")}</span>
              </div>
              <table className="w-full text-right text-[10px]">
                <tbody>
                  {regimeMap[rg].map((row) => (
                    <tr key={row.feature} className="border-t border-zinc-800/40">
                      <td className="py-1 pr-1 text-zinc-400">{FEATURE_SOURCES[row.feature]?.label ?? row.feature}</td>
                      <td className="py-1 font-mono ltr text-zinc-500">{row.samples}</td>
                      <td className="py-1 font-mono ltr">
                        <span className={pctBias(row.accuracy) === "good" ? "text-emerald-400" : pctBias(row.accuracy) === "short" ? "text-red-400" : "text-zinc-300"}>
                          {fmtPct(row.accuracy)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

/* Layer 7 — HORIZON + CONFIDENCE */
function LayerHorizonAndConfidence({ r }: { r: FeatureResearchRun }) {
  const rows = Object.values(r.features).filter((fs) => fs.outOfSample);
  return (
    <Section title="الآفاق ومعايرة الثقة" eyebrow="Horizon & Confidence">
      <div className="mb-3 overflow-x-auto">
        <table className="w-full text-right text-[11px]">
          <thead>
            <tr className="text-[9px] uppercase tracking-wider text-zinc-500">
              <th className="py-1 pr-2">الخاصية</th>
              {HORIZON_KEYS.map((h) => (
                <th key={h} className="font-mono ltr">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((fs) => (
              <tr key={fs.key} className="border-t border-zinc-800/60">
                <td className="py-1.5 pr-2 text-zinc-300">{FEATURE_SOURCES[fs.key]?.label ?? fs.key}</td>
                {HORIZON_KEYS.map((h) => {
                  const m = fs.outOfSample?.horizons[h];
                  const acc = m?.accuracy;
                  return (
                    <td key={h} className="font-mono ltr">
                      <span className={pctBias(acc) === "good" ? "text-emerald-400" : pctBias(acc) === "short" ? "text-red-400" : "text-zinc-300"}>
                        {fmtPct(acc)}
                      </span>
                      <span className="mr-1 text-[9px] text-zinc-500">(n={m?.samples ?? 0})</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3 text-[11px] text-zinc-500">
        <div className="mb-1 flex items-center gap-2">
          <Dot tone="quiet" />
          <span className="font-bold text-zinc-300">معايرة الثقة</span>
        </div>
        <p>
          الثقة (خلايا 90-100 / 80-90 / …) هي مخرَج محرك القرار، وليست خاصية منفردة. لذا تُقاس في
          «مختبر التحقق من قرارات المحرك»، لا هنا. هنا يرصد المستوى التنبؤي لكل خاصية مجردة قبل
          دمجها في محرك القرار.
        </p>
      </div>
    </Section>
  );
}

/* Version comparison (runs against a selected historical run). */
function VersionComparison({ r }: { r: FeatureResearchRun }) {
  const rows = Object.values(r.features);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-right text-[11px]">
        <thead>
          <tr className="text-[9px] uppercase tracking-wider text-zinc-500">
            <th className="py-1 pr-2">الخاصية</th>
            <th>قطار %</th>
            <th>تحقق %</th>
            <th>خارج العينة %</th>
            <th>إيدج 60s</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((fs) => (
            <tr key={fs.key} className="border-t border-zinc-800/60">
              <td className="py-1.5 pr-2 text-zinc-300">{FEATURE_SOURCES[fs.key]?.label ?? fs.key}</td>
              <td className="font-mono ltr">{fmtPct(fs.train?.accuracy60)}</td>
              <td className="font-mono ltr">{fmtPct(fs.validation?.accuracy60)}</td>
              <td className="font-mono ltr">{fmtPct(fs.outOfSample?.accuracy60)}</td>
              <td className="font-mono ltr">{fmt(fs.oosEdge60Pp)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
