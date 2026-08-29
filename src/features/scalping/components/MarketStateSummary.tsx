"use client";

import type { ScalpDecisionView, ScalpingSignal, ScalpDirection } from "../types";
import type { FuturesState } from "../../bitcoin/futures/types";
import { Sparkline } from "./Sparkline";
import { classifyFreshness, FRESHNESS_META } from "./freshness";

const DIR_CHIP: Record<ScalpDirection, { txt: string; cls: string }> = {
  LONG: { txt: "صاعد", cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" },
  SHORT: { txt: "هابط", cls: "border-red-500/40 bg-red-500/10 text-red-300" },
  NEUTRAL: { txt: "محايد", cls: "border-zinc-600 bg-zinc-800/40 text-zinc-400" },
};

function biasOf(ret: number | null): ScalpDirection {
  if (ret == null) return "NEUTRAL";
  if (ret > 0.005) return "LONG";
  if (ret < -0.005) return "SHORT";
  return "NEUTRAL";
}

function fmtPct(v: number | null | undefined, digits = 3): string {
  return v == null || !isFinite(v) ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(digits)}%`;
}

function fmt(v: number | null | undefined, digits = 2): string {
  return v == null || !isFinite(v) ? "—" : (v as number).toFixed(digits);
}

function fmtUsd(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return "—";
  const a = Math.abs(v);
  return a >= 1_000_000 ? `$${(a / 1_000_000).toFixed(2)}M` : a >= 1_000 ? `$${(a / 1_000).toFixed(1)}K` : `$${a.toFixed(0)}`;
}

function ContactChip({ txt, cls }: { txt: string; cls: string }) {
  return <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[9px] font-bold ${cls}`}>{txt}</span>;
}

export function MarketStateSummary({
  decision,
  signal,
  futuresState,
}: {
  decision?: ScalpDecisionView | null;
  signal?: ScalpingSignal | null;
  futuresState?: FuturesState | null;
}) {
  const ms = decision?.marketState;
  const spotAge = ms?.health?.priceAgeMs ?? null;
  const fresh = classifyFreshness(spotAge);
  const fmeta = FRESHNESS_META[fresh];

  // Multi-timeframe bias from the real rolling windows.
  const biasWindows = [30, 60, 120].map((s) => {
    const w = ms?.windows?.find((x) => x.windowS === s);
    return { s, ret: w?.returnPct ?? null, z: w?.returnZ ?? null };
  });

  // Overall score = the existing engine's family-composite magnitude score,
  // directional by signed vote. Traceable via the family votes below.
  const score = signal?.score ?? null;
  const signDir: ScalpDirection = signal?.direction ?? "NEUTRAL";
  const scoreBarCls =
    signDir === "LONG" ? "bg-emerald-500" : signDir === "SHORT" ? "bg-red-500" : "bg-zinc-600";

  const familyVotes = signal?.familyVotes ?? {};
  const familyMeta: { key: string; label: string }[] = [
    { key: "price-action", label: "حركة السعر" },
    { key: "flow", label: "تدفق" },
    { key: "positioning", label: "مراكز" },
    { key: "structure", label: "بنيان" },
  ];

  const taker = ms?.takerBuyRatio ?? null;
  const buySell = ms?.buySellRatio ?? null;
  const cvd = ms?.cvd ?? null;
  const imbalance = ms?.bookImbalance ?? null;
  const spread = ms?.spreadPct ?? null;
  const rawVol = ms?.rawVolatilityPct ?? null;

  const oi30 =
    futuresState?.openInterest?.windows?.find((w) => w.windowS === 30)?.pct ?? null;
  const funding = futuresState?.positioning?.fundingRate ?? null;
  const ls = futuresState?.positioning?.globalLongShortRatio ?? null;

  const volSeries = (ms?.windows ?? [])
    .slice()
    .sort((a, b) => a.windowS - b.windowS)
    .map((w) => w.volatilityPct ?? 0);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Overall score + trace */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-zinc-100">ملخّص حالة السوق</h2>
          <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-bold ${fmeta.chip}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${fmeta.dot}`} />
            {fmeta.label}
          </span>
        </div>

        <div className="mt-4 flex items-end gap-3">
          <div>
            <div className="text-[10px] text-zinc-500">الدرجة الكلية للسوق</div>
            <div className="font-mono text-4xl font-extrabold text-zinc-50" dir="ltr">
              {score != null ? score.toFixed(0) : "—"}
              <span className="text-base text-zinc-500">/100</span>
            </div>
          </div>
          <div className="mb-1 flex flex-col gap-1">
            <ContactChip txt={DIR_CHIP[signDir].txt} cls={DIR_CHIP[signDir].cls} />
            <span className="text-[9px] text-zinc-600">الاتجاه الصافي</span>
          </div>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-zinc-800">
          <div className={`h-full rounded-full transition-all duration-500 ${scoreBarCls}`} style={{ width: `${score ?? 0}%` }} />
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-zinc-600">
          نفس درجة الـ engine الحالية (composite العائلات) — تُعرض للشفافية، لا تُحسب من جديد. مساهمة كل
          عائلة موضّحة أدناه.
        </p>

        <div className="mt-4 space-y-2">
          {familyMeta.map((fm) => {
            const v = (familyVotes as Record<string, number>)[fm.key] ?? 0;
            const mag = Math.min(100, Math.abs(v) * 100);
            const tend = v >= 0 ? "bg-emerald-500" : "bg-red-500";
            const txt = v >= 0 ? "صاعد" : "هابط";
            return (
              <div key={fm.key} className="flex items-center gap-2">
                <span className="w-20 shrink-0 text-[10px] text-zinc-500">{fm.label}</span>
                <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800" dir="ltr">
                  <div
                    className={`h-full rounded-full ${tend}`}
                    style={{
                      width: `${Math.abs(mag) / 2}%`,
                      marginLeft: v >= 0 ? `${50}%` : `${50 - mag / 2}%`,
                    }}
                  />
                </div>
                <span className="w-9 shrink-0 text-right font-mono text-[10px] text-zinc-400">{fmt(v, 2)}</span>
                <span className="w-8 shrink-0 text-right text-[9px] text-zinc-500">{txt}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Multi-timeframe bias + components */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
        <h2 className="mb-3 text-sm font-bold text-zinc-100">الانحياز متعدد الأطر الزمنية</h2>
        <div className="grid grid-cols-3 gap-2">
          {biasWindows.map((b) => {
            const d = biasOf(b.ret);
            return (
              <div key={b.s} className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-2.5 text-center">
                <div className="text-[10px] text-zinc-500">أفق {b.s}ث</div>
                <div className="mt-1 font-mono text-sm font-bold text-zinc-100" dir="ltr">
                  {fmtPct(b.ret)}
                </div>
                <div className="mt-1 flex justify-center">
                  <ContactChip txt={DIR_CHIP[d].txt} cls={DIR_CHIP[d].cls} />
                </div>
                {b.z != null ? (
                  <div className="mt-1 text-[9px] text-zinc-600" dir="ltr">z {fmt(b.z, 1)}</div>
                ) : (
                  <div className="mt-1 text-[9px] text-zinc-600">—</div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-2.5">
            <div className="text-[10px] font-semibold text-zinc-400">مكوّن التدفق</div>
            <div className="mt-1 font-mono text-sm text-zinc-100">
              شراء <b className={taker != null && taker >= 0.5 ? "text-emerald-400" : ""}>{taker != null ? `${(taker * 100).toFixed(1)}%` : "—"}</b>
              <span className="text-zinc-600"> · ب/ع {fmt(buySell, 2)}</span>
            </div>
            <div className="mt-0.5 text-[10px] text-zinc-500">CVD {fmtUsd(cvd)}</div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-2.5">
            <div className="text-[10px] font-semibold text-zinc-400">مكوّن المراكز</div>
            <div className="mt-1 font-mono text-sm text-zinc-100">
              OI30 {fmtPct(oi30)} <span className="text-zinc-600">· فاند {fmt(funding, 4)}%</span>
            </div>
            <div className="mt-0.5 text-[10px] text-zinc-500">ل/ش {fmt(ls, 3)}</div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-2.5">
            <div className="text-[10px] font-semibold text-zinc-400">مكوّن السيولة</div>
            <div className="mt-1 font-mono text-sm text-zinc-100">
              عمق {fmt(imbalance != null ? imbalance * 100 : null, 1)}% <span className="text-zinc-600">· سبريد {fmt(spread, 3)}%</span>
            </div>
            <div className="mt-0.5 text-[10px] text-zinc-500">{spread != null && spread > 0.02 ? "سبريد واسع — تنفيذ مكلف" : "عمق مقبول"}</div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-2.5">
            <div className="text-[10px] font-semibold text-zinc-400">مكوّن التقلب</div>
            <div className="mt-1 font-mono text-sm text-zinc-100">{rawVol != null ? `${rawVol.toFixed(3)}%` : "—"}</div>
            <div className="mt-0.5">
              <Sparkline points={volSeries} width={120} height={20} stroke="#f59e0b" fill="rgba(245,158,11,0.12)" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
