"use client";

import { ALERT_RULES, computeAlerts, type AlertItem } from "../intelligence";
import type {
  BtcCandle,
  FuturesContext,
  MarketState,
  OrderBookSnapshot,
  OrderFlowData,
  TechnicalIndicators,
} from "../types";
import { timeLabel } from "../utils";
import { Badge, Card, Collapse } from "@/components/ui/index";

const SEV_TONE: Record<string, "down" | "warn" | "neutral"> = {
  critical: "down",
  warning: "warn",
  info: "neutral",
};

const SEV_LABEL: Record<string, string> = {
  critical: "حرج",
  warning: "تحذير",
  info: "معلومة",
};

function AlertRow({ item }: { item: AlertItem }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-panel bg-surface-2/30 px-3 py-2">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Badge tone={SEV_TONE[item.severity]}>{SEV_LABEL[item.severity]}</Badge>
          <span className="text-sm font-semibold text-zinc-100">{item.label}</span>
        </div>
        <p className="mt-0.5 text-2xs text-muted">
          {item.detail} · المصدر: {item.source} · {timeLabel(item.time)}
        </p>
      </div>
      <span dir="ltr" className="shrink-0 text-sm font-bold tabular-nums text-zinc-200">
        {item.value}
      </span>
    </div>
  );
}

export function MarketAlerts({
  nowMs,
  marketState,
  orderBook,
  orderFlow,
  futures,
  indicators,
  candles30m,
}: {
  nowMs: number;
  marketState: MarketState | null;
  orderBook: OrderBookSnapshot | null;
  orderFlow: OrderFlowData | null;
  futures: FuturesContext | null;
  indicators: TechnicalIndicators | null;
  candles30m: BtcCandle[] | null;
}) {
  const alerts = computeAlerts({ nowMs, marketState, orderBook, orderFlow, futures, indicators, candles30m });

  return (
    <Card
      title="التنبيهات والأحداث (Alert Engine)"
      actions={
        alerts.length > 0 ? (
          <Badge tone={alerts[0].severity === "critical" ? "down" : alerts[0].severity === "warning" ? "warn" : "neutral"}>
            {alerts.length} حدث
          </Badge>
        ) : undefined
      }
      className="h-full"
    >
      {alerts.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-8 text-center">
          <p className="text-2xs text-muted">
            لا توجد أحداث حالياً وفق الحدود الحالية (البيانات هادئة ومتوازنة).
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map((a) => (
            <AlertRow key={a.id} item={a} />
          ))}
        </div>
      )}

      <Collapse summary="عرض حدود التفعيل (شفافية)">
        <ul className="space-y-1">
          {ALERT_RULES.map((r) => (
            <li key={r.id} className="flex items-baseline justify-between gap-2 text-2xs">
              <span className="text-zinc-300">{r.label}</span>
              <span className="text-muted">{r.threshold}</span>
            </li>
          ))}
        </ul>
      </Collapse>
    </Card>
  );
}