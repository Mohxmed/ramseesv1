"use client";

import type { MarketInfluenceFactor, WindowKey } from "@/features/market-influence/intelligence";
import { Badge, DataRow, Modal, Status } from "@/components/ui/index";
import { AreaChart } from "@/components/charts/ChartContainer";
import {
  assetStatusMeta,
  corrLabel,
  corrStatusMeta,
  fmtNum,
  fmtPct,
  fmtSigned,
  impactTone,
  roleMeta,
  timeAgo,
} from "./format";

const windowLabel: Record<WindowKey, string> = {
  "30m": "30 دقيقة",
  "1h": "ساعة",
  "4h": "4 ساعات",
  "24h": "24 ساعة",
  "7d": "7 أيام",
};

const windows: WindowKey[] = ["30m", "1h", "4h", "24h", "7d"];

export interface FactorDetailModalProps {
  factor: MarketInfluenceFactor | null;
  nowMs: number;
  onClose: () => void;
}

export function FactorDetailModal({ factor: f, nowMs, onClose }: FactorDetailModalProps) {
  if (!f) return null;
  const role = roleMeta(f.role);
  const st = assetStatusMeta(f, nowMs);
  const cs = corrStatusMeta(f.corrStatus);

  const chartData = f.spark.map((p) => ({ t: p.t, v: p.v }));
  const chartColor =
    f.direction === "up"
      ? "var(--color-up)"
      : f.direction === "down"
      ? "var(--color-down)"
      : "var(--color-info)";

  return (
    <Modal
      open={f != null}
      onClose={onClose}
      title={`${f.nameAr} — ${f.nameEn}`}
      maxWidth={560}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge tone={role.tone}>الدور: {role.label}</Badge>
          <Status label={st.label} tone={st.tone} pulse={st.pulse} />
        </div>
        {f.impactScore != null ? (
          <span
            className={`font-mono text-2xl font-extrabold tabular-nums leading-none ${
              impactTone(f.impactScore) === "up"
                ? "text-up-fg"
                : impactTone(f.impactScore) === "down"
                ? "text-down-fg"
                : "text-zinc-300"
            }`}
            dir="ltr"
          >
            {f.impactScore > 0 ? "+" : ""}
            {f.impactScore.toFixed(0)}
          </span>
        ) : null}
      </div>

      <div className="mt-3 text-2xs text-muted">{f.tooltip}</div>

      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3">
        <DataRow label="السعر الحالي" value={f.price != null ? fmtNum(f.price) : "—"} strong />
        <DataRow
          label="تغيّر 24 ساعة"
          value={f.change24hPct != null ? fmtPct(f.change24hPct) : "—"}
          tone={f.change24hPct != null ? (f.change24hPct > 0 ? "up" : f.change24hPct < 0 ? "down" : "quiet") : "quiet"}
        />
        <DataRow label="الزخم" value={fmtSigned(f.momentum, 2)} tone={f.momentum != null && f.momentum > 0 ? "up" : f.momentum != null && f.momentum < 0 ? "down" : "quiet"} />
        <DataRow label="التسارع" value={fmtSigned(f.acceleration, 2)} tone={f.acceleration != null && f.acceleration > 0 ? "up" : f.acceleration != null && f.acceleration < 0 ? "down" : "quiet"} />
        <DataRow
          label="درجة الانحراف Z"
          value={fmtSigned(f.zScore, 2)}
          tone={f.zScore != null && Math.abs(f.zScore) >= 2 ? "warn" : "quiet"}
        />
        <DataRow
          label="التقلب النسبي"
          value={f.volatility != null ? `${(f.volatility * 100).toFixed(1)}%` : "—"}
        />
        <DataRow
          label="اتفاق الأطر الزمنية"
          value={f.timeframeAgreement != null ? `${Math.round(f.timeframeAgreement * 100)}%` : "—"}
        />
        <DataRow label="استقرار الارتباط" value={f.corrStability != null ? fmtNum(f.corrStability, 2) : "—"} />
        <DataRow label="آخر تحديث" value={timeAgo(nowMs, f.marketTimestamp ?? f.updatedAt)} />
      </div>

      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-2xs font-semibold text-muted">الارتباط المتحرك مع BTC</span>
          <span
            className={`text-2xs font-semibold ${
              cs.tone === "down" ? "text-down-fg" : cs.tone === "warn" ? "text-warn-fg" : "text-muted"
            }`}
          >
            {cs.label}
          </span>
        </div>
        <div className="space-y-2">
          {windows.map((w) => {
            const v = f.corr[w];
            return (
              <div key={w} className="flex items-center gap-3">
                <span className="w-16 shrink-0 text-2xs text-muted">{windowLabel[w]}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                  <div
                    className="h-full rounded-full bg-zinc-400/70"
                    style={{ width: `${Math.min(100, Math.abs(v ?? 0) * 100)}%` }}
                  />
                </div>
                <span className="w-12 shrink-0 text-right font-mono text-2xs tabular-nums text-zinc-200" dir="ltr">
                  {corrLabel(v)}
                </span>
              </div>
            );
          })}
        </div>
        <p className="mt-1 text-2xs text-muted">
          قراءة موجبة تعني تحركًا متوازيًا مع البتكوين في هذه النافذة، وسالبة تعني علاقة عكسية.
        </p>
      </div>

      <div className="mt-4">
        <div className="mb-1.5 text-2xs font-semibold text-muted">السلسلة المحدَّثة</div>
        <AreaChart
          data={chartData}
          xKey="t"
          series={[{ key: "v", name: "السعر", color: chartColor }]}
          height={180}
          showGrid={false}
          showXAxis={false}
          showYAxis={false}
        />
      </div>
    </Modal>
  );
}