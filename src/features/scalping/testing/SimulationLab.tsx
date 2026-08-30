"use client";

import { useState } from "react";
import { useSimulation, DEFAULT_CONFIG, INITIAL_BALANCE } from "./hooks/useSimulation";
import {
  Section,
  Tag,
  StatRow,
  Bar,
  Dot,
  Collapse,
  type Tone,
} from "../components/terminal/TradingPrimitives";
import type { SimMode } from "./types";

/** 8-tier Scalping Simulation & Validation Lab — premium dark-minimal. */
export function SimulationLab() {
  const sim = useSimulation();

  const [from, setFrom] = useState(isoDaysAgo(3));
  const [to, setTo] = useState(isoDaysAgo(0));
  const [draft, setDraft] = useState({ riskPerTrade: DEFAULT_CONFIG.riskPerTrade, slFraction: DEFAULT_CONFIG.slFraction, tpFraction: DEFAULT_CONFIG.tpFraction });

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-6" dir="rtl">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Scalping Simulation &amp; Validation Lab
          </div>
          <h1 className="text-xl font-bold text-zinc-100">
            مختبر المحاكاة واختبار الاستراتيجية
          </h1>
          <p className="mt-1 max-w-2xl text-xs text-zinc-500">
            يشغّل نفس محرك القرار المستخدم في الصفحة المباشرة على بيانات تاريخية
            BTCUSDT 1m عبر معيد تشغيل بدون تسريب مستقبلي (no look-ahead) مع تنفيذ
            ورقي واقعي (عمولات/انزلاق/وقف/هدف).
          </p>
        </div>
        <Tag tone="quiet" ltr>
          {sim.session ? `${sim.decisions.length} قرار · ${sim.trades.length} صفقة` : "بدون جلسة"}
        </Tag>
      </header>

      {sim.error ? (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">
          {sim.error}
        </div>
      ) : null}

      {/* Tier 1 — Experiment control */}
      <Section title="إعداد التجربة" eyebrow="Layer 1 · Control">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[11px] text-zinc-500">من</span>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 ltr"
                  dir="ltr"
                />
              </label>
              <label className="block">
                <span className="text-[11px] text-zinc-500">إلى</span>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 ltr"
                  dir="ltr"
                />
              </label>
            </div>
            <div>
              <span className="text-[11px] text-zinc-500">وضع التنفيذ</span>
              <div className="mt-1 flex gap-2">
                {(Object.keys(MODE_LABELS) as SimMode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => sim.setMode(m)}
                    className={`rounded-lg border px-3 py-1.5 text-[11px] font-bold ${
                      sim.mode === m
                        ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                        : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700"
                    }`}
                  >
                    {MODE_LABELS[m]}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <ConfigField label="المخاطرة/صفقة" value={draft.riskPerTrade} onChange={(v) => setDraft((d) => ({ ...d, riskPerTrade: v }))} />
              <ConfigField label="وقف %" value={draft.slFraction} onChange={(v) => setDraft((d) => ({ ...d, slFraction: v }))} />
              <ConfigField label="هدف %" value={draft.tpFraction} onChange={(v) => setDraft((d) => ({ ...d, tpFraction: v }))} />
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <button
                onClick={() =>
                  sim.start({
                    startMs: parseStart(from),
                    endMs: parseEnd(to),
                    mode: sim.mode,
                    config: { riskPerTrade: draft.riskPerTrade, slFraction: draft.slFraction, tpFraction: draft.tpFraction },
                  })
                }
                disabled={sim.loading || !from || !to}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-zinc-950 hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {sim.loading ? "جارٍ التحميل…" : "بدء محاكاة جديدة"}
              </button>
              <button
                onClick={() => sim.reset()}
                className="rounded-lg border border-zinc-700 px-4 py-2 text-xs font-bold text-zinc-300 hover:border-zinc-600"
              >
                إعادة تعيين
              </button>
              <button
                onClick={() => sim.finalize()}
                disabled={!sim.session}
                className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs font-bold text-amber-300 disabled:opacity-40"
              >
                إنهاء وحساب التحليلات
              </button>
            </div>
          </div>
        </div>
      </Section>

      {/* Tier 2 — Replay transport */}
      <Section
        title="التشغيل المتزامن"
        eyebrow="Layer 2 · Transport"
        actions={
          <Tag tone={sim.replay === "playing" ? "good" : "neutral"} ltr>
            {REPLAY_LABELS[sim.replay]}
          </Tag>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => (sim.replay === "playing" ? sim.pause() : sim.play())} disabled={!sim.session} className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs font-bold text-zinc-200 hover:border-zinc-600 disabled:opacity-40">
            {sim.replay === "playing" ? "⏸ إيقاف" : "▶ تشغيل"}
          </button>
          <button onClick={() => sim.nextBar()} disabled={!sim.session} className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs font-bold text-zinc-200 disabled:opacity-40">
            خطوة ▸
          </button>
          <div className="flex items-center gap-1">
            {[1, 2, 5, 10].map((s) => (
              <button
                key={s}
                onClick={() => sim.setSpeedValue(s)}
                className={`rounded-md border px-2 py-1 text-[10px] font-bold ${
                  sim.speed === s ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300" : "border-zinc-800 text-zinc-400"
                }`}
              >
                ×{s}
              </button>
            ))}
          </div>
          <div className="mr-auto flex items-center gap-3 ltr" dir="ltr">
            <span className="font-mono text-[11px] text-zinc-400">
              {sim.cursor?.index ?? 0} / {sim.cursor?.count ?? 0}
            </span>
            <span className="font-mono text-[11px] text-zinc-500">
              {sim.cursor?.timeMs ? new Date(sim.cursor.timeMs).toLocaleTimeString("en-GB") : "—"}
            </span>
            <span className="font-mono text-[11px] text-emerald-400">
              ${sim.cursor?.bar?.close?.toFixed(2) ?? "—"}
            </span>
          </div>
        </div>
        <div className="mt-3">
          <Bar pct={sim.cursor && sim.cursor.count > 0 ? (sim.cursor.index / (sim.cursor.count - 1)) * 100 : 0} tone="neutral" />
        </div>
      </Section>

      {sim.session ? (
        <>
          {/* Tier 3 — Live engine decision */}
          <LiveDecision latest={sim.latest} />

          {/* Tier 4 — Wallet & position */}
          <Section title="المحفظة والصفقة" eyebrow="Layer 4 · Wallet & Position">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <StatRow label="الرصيد" value={fmtMoney(sim.balance)} tone={sim.balance >= INITIAL_BALANCE ? "long" : "short"} strong />
                <StatRow label="رأس المال المبدئي" value={fmtMoney(INITIAL_BALANCE)} />
                <StatRow label="صافي التغير" value={`${((sim.balance - INITIAL_BALANCE) / INITIAL_BALANCE) * 100 >= 0 ? "+" : ""}${(((sim.balance - INITIAL_BALANCE) / INITIAL_BALANCE) * 100).toFixed(2)}%`} tone={sim.balance >= INITIAL_BALANCE ? "long" : "short"} />
                <StatRow label="عمولات" value={fmtMoney(sim.trades.reduce((s, t) => s + t.fees, 0))} />
                <StatRow label="انزلاق" value={fmtMoney(sim.trades.reduce((s, t) => s + t.slippage, 0))} />
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
                {sim.position ? (
                  <>
                    <div className="mb-2 flex items-center gap-2">
                      <Tag tone={sim.position.side === "LONG" ? "long" : "short"} ltr>{sim.position.side === "LONG" ? "LONG" : "SHORT"}</Tag>
                      <span className="text-[10px] text-zinc-500">صفقة مفتوحة</span>
                    </div>
                    <StatRow label="دخول" value={fmtPrice(sim.position.entryPrice)} />
                    <StatRow label="وقف" value={fmtPrice(sim.position.stopLoss)} tone="short" />
                    <StatRow label="هدف" value={fmtPrice(sim.position.takeProfit)} tone="long" />
                    <StatRow label="الحجم" value={sim.position.size.toFixed(6)} ltr />
                  </>
                ) : (
                  <div className="flex h-full min-h-[120px] items-center justify-center text-[11px] text-zinc-600">
                    لا توجد صفقة مفتوحة
                  </div>
                )}
              </div>
            </div>
          </Section>

          {/* Tier 5 — Pending action (manual/assisted) */}
          <PendingView pending={sim.pending} respond={sim.respond} />

          {/* Tier 6 — Journal */}
          <JournalView decisions={sim.decisions} trades={sim.trades} />

          {/* Tier 7 — Analytics */}
          <AnalyticsView analytics={sim.analytics} />

          {/* Tier 8 — Validation */}
          <ValidationView validation={sim.validation} />
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-zinc-800 p-8 text-center text-sm text-zinc-500">
          حدّد النطاق الزمني ثم اضغط «بدء محاكاة جديدة» لتحميل البيانات وتشغيل محرك القرار.
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */

function LiveDecision({ latest }: { latest: ReturnType<typeof useSimulation>["latest"] }) {
  const d = latest?.decision;
  const tone: Tone = latest?.direction === "LONG" ? "long" : latest?.direction === "SHORT" ? "short" : "neutral";
  return (
    <Section
      title="قرار المحرك المباشر"
      eyebrow="Layer 3 · Engine Decision"
      actions={d ? <Tag tone={tone} ltr>{d.direction}</Tag> : <Tag>—</Tag>}
    >
      {latest && d ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-4">
            <StatRow label="الثقة" value={`${Math.round(latest.confidence)}%`} tone={tone} strong />
            <StatRow label="الدرجة" value={`${Math.round(latest.score)}`} tone={tone} />
            <StatRow label="الموقع الموقّع" value={latest.signed.toFixed(0)} tone={latest.signed >= 0 ? "long" : "short"} />
            <StatRow label="الاحتمال الأساسي" value={d.primaryProbability != null ? (d.primaryProbability * 100).toFixed(1) + "%" : "—"} />
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            <QuantBar label="قوة شراء" value={d.longScore} tone="long" />
            <QuantBar label="قوة بيع" value={d.shortScore} tone="short" />
            <QuantBar label="منطقة الاتجاه" value={d.regimeConfidence ?? 0} tone="neutral" />
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 md:grid-cols-4">
            <StatRow label="البوابة" value={d.gate} />
            <StatRow label="النظام" value={d.regimeKey} ltr />
            <StatRow label={"السعر"} value={latest.price != null ? fmtPrice(latest.price) : "—"} />
            <StatRow label="الصافي المتوقع" value={d.expectedNetMovePct != null ? d.expectedNetMovePct.toFixed(2) + "%" : "—"} tone={d.expectedNetMovePct != null && d.expectedNetMovePct > 0 ? "long" : "neutral"} />
          </div>
          <Collapse summary="أسباب القرار">
            <div className="space-y-1 text-[11px] text-zinc-400">
              {d.reasonNote ? <div>ملاحظة: {d.reasonNote}</div> : <div>قرار متاح للتداول.</div>}
              {d.blocked ? (
                <div className="text-amber-400">البوابة حجبت الصفقة ({d.gate}).</div>
              ) : null}
            </div>
          </Collapse>
        </div>
      ) : (
        <div className="text-xs text-zinc-600">لم يصدر قرار بعد — شغّل الإعادة.</div>
      )}
    </Section>
  );
}

function QuantBar({ label, value, tone }: { label: string; value: number | null; tone: Tone }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[10px]">
        <span className="text-zinc-500">{label}</span>
        <span className="font-mono text-zinc-300">{value != null ? Math.round(value) : "—"}</span>
      </div>
      <Bar pct={value} tone={tone} />
    </div>
  );
}

function PendingView({ pending, respond }: { pending: ReturnType<typeof useSimulation>["pending"]; respond: (e: boolean) => void }) {
  if (!pending) return null;
  const tone: Tone = pending.decision === "LONG" ? "long" : pending.decision === "SHORT" ? "short" : "neutral";
  return (
    <Section title="قرار بانتظار التأكيد" eyebrow="Layer 5 · Pending Action" actions={<Tag tone={tone} ltr>{pending.decision}</Tag>}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1 text-xs">
          <StatRow label="الثقة" value={`${Math.round(pending.confidence)}%`} tone={tone} />
          <StatRow label="التوقيت" value={new Date(pending.timestamp).toLocaleTimeString("en-GB")} ltr />
          <StatRow label="النظام" value={pending.regime} ltr />
        </div>
        <div className="flex gap-2">
          <button onClick={() => respond(true)} className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-zinc-950 hover:bg-emerald-500">
            تنفيذ
          </button>
          <button onClick={() => respond(false)} className="rounded-lg border border-zinc-700 px-4 py-2 text-xs font-bold text-zinc-300">
            تخطّي
          </button>
        </div>
      </div>
    </Section>
  );
}

function JournalView({ decisions, trades }: { decisions: ReturnType<typeof useSimulation>["decisions"]; trades: ReturnType<typeof useSimulation>["trades"] }) {
  const tone = (a?: string): Tone => (a === "EXECUTE" ? "good" : a === "WAIT" ? "warn" : "quiet");
  return (
    <Section title="سجل القرارات والصفقات" eyebrow="Layer 6 · Journal">
      <Collapse summary={`القرارات (${decisions.length})`} open>
        {decisions.length === 0 ? (
          <div className="py-2 text-[11px] text-zinc-600">لا توجد قرارات بعد.</div>
        ) : (
          <div className="max-h-72 overflow-auto">
            <table className="w-full text-left text-[11px]">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500">
                  <th className="py-1 pr-2 font-medium">#</th>
                  <th className="py-1 pr-2 font-medium">الوقت</th>
                  <th className="py-1 pr-2 font-medium">القرار</th>
                  <th className="py-1 pr-2 font-medium">الثقة</th>
                  <th className="py-1 pr-2 font-medium">الإجراء</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {decisions.map((d) => (
                  <tr key={d.id} className="border-b border-zinc-900">
                    <td className="py-1 pr-2 text-zinc-500">{d.seq}</td>
                    <td className="py-1 pr-2 text-zinc-400">{new Date(d.timestamp).toLocaleTimeString("en-GB")}</td>
                    <td className="py-1 pr-2"><span className={d.decision === "LONG" ? "text-emerald-400" : d.decision === "SHORT" ? "text-red-400" : "text-zinc-500"}>{d.decision}</span></td>
                    <td className="py-1 pr-2 text-zinc-400">{Math.round(d.confidence)}%</td>
                    <td className="py-1 pr-2"><Tag tone={tone(d.action)} ltr>{d.action ?? "—"}</Tag></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Collapse>
      <Collapse summary={`الصفقات (${trades.length})`}>
        {trades.length === 0 ? (
          <div className="py-2 text-[11px] text-zinc-600">لا توجد صفقات بعد.</div>
        ) : (
          <table className="w-full text-left text-[11px] font-mono">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500">
                <th className="py-1 pr-2 font-medium">الجهة</th>
                <th className="py-1 pr-2 font-medium">الدخول</th>
                <th className="py-1 pr-2 font-medium">الخروج</th>
                <th className="py-1 pr-2 font-medium">السبب</th>
                <th className="py-1 pr-2 font-medium">R</th>
                <th className="py-1 pr-2 font-medium">النتيجة</th>
                <th className="py-1 pr-2 font-medium">صافي</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t) => (
                <tr key={t.id} className="border-b border-zinc-900">
                  <td className="py-1 pr-2"><span className={t.side === "LONG" ? "text-emerald-400" : "text-red-400"}>{t.side}</span></td>
                  <td className="py-1 pr-2 text-zinc-300">{t.entryPrice.toFixed(2)}</td>
                  <td className="py-1 pr-2 text-zinc-300">{t.exitPrice.toFixed(2)}</td>
                  <td className="py-1 pr-2 text-zinc-500">{EXIT_LABELS[t.exitReason]}</td>
                  <td className="py-1 pr-2 text-zinc-400">{t.rMultiple != null ? t.rMultiple.toFixed(2) : "—"}</td>
                  <td className="py-1 pr-2"><span className={t.result === "WIN" ? "text-emerald-400" : t.result === "LOSS" ? "text-red-400" : "text-zinc-400"}>{t.result}</span></td>
                  <td className={`py-1 pr-2 ${t.netPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>{t.netPnl.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Collapse>
    </Section>
  );
}

function AnalyticsView({ analytics }: { analytics: ReturnType<typeof useSimulation>["analytics"] }) {
  if (!analytics) return null;
  const p = analytics.performance;
  const pfTone: Tone = (p.profitFactor ?? 0) >= 1 ? "long" : "short";
  return (
    <>
      <Section title="الأداء" eyebrow="Layer 7 · Analytics · Performance">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 md:grid-cols-4">
          <StatRow label="صفقات" value={p.trades} />
          <StatRow label="نسبة الربح" value={p.winRate != null ? p.winRate.toFixed(1) + "%" : "—"} tone={p.winRate != null && p.winRate >= 50 ? "long" : "short"} />
          <StatRow label="معامل الربح" value={p.profitFactor != null ? (isFinite(p.profitFactor) ? p.profitFactor.toFixed(2) : "∞") : "—"} tone={pfTone} />
          <StatRow label="صافي الربح" value={fmtMoney(p.netPnl)} tone={p.netPnl >= 0 ? "long" : "short"} strong />
          <StatRow label="متوسط R" value={p.averageR != null ? p.averageR.toFixed(2) : "—"} tone={p.averageR != null && p.averageR > 0 ? "long" : "short"} />
          <StatRow label="الرّبحية المتوقعة" value={p.expectancy != null ? fmtMoney(p.expectancy) : "—"} />
          <StatRow label="أقصى سحب" value={p.maxDrawdown != null ? fmtMoney(p.maxDrawdown) : "—"} tone="short" />
          <StatRow label="التوقع/صفقة" value={p.expectancy != null ? p.expectancy.toFixed(2) : "—"} />
        </div>
      </Section>

      <Section title="معايرة الثقة" eyebrow="Test &amp; Validation · Calibration" className="mt-4">
        <div className="space-y-2">
          {analytics.accuracy.map((b) => {
            const tone: Tone = b.winRate != null ? (b.winRate >= b.midConfidence - 5 ? "good" : "warn") : "quiet";
            return (
              <div key={b.bucket} className="grid grid-cols-[70px_1fr_auto_auto] items-center gap-3">
                <span className="font-mono text-[11px] text-zinc-400">{b.bucket}</span>
                <Bar pct={b.winRate} tone={tone} />
                <span className="w-16 text-right font-mono text-[11px] text-zinc-300">{b.winRate != null ? b.winRate.toFixed(0) + "%" : "—"}</span>
                <span className="w-16 text-right font-mono text-[10px] text-zinc-500">n={b.count}</span>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-[10px] text-zinc-600">
          النسبة المحققة مقابل نطاق الثقة المعلن — الفجوة الكبيرة تشير إلى حاجة إعادة معايرة.
        </p>
      </Section>

      <Section title="تشخيص الاستراتيجية" eyebrow="Strategy Diagnostics · Conditions" className="mt-4">
        <Collapse summary="كل شرط">
          <table className="w-full text-left text-[11px] font-mono">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500">
                <th className="py-1 pr-2 font-medium">الشرط</th>
                <th className="py-1 pr-2 font-medium">عينات</th>
                <th className="py-1 pr-2 font-medium">نسبة الربح</th>
                <th className="py-1 pr-2 font-medium">R</th>
                <th className="py-1 pr-2 font-medium">صافي</th>
              </tr>
            </thead>
            <tbody>
              {analytics.strategy.singles.map((c) => (
                <tr key={c.key} className="border-b border-zinc-900">
                  <td className="py-1 pr-2 text-zinc-300">{c.label}</td>
                  <td className="py-1 pr-2 text-zinc-400">{c.sampleSize}</td>
                  <td className={`py-1 pr-2 ${c.winRate != null && c.winRate >= 50 ? "text-emerald-400" : "text-red-400"}`}>{c.winRate != null ? c.winRate.toFixed(1) + "%" : "—"}</td>
                  <td className="py-1 pr-2 text-zinc-400">{c.averageR != null ? c.averageR.toFixed(2) : "—"}</td>
                  <td className={`py-1 pr-2 ${c.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>{c.pnl.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Collapse>
        <Collapse summary="التركيبات">
          {analytics.strategy.combos.length === 0 ? (
            <div className="py-2 text-[11px] text-zinc-600">لا تركيبات بحدّ أدنى من العينات بعد.</div>
          ) : (
            <table className="w-full text-left text-[11px] font-mono">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500">
                  <th className="py-1 pr-2 font-medium">التركيب</th>
                  <th className="py-1 pr-2 font-medium">عينات</th>
                  <th className="py-1 pr-2 font-medium">نسبة الربح</th>
                  <th className="py-1 pr-2 font-medium">R</th>
                  <th className="py-1 pr-2 font-medium">صافي</th>
                </tr>
              </thead>
              <tbody>
                {analytics.strategy.combos.map((c) => (
                  <tr key={c.key} className="border-b border-zinc-900">
                    <td className="py-1 pr-2 text-zinc-300">{c.label}</td>
                    <td className="py-1 pr-2 text-zinc-400">{c.sampleSize}</td>
                    <td className={`py-1 pr-2 ${c.winRate != null && c.winRate >= 50 ? "text-emerald-400" : "text-red-400"}`}>{c.winRate != null ? c.winRate.toFixed(1) + "%" : "—"}</td>
                    <td className="py-1 pr-2 text-zinc-400">{c.averageR != null ? c.averageR.toFixed(2) : "—"}</td>
                    <td className={`py-1 pr-2 ${c.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>{c.pnl.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Collapse>
      </Section>

      <Section title="تصنيف الإخفاقات" eyebrow="Failure Classification" className="mt-4">
        <div className="space-y-1">
          {Object.entries(analytics.failures.byCategory).map(([k, v]) => (
            <StatRow key={k} label={FAILURE_LABELS[k] ?? k} value={v} tone={v > 0 ? "warn" : "quiet"} />
          ))}
          <div className="pt-1">
            <StatRow label="إجمالي الإخفاقات" value={analytics.failures.total} tone={analytics.failures.total > 0 ? "warn" : "good"} />
          </div>
        </div>
      </Section>
    </>
  );
}

function ValidationView({ validation }: { validation: ReturnType<typeof useSimulation>["validation"] }) {
  if (!validation) return null;
  const tone: Tone = validation.passed ? "good" : "short";
  return (
    <Section
      title="مصادقة النزاهة"
      eyebrow="Layer 8 · Validation"
      actions={<Tag tone={tone} ltr>{validation.passed ? "PASS" : "FAIL"}</Tag>}
    >
      <div className="space-y-1">
        {validation.checks.map((c) => (
          <div key={c.name} className="flex items-start gap-2">
            <Dot tone={c.passed ? "good" : "short"} />
            <div className="text-[11px]">
              <span className="font-bold text-zinc-300">{VAL_LABELS[c.name] ?? c.name}</span>
              <span className="ml-2 text-zinc-500 ltr" dir="ltr">({c.name})</span>
              <div className="text-zinc-500">{c.detail}</div>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ---------------------------------------------------------------------- */
/* small helpers                                                           */
/* ---------------------------------------------------------------------- */

function ConfigField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="text-[11px] text-zinc-500">{label}</span>
      <input
        type="number"
        step="0.0001"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 ltr"
        dir="ltr"
      />
    </label>
  );
}

const MODE_LABELS: Record<SimMode, string> = {
  MANUAL: "يدوي",
  ASSISTED: "موجّه",
  AUTO: "تلقائي",
};

const REPLAY_LABELS: Record<string, string> = {
  idle: "جاهز",
  playing: "قيد التشغيل",
  paused: "متوقّف",
  finished: "انتهى",
};

const EXIT_LABELS: Record<string, string> = {
  TAKE_PROFIT: "وجهة",
  STOP_LOSS: "وقف",
  SESSION_END: "نهاية",
  REVERSAL: "انعكاس",
  MANUAL: "يدوي",
};

const FAILURE_LABELS: Record<string, string> = {
  FALSE_BREAKOUT: "اختراق كاذب",
  COUNTER_TREND: "عكس الاتجاه",
  LOW_LIQUIDITY: "سيولة منخفضة",
  HIGH_VOLATILITY: "تقلب مرتفع",
  WEAK_MOMENTUM: "زخم ضعيف",
  BAD_ENTRY: "دخول سيئ",
  LATE_ENTRY: "دخول متأخر",
  SL_TOO_TIGHT: "وقف ضيق",
  TP_TOO_FAR: "هدف بعيد",
  SIGNAL_CONFLICT: "تضارب إشارة",
  OTHER: "أخرى",
};

const VAL_LABELS: Record<string, string> = {
  "no-look-ahead": "بدون تسريب مستقبلي",
  "decision-timestamps-valid": "توقيت القرارات صالح",
  "entry-before-exit": "الدخول قبل الخروج",
  "trade-replayable": "الصفقات قابلة للإعادة",
  "sequence-monotonic": "تسلسل متصاعد",
  "data-complete": "اكتمال البيانات",
};

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

function fmtMoney(v: number): string {
  return `$${v.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function fmtPrice(v: number): string {
  return `$${v.toFixed(2)}`;
}
