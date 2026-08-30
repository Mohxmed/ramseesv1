"use client";

import { useState } from "react";
import { useValidationLab } from "./hooks/useValidationLab";
import {
  Section,
  Tag,
  StatRow,
  Bar,
  Dot,
  Collapse,
  type Tone,
} from "../components/terminal/TradingPrimitives";
import type {
  DecisionSnapshot,
  EngineRunOutput,
  ValidationDecisionRecord,
  ValidationMetrics,
  ValidationRun,
} from "./types";
import { HORIZON_KEYS, CONFIDENCE_RANGES } from "./validation/versions";
import { REGIME_LABELS } from "../regime";
import { ValidationDashboard } from "./ValidationDashboard";

/** 7-layer Decision Validation Lab — premium dark-minimal, no wallet. */
export function ValidationLab() {
  const lab = useValidationLab();

  const [from, setFrom] = useState(isoDaysAgo(3));
  const [to, setTo] = useState(isoDaysAgo(0));
  const [minConfidence, setMinConfidence] = useState(60);

  const hasData = lab.candles.length > 0;
  const metrics = lab.validation?.metrics ?? null;

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-6" dir="rtl">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-2xs font-semibold uppercase tracking-[0.2em] text-muted">
            Scalping Decision Validation Lab
          </div>
          <h1 className="text-xl font-bold text-zinc-100">
            مختبر التحقق من قرارات المحرك
          </h1>
          <p className="mt-1 max-w-2xl text-xs text-muted">
            يختبر هل يتنبأ محرك القرار باتجاه BTC على بيانات تاريخية 1m، وعبر أي أفق
            (30/60/120 ثانية)، ومتى يكون أدق، وهل الثقة معايرة، وفي أي نظام سوقي يفشل.
            يكرر نفس الوظائف النقية للمحرك المباشر دون محفظة أو مواقف أو أرباح.
          </p>
        </div>
        <Tag tone="quiet" ltr>
          v{lab.engineVersion} · {hasData ? `${lab.decisions.length} قرار` : "بدون تشغيل"}
        </Tag>
      </header>

      {lab.error ? (
        <div className="rounded-panel border border-down/40 bg-down/10 p-3 text-xs text-down-fg">
          {lab.error}
        </div>
      ) : null}

      {/* Layer 1 — Control */}
      <LayerControl
        from={from}
        to={to}
        minConfidence={minConfidence}
        lab={lab}
        onChange={{ setFrom, setTo, setMinConfidence }}
      />

      {/* Layer 2 — Replay transport */}
      <LayerReplay lab={lab} />

      {hasData ? (
        <>
          {/* Layer 3 — Engine decision + feature snapshot */}
          <LayerEngineDecision latest={lab.latest} />

          {/* Layer 4 — Decision evaluation per horizon */}
          <LayerEvaluation records={lab.validation?.records ?? null} />

          {/* Layer 6 — Decision journal */}
          <LayerJournal decisions={lab.decisions} />

          {/* Layer 7 — Decision performance */}
          <LayerPerformance metrics={metrics} run={lab.validation?.run ?? null} />

          {/* Calibration + Regime */}
          <LayerCalibration metrics={metrics} />
          <LayerRegime metrics={metrics} />

          <div className="rounded-panel border border-line bg-surface-2/40 px-4 py-3 text-2xs text-muted">
            <div className="mb-2 flex items-center gap-2">
              <Dot tone={lab.replay === "finished" ? "good" : "warn"} pulse={lab.replay === "playing"} />
              <span className="font-bold text-zinc-200">إنهاء وتجميع التحقق</span>
            </div>
            <p className="mb-2">
              على اكتمال التشغيل، إن قرّرت الحفظ تُقيَّم القرارات على السلسلة الكاملة عبر
              آفاق 30/60/120 ثانية وتُحفظ كسجلّ غير قابل للتعديل.
            </p>
            <button
              onClick={() => lab.finalize()}
              disabled={!hasData || lab.decisions.length === 0 || lab.runPersistence.status === "saving"}
              className="rounded-panel border border-warn/40 bg-warn/10 px-4 py-2 text-xs font-bold text-warn-fg hover:bg-warn/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {lab.runPersistence.status === "saved"
                ? "تم الحفظ ✓ (سجلّ جديد)"
                : lab.runPersistence.status === "saving"
                ? "جارٍ الحفظ…"
                : "إنهاء وحفظ سجلّ التحقق"}
            </button>
          </div>
        </>
      ) : (
        <div className="rounded-card border border-dashed border-line p-8 text-center text-sm text-muted">
          حدّد النطاق الزمني ثم اضغط «بدء تشغيل جديد» لتحميل البيانات وتشغيل محرك القرار.
        </div>
      )}

      {/* Layer 9 — Validation history & comparison */}
      <ValidationDashboard
        currentRunId={lab.runId}
        engineVersion={lab.engineVersion}
        strategyVersion={lab.strategyVersion}
      />
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Layer 1 · Control                                                       */
/* ---------------------------------------------------------------------- */

function LayerControl({
  from,
  to,
  minConfidence,
  lab,
  onChange,
}: {
  from: string;
  to: string;
  minConfidence: number;
  lab: ReturnType<typeof useValidationLab>;
  onChange: { setFrom: (v: string) => void; setTo: (v: string) => void; setMinConfidence: (v: number) => void };
}) {
  return (
    <Section title="إعداد التجربة" eyebrow="Layer 1 · Control">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-2xs text-muted">من</span>
              <input
                type="date"
                value={from}
                onChange={(e) => onChange.setFrom(e.target.value)}
                className="mt-1 w-full rounded-panel border border-line bg-surface-2 px-3 py-2 text-xs text-zinc-200 ltr"
                dir="ltr"
              />
            </label>
            <label className="block">
              <span className="text-2xs text-muted">إلى</span>
              <input
                type="date"
                value={to}
                onChange={(e) => onChange.setTo(e.target.value)}
                className="mt-1 w-full rounded-panel border border-line bg-surface-2 px-3 py-2 text-xs text-zinc-200 ltr"
                dir="ltr"
              />
            </label>
          </div>
          <div className="grid grid-cols-1 gap-3">
            <label className="block">
              <span className="text-2xs text-muted">حدّ أدنى للثقة لتسجيل قرار اتجاهي</span>
              <input
                type="number"
                min={0}
                max={100}
                value={minConfidence}
                onChange={(e) => onChange.setMinConfidence(parseInt(e.target.value) || 0)}
                className="mt-1 w-full rounded-panel border border-line bg-surface-2 px-3 py-2 text-xs text-zinc-200 ltr"
                dir="ltr"
              />
            </label>
            <div className="text-2xs text-muted">
              كل قرار LONG/SHORT يعدّ حالة اختبار مستقلة؛ NEUTRAL يُسجَّل لكنه لا يُعدّ تداولاً.
            </div>
          </div>
        </div>
        <div className="flex flex-col justify-end gap-3">
          <div className="text-2xs text-muted">
            إصدار المحرك: <span className="font-mono text-zinc-300">{lab.engineVersion}</span>
            <span className="mx-2">·</span>
            الاستراتيجية: <span className="font-mono text-zinc-300">{lab.strategyVersion}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() =>
                lab.start({ from: parseStart(from), to: parseEnd(to), minConfidence })
              }
              disabled={lab.loading || !from || !to}
              className="rounded-panel bg-up px-4 py-2 text-xs font-bold text-zinc-950 hover:bg-up/80 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {lab.loading ? "جارٍ التحميل…" : "بدء تشغيل جديد"}
            </button>
            <button
              onClick={() => lab.reset()}
              disabled={!lab.candles.length}
              className="rounded-panel border border-line px-4 py-2 text-xs font-bold text-zinc-300 hover:border-surface-3 disabled:opacity-40"
            >
              إعادة تعيين
            </button>
          </div>
        </div>
      </div>
    </Section>
  );
}

/* ---------------------------------------------------------------------- */
/* Layer 2 · Replay transport                                              */
/* ---------------------------------------------------------------------- */

const REPLAY_LABELS: Record<string, string> = {
  idle: "جاهز",
  playing: "قيد التشغيل",
  paused: "متوقّف",
  finished: "انتهى",
};

function LayerReplay({ lab }: { lab: ReturnType<typeof useValidationLab> }) {
  return (
    <Section
      title="التشغيل المتزامن"
      eyebrow="Layer 2 · Transport"
      actions={<Tag tone={lab.replay === "playing" ? "good" : "neutral"} ltr>{REPLAY_LABELS[lab.replay]}</Tag>}
    >
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => (lab.replay === "playing" ? lab.pause() : lab.play())} disabled={!lab.candles.length} className="rounded-panel border border-line bg-surface-2 px-3 py-1.5 text-xs font-bold text-zinc-200 hover:border-surface-3 disabled:opacity-40">
          {lab.replay === "playing" ? "⏸ إيقاف" : "▶ تشغيل"}
        </button>
        <button onClick={() => lab.nextBar()} disabled={!lab.candles.length} className="rounded-panel border border-line bg-surface-2 px-3 py-1.5 text-xs font-bold text-zinc-200 disabled:opacity-40">
          خطوة ▸
        </button>
        <div className="flex items-center gap-1">
          {[1, 2, 5, 10].map((s) => (
            <button
              key={s}
              onClick={() => lab.setSpeedValue(s)}
              className={`rounded-chip border px-2 py-1 text-2xs font-bold ${
                lab.speed === s ? "border-up/40 bg-up/10 text-up-fg" : "border-line text-muted"
              }`}
            >
              ×{s}
            </button>
          ))}
        </div>
        <div className="mr-auto flex items-center gap-3 ltr" dir="ltr">
          <span className="font-mono text-2xs text-muted">
            {lab.cursor?.index ?? 0} / {lab.cursor?.count ?? 0}
          </span>
          <span className="font-mono text-2xs text-muted">
            {lab.cursor?.timeMs ? new Date(lab.cursor.timeMs).toLocaleTimeString("en-GB") : "—"}
          </span>
          <span className="font-mono text-2xs text-up-fg">
            ${lab.cursor?.bar?.close?.toFixed(2) ?? "—"}
          </span>
        </div>
      </div>
      <div className="mt-3">
        <Bar pct={lab.cursor && lab.cursor.count > 0 ? (lab.cursor.index / (lab.cursor.count - 1)) * 100 : 0} tone="neutral" />
      </div>
    </Section>
  );
}

/* ---------------------------------------------------------------------- */
/* Layer 3 · Engine decision + feature snapshot                            */
/* ---------------------------------------------------------------------- */

function LayerEngineDecision({ latest }: { latest: EngineRunOutput | null }) {
  const d = latest?.decision;
  const tone: Tone = latest?.direction === "LONG" ? "long" : latest?.direction === "SHORT" ? "short" : "neutral";
  const features = latest?.features ?? [];
  return (
    <Section
      title="قرار المحرك المباشر"
      eyebrow="Layer 3 · Engine Decision"
      actions={d ? <Tag tone={tone} ltr>{d.direction === "NO_TRADE" ? "NEUTRAL" : d.direction}</Tag> : <Tag>—</Tag>}
    >
      {latest && d ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-4">
            <StatRow label="الثقة" value={`${Math.round(latest.confidence)}%`} tone={tone} strong />
            <StatRow label="الدرجة" value={`${Math.round(latest.score)}`} tone={tone} />
            <StatRow label="الموقع الموقّع" value={latest.signed.toFixed(0)} tone={latest.signed >= 0 ? "long" : "short"} />
            <StatRow label="الاحتمال الأساسي" value={d.primaryProbability != null ? (d.primaryProbability * 100).toFixed(1) + "%" : "—"} />
            <StatRow label="الصافي المتوقع" value={d.expectedNetMovePct != null ? d.expectedNetMovePct.toFixed(2) + "%" : "—"} tone={d.expectedNetMovePct != null && d.expectedNetMovePct > 0 ? "long" : "neutral"} />
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 md:grid-cols-4">
            <StatRow label="البوابة" value={d.gate} />
            <StatRow label="النظام" value={regimeLabel(d.regimeKey)} ltr={false} />
            <StatRow label="ثقة النظام" value={d.regimeConfidence != null ? Math.round(d.regimeConfidence) + "%" : "—"} />
            <StatRow label="السعر" value={latest.price != null ? `$${latest.price.toFixed(2)}` : "—"} />
          </div>
          {d.blocked ? (
            <div className="rounded-panel border border-warn/40 bg-warn/10 px-3 py-2 text-2xs text-warn-fg">
              البوابة حجبت القرار ({d.gate})
            </div>
          ) : null}
          <Collapse summary={`مكونات الميزات (${features.length})`}>
            <FeatureSnapshot features={features} />
          </Collapse>
        </div>
      ) : (
        <div className="text-xs text-muted">لم يصدر قرار بعد — شغّل الإعادة.</div>
      )}
    </Section>
  );
}

function FeatureSnapshot({ features }: { features: EngineRunOutput["features"] }) {
  return (
    <div className="grid gap-1.5 md:grid-cols-2">
      {features.map((f) => {
        const tone: Tone = f.direction === "bullish" ? "long" : f.direction === "bearish" ? "short" : "neutral";
        return (
          <div key={f.key} className="rounded-panel border border-line bg-surface-2/40 p-2">
            <div className="mb-1 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Dot tone={tone} />
                <span className="text-2xs text-zinc-300">{f.label}</span>
              </div>
              <span className="font-mono text-2xs text-muted ltr" dir="ltr">{f.key}</span>
            </div>
            <div className="flex items-center gap-2">
              <Bar pct={f.normalized != null ? f.normalized * 50 + 50 : null} tone={tone} className="flex-1" />
              <span className="w-10 shrink-0 text-right font-mono text-2xs text-muted">
                {f.normalized != null ? f.normalized.toFixed(2) : "—"}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-3xs text-muted">
              <span>الحالة: {STATE_LABELS[f.state]}</span>
              <span>المساهمة: {f.contribution.toFixed(2)}</span>
              <span>ن: {Math.round(f.score)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Layer 4 · Decision evaluation per horizon                               */
/* ---------------------------------------------------------------------- */

function LayerEvaluation({ records }: { records: ValidationDecisionRecord[] | null }) {
  if (!records || records.length === 0) {
    return (
      <Section title="تقييم القرارات" eyebrow="Layer 4 · Decision Evaluation">
        <div className="text-xs text-muted">
          لا توجد نتائج بعد — أتمّ الحفظ لقياس كل قرار عبر آفاق 30/60/120 ثانية.
        </div>
      </Section>
    );
  }
  const rows = records.slice(-25).reverse();
  return (
    <Section title="تقييم القرارات" eyebrow="Layer 4 · Decision Evaluation · Entry → +30s → +60s → +120s">
      <div className="max-h-80 overflow-auto">
        <table className="w-full text-left text-2xs font-mono ltr" dir="ltr">
          <thead>
            <tr className="border-b border-line text-muted">
              <th className="py-1 pr-2 text-left">Time</th>
              <th className="py-1 pr-2 text-left">Dir</th>
              <th className="py-1 pr-2 text-left">Entry</th>
              {HORIZON_KEYS.map((h) => (
                <th key={h} className="py-1 pr-2 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-line">
                <td className="py-1 pr-2 text-muted">
                  {new Date(r.timestamp).toLocaleTimeString("en-GB")}
                </td>
                <td className="py-1 pr-2">
                  <span className={r.direction === "LONG" ? "text-up-fg" : r.direction === "SHORT" ? "text-down-fg" : "text-muted"}>
                    {r.direction}
                  </span>
                </td>
                <td className="py-1 pr-2 text-zinc-300">{r.price.toFixed(2)}</td>
                {HORIZON_KEYS.map((h) => {
                  const hv = r.horizons[h];
                  return (
                    <td key={h} className="py-1 pr-2">
                      {hv.result === "win" ? (
                        <span className="text-up-fg">✓ {fmtPct(hv.actualMovePct)}</span>
                      ) : hv.result === "loss" ? (
                        <span className="text-down-fg">✗ {fmtPct(hv.actualMovePct)}</span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

/* ---------------------------------------------------------------------- */
/* Layer 6 · Decision journal                                              */
/* ---------------------------------------------------------------------- */

function LayerJournal({ decisions }: { decisions: DecisionSnapshot[] }) {
  const tone = (d?: string): Tone => (d === "LONG" ? "good" : d === "SHORT" ? "short" : "quiet");
  return (
    <Section title="سجل القرارات" eyebrow="Layer 6 · Decision Journal">
      <Collapse summary={`القرارات المسجّلة (${decisions.length})`} open>
        {decisions.length === 0 ? (
          <div className="py-2 text-2xs text-muted">لا توجد قرارات بعد.</div>
        ) : (
          <div className="max-h-72 overflow-auto">
            <table className="w-full text-left text-2xs">
              <thead>
                <tr className="border-b border-line text-muted">
                  <th className="py-1 pr-2 font-medium">#</th>
                  <th className="py-1 pr-2 font-medium">الوقت</th>
                  <th className="py-1 pr-2 font-medium">القرار</th>
                  <th className="py-1 pr-2 font-medium">الثقة</th>
                  <th className="py-1 pr-2 font-medium">النظام</th>
                  <th className="py-1 pr-2 font-medium">السعر</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {decisions.slice(-40).map((d) => (
                  <tr key={d.id} className="border-b border-line">
                    <td className="py-1 pr-2 text-muted">{d.seq}</td>
                    <td className="py-1 pr-2 text-muted">{new Date(d.timestamp).toLocaleTimeString("en-GB")}</td>
                    <td className="py-1 pr-2"><Tag tone={tone(d.direction)} ltr>{d.direction}</Tag></td>
                    <td className="py-1 pr-2 text-muted">{Math.round(d.confidence)}%</td>
                    <td className="py-1 pr-2 text-muted">{regimeLabel(d.regime)}</td>
                    <td className="py-1 pr-2 text-muted">{d.price.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Collapse>
    </Section>
  );
}

/* ---------------------------------------------------------------------- */
/* Layer 7 · Decision performance + analytics                              */
/* ---------------------------------------------------------------------- */

function LayerPerformance({ metrics, run }: { metrics: ValidationMetrics | null; run: ValidationRun | null }) {
  if (!metrics) {
    return (
      <Section title="أداء القرارات" eyebrow="Layer 7 · Analytics · Decision Performance">
        <div className="text-xs text-muted">لا توجد تحليلات بعد.</div>
      </Section>
    );
  }
  const totals = metrics.totals;
  return (
    <>
      <Section
        title="أداء القرارات"
        eyebrow="Layer 7 · Analytics · Decision Performance"
        actions={run ? <Tag tone="quiet" ltr>{(run as ValidationRun).runId}</Tag> : null}
      >
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 md:grid-cols-4">
          <StatRow label="قرارات اتجاهية" value={totals.directionalDecisions} tone="good" strong />
          <StatRow label="شراء" value={totals.longDecisions} tone="long" />
          <StatRow label="بيع" value={totals.shortDecisions} tone="short" />
          <StatRow label="محايد (مسجّل)" value={totals.neutralDecisions} tone="quiet" />
        </div>
        <div className="mt-3">
          <table className="w-full text-left text-2xs">
            <thead>
              <tr className="border-b border-line text-muted">
                <th className="py-1 pr-2 font-medium">الأفق</th>
                <th className="py-1 pr-2 font-medium">عينة</th>
                <th className="py-1 pr-2 font-medium">ربح</th>
                <th className="py-1 pr-2 font-medium">خسارة</th>
                <th className="py-1 pr-2 font-medium">دقة</th>
                <th className="py-1 pr-2 font-medium">أفضل من 50%</th>
                <th className="py-1 pr-2 font-medium">متوسط حركة</th>
                <th className="py-1 pr-2 font-medium">وسيط حركة</th>
                <th className="py-1 pr-2 font-medium">MFE</th>
                <th className="py-1 pr-2 font-medium">MAE</th>
              </tr>
            </thead>
            <tbody>
              {HORIZON_KEYS.map((h) => {
                const m = metrics.horizons[h];
                return (
                  <tr key={h} className="border-b border-line font-mono">
                    <td className="py-1 pr-2 text-zinc-300">{h}</td>
                    <td className="py-1 pr-2 text-muted">{m.sampleSize}</td>
                    <td className="py-1 pr-2 text-up-fg">{m.wins}</td>
                    <td className="py-1 pr-2 text-down-fg">{m.losses}</td>
                    <td className="py-1 pr-2"><span className={accTone(m.accuracy)}>{fmtAcc(m.accuracy)}</span></td>
                    <td className="py-1 pr-2"><span className={edgeTone(m.edgePp)}>{fmtDelta(m.edgePp)}</span></td>
                    <td className="py-1 pr-2 text-zinc-300">{fmtPct(m.averageMovePct)}</td>
                    <td className="py-1 pr-2 text-muted">{fmtPct(m.medianMovePct)}</td>
                    <td className="py-1 pr-2 text-up-fg/80">{fmtPct(m.averageMFE)}</td>
                    <td className="py-1 pr-2 text-down-fg/80">{fmtPct(m.averageMAE)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <BestHighlights metrics={metrics} />
      </Section>

      <Section title="الأداء حسب الاتجاه" eyebrow="Direction · Segment" className="mt-4">
        <div className="grid gap-3 md:grid-cols-2">
          {(["LONG", "SHORT"] as const).map((d) => {
            const seg = metrics.segments.byDirection[d];
            return <SegmentCard key={d} title={d} seg={seg} />;
          })}
        </div>
      </Section>
    </>
  );
}

function BestHighlights({ metrics }: { metrics: ValidationMetrics }) {
  const b = metrics.best;
  return (
    <div className="mt-3 grid gap-2 md:grid-cols-3">
      <StatRow label="أفضل أفق" value={b.bestHorizon ?? "-"} tone="good" />
      <StatRow label="أفضل اتجاه" value={b.bestDirection ?? "-"} tone="good" />
      <StatRow label="أفضل نطاق ثقة" value={b.bestConfidenceRange ?? "-"} tone="good" />
      <StatRow label="أفضل نظام" value={regimeLabel(b.bestMarketRegime ?? "")} tone="good" />
      <StatRow label="أضعف نظام" value={regimeLabel(b.weakestMarketRegime ?? "")} tone="short" />
      <StatRow label="متوسط الصافي 60s" value={fmtPct(metrics.returns.averageReturnPct)} />
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Confidence calibration                                                  */
/* ---------------------------------------------------------------------- */

function LayerCalibration({ metrics }: { metrics: ValidationMetrics | null }) {
  if (!metrics) return null;
  const segs = metrics.segments.byConfidence;
  const calibrated = segs["90-100"] || segs["80-90"] || segs["70-80"] || segs["60-70"] || segs["<60"];
  return (
    <Section title="معايرة الثقة" eyebrow="Confidence Calibration">
      <div className="space-y-2">
        {CONFIDENCE_RANGES.map((r) => {
          const seg = segs[r.label];
          if (!seg) return null;
          const mid = r.label === "<60" ? 50 : r.lo + 5;
          const tone: Tone = seg.accuracy60 != null ? (Math.abs(seg.accuracy60 - mid) <= 5 ? "good" : "warn") : "quiet";
          return (
            <div key={r.label} className="grid grid-cols-[70px_1fr_auto_auto] items-center gap-3">
              <span className="font-mono text-2xs text-muted">{r.label}</span>
              <Bar pct={seg.accuracy60} tone={tone} />
              <span className="w-16 text-right font-mono text-2xs text-zinc-300">{fmtAcc(seg.accuracy60)}</span>
              <span className="w-12 text-right font-mono text-2xs text-muted">n={seg.directionalCount}</span>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-2xs text-muted">
        {calibrated
          ? "المعدل المحقّق مقابل منتصف نطاق الثقة المعلن — الفجوة الكبيرة تشير إلى حاجة إعادة معايرة."
          : "لا نطاقات كافية بعد."}
      </p>
    </Section>
  );
}

/* ---------------------------------------------------------------------- */
/* Regime analytics                                                        */
/* ---------------------------------------------------------------------- */

function LayerRegime({ metrics }: { metrics: ValidationMetrics | null }) {
  const segs = metrics?.segments.byRegime;
  return (
    <Section title="التحقق حسب نظام السوق" eyebrow="Market Regime Analytics">
      {!segs || Object.keys(segs).length === 0 ? (
        <div className="text-xs text-muted">لا شرائح أنظمة بعد.</div>
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {Object.entries(segs).map(([key, seg]) => (
            <div key={key} className="rounded-panel border border-line bg-surface-2/40 p-2">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-2xs text-zinc-300">{regimeLabel(key)}</span>
                <span className="font-mono text-2xs text-muted ltr" dir="ltr">{key}</span>
              </div>
              <div className="flex items-center gap-2">
                <Bar pct={seg.accuracy60} tone={accTone(seg.accuracy60) === "text-up-fg" ? "good" : accTone(seg.accuracy60) === "text-down-fg" ? "short" : "neutral"} className="flex-1" />
                <span className="w-12 shrink-0 text-right font-mono text-2xs text-zinc-300">{fmtAcc(seg.accuracy60)}</span>
              </div>
              <div className="mt-1 flex justify-between text-3xs text-muted">
                <span>عينة: {seg.directionalCount}</span>
                <span>متوسط: {fmtPct(seg.averageReturnPct)}</span>
                <span>MFE {fmtPct(seg.averageMFE)} / MAE {fmtPct(seg.averageMAE)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

/* ---------------------------------------------------------------------- */
/* Shared small components + helpers                                       */
/* ---------------------------------------------------------------------- */

function SegmentCard({ title, seg }: { title: string; seg: import("./types").AccuracySegment }) {
  return (
    <div className="rounded-panel border border-line bg-surface-2/40 p-3">
      <div className="mb-1 flex items-center justify-between">
        <Tag tone={title === "LONG" ? "long" : "short"} ltr>{title}</Tag>
        <span className="text-2xs text-muted">عينة {seg.directionalCount}</span>
      </div>
      <StatRow label="الدقة 60s" value={fmtAcc(seg.accuracy60)} tone={accTone(seg.accuracy60) === "text-muted" ? "quiet" : seg.accuracy60 != null && seg.accuracy60 >= 50 ? "good" : "short"} />
      <StatRow label="متوسط الصافي" value={fmtPct(seg.averageReturnPct)} />
      <StatRow label="MFE / MAE" value={`${fmtPct(seg.averageMFE)} / ${fmtPct(seg.averageMAE)}`} ltr />
    </div>
  );
}

const STATE_LABELS: Record<string, string> = {
  strong: "قوي",
  moderate: "متوسط",
  weak: "ضعيف",
  unknown: "غير معروف",
};

function regimeLabel(key: string): string {
  if (!key) return "—";
  return REGIME_LABELS[key as keyof typeof REGIME_LABELS] ?? key;
}

function accTone(v: number | null): string {
  if (v == null) return "text-muted";
  return v >= 50 ? "text-up-fg" : "text-down-fg";
}

function edgeTone(v: number | null): string {
  if (v == null) return "text-muted";
  return v > 0 ? "text-up-fg" : "text-down-fg";
}

function isoDaysAgo(days: number): string {
  const d = new Date(Date.now() - days * 86400000);
  return d.toISOString().slice(0, 10);
}

function parseStart(iso: string): number {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.getTime();
}

function parseEnd(iso: string): number {
  const d = new Date(`${iso}T23:59:59Z`);
  return d.getTime();
}

function fmtAcc(v: number | null): string {
  return v == null ? "-" : `${v.toFixed(1)}%`;
}

function fmtPct(v: number | null): string {
  return v == null ? "-" : `${v.toFixed(2)}%`;
}

function fmtDelta(v: number | null): string {
  if (v == null) return "-";
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}pp`;
}
