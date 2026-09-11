"use client";

import { useMemo, useState } from "react";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import Box from "@mui/material/Box";
import { ThemeGate, Tabs, Select, SkeletonTable, num, Badge } from "@/components/ui";
import {
  TradesIcon,
  DepositIcon,
  WithdrawIcon,
  ScaleIcon,
  CloseIcon,
  ArrowLeftIcon,
} from "@/components/icons/icons";
import { fmtMoney, fmtDateTime } from "../utils";
import { buildOps, OP_FILTERS } from "../operations";
import type {
  ImportedAccountDetailDto,
  ImportedOpRow,
  OpCategory,
  OpFilter,
} from "../types";

const CATEGORY_LABELS: Record<OpCategory, string> = {
  profit: "أرباح المراكز",
  loss: "خسائر المراكز",
  fee: "رسوم الصفقات",
  flow: "ودائع وسحب",
  other: "أخرى",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "معلّقة",
  CONFIRMED: "مؤكدة",
  FAILED: "فشلت",
  CANCELLED: "ملغاة",
};

type TabKey = "all" | "trades" | "deposit" | "withdrawal" | "fee";

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: "all", label: "الكل", icon: null },
  { key: "trades", label: "الصفقات", icon: <TradesIcon className="h-3.5 w-3.5" /> },
  { key: "deposit", label: "إيداع", icon: <DepositIcon className="h-3.5 w-3.5" /> },
  { key: "withdrawal", label: "سحب", icon: <WithdrawIcon className="h-3.5 w-3.5" /> },
  { key: "fee", label: "رسوم", icon: <ScaleIcon className="h-3.5 w-3.5" /> },
];

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

function matchTab(o: ImportedOpRow, tab: TabKey): boolean {
  switch (tab) {
    case "trades":
      return o.kind === "trade";
    case "deposit":
      return o.category === "flow" && (o.pnl ?? 0) > 0;
    case "withdrawal":
      return o.category === "flow" && (o.pnl ?? 0) < 0;
    case "fee":
      return o.category === "fee";
    default:
      return true;
  }
}

export function ImportedHistory({
  detail,
  loading,
  nowMs,
}: {
  detail: ImportedAccountDetailDto | null;
  loading: boolean;
  nowMs: number;
}) {
  const [tab, setTab] = useState<TabKey>("all");
  const [typeFilter, setTypeFilter] = useState<OpFilter>("all");
  const [asset, setAsset] = useState("all");
  const [range, setRange] = useState("all");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<ImportedOpRow | null>(null);

  const ops = useMemo(() => (detail ? buildOps(detail) : []), [detail]);

  const assets = useMemo(() => {
    const set = new Set<string>();
    for (const o of ops) {
      const a = o.asset ?? o.symbol;
      if (a) set.add(a);
    }
    return Array.from(set).sort();
  }, [ops]);

  const filtered = useMemo(() => {
    let rows = ops;
    if (tab !== "all") rows = rows.filter((o) => matchTab(o, tab));
    if (typeFilter !== "all") rows = rows.filter((o) => o.category === typeFilter);
    if (asset !== "all") rows = rows.filter((o) => (o.asset ?? o.symbol) === asset);
    if (range !== "all") {
      const since = nowMs - RANGE_MS[range];
      rows = rows.filter((o) => o.timestamp >= since);
    }
    const needle = q.trim().toLowerCase();
    if (needle) {
      rows = rows.filter((o) =>
        [o.typeLabel, o.symbol, o.asset, o.orderId, o.status, CATEGORY_LABELS[o.category]].some(
          (v) => v != null && v.toLowerCase().includes(needle)
        )
      );
    }
    return rows;
  }, [ops, tab, typeFilter, asset, range, q, nowMs]);

  if (loading || detail == null) {
    return (
      <section className="rounded-card border border-line bg-surface-1/40">
        <div className="border-b border-line/70 px-4 py-2.5">
          <div className="h-4 w-40 rounded-panel bg-surface-2/50 animate-pulse" />
        </div>
        <div className="p-4">
          <SkeletonTable rows={6} columns={5} className="border-0 p-0" />
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-card border border-line bg-surface-1/40">
      <div className="border-b border-line/70 px-4 pt-2.5 pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-foreground">سجل العمليات</h2>
            <p className="mt-0.5 text-2xs text-muted">
              تتم مزامنة العمليات تلقائيًا من المنصة — اضغط أي صف لعرض التفاصيل.
            </p>
          </div>
          <span className="rounded-chip border border-line px-2 py-0.5 text-2xs font-bold text-muted">
            {ops.length}
          </span>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Tabs
            slim
            value={tab}
            onChange={(v) => setTab(v as TabKey)}
            items={TABS.map((t) => ({ value: t.key, label: t.label, icon: t.icon ?? undefined }))}
          />

          <div className="ms-auto flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="بحث…"
              className="h-8 w-36 rounded-panel border border-line bg-surface-2/40 px-2.5 text-xs text-foreground placeholder:text-muted focus:border-gold/50 focus:outline-none"
            />
            <div style={{ width: 130 }}>
              <Select
                value={typeFilter}
                onChange={setTypeFilter}
                options={OP_FILTERS.map((f) => ({ value: f.key, label: f.label }))}
                placeholder="النوع"
              />
            </div>
            <div style={{ width: 120 }}>
              <Select
                value={asset}
                onChange={setAsset}
                options={[{ value: "all", label: "كل العملات" }, ...assets.map((a) => ({ value: a, label: a }))]}
              />
            </div>
            <div style={{ width: 130 }}>
              <Select
                value={range}
                onChange={setRange}
                options={RANGE_OPTIONS}
              />
            </div>
          </div>
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
              onClick={() => {
                setTab("all");
                setTypeFilter("all");
                setAsset("all");
                setRange("all");
                setQ("");
              }}
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
                  <th className="px-3 py-2 text-right font-semibold">الوقت</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => (
                  <Row key={o.id} o={o} onOpen={() => setSelected(o)} />
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="divide-y divide-line/50 md:hidden">
            {filtered.map((o) => (
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
                  <div className="mt-0.5 text-2xs text-muted" dir="ltr">
                    {o.asset ?? o.symbol ?? "—"} · {fmtDateTime(o.timestamp)}
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

          <div className="flex items-center justify-between gap-3 border-t border-line/60 px-4 py-2.5">
            <span className="text-2xs text-muted">
              {filtered.length} عملية — الأحدث أولاً
            </span>
            <a
              href={`/operations?filter=${typeFilter !== "all" ? typeFilter : "all"}`}
              className="flex items-center gap-1 text-2xs font-bold text-gold-fg transition-colors hover:text-gold"
            >
              السجل الكامل في صفحة العمليات
              <ArrowLeftIcon className="h-3.5 w-3.5" />
            </a>
          </div>
        </>
      )}

      <DetailsDrawer row={selected} onClose={() => setSelected(null)} nowMs={nowMs} />
    </section>
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
          ) : (
            <Badge tone="quiet">{CATEGORY_LABELS[o.category]}</Badge>
          )}
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
            {field("الفئة", CATEGORY_LABELS[o.category])}
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
        </Box>
      </Drawer>
    </ThemeGate>
  );
}