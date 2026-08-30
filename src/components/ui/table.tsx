"use client";

import { useMemo, useState } from "react";
import { TablePagination } from "@mui/material";
import { ThemeGate } from "./mui-theme";
import { Badge } from "./primitives";

export interface DataColumn<T> {
  /** Stable id (used as React key / sort id). */
  key: string;
  header: React.ReactNode;
  /** Render the cell for a row. */
  render: (row: T) => React.ReactNode;
  /** Optional numeric/string extractor for sorting. Falls back to no sort. */
  sortValue?: (row: T) => number | string | null;
  align?: "left" | "center" | "right";
  width?: string;
  /** Right-align numeric columns by default when set. */
  numeric?: boolean;
}

export interface DataTableProps<T> {
  columns: DataColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  empty?: React.ReactNode;
  dense?: boolean;
  /** Enable client-side pagination (page size). */
  pageSize?: number;
  className?: string;
}

type SortState = { key: string; dir: "asc" | "desc" } | null;

/** Sortable, responsive DataTable. Pure presentation — no data layer coupling. */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  empty,
  dense = false,
  pageSize,
  className = "",
}: DataTableProps<T>) {
  const [sort, setSort] = useState<SortState>(null);
  const [page, setPage] = useState(0);
  const [perPage, setPerPage] = useState(pageSize ?? 10);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = col.sortValue!(a);
      const vb = col.sortValue!(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
  }, [rows, columns, sort]);

  const paginated = pageSize ? sorted.slice(page * perPage, page * perPage + perPage) : sorted;

  const toggleSort = (key: string) => {
    setSort((prev) => {
      if (prev?.key === key) {
        return prev.dir === "asc" ? { key, dir: "desc" } : null;
      }
      return { key, dir: "asc" };
    });
  };

  return (
    <div className={`overflow-x-auto rounded-panel border border-line ${className}`}>
      <table className={`w-full border-collapse text-right ${dense ? "text-2xs" : "text-xs"}`}>
        <thead>
          <tr className="text-3xs uppercase tracking-wider text-muted">
            {columns.map((c) => (
              <th
                key={c.key}
                style={{ textAlign: c.align ?? (c.numeric ? "right" : "right"), width: c.width }}
                className={`whitespace-nowrap px-3 py-2 ${c.sortValue ? "cursor-pointer select-none" : ""}`}
                onClick={c.sortValue ? () => toggleSort(c.key) : undefined}
              >
                <span className="inline-flex items-center gap-1">
                  {c.header}
                  {c.sortValue && sort?.key === c.key ? (
                    <span className="text-up-fg">{sort.dir === "asc" ? "▲" : "▼"}</span>
                  ) : null}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {paginated.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-6 text-center text-muted">
                {empty ?? "لا توجد بيانات"}
              </td>
            </tr>
          ) : (
            paginated.map((r) => {
              const k = rowKey(r);
              return (
                <tr key={k} className="border-t border-line/60 hover:bg-surface-2/20">
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      dir={c.numeric ? "ltr" : "auto"}
                      style={{ textAlign: c.align ?? (c.numeric ? "right" : "right") }}
                      className={`whitespace-nowrap px-3 py-2 ${c.numeric ? "font-mono tabular-nums" : ""}`}
                    >
                      {c.render(r)}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
      {pageSize && sorted.length > pageSize ? (
        <ThemeGate>
          <div className="border-t border-line/60">
            <TablePagination
              component="div"
              count={sorted.length}
              page={page}
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
          </div>
        </ThemeGate>
      ) : null}
    </div>
  );
}

export { Badge };
