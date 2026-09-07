"use client";

import { scoreReport } from "../intelligence";
import type { MarketState } from "../types";
import { timeLabel } from "../utils";
import { Badge, Card, Progress } from "@/components/ui/index";

function SideChip({ item, side }: { item: { label: string; value: string }; side: "bull" | "bear" }) {
  return (
    <li className="flex items-center justify-between gap-2 rounded-panel bg-surface-2/30 px-2.5 py-1.5">
      <span className="text-2xs text-zinc-400">{item.label}</span>
      <span className={`text-2xs font-semibold ${side === "bull" ? "text-up-fg" : "text-down-fg"}`}>
        {item.value}
      </span>
    </li>
  );
}

export function RegimeHero({ state }: { state: MarketState | null }) {
  const report = scoreReport(state);

  if (!report || !state) {
    return (
      <Card className="py-10 text-center text-2xs text-muted">
        قراءة النظام السوقي غير متاحة بعد
      </Card>
    );
  }

  const regimeCls =
    report.direction === "up"
      ? "bg-up/15 text-up-fg border-up/50"
      : report.direction === "down"
      ? "bg-down/15 text-down-fg border-down/50"
      : "bg-zinc-600/30 text-zinc-300 border-zinc-600/50";
  const confluence = Math.round(report.agreement * 100);
  const missing = state.components.filter((c) => !c.healthy);

  return (
    <Card
      className="h-full"
      title="النظام السوقي (Market Regime) — قراءة مركّبة"
      actions={
        state.timestamp ? (
          <span className="text-2xs text-muted">آخر احتساب {timeLabel(state.timestamp)}</span>
        ) : undefined
      }
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-2xs text-muted">النظام الحالي</p>
          <span className={`mt-1 inline-block rounded-panel border px-3 py-1 text-lg font-bold ${regimeCls}`}>
            {report.directionLabel}
          </span>
        </div>
        <div className="text-left">
          <p className="text-2xs text-muted">درجة الانحياز</p>
          <p dir="ltr" className="text-2xl font-extrabold tabular-nums text-zinc-100">
            {report.score >= 0 ? "+" : ""}
            {report.score.toFixed(0)}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-2xs">
          <span className="text-muted">توافق المحاور ({report.present}/{report.total} متاح)</span>
          <span className="font-semibold text-zinc-300">{confluence}%</span>
        </div>
        <Progress pct={confluence} tone={report.direction === "up" ? "up" : report.direction === "down" ? "down" : "neutral"} className="mt-1" />
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <div className="rounded-panel border border-up/20 bg-up/5 p-2.5">
          <p className="text-2xs font-semibold text-up-fg">محفزات الصعود ({report.bull.length})</p>
          {report.bull.length === 0 ? (
            <p className="mt-1 text-2xs text-muted">لا توجد قراءات صاعدة</p>
          ) : (
            <ul className="mt-1.5 space-y-1.5">
              {report.bull.map((c) => (
                <SideChip key={c.label} item={c} side="bull" />
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-panel border border-down/20 bg-down/5 p-2.5">
          <p className="text-2xs font-semibold text-down-fg">ضغوط الهبوط ({report.bear.length})</p>
          {report.bear.length === 0 ? (
            <p className="mt-1 text-2xs text-muted">لا توجد قراءات هابطة</p>
          ) : (
            <ul className="mt-1.5 space-y-1.5">
              {report.bear.map((c) => (
                <SideChip key={c.label} item={c} side="bear" />
              ))}
            </ul>
          )}
        </div>
      </div>

      {report.neutral.length > 0 && (
        <div className="mt-2">
          <p className="text-2xs text-muted">
            محايد ({report.neutral.length}):{" "}
            <span className="text-zinc-400">
              {report.neutral.map((c) => `${c.label} (${c.value})`).join(" · ")}
            </span>
          </p>
        </div>
      )}

      {missing.length > 0 && (
        <div className="mt-2">
          <Badge tone="warn">غير متاح: {missing.map((c) => c.label).join("، ")}</Badge>
        </div>
      )}

      <p className="mt-3 text-2xs text-muted">
        قراءة مركّبة من بيانات حقيقية متاحة حاليًا — سياق تحليلي وليس توصية استثمارية.
      </p>
    </Card>
  );
}