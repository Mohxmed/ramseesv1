"use client";

import { useMemo, useState } from "react";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import Box from "@mui/material/Box";
import Popover from "@mui/material/Popover";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import { TablePagination } from "@mui/material";
import {
  Ban,
  CircleCheck,
  CircleX,
  Filter,
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
import { ThemeGate, Select, SkeletonTable, num, Badge, colors } from "@/components/ui";
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
import { buildOps, OPKIND_LABELS } from "../operations";
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

/**
 * Every classification offered in the classification menu. All kinds are
 * available here so the menu replaces the old tab strip entirely.
 */
const ALL_KINDS: (OpKind | "all")[] = [
  "all",
  "deposit",
  "withdrawal",
  "transfer",
  "trade",
  "fee",
  "funding",
  "settlement",
  "liquidation",
  "pnl",
  "reward",
  "convert",
  "other",
];

const STATUS_LABELS: Record<string, string> = {
  PENDING: "ظ…ط¹ظ„ظ‘ظ‚ط©",
  CONFIRMED: "ظ…ط¤ظƒط¯ط©",
  FAILED: "ظپط´ظ„طھ",
  CANCELLED: "ظ…ظ„ط؛ط§ط©",
};

const IMPACT_OPTIONS = [
  { value: "all", label: "ظƒظ„ ط§ظ„ط§طھط¬ط§ظ‡ط§طھ" },
  { value: "in", label: "ط¯ط®ظ„ (+)" },
  { value: "out", label: "ط®طµظ… (âˆ’)" },
  { value: "neutral", label: "ظ…ط­ط§ظٹط¯" },
] as const;

const RANGE_MS: Record<string, number> = {
  "1D": 24 * 60 * 60 * 1000,
  "7D": 7 * 24 * 60 * 60 * 1000,
  "30D": 30 * 24 * 60 * 60 * 1000,
  "90D": 90 * 24 * 60 * 60 * 1000,
};

const RANGE_OPTIONS = [
  { value: "all", label: "ظƒظ„ ط§ظ„ظ…ط¯ط©" },
  { value: "1D", label: "ط¢ط®ط± 24 ط³ط§ط¹ط©" },
  { value: "7D", label: "ط¢ط®ط± 7 ط£ظٹط§ظ…" },
  { value: "30D", label: "ط¢ط®ط± 30 ظٹظˆظ…" },
  { value: "90D", label: "ط¢ط®ط± 90 ظٹظˆظ…" },
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
  const [asset, setAsset] = useState("all");
  const [direction, setDirection] = useState<OpImpact | "all">("all");
  const [status, setStatus] = useState("all");
  const [range, setRange] = useState("all");
  const [selected, setSelected] = useState<ImportedOpRow | null>(null);
  const [page, setPage] = useState(0);
  const [perPage, setPerPage] = useState(10);
  const [kindAnchor, setKindAnchor] = useState<HTMLElement | null>(null);
  const [filterAnchor, setFilterAnchor] = useState<HTMLElement | null>(null);

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

  const filtered = useMemo(() => {
    let rows = ops;
    if (opKind !== "all") rows = rows.filter((o) => o.opType === opKind);
    if (asset !== "all") rows = rows.filter((o) => (o.asset ?? o.symbol) === asset);
    if (direction !== "all") rows = rows.filter((o) => o.impact === direction);
    if (status !== "all") rows = rows.filter((o) => (o.status ?? null) === status);
    if (range !== "all") {
      const since = nowMs - RANGE_MS[range];
      rows = rows.filter((o) => o.timestamp >= since);
    }
    return rows;
  }, [ops, opKind, asset, direction, status, range, nowMs]);

  const clearFilters = () => {
    setAsset("all");
    setDirection("all");
    setStatus("all");
    setRange("all");
    setPage(0);
  };

  const activeCount = [asset, direction, status, range].filter((v) => v !== "all").length;

  const changeKind = (k: OpKind | "all") => {
    setOpKind(k);
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
          <h2 className="text-sm font-bold text-foreground">ط³ط¬ظ„ ط§ظ„ط¹ظ…ظ„ظٹط§طھ</h2>
          <p className="mt-0.5 text-2xs text-muted">
            طھطھظ… ظ…ط²ط§ظ…ظ†ط© ط§ظ„ط¹ظ…ظ„ظٹط§طھ طھظ„ظ‚ط§ط¦ظٹظ‹ط§ ظ…ظ† ط§ظ„ظ…ظ†طµط© â€” ط§ط¶ط؛ط· ط£ظٹ طµظپ ظ„ط¹ط±ط¶ ط§ظ„طھظپط§طµظٹظ„.
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
            ط¹ط¯ط¯ ط§ظ„ط¹ظ…ظ„ظٹط§طھ <b className={`${num} font-bold text-foreground`}>{ops.length}</b>
          </span>
          <span className="text-muted">
            طµط§ظپظٹ{" "}
            <b className={`${num} font-bold ${netSum > 0 ? "text-up-fg" : netSum < 0 ? "text-down-fg" : "text-foreground"}`} dir="ltr">
              {fmtMoney(netSum, { signed: true })}
            </b>
          </span>
        </div>
      }
      bodyClassName="p-0"
    >
      <div className="border-b border-line/60">
        {/* Classification + filters */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-1.5">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={(e) => setKindAnchor(e.currentTarget)}
              aria-haspopup="menu"
              aria-expanded={Boolean(kindAnchor)}
              className="flex h-7 items-center gap-1.5 rounded-panel px-2 text-2xs font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              {KIND_ICONS[opKind]}
              {opKind === "all" ? "ط§ظ„ظƒظ„" : OPKIND_LABELS[opKind]}
            </button>
            <button
              type="button"
              onClick={(e) => setFilterAnchor(e.currentTarget)}
              aria-haspopup="dialog"
              aria-expanded={Boolean(filterAnchor)}
              className="flex h-7 items-center gap-1.5 rounded-panel px-2 text-2xs font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              <Filter className="h-3.5 w-3.5" />
              ط§ظ„ظپظ„ط§طھط±
              {activeCount > 0 ? (
                <span
                  className={`${num} flex h-4 min-w-4 items-center justify-center rounded-full bg-gold/20 px-1 text-[10px] font-bold leading-none text-gold-fg`}
                >
                  {activeCount}
                </span>
              ) : null}
            </button>
          </div>
          {activeCount > 0 ? (
            <button
              type="button"
              onClick={clearFilters}
              className="flex h-7 items-center gap-1.5 rounded-panel px-2 text-2xs font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              <RefreshIcon className="h-3 w-3" />
              ظ…ط³ط­ ط§ظ„ظپظ„ط§طھط±
            </button>
          ) : null}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <p className="text-2xs text-muted">
            {ops.length === 0
              ? "ظ„ظ… طھظڈط³ط¬ظژظ‘ظ„ ط¹ظ…ظ„ظٹط§طھ ط¨ط¹ط¯ â€” طھط¸ظ‡ط± طھظ„ظ‚ط§ط¦ظٹظ‹ط§ ط¨ط¹ط¯ ط§ظƒطھظ…ط§ظ„ ط£ظˆظ„ ظ…ط²ط§ظ…ظ†ط© ظ…ط¹ ط§ظ„ظ…ظ†طµط©."
              : "ظ„ط§ طھظˆط¬ط¯ ط¹ظ…ظ„ظٹط§طھ طھط·ط§ط¨ظ‚ ظ‡ط°ظ‡ ط§ظ„ظپظ„ط§طھط±."}
          </p>
          {ops.length > 0 ? (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-3 rounded-panel border border-line px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:text-zinc-200"
            >
              ظ…ط³ط­ ط§ظ„ظپظ„ط§طھط±
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
                  <th className="px-4 py-2 font-semibold">ط§ظ„ط¹ظ…ظ„ظٹط©</th>
                  <th className="px-3 py-2 font-semibold">ط§ظ„ط£طµظ„</th>
                  <th className="px-3 py-2 text-right font-semibold">ط§ظ„ظ…ط¨ظ„ط؛</th>
                  <th className="px-3 py-2 text-right font-semibold">ط§ظ„ط±ط¨ط­ / ط§ظ„ط®ط³ط§ط±ط©</th>
                  <th className="px-3 py-2 font-semibold">ط§ظ„ط­ط§ظ„ط©</th>
                  <th className="px-3 py-2 text-right font-semibold">ط§ظ„ظˆظ‚طھ</th>
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
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-panel bg-surface-2/70">
                    {KIND_ICONS[o.opType]}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-xs font-bold text-foreground">{o.typeLabel}</span>
                      {o.side ? (
                        <Badge tone={o.side === "BUY" ? "up" : "down"}>{o.side === "BUY" ? "ط´ط±ط§ط،" : "ط¨ظٹط¹"}</Badge>
                      ) : null}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-2xs text-muted">
                      <span>{OPKIND_LABELS[o.opType]}</span>
                      <span dir="ltr">آ· {o.asset ?? o.symbol ?? "â€”"} آ· {fmtDateTime(o.timestamp)}</span>
                    </div>
                  </div>
                </div>
                <div className="shrink-0 text-right">
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

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line/60 px-4 py-2">
            <span className="text-2xs text-muted">
              {filtered.length} ط¹ظ…ظ„ظٹط© â€” ط§ظ„ط£ط­ط¯ط« ط£ظˆظ„ط§ظ‹
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
              className="flex h-8 items-center gap-1.5 rounded-panel px-2.5 text-2xs font-bold text-gold-fg transition-colors hover:bg-surface-2 hover:text-gold"
            >
              ط§ظ„ط³ط¬ظ„ ط§ظ„ظƒط§ظ…ظ„ ظپظٹ طµظپط­ط© ط§ظ„ط¹ظ…ظ„ظٹط§طھ
              <ArrowLeftIcon className="h-3.5 w-3.5" />
            </a>
          </div>
        </>
      )}

      <ThemeGate>
        <Menu
          open={Boolean(kindAnchor)}
          onClose={() => setKindAnchor(null)}
          anchorEl={kindAnchor}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
          slotProps={{ paper: { sx: { width: 232, py: 0.75, mt: 0.5 } } }}
        >
          {ALL_KINDS.map((k) => {
            const activeKind = opKind === k;
            return (
              <MenuItem
                key={k}
                onClick={() => {
                  changeKind(k);
                  setKindAnchor(null);
                }}
                sx={{
                  gap: "10px",
                  py: "5px",
                  color: activeKind ? colors.goldFg : colors.foreground,
                  backgroundColor: activeKind ? "rgba(235, 180, 91, 0.08)" : "transparent",
                  "&:hover": { backgroundColor: colors.surface2 },
                }}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-panel ${
                    activeKind ? "bg-gold/20 text-gold-fg" : "bg-surface-2/70 text-muted"
                  }`}
                >
                  {KIND_ICONS[k]}
                </span>
                <span className="flex-1 text-xs font-semibold">{k === "all" ? "ط§ظ„ظƒظ„" : OPKIND_LABELS[k]}</span>
                <span className={`${num} text-2xs font-bold ${activeKind ? "text-gold-fg" : "text-muted"}`}>
                  {kindCounts.get(k) ?? 0}
                </span>
              </MenuItem>
            );
          })}
        </Menu>
      </ThemeGate>

      <ThemeGate>
        <Popover
          open={Boolean(filterAnchor)}
          anchorEl={filterAnchor}
          onClose={() => setFilterAnchor(null)}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
          slotProps={{
            paper: { sx: { width: 256, mt: 0.5, p: 1.5, border: `1px solid ${colors.line}` } },
          }}
        >
          <div className="space-y-3">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-foreground">ط§ظ„ظپظ„ط§طھط±</span>
              <PopoverReset activeCount={activeCount} onReset={clearFilters} />
            </div>

            <FilterField label="ط§ظ„ط¹ظ…ظ„ط©">
              <Select
                value={asset}
                onChange={(v) => {
                  setAsset(v);
                  setPage(0);
                }}
                options={[{ value: "all", label: "ظƒظ„ ط§ظ„ط¹ظ…ظ„ط§طھ" }, ...assets.map((a) => ({ value: a, label: a }))]}
              />
            </FilterField>
            <FilterField label="ط§ظ„ط§طھط¬ط§ظ‡">
              <Select
                value={direction}
                onChange={(v) => {
                  setDirection(v as OpImpact | "all");
                  setPage(0);
                }}
                options={IMPACT_OPTIONS as unknown as { value: string; label: string }[]}
              />
            </FilterField>
            <FilterField label="ط§ظ„ط­ط§ظ„ط©">
              <Select
                value={status}
                onChange={(v) => {
                  setStatus(v);
                  setPage(0);
                }}
                options={[
                  { value: "all", label: "ظƒظ„ ط§ظ„ط­ط§ظ„ط§طھ" },
                  ...statuses.map((s) => ({ value: s, label: STATUS_LABELS[s] ?? s })),
                ]}
              />
            </FilterField>
            <FilterField label="ط§ظ„ظپطھط±ط©">
              <Select
                value={range}
                onChange={(v) => {
                  setRange(v);
                  setPage(0);
                }}
                options={RANGE_OPTIONS}
              />
            </FilterField>
          </div>
        </Popover>
      </ThemeGate>

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
  return o.pnl == null ? "â€”" : fmtMoney(o.pnl, { signed: true });
}

function StatusGlyph({ status }: { status: string | null | undefined }) {
  if (!status) return null;
  switch (status) {
    case "CONFIRMED":
      return <CircleCheck className="h-3.5 w-3.5 text-up-fg" />;
    case "FAILED":
      return <CircleX className="h-3.5 w-3.5 text-down-fg" />;
    case "PENDING":
      return <TriangleAlert className="h-3.5 w-3.5 text-warn-fg" />;
    case "CANCELLED":
      return <Ban className="h-3.5 w-3.5 text-muted" />;
    default:
      return <CircleHelp className="h-3.5 w-3.5 text-muted" />;
  }
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-2xs font-semibold text-muted">{label}</div>
      {children}
    </div>
  );
}

function PopoverReset({ activeCount, onReset }: { activeCount: number; onReset: () => void }) {
  return (
    <button
      type="button"
      onClick={onReset}
      disabled={activeCount === 0}
      className="flex h-6 items-center gap-1 rounded-panel px-1.5 text-2xs font-semibold text-gold-fg transition-colors hover:bg-surface-2 hover:text-gold disabled:cursor-not-allowed disabled:opacity-40"
    >
      <RefreshIcon className="h-3 w-3" />
      ط¥ط¹ط§ط¯ط© طھط¹ظٹظٹظ†
    </button>
  );
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
      <td className="px-4 py-2">
        <div className="flex items-center gap-2.5">
          <span className="flex h-6 w-5 shrink-0 items-center justify-center">
            <StatusGlyph status={o.status} />
          </span>
          <span className="flex h-5 w-5 shrink-0 items-center justify-center"><StatusGlyph status={o.status} /></span><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-panel bg-surface-2/70">
            {KIND_ICONS[o.opType]}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-xs font-bold text-foreground">{o.typeLabel}</span>
              {o.side ? (
                <Badge tone={o.side === "BUY" ? "up" : "down"}>{o.side === "BUY" ? "ط´ط±ط§ط،" : "ط¨ظٹط¹"}</Badge>
              ) : null}
            </div>
            <div className="mt-0.5 truncate text-2xs text-muted">{OPKIND_LABELS[o.opType]}</div>
          </div>
        </div>
      </td>
      <td className="px-3 py-2 text-xs font-semibold text-foreground" dir="ltr">
        {o.asset ?? o.symbol ?? "â€”"}
      </td>
      <td className="px-3 py-2 text-right" dir="ltr">
        <span className={`${num} text-xs font-semibold text-foreground`}>{fmtAmount(o.amount)}</span>
        <span className="text-2xs text-muted"> {o.asset ?? o.symbol ?? ""}</span>
      </td>
      <td className={`${num} px-3 py-2 text-right text-xs ${pnlTone(o)}`} dir="ltr">
        {pnlText(o)}
      </td>
      <td className="px-3 py-2 text-right text-2xs text-muted" dir="ltr">
        {fmtDateTime(o.timestamp)}
      </td>
      <td className="px-2 py-2">
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
            <h2 className="text-sm font-bold text-foreground">طھظپط§طµظٹظ„ ط§ظ„ط¹ظ…ظ„ظٹط©</h2>
            <IconButton onClick={onClose} size="small" aria-label="ط¥ط؛ظ„ط§ظ‚">
              <CloseIcon className="h-4 w-4 text-muted" />
            </IconButton>
          </div>

          {o.side ? (
            <span className="mb-1 inline-block">
              <Badge tone={o.side === "BUY" ? "up" : "down"}>
                {o.side === "BUY" ? "ط´ط±ط§ط،" : "ط¨ظٹط¹"}
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
              {o.typeLabel} آ· {fmtAmount(o.amount)} {o.asset ?? o.symbol ?? ""}
            </div>
          </div>

          <div className="space-y-1 border-t border-line/60 pt-2">
            {field("ظ†ظˆط¹ ط§ظ„ط¹ظ…ظ„ظٹط©", o.typeLabel)}
            {field("ط§ظ„ظپط¦ط©", OPKIND_LABELS[o.opType])}
            {field("ط§ظ„ط§طھط¬ط§ظ‡", o.impact === "in" ? "ط¯ط®ظ„ (+)" : o.impact === "out" ? "ط®طµظ… (âˆ’)" : "ظ…ط­ط§ظٹط¯")}
            {field("ط§ظ„ط£طµظ„", o.asset ?? o.symbol ?? "â€”", true)}
            {field("ط§ظ„ظ…ط¨ظ„ط؛", `${fmtAmount(o.amount)} ${o.asset ?? o.symbol ?? ""}`, true)}
            {o.price != null ? field("ط§ظ„ط³ط¹ط±", fmtMoney(o.price), true) : null}
            {o.usdValue != null ? field("ط§ظ„ظ‚ظٹظ…ط© ط¨ط§ظ„ط¯ظˆظ„ط§ط±", fmtMoney(o.usdValue), true) : null}
            {o.pnl != null ? field("ط§ظ„ط±ط¨ط­ / ط§ظ„ط®ط³ط§ط±ط©", fmtMoney(o.pnl, { signed: true }), true) : null}
            {o.realizedPnlUsd != null
              ? field("ط§ظ„ط±ط¨ط­ ط§ظ„ظ…ط­ظ‚ظ‚", fmtMoney(o.realizedPnlUsd, { signed: true }), true)
              : null}
            {o.fee !== 0 || o.income != null
              ? field("ط§ظ„ط±ط³ظˆظ… / ط§ظ„ط¯ط®ظ„", fmtMoney(o.fee !== 0 ? o.fee : (o.income ?? 0), { signed: true }), true)
              : null}
            {o.status ? field("ط§ظ„ط­ط§ظ„ط©", STATUS_LABELS[o.status] ?? o.status) : null}
            {o.orderId ? field("ط±ظ‚ظ… ط§ظ„ط¹ظ…ظ„ظٹط©", o.orderId, true) : null}
            {field("ط§ظ„طھط§ط±ظٹط®", fmtDateTime(o.timestamp), true)}
            {field("ظ…ظ†ط°", `ظ…ظ† ${nowMs >= o.timestamp ? Math.max(1, Math.round((nowMs - o.timestamp) / 60000)) : 0} ط¯ظ‚ظٹظ‚ط©`)}
          </div>

          {o.rawType != null || o.rawSubType != null ? (
            <div className="border-t border-line/60 pt-2">
              <div className="pt-1 text-2xs font-bold text-muted">ط¨ظٹط§ظ†ط§طھ ط§ظ„ظ…طµط¯ط± (ط®ط§ظ…)</div>
              <div className="space-y-1">
                {field("ط§ظ„ظ†ظˆط¹ ط§ظ„ط®ط§ظ…", o.rawType ?? "â€”", true)}
                {o.rawSubType ? field("ط§ظ„ظ†ظˆط¹ ط§ظ„ظپط±ط¹ظٹ (income)", o.rawSubType, true) : null}
                {field(
                  "ط§ظ„ظ…طµط¯ط±",
                  o.kind === "trade" ? "ط³ط¬ظ„ ط§ظ„طµظپظ‚ط§طھ (userTrades)" : "ط³ط¬ظ„ ط§ظ„ط¹ظ…ظ„ظٹط§طھ (transactions)",
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