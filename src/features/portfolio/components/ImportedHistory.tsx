"use client";

import { useMemo, useState } from "react";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import { TablePagination } from "@mui/material";
import {
  LayoutGrid,
  ArrowRightLeft,
  ShieldCheck,
  TriangleAlert,
  Percent,
  Gift,
  CircleHelp,
  Repeat,
  Shuffle,
} from "lucide-react";
import { ThemeGate, Tabs, Select, SkeletonTable, num, Badge, type Tone } from "@/components/ui";
import {
  TradesIcon,
  DepositIcon,
  WithdrawIcon,
  ScaleIcon,
  CloseIcon,
  ArrowLeftIcon,
  RefreshIcon,
} from "@/components/icons/icons";
import { fmtMoney, fmtDateTime } from "../utils";
import { buildOps, classifyOp, OP_KIND_OPTIONS, OPKIND_LABELS } from "../operations";
import { PortfolioCard } from "./PortfolioCard";
import type {
  ImportedAccountDetailDto,
  ImportedOpRow,
  OpImpact,
  OpKind,
} from "../types";

const KIND_ICONS: Record<OpKind | "all", React.ReactNode> = {
  all: <LayoutGrid className="h-3.5 w-3.5" />,
  deposit: <DepositIcon className="h-3.5 w-3.5" />,
  withdrawal: <WithdrawIcon className="h-3.5 w-3.5" />,
  transfer: <ArrowRightLeft className="h-3.5 w-3.5" />,
  trade: <TradesIcon className="h-3.5 w-3.5" />,
  fee: <ScaleIcon className="h-3.5 w-3.5" />,
  funding: <Repeat className="h-3.5 w-3.5" />,
  settlement: <ShieldCheck className="h-3.5 w-3.5" />,
  liquidation: <TriangleAlert className="h-3.5 w-3.5" />,
  pnl: <Percent className="h-3.5 w-3.5" />,
  reward: <Gift className="h-3.5 w-3.5" />,
  convert: <Shuffle className="h-3.5 w-3.5" />,
  other: <CircleHelp className="h-3.5 w-3.5" />,
};

const KIND_DOTS: Record<OpKind, string> = {
  deposit: "bg-up-fg",
  withdrawal: "bg-down-fg",
  transfer: "bg-muted",
  trade: "bg-muted",
  fee: "bg-warn-fg",
  funding: "bg-muted",
  settlement: "bg-muted",
  liquidation: "bg-down-fg",
  pnl: "bg-good",
  reward: "bg-good",
  convert: "bg-muted",
  other: "bg-muted/70",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "معلّقة",
  CONFIRMED: "مؤكدة",
  FAILED: "فشلت",
  CANCELLED: "ملغاة",
};

const STATUS_TONES: Record<string, Tone> = {
  PENDING: "warn",
  CONFIRMED: "good",
  FAILED: "down",
  CANCELLED: "quiet",
};

const IMPACT_OPTIONS = [
  { value: "all", label: "كل الاتجاهات" },
  { value: "in", label: "دخل (+)" },
  { value: "out", label: "خصم (−)" },
  { value: "neutral", label: "محايد" },
] as const;

const RANGE_MS: Record<string, number> = {
  "1D": 24 * 60 * 60 * 1000,
  "7D": 7 * 24 * 60 * 60 * 1000,
  "30D": 30 * 24 * 60 * 60 * 1000,
  "90D": 90 * 24 * 60 * 60 * 1000,
};

const RANGE_OPTIONS = [
  { value: "all", label: "كل المدة" },
  { value: "1D", label: "آخر 24 ساعة" },
  { value: "7D", label: "آخر 7 أيام" },
  { value: "30D", label: "آخر 30 يوم" },
  { value: "90D", label: "آخر 90 يوم" },
];

const fmtAmount = (v: number) =>
  v.toLocaleString("en-US", { maximumFractionDigits: 6 });

/** Dust threshold: operations with a coin amount below this are hidden from the list. */
const MIN_AMOUNT = 0.01;

export function ImportedHistory({
  detail,
  loading,
  nowMs,
}: {
  detail: ImportedAccountDetailDto | null;
  loading: boolean;
  nowMs: number;
}) {
  const [opKind, setOpKind] = useState<OpKind | "all">("all");
  const [subType, setSubType] = useState<string>("all");
  const [q, setQ] = useState("");
  const [asset, setAsset] = useState("all");
  const [direction, setDirection] = useState<OpImpact | "all">("all");
  const [status, setStatus] = useState("all");
  const [range, setRange] = useState("all");
  const [selected, setSelected] = useState<ImportedOpRow | null>(null);
  const [page, setPage] = useState(0);
  const [perPage, setPerPage] = useState(10);

  const ops = useMemo(
    () =>
      detail
        ? buildOps(detail).filter((o) => Math.abs(o.amount) >= MIN_AMOUNT)
        : [],
    [detail]
  );

  const assets = useMemo(() => {
    const set = new Set<string>();
    for (const o of ops) {
      const a = o.asset ?? o.symbol;
      if (a) set.add(a);
    }
    return Array.from(set).sort();
  }, [ops]);

  const statuses = useMemo(() => {
    const set = new Set<string>();
    for (const o of ops) if (o.status) set.add(o.status);
    return Array.from(set).sort();
  }, [ops]);

  const kindCounts = useMemo(() => {
    const m = new Map<OpKind | "all", number>([["all", ops.length]]);
    for (const o of ops) m.set(o.opType, (m.get(o.opType) ?? 0) + 1);
    return m;
  }, [ops]);

  /* Detailed sub-types present under the selected classification (only shown
     when it helps, so the bar never gets crowded). */
  const subOptions = useMemo(() => {
    if (opKind === "all") return [];
    const seen = new Map<string, string>();
    for (const o of ops) {
      if (o.opType !== opKind) continue;
      const key = o.subType ?? o.typeLabel;
      if (seen.has(key)) continue;
      seen.set(
        key,
        o.subType && (o.rawType ?? "") !== ""
          ? classifyOp(o.rawType ?? "", o.rawSubType).label
          : o.typeLabel
      );
    }
    return Array.from(seen, ([key, label]) => ({ key, label }));
  }, [ops, opKind]);

  const filtered = useMemo(() => {
    let rows = ops;
    if (opKind !== "all") rows = rows.filter((o) => o.opType === opKind);
    if (opKind !== "all" && subType !== "all")
      rows = rows.filter((o) => (o.subType ?? o.typeLabel) === subType);
    if (asset !== "all") rows = rows.filter((o) => (o.asset ?? o.symbol) === asset);
    if (direction !== "all") rows = rows.filter((o) => o.impact === direction);
    if (status !== "all") rows = rows.filter((o) => (o.status ?? null) === status);
    if (range !== "all") {
      const since = nowMs - RANGE_MS[range];
      rows = rows.filter((o) => o.timestamp >= since);
    }
    const needle = q.trim().toLowerCase();
    if (needle) {
      rows = rows.filter((o) =>
        [
          o.typeLabel,
          OPKIND_LABELS[o.opType],
          o.symbol,
          o.asset,
          o.orderId,
          o.status,
          o.rawType,
          o.rawSubType,
        ].some((v) => v != null && v.toLowerCase().includes(needle))
      );
    }
    return rows;
  }, [ops, opKind, subType, asset, direction, status, range, q, nowMs]);

  const resetFilters = () => {
    setOpKind("all");
    setSubType("all");
    setQ("");
    setAsset("all");
    setDirection("all");
    setStatus("all");
    setRange("all");
    setPage(0);
  };

  const changeKind = (k: OpKind | "all") => {
    setOpKind(k);
    setSubType("all");
    setPage(0);
  };

  if (loading || detail == null) {
    return (
      <PortfolioCard
        title={
          <div className="h-4 w-40 rounded-panel bg-surface-2/50 animate-pulse" />
        }
        bodyClassName="p-4"
      >
        <SkeletonTable rows={6} columns={5} className="border-0 p-0" />
      </PortfolioCard>
    );
  }

  const netSum = ops.reduce((acc, o) => acc + (o.pnl ?? 0), 0);
  const count = filtered.length;
  const safePage = Math.min(page, Math.max(0, Math.ceil(count / perPage) - 1));
  const pageRows = filtered.slice(safePage * perPage, safePage * perPage + perPage);

  return (
    <PortfolioCard
      title={
        <div>
          <h2 className="text-sm font-bold text-foreground">سجل العمليات</h2>
          <p className="mt-0.5 text-2xs text-muted">
            تتم مزامنة العمليات تلقائيًا من المنصة — اضغط أي صف لعرض التفاصيل.
          </p>
        </div>
      }
      actions={
        <span className="rounded-chip border border-line px-2 py-0.5 text-2xs font-bold text-muted">
          {ops.length}
        </span>
      }
      snippet={
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-2xs">
          <span className="text-muted">
            عدد العمليات <b className={`${num} font-bold text-foreground`}>{ops.length}</b>
          </span>
          <span className="text-muted">
            صافي{" "}
            <b className={`${num} font-bold ${netSum > 0 ? "text-up-fg" : netSum < 0 ? "text-down-fg" : "text-foreground"}`} dir="ltr">
              {fmtMoney(netSum, { signed: true })}
            </b>
          </span>
        </div>
      }
      bodyClassName="p-0"
    >
      <div className="border-b border-line/60">
        {/* Main classification bar */}
        <div className="px-4 pt-1.5">
          <Tabs
            slim
            value={opKind}
            onChange={(v) => changeKind(v as OpKind | "all")}
            items={OP_KIND_OPTIONS.map((k) => ({
              value: k,
              label: (
                <span className="flex items-center gap-1">
                  {KIND_ICONS[k]}
                  {k === "all" ? "الكل" : OPKIND_LABELS[k]}
                  <span className={`${num} text-2xs ${k === opKind ? "text-gold-fg" : "text-muted"}`}>
                    {kindCounts.get(k) ?? 0}
                  </span>
                </span>
              ),
            }))}
          />
        </div>

        {/* Detailed sub-type chips — only when a classification is selected */}
        {subOptions.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5 px-4 py-1.5">
            <ThemeGate>
              {[{ key: "all", label: "كل الأنواع" }, ...subOptions].map((s) => {
                const active = subType === s.key;
                return (
                  <Chip
                    key={s.key}
                    size="small"
                    label={s.label}
                    variant={active ? "filled" : "outlined"}
                    color={active ? "primary" : "default"}
                    onClick={() => {
                      setSubType(s.key);
                      setPage(0);
                    }}
                  />
                );
              })}
            </ThemeGate>
          </div>
        ) : null}

        {/* Secondary filters */}
        <div className="flex flex-wrap items-center gap-2 px-4 py-2">
          <input
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
            placeholder="بحث…"
            className="h-8 w-36 rounded-panel border border-line bg-surface-2/40 px-2.5 text-xs text-foreground placeholder:text-muted focus:border-gold/50 focus:outline-none"
          />
          <div style={{ width: 120 }}>
            <Select
              value={asset}
              onChange={(v) => {
                setAsset(v);
                setPage(0);
              }}
              options={[{ value: "all", label: "كل العملات" }, ...assets.map((a) => ({ value: a, label: a }))]}
            />
          </div>
          <div style={{ width: 130 }}>
            <Select
              value={direction}
              onChange={(v) => {
                setDirection(v as OpImpact | "all");
                setPage(0);
              }}
              options={IMPACT_OPTIONS as unknown as { value: string; label: string }[]}
            />
          </div>
          <div style={{ width: 120 }}>
            <Select
              value={status}
              onChange={(v) => {
                setStatus(v);
                setPage(0);
              }}
              options={[
                { value: "all", label: "كل الحالات" },
                ...statuses.map((s) => ({ value: s, label: STATUS_LABELS[s] ?? s })),
              ]}
            />
          </div>
          <div style={{ width: 130 }}>
            <Select
              value={range}
              onChange={(v) => {
                setRange(v);
                setPage(0);
              }}
              options={RANGE_OPTIONS}
            />
          </div>
          <button
            type="button"
            onClick={resetFilters}
            disabled={opKind === "all" && subType === "all" && !q && asset === "all" && direction === "all" && status === "all" && range === "all"}
            className="flex h-8 items-center gap-1.5 rounded-panel border border-line/70 px-2.5 text-2xs font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-foreground disabled:opacity-40"
            title="إعادة تعيين كل الفلاتر"
          >
            <RefreshIcon className="h-3.5 w-3.5" />
            إعادة التعيين
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <p className="text-2xs text-muted">
            {ops.length === 0
              ? "لم تُسجَّل عمليات بعد — تظهر تلقائيًا بعد اكتمال أول مزامنة مع المنصة."
              : "لا توجد عمليات تطابق هذه الفلاتر."}
          </p>
          {ops.length > 0 ? (
            <button
              type="button"
              onClick={resetFilters}
              className="mt-3 rounded-panel border border-line px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:text-zinc-200"
            >
              مسح الفلاتر
            </button>
          ) : null}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-right text-2xs">
              <thead>
                <tr className="border-b border-line/60 text-muted">
                  <th className="px-4 py-2 font-semibold">العملية</th>
                  <th className="px-3 py-2 font-semibold">الأصل</th>
                  <th className="px-3 py-2 text-right font-semibold">المبلغ</th>
                  <th className="px-3 py-2 text-right font-semibold">الربح / الخسارة</th>
                  <th className="px-3 py-2 text-right font-semibold">الرسوم</th>
                  <th className="px-3 py-2 font-semibold">الحالة</th>
                  <th className="px-3 py-2 text-right font-semibold">الوقت</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {pageRows.map((o) => (
                  <Row key={o.id} o={o} onOpen={() => setSelected(o)} />
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="divide-y divide-line/50 md:hidden">
            {pageRows.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setSelected(o)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-right transition-colors hover:bg-surface-2/30"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-xs font-bold text-foreground">{o.typeLabel}</span>
                    {o.side ? (
                      <Badge tone={o.side === "BUY" ? "up" : "down"}>{o.side === "BUY" ? "شراء" : "بيع"}</Badge>
                    ) : null}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-2xs text-muted">
                    <span className={`inline-block h-1 w-1 rounded-full ${KIND_DOTS[o.opType]}`} />
                    <span>{OPKIND_LABELS[o.opType]}</span>
                    <span dir="ltr">· {o.asset ?? o.symbol ?? "—"} · {fmtDateTime(o.timestamp)}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`${num} text-xs font-bold ${pnlTone(o)}`} dir="ltr">
                    {pnlText(o)}
                  </div>
                  <div className={`${num} mt-0.5 text-2xs text-muted`} dir="ltr">
                    {fmtAmount(o.amount)} {o.asset ?? o.symbol ?? ""}
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line/60 px-3 md:px-2">
            <span className="text-2xs text-muted">
              {filtered.length} عملية — الأحدث أولاً
            </span>
            {filtered.length > perPage ? (
              <ThemeGate>
                <TablePagination
                  component="div"
                  count={filtered.length}
                  page={safePage}
                  rowsPerPage={perPage}
                  onPageChange={(_e, p) => setPage(p)}
                  onRowsPerPageChange={(e) => {
                    setPerPage(parseInt(e.target.value, 10));
                    setPage(0);
                  }}
                  rowsPerPageOptions={[10, 25, 50]}
                  sx={{
                    color: "text.secondary",
                    fontSize: 12,
                    "& .MuiTablePagination-select": { color: "text.secondary" },
                  }}
                />
              </ThemeGate>
            ) : null}
            <a
              href="/operations"
              className="flex items-center gap-1 text-2xs font-bold text-gold-fg transition-colors hover:text-gold"
            >
              السجل الكامل في صفحة العمليات
              <ArrowLeftIcon className="h-3.5 w-3.5" />
            </a>
          </div>
        </>
      )}

      <DetailsDrawer row={selected} onClose={() => setSelected(null)} nowMs={nowMs} />
    </PortfolioCard>
  );
}

function pnlTone(o: ImportedOpRow): string {
  const p = o.pnl;
  if (p == null) return "text-muted";
  if (p > 0) return "text-up-fg";
  if (p < 0) return "text-down-fg";
  return "text-muted";
}

function pnlText(o: ImportedOpRow): string {
  return o.pnl == null ? "—" : fmtMoney(o.pnl, { signed: true });
}

function Row({
  o,
  onOpen,
}: {
  o: ImportedOpRow;
  onOpen: () => void;
}) {
  return (
    <tr
      onClick={onOpen}
      className="cursor-pointer border-b border-line/40 transition-colors last:border-b-0 hover:bg-surface-2/30"
    >
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-foreground">{o.typeLabel}</span>
          {o.side ? (
            <Badge tone={o.side === "BUY" ? "up" : "down"}>{o.side === "BUY" ? "شراء" : "بيع"}</Badge>
          ) : null}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-2xs text-muted">
          <span className={`inline-block h-1 w-1 rounded-full ${KIND_DOTS[o.opType]}`} />
          <span>{OPKIND_LABELS[o.opType]}</span>
        </div>
      </td>
      <td className="px-3 py-2.5 font-semibold text-foreground" dir="ltr">
        {o.asset ?? o.symbol ?? "—"}
      </td>
      <td className="px-3 py-2.5 text-right" dir="ltr">
        <span className="font-semibold text-foreground">{fmtAmount(o.amount)}</span>
        <span className="text-muted"> {o.asset ?? o.symbol ?? ""}</span>
      </td>
      <td className={`${num} px-3 py-2.5 text-right ${pnlTone(o)}`} dir="ltr">
        {pnlText(o)}
      </td>
      <td className={`${num} px-3 py-2.5 text-right`} dir="ltr">
        {o.fee !== 0 ? fmtMoney(o.fee) : "—"}
      </td>
      <td className="px-3 py-2.5">
        {o.status ? (
          <Badge tone={STATUS_TONES[o.status] ?? "quiet"}>
            {STATUS_LABELS[o.status] ?? o.status}
          </Badge>
        ) : (
          <span className="text-muted">—</span>
        )}
      </td>
      <td className="px-3 py-2.5 text-right text-muted" dir="ltr">
        {fmtDateTime(o.timestamp)}
      </td>
      <td className="px-2 py-2.5">
        <ArrowLeftIcon className="h-3.5 w-3.5 text-muted" />
      </td>
    </tr>
  );
}

function DetailsDrawer({
  row,
  onClose,
  nowMs,
}: {
  row: ImportedOpRow | null;
  onClose: () => void;
  nowMs: number;
}) {
  const o = row;
  if (!o) return null;

  const field = (label: string, value: React.ReactNode, ltr = false) => (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="text-2xs text-muted">{label}</span>
      <span
        dir={ltr ? "ltr" : "auto"}
        className={`text-right text-xs font-semibold text-foreground ${ltr ? num : ""}`}
      >
        {value}
      </span>
    </div>
  );

  return (
    <ThemeGate>
      <Drawer anchor="right" open onClose={onClose}>
        <Box
          sx={{
            width: { xs: "100vw", sm: 400 },
            maxWidth: "100vw",
            px: 2.5,
            py: 2,
            color: "text.primary",
            bgcolor: "background.paper",
            height: "100%",
          }}
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-foreground">تفاصيل العملية</h2>
            <IconButton onClick={onClose} size="small" aria-label="إغلاق">
              <CloseIcon className="h-4 w-4 text-muted" />
            </IconButton>
          </div>

          {o.side ? (
            <span className="mb-1 inline-block">
              <Badge tone={o.side === "BUY" ? "up" : "down"}>
                {o.side === "BUY" ? "شراء" : "بيع"}
              </Badge>
            </span>
          ) : null}

          <div
            className="mb-4 rounded-panel border border-line/70 bg-surface-2/40 p-3"
            dir="ltr"
          >
            <div className={`${num} text-2xl font-extrabold ${pnlTone(o)}`}>
              {pnlText(o)}
            </div>
            <div className="mt-1 text-2xs text-muted">
              {o.typeLabel} · {fmtAmount(o.amount)} {o.asset ?? o.symbol ?? ""}
            </div>
          </div>

          <div className="space-y-1 border-t border-line/60 pt-2">
            {field("نوع العملية", o.typeLabel)}
            {field("الفئة", OPKIND_LABELS[o.opType])}
            {field("الاتجاه", o.impact === "in" ? "دخل (+)" : o.impact === "out" ? "خصم (−)" : "محايد")}
            {field("الأصل", o.asset ?? o.symbol ?? "—", true)}
            {field("المبلغ", `${fmtAmount(o.amount)} ${o.asset ?? o.symbol ?? ""}`, true)}
            {o.price != null ? field("السعر", fmtMoney(o.price), true) : null}
            {o.usdValue != null ? field("القيمة بالدولار", fmtMoney(o.usdValue), true) : null}
            {o.pnl != null ? field("الربح / الخسارة", fmtMoney(o.pnl, { signed: true }), true) : null}
            {o.realizedPnlUsd != null
              ? field("الربح المحقق", fmtMoney(o.realizedPnlUsd, { signed: true }), true)
              : null}
            {o.fee !== 0 || o.income != null
              ? field("الرسوم / الدخل", fmtMoney(o.fee !== 0 ? o.fee : (o.income ?? 0), { signed: true }), true)
              : null}
            {o.status ? field("الحالة", STATUS_LABELS[o.status] ?? o.status) : null}
            {o.orderId ? field("رقم العملية", o.orderId, true) : null}
            {field("التاريخ", fmtDateTime(o.timestamp), true)}
            {field("منذ", `من ${nowMs >= o.timestamp ? Math.max(1, Math.round((nowMs - o.timestamp) / 60000)) : 0} دقيقة`)}
          </div>

          {o.rawType != null || o.rawSubType != null ? (
            <div className="border-t border-line/60 pt-2">
              <div className="pt-1 text-2xs font-bold text-muted">بيانات المصدر (خام)</div>
              <div className="space-y-1">
                {field("النوع الخام", o.rawType ?? "—", true)}
                {o.rawSubType ? field("النوع الفرعي (income)", o.rawSubType, true) : null}
                {field(
                  "المصدر",
                  o.kind === "trade" ? "سجل الصفقات (userTrades)" : "سجل العمليات (transactions)",
                  true
                )}
              </div>
            </div>
          ) : null}
        </Box>
      </Drawer>
    </ThemeGate>
  );
}