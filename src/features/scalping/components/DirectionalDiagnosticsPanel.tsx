"use client";

import type { ScalpDecisionView, ScalpRecorderView } from "../types";
import { Panel, Chip } from "./ui";

function DriverList({ label, drivers, color, score }: { label: string; drivers: string[]; score: number; color: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-wide text-zinc-500">{label} — المساهمون</div>
        <Chip className={`border-zinc-700 bg-zinc-800/30 text-zinc-300`} dir="ltr">
          {score.toFixed(0)}
        </Chip>
      </div>
      <div className="mt-2 space-y-1">
        {drivers.length === 0 ? (
          <div className="text-[10px] text-zinc-600">لا مساهمين في هذا الاتجاه الآن.</div>
        ) : (
          drivers.map((d, i) => (
            <div key={d} className="flex items-center gap-2 text-[11px] text-zinc-300">
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${color}`} />
              <span>
                <span className="text-zinc-500">{i + 1}.</span> {d}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function DistBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[10px]">
        <span className="text-zinc-400">{label}</span>
        <span className="font-mono font-bold text-zinc-100" dir="ltr">
          {value.toFixed(0)}%
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
    </div>
  );
}

export function DirectionalDiagnosticsPanel({
  decision,
  recorder,
}: {
  decision: ScalpDecisionView | null | undefined;
  recorder: ScalpRecorderView | null | undefined;
}) {
  const dist = recorder?.distribution;
  const bias = recorder?.biasWarning;

  return (
    <Panel
      title="DIRECTIONAL DIAGNOSTICS — تشخيص الاتجاه"
      actions={
        bias ? (
          <Chip className="border-red-500/60 bg-red-500/15 text-red-300">⚠ انحياز اتجاهي</Chip>
        ) : (
          <Chip className="border-emerald-500/50 bg-emerald-500/10 text-emerald-300">متوازن</Chip>
        )
      }
    >
      {/* Symmetric LONG vs SHORT strength + probability */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-300">شراء (LONG)</span>
          </div>
          <div className="mt-1 flex items-end gap-3">
            <div>
              <div className="text-[9px] text-zinc-500">الدرجة</div>
              <div className="text-2xl font-extrabold text-emerald-300" dir="ltr">
                {decision?.longScore ?? 0}
              </div>
            </div>
            <div className="flex-1">
              <div className="text-[9px] text-zinc-500">الاحتمال</div>
              <div className="text-lg font-bold text-emerald-200" dir="ltr">
                {decision ? (decision.longProbability * 100).toFixed(0) : "—"}%
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-red-300">بيع (SHORT)</span>
          </div>
          <div className="mt-1 flex items-end gap-3">
            <div>
              <div className="text-[9px] text-zinc-500">الدرجة</div>
              <div className="text-2xl font-extrabold text-red-300" dir="ltr">
                {decision?.shortScore ?? 0}
              </div>
            </div>
            <div className="flex-1">
              <div className="text-[9px] text-zinc-500">الاحتمال</div>
              <div className="text-lg font-bold text-red-200" dir="ltr">
                {decision ? (decision.shortProbability * 100).toFixed(0) : "—"}%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Driver lists per direction */}
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <DriverList label="LONG" drivers={decision?.longDrivers ?? []} score={decision?.longScore ?? 0} color="bg-emerald-500" />
        <DriverList label="SHORT" drivers={decision?.shortDrivers ?? []} score={decision?.shortScore ?? 0} color="bg-red-500" />
      </div>

      {/* Distribution monitor */}
      {dist ? (
        <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-wide text-zinc-500">
              توزيع القرارات (مراقبة الانحياز) — {dist.total}
            </div>
            <Chip className="border-zinc-700 bg-zinc-800/30 text-zinc-400">نافذة الجلسة</Chip>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <DistBar label="LONG" value={dist.long.pct} color="bg-emerald-500" />
            <DistBar label="SHORT" value={dist.short.pct} color="bg-red-500" />
            <DistBar label="NO TRADE" value={dist.noTrade.pct} color="bg-zinc-600" />
          </div>
          <div className="mt-2 flex items-center gap-3 text-center text-[10px] text-zinc-500">
            <span>
              LONG <b className="text-emerald-300">{dist.long.count}</b>
            </span>
            <span>
              SHORT <b className="text-red-300">{dist.short.count}</b>
            </span>
            <span>
              NO TRADE <b className="text-zinc-300">{dist.noTrade.count}</b>
            </span>
          </div>
          {bias && (
            <div className="mt-2 rounded-md border border-red-500/30 bg-red-500/10 p-2 text-[11px] text-red-200">
              {bias}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 text-[10px] text-zinc-600">كمية قرارات كافية لمراقبة التوزيع قريبًا…</div>
      )}

      {/* Per-direction win rate + calibration (recomputed from the window) */}
      {recorder?.perDirection && (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <PerDir label="LONG" p={recorder.perDirection.LONG} color="text-emerald-300" />
          <PerDir label="SHORT" p={recorder.perDirection.SHORT} color="text-red-300" />
        </div>
      )}
    </Panel>
  );
}

function PerDir({
  label,
  p,
  color,
}: {
  label: string;
  p: { count: number; resolved: number; winRate: number | null; meanProbability: number | null; calibrationError: number | null; brier: number | null };
  color: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
      <div className="flex items-center justify-between">
        <span className={`text-[11px] font-bold ${color}`}>{label}</span>
        <span className="text-[10px] text-zinc-500">
          {p.resolved}/{p.count} محسومة
        </span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-zinc-400">
        <div>
          معدل الفوز
          <div className="font-mono text-sm font-bold text-zinc-100" dir="ltr">
            {p.winRate != null ? `${(p.winRate * 100).toFixed(0)}%` : "—"}
          </div>
        </div>
        <div>
          متوسط الاحتمال
          <div className="font-mono text-sm font-bold text-zinc-100" dir="ltr">
            {p.meanProbability != null ? `${(p.meanProbability * 100).toFixed(0)}%` : "—"}
          </div>
        </div>
        <div>
          خطأ التناسب
          <div className="font-mono text-sm font-bold text-zinc-100" dir="ltr">
            {p.calibrationError != null ? p.calibrationError.toFixed(3) : "—"}
          </div>
        </div>
        <div>
          Brier
          <div className="font-mono text-sm font-bold text-zinc-100" dir="ltr">
            {p.brier != null ? p.brier.toFixed(3) : "—"}
          </div>
        </div>
      </div>
    </div>
  );
}
