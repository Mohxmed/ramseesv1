"use client";

import { useState, useRef } from "react";
import {
  PageHeader,
  Card,
  Section,
  MetricCard,
  Stat,
  DataRow,
  Badge,
  Status,
  Score,
  Risk,
  Progress,
  ScoreBar,
  Tabs,
  Select,
  FilterBar,
  DataTable,
  Tooltip,
  Popover,
  Modal,
  type Tone,
} from "../ui/index";

import {
  LineChart, AreaChart, BarChart, type ChartDatum,
} from "../charts/index";
import {
  MarketHeader,
  ScalpScore,
  SignalPanel,
  DecisionCard,
  FlowPanel,
  LiquidityPanel,
  ExecutionPanel,
  PredictionPanel,
} from "../trading/index";
const series: ChartDatum[] = Array.from({ length: 40 }, (_, i) => ({
  t: i + 1,
  bid: 60000 + i * 20 + Math.sin(i / 5) * 300,
  ask: 60060 + i * 20 + Math.sin(i / 5) * 300,
  volume: Math.abs(Math.sin(i / 4)) * 40 + 5,
}));

const tableRows = Array.from({ length: 24 }, (_, i) => ({
  id: i + 1,
  feature: `خاصية ${i + 1}`,
  edge: (i % 5) * 2.4 - 2,
  acc: 50 + ((i * 7) % 20),
  samples: 100 + i * 40,
}));

export function UiShowcase() {
  const [tab, setTab] = useState("tab1");
  const [sel, setSel] = useState("opt1");
  const [filters, setFilters] = useState<string[]>(["a", "c"]);
  const [popEl, setPopEl] = useState<HTMLElement | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const popRef = useRef<HTMLButtonElement>(null);

  const trades = (t: Tone) => ({ tone: t, label: t });

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6" dir="rtl">
      <PageHeader
        eyebrow="Premium UI Library"
        title="مكتبة مكونات UI"
        description="نماذج حية لكل مكون من مكتبة المكونات القابلة لإعادة الاستخدام — طبقات، خصائص، رسوم، ولوحات تداول عليها بيانات تجريبية."
        right={<Badge tone="good">v1.0</Badge>}
      />

      <ToneStrip />

      {/* UI primitives */}
      <Card title="الطبقات الأساسية" eyebrow="Primitives" actions={<Badge tone="up">Card</Badge>}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="السعر" value="61,240" delta="+1.24%" deltaTone="up" hint="آخر تحديث قبل 5 ثوانٍ" />
          <MetricCard label="الصافى" value="12.4" delta="-0.3%" deltaTone="down" />
          <MetricCard label="الائتمان" value="88" tone="good" hint="تقييم النظام" />
          <MetricCard label="الأوامر" value="1,204" />
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Stat label="الحجم" value="2.4K" tone="up" hint="من الشموع" />
          <Stat label="التغطية" value="98.2%" tone="good" />
          <Stat label="الانزلاق" value="0.02%" tone="warn" />
        </div>

        <div className="mt-4 max-w-sm space-y-1">
          <DataRow label="أفضل شراء" value={trades("up").label} tone="up" />
          <DataRow label="أفضل بيع" value="60,998.5" tone="down" ltr />
          <DataRow label="الثقة" value="72.4%" tone="warn" ltr strong />
          <DataRow label="الرسوم" value="4.2 ب.أ" ltr />
        </div>
      </Card>

      {/* Badges / status / score / risk / progress */}
      <Section title="الشارات والتقييم" eyebrow="Badges · Score · Risk">
        <div className="flex flex-wrap items-center gap-2">
          {(["up", "down", "neutral", "warn", "good", "quiet"] as Tone[]).map((t) => (
            <Badge key={t} tone={t}>{t}</Badge>
          ))}
          <Badge tone="up" ltr>LONG</Badge>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-6">
          <Status label="مباشر" tone="good" pulse />
          <Status label="متأخر" tone="warn" />
          <Score value={83} tone="up" size="md" />
          <Score value={41} tone="down" size="md" />
          <Risk level="high" />
          <Risk level="low" />
        </div>
        <div className="mt-4 max-w-sm space-y-3">
          <Progress pct={72} tone="up" showLabel />
          <Progress pct={34} tone="down" showLabel />
          <ScoreBar value={0.6} showValue />
          <ScoreBar value={-0.3} showValue />
        </div>
      </Section>

      {/* Controls */}
      <Section title="عناصر التحكم" eyebrow="Tabs · Select · FilterBar">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: "tab1", label: "المباشر" },
            { value: "tab2", label: "التاريخي" },
            { value: "tab3", label: "التحليل" },
          ]}
        />
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Select
            value={sel}
            onChange={setSel}
            label="الإطار الزمني"
            placeholder="اختر…"
            options={[
              { value: "opt1", label: "1 دقيقة" },
              { value: "opt2", label: "5 دقائق" },
              { value: "opt3", label: "15 دقيقة" },
            ]}
          />
          <FilterBar
            label="الخصائص:"
            value={filters}
            onChange={setFilters}
            options={[
              { value: "a", label: "الزخم" },
              { value: "b", label: "الحجم" },
              { value: "c", label: "السيولة" },
              { value: "d", label: "التقلب" },
            ]}
          />
        </div>
      </Section>

      {/* Overlays */}
      <Section title="نوافذ وتلميحات" eyebrow="Tooltip · Popover · Modal">
        <div className="flex flex-wrap items-center gap-3">
          <Tooltip title="تلميح توضيحي مخصّص" placement="top">
            <span className="cursor-pointer rounded-chip border border-line px-3 py-1.5 text-xs text-zinc-300">
              مرّر هنا للتلميح
            </span>
          </Tooltip>
          <button
            ref={popRef}
            onClick={() => setPopEl(popRef.current)}
            className="rounded-chip border border-line px-3 py-1.5 text-xs text-zinc-300"
          >
            افتح Popover
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="rounded-chip border border-line px-3 py-1.5 text-xs text-zinc-300"
          >
            افتح Modal
          </button>
        </div>

        <Popover
          open={Boolean(popEl)}
          onClose={() => setPopEl(null)}
          anchorEl={popEl}
          width={260}
        >
          <div className="text-2xs text-muted">Popover content</div>
          <div className="mt-1 text-sm font-bold text-zinc-100">محتوى منبثق قابل لإعادة الاستخدام</div>
          <DataRow label="القيمة" value="42" ltr />
        </Popover>

        <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="نافذة حوارية" maxWidth={360}>
          <p className="text-xs text-zinc-300">هذا Modal مبني على MUI مع ثيم بيت الموناستهب (zinc).</p>
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => setModalOpen(false)}
              className="rounded-lg border border-line px-3 py-1.5 text-xs text-zinc-300 hover:bg-surface-2"
            >
              إغلاق
            </button>
          </div>
        </Modal>
      </Section>

      {/* Chart wrappers */}
      <Section title="الرسوم البيانية" eyebrow="Recharts · Line · Area · Bar">
        <div className="grid gap-4 lg:grid-cols-3">
          <div>
            <div className="mb-1 text-2xs text-muted">خط</div>
            <LineChart data={series} xKey="t" series={[{ key: "bid", name: "شراء", color: "#10b981" }, { key: "ask", name: "بيع", color: "#ef4444" }]} height={180} showLegend />
          </div>
          <div>
            <div className="mb-1 text-2xs text-muted">مساحة</div>
            <AreaChart data={series} xKey="t" series={[{ key: "volume", name: "الحجم", color: "#38bdf8", fillOpacity: 0.2 }]} height={180} />
          </div>
          <div>
            <div className="mb-1 text-2xs text-muted">أعمدة</div>
            <BarChart data={series} xKey="t" series={[{ key: "volume", name: "الحجم", color: "#fbbf24" }]} height={180} />
          </div>
        </div>
      </Section>

      {/* DataTable */}
      <Section title="جدول بيانات" eyebrow="DataTable · sortable · paginated">
        <DataTable
          rows={tableRows}
          rowKey={(r) => r.id}
          pageSize={8}
          columns={[
            { key: "feature", header: "الخاصية", render: (r) => <span className="text-zinc-200">{r.feature}</span> },
            { key: "edge", header: "الإيدج", numeric: true, sortValue: (r) => r.edge, render: (r) => <Badge tone={r.edge >= 0 ? "up" : "down"}>{r.edge.toFixed(1)}</Badge> },
            { key: "acc", header: "الدقة %", numeric: true, sortValue: (r) => r.acc, render: (r) => <span className="text-zinc-300">{r.acc.toFixed(1)}%</span> },
            { key: "samples", header: "العينات", numeric: true, sortValue: (r) => r.samples, render: (r) => <span className="text-zinc-400">{r.samples}</span> },
          ]}
        />
      </Section>

      {/* Trading panels */}
      <Section title="لوحات التداول" eyebrow="Trading Panels">
        <div className="grid gap-4 lg:grid-cols-2">
          <MarketHeader
            data={{
              symbol: "BTCUSDT",
              price: 61240.5,
              change24hPct: 1.24,
              session: "الرئيسية",
              regime: "UPTREND",
              regimeConfidence: 78,
              freshness: "LIVE",
              bias: 72,
            }}
          />
          <ScalpScore
            data={{
              score: 74,
              direction: "LONG",
              families: [
                { key: "price-action", label: "حركة السعر", vote: 0.62 },
                { key: "flow", label: "التدفق", vote: 0.4 },
                { key: "positioning", label: "المراكز", vote: 0.1 },
                { key: "structure", label: "البنية", vote: 0.31 },
              ],
            }}
          />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <SignalPanel
            data={{
              direction: "LONG",
              strength: "strong",
              confidence: 74,
              reason: "زخم إيجابي مع تدفق شرائي واضح.",
              factors: [
                { label: "الزخم فوق المتوسط" },
                { label: "الحجم داعم" },
                { label: "البنية صاعدة" },
              ],
            }}
          />
          <DecisionCard
            data={{
              direction: "LONG",
              probability: 0.68,
              confidence: 74,
              expectedMovePct: 0.14,
              reason: "إجماع إيجابي عبر العائلات.",
              factors: [{ label: "إشارة قوية" }],
              gate: "الرئيسية",
              blocked: false,
            }}
          />
          <PredictionPanel
            data={{
              price: 61240.5,
              align: "السعر ↕ الزخم",
              horizons: [
                { minutes: 30, probabilityUp: 64, expectedMovePct: 0.08, confidence: 60 },
                { minutes: 60, probabilityUp: 68, expectedMovePct: 0.14, confidence: 66 },
                { minutes: 120, probabilityUp: 71, expectedMovePct: 0.22, confidence: 62 },
              ],
            }}
          />
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <FlowPanel
            data={{
              buyVolume: 38.2,
              sellVolume: 27.9,
              delta: 10.3,
              ratio: 1.37,
              largeBuyVolume: 5.1,
              largeSellVolume: 2.2,
              takerBuyRatio: 0.58,
            }}
          />
          <LiquidityPanel
            data={{
              bestBid: 61238,
              bestAsk: 61243,
              spread: 5,
              spreadPct: 0.008,
              bidDepth: 14.2,
              askDepth: 9.8,
              depthImbalance: 0.18,
            }}
          />
          <ExecutionPanel
            data={{
              entry: 61240.5,
              stopLoss: 61160,
              takeProfit: 61420,
              feeBps: 2,
              spreadBps: 0.8,
              slippageBps: 0.5,
              totalCostBps: 3.3,
              status: "OK",
            }}
          />
          <div className="rounded-card border border-line bg-surface-1/40 p-4">
            <div className="text-2xs font-semibold uppercase tracking-[0.18em] text-muted">إشعار</div>
            <p className="mt-2 text-xs text-zinc-300">
              جميع اللوحات أعلاه تُعرض على بيانات تجريبية محلية فقط — لا تُقرأ من المحرك مباشرة ولا
              تُعدّل أي منطق أعمال.
            </p>
          </div>
        </div>
      </Section>
    </div>
  );
}

function ToneStrip() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {(["up", "down", "neutral", "warn", "good", "quiet"] as Tone[]).map((t) => (
        <Badge key={t} tone={t}>{t}</Badge>
      ))}
    </div>
  );
}
