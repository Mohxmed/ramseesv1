"use client";

import { useMacro } from "./useMacro";
import { GlobeIcon, RefreshIcon } from "@/components/icons/icons";
import { Badge, Card, PageHeader, Status } from "@/components/ui/index";
import { MacroBiasHero } from "./MacroBiasHero";
import { MarketRegimePanel } from "./MarketRegimePanel";
import { MacroRegimeTable } from "./MacroRegimeTable";
import { CorrelationMatrixPanel } from "./CorrelationMatrixPanel";
import { DecouplingPanel } from "./DecouplingPanel";
import { MacroPressurePanel, pressureTotal, regimeShortLabel } from "./MacroPressurePanel";
import { LiquidityPanel } from "./LiquidityPanel";
import { EventCalendarPanel } from "./EventCalendarPanel";
import { MarketMapPanel } from "./MarketMapPanel";
import { timeAgo } from "../format";

function Skeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="h-28 animate-pulse rounded-card border border-line bg-surface-1/40"
        />
      ))}
    </div>
  );
}

/**
 * Global Markets page — dedicated, extensive view of the cross-market
 * intelligence engine. All tables/matrices/regimes are derived client-side
 * from the shared raw dataset (pure engine helpers): no fabricated numbers.
 */
export function MacroPage() {
  const {
    state,
    status,
    error,
    nowMs,
    refresh,
    matrix,
    decoupling,
    events,
    eventRiskHigh,
    nextEarlyEvent,
    pressure,
    regimeLevel,
  } = useMacro();

  const factors = state?.factors ?? null;
  const sparklines = factors
    ? Object.fromEntries(Object.entries(factors).map(([id, f]) => [id, f.spark]))
    : {};

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Global Markets · خريطة الأسواق العالمية"
        icon={<GlobeIcon className="h-5 w-5 text-muted" />}
        title="الأسواق العالمية مقابل Bitcoin"
        description="أسواق الأسهم والعوائد والدولار والتقلب والسيولة — من أصل واحد محدّث: مصفوفة ارتباط، انحياز كلي، ضغط قطاعي، تقويم اقتصادي وخريطة أصول تفصيلية."
        actions={
          <>
            {status === "ready" && state ? (
              <div className="flex flex-wrap items-center gap-2">
                <Status
                  label={`آخر تحديث ${timeAgo(nowMs, state.fetchedAt)}`}
                  tone={state.freshShare >= 0.8 ? "good" : state.freshShare >= 0.4 ? "warn" : "down"}
                  pulse={state.freshShare >= 0.8 && nowMs - (state.fetchedAt ?? 0) < 90_000}
                />
                <Badge tone="neutral">{Object.keys(factors ?? {}).length} عامل</Badge>
              </div>
            ) : null}
            {error && status === "ready" ? (
              <Badge tone="warn">تحديث فاشل — تظهر بيانات سابقة</Badge>
            ) : null}
            <button
              type="button"
              onClick={refresh}
              className="inline-flex items-center gap-1.5 rounded-panel border border-line bg-surface-2/40 px-2.5 py-1.5 text-2xs font-semibold text-zinc-200 transition-colors hover:border-zinc-600 hover:bg-surface-2/60 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={status === "loading"}
            >
              <RefreshIcon />
              تحديث
            </button>
          </>
        }
      />

      {status === "loading" && !state ? (
        <Skeleton />
      ) : status === "error" && !state ? (
        <div className="rounded-card border border-line bg-surface-1/40 p-6 text-center">
          <p className="text-sm font-bold text-zinc-100">تعذّر جلب بيانات الأسواق</p>
          <p className="mt-1 text-2xs text-muted" dir="ltr">
            {error ?? "unknown error"}
          </p>
          <button
            type="button"
            onClick={refresh}
            className="mt-4 inline-flex items-center gap-1.5 rounded-panel bg-zinc-100 px-3 py-1.5 text-2xs font-bold text-zinc-900 transition-colors hover:bg-white"
          >
            <RefreshIcon /> إعادة المحاولة
          </button>
        </div>
      ) : state ? (
        <>
          <MacroBiasHero
            state={state}
            vix={state.factors.vix ?? null}
            decoupling={decoupling}
            regimeLevel={regimeLevel}
          />

          <MarketRegimePanel state={state} />

          <Card title="جدول النظام السوقي" eyebrow="Market Regime Table">
            <MacroRegimeTable
              factors={state.factors}
              sparklines={sparklines}
              nowMs={nowMs}
            />
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            {matrix ? (
              <CorrelationMatrixPanel matrix={matrix} />
            ) : (
              <Card title="مصفوفة الارتباط" eyebrow="Correlation">
                <div className="py-6 text-center text-2xs text-muted">
                  بيانات يومية غير متاحة حاليًا — ستظهر المصفوفة عند توفرها.
                </div>
              </Card>
            )}
            {decoupling ? (
              <DecouplingPanel status={decoupling} />
            ) : (
              <Card title="رصد فك الارتباط" eyebrow="Decoupling">
                <div className="py-6 text-center text-2xs text-muted">
                  لا بيانات كافية لحساب حالة الارتباط.
                </div>
              </Card>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <MacroPressurePanel
              pressure={pressure}
              total={pressureTotal(state.factors)}
              regimeLabel={regimeShortLabel(regimeLevel)}
            />
            <LiquidityPanel
              state={state}
              factors={state.factors}
              sparklines={sparklines}
              nowMs={nowMs}
            />
          </div>

          <EventCalendarPanel
            events={events}
            eventRiskHigh={eventRiskHigh}
            nextEarlyEvent={nextEarlyEvent}
          />

          <Card
            title="خريطة الأصول الكبرى"
            eyebrow="Macro Market Map"
            actions={<Badge tone="neutral">اضغط على أي أصل للتفاصيل</Badge>}
          >
            <MarketMapPanel
              factors={state.factors}
              sparklines={sparklines}
              nowMs={nowMs}
            />
          </Card>
        </>
      ) : null}
    </div>
  );
}