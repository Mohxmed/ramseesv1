"use client";

import type { FuturesState } from "../futures/types";
import type { MarketState } from "../types";
import { timeLabel } from "../utils";
import { Badge, Card, DataRow } from "@/components/ui/index";

const INTENSITY_TONE: Record<string, string> = {
  EXTREME: "down",
  HIGH: "down",
  MODERATE: "warn",
  LOW: "good",
  NONE: "quiet",
};

const INTENSITY_LABEL: Record<string, string> = {
  EXTREME: "متطرف",
  HIGH: "مرتفع",
  MODERATE: "متوسط",
  LOW: "منخفض",
  NONE: "لا يوجد",
};

function SideBlock({ label, value }: { label: string; value: { notional: number; count: number } }) {
  return (
    <div className="rounded-panel bg-surface-2/30 px-3 py-2">
      <p className="text-2xs text-muted">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-zinc-100" dir="ltr">
        {value.notional > 0 ? `$${value.notional.toLocaleString("en-US")}` : "—"}
      </p>
      <p className="text-2xs text-muted">{value.count} حدث</p>
    </div>
  );
}

export function LiquidationCard({
  futuresState,
  marketState,
}: {
  futuresState: FuturesState | null;
  marketState: MarketState | null;
}) {
  if (!futuresState) {
    const pressure = marketState?.liquidationPressure;
    return (
      <Card title="التصفيات (Liquidations)">
        <p className="py-6 text-center text-2xs text-muted">
          {pressure ? `ضغط التصفية من نموذج السوق: ${pressure === "high" ? "مرتفع" : pressure === "moderate" ? "متوسط" : "منخفض"}` : "بيانات التصفيات غير متاحة بعد"}
        </p>
      </Card>
    );
  }

  const liq = futuresState.liquidations;
  const tone = INTENSITY_TONE[liq.intensity] ?? "quiet";

  return (
    <Card
      title="التصفيات لحظيًا (Liquidation Radar)"
      actions={<Badge tone={tone as "down" | "warn" | "good" | "quiet"}>{INTENSITY_LABEL[liq.intensity] ?? liq.intensity}</Badge>}
    >
      <div className="grid grid-cols-2 gap-3">
        <SideBlock label="تصفية مراكز طويلة" value={liq.long} />
        <SideBlock label="تصفية مراكز قصيرة" value={liq.short} />
      </div>

      <div className="mt-3 rounded-panel border border-line bg-surface-2/30 px-3 py-2">
        <DataRow
          label="الصافي المسال"
          value={liq.net !== 0 ? `$${Math.abs(liq.net).toLocaleString("en-US")}` : "محايد"}
          tone={liq.net > 0 ? "down" : liq.net < 0 ? "up" : "neutral"}
        />
        <DataRow
          label="اتجاه التصفية الغالب"
          value={liq.net > 0 ? "مراكز طويلة تُسال" : liq.net < 0 ? "مراكز قصيرة تُسال" : "متوازن"}
          tone={liq.net > 0 ? "down" : liq.net < 0 ? "up" : "neutral"}
        />
      </div>

      {liq.cascade && liq.cascade.active ? (
        <div className="mt-3 rounded-panel border border-warn/40 bg-warn/10 px-3 py-2">
          <p className="text-2xs font-semibold text-warn-fg">
            نموذج سلسلة تصفية محتملة — {liq.cascade.direction}
          </p>
          <p className="text-2xs text-muted">
            احتمال {Math.round(liq.cascade.probability * 100)}% · محلي/متسلسل: {liq.cascade.intensity}
          </p>
        </div>
      ) : (
        <div className="mt-3 rounded-panel border border-line bg-surface-2/30 px-3 py-2">
          <p className="text-2xs text-muted">لا نموذج سلسلة تصفية نشط حاليًا</p>
        </div>
      )}

      {liq.last && (
        <div className="mt-3 rounded-panel bg-surface-2/30 px-3 py-2">
          <p className="text-2xs text-muted">آخر حدث تصفية</p>
          <p className="mt-0.5 text-sm font-semibold text-zinc-100" dir="ltr">
            {liq.last.side === "LONG_LIQUIDATION" ? "طويل" : "قصير"} · {liq.last.quantity.toFixed(3)} BTC ·{" "}
            {liq.last.price.toLocaleString("en-US")}
          </p>
          <p className="text-2xs text-muted">
            {liq.last.timestamp ? timeLabel(liq.last.timestamp) : "—"} · {liq.last.source}
          </p>
        </div>
      )}

      <p className="mt-3 text-2xs text-muted">
        أحداث حقيقية من قناة التصفيات المباشرة — سياق سوق، وليست إشارة مؤكدة.
      </p>
    </Card>
  );
}