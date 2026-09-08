"use client";

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Paper,
  Box,
  Chip,
} from "@mui/material";
import type { StrategyVersion } from "../types/strategy";

const ROWS: Array<{ label: string; render: (v: StrategyVersion) => string }> = [
  { label: "الاسم", render: (v) => v.name },
  { label: "المخاطرة لكل صفقة", render: (v) => `${v.riskPerTrade}%` },
  { label: "أقصى سحب", render: (v) => `${v.maxDrawdown}%` },
  { label: "أقصى مخاطرة يومية", render: (v) => `${v.maxDailyRisk}%` },
  { label: "خسائر متتالية", render: (v) => String(v.maxConsecutiveLosses) },
  { label: "صفقات مفتوحة", render: (v) => String(v.maxOpenPositions) },
  { label: "صفقات يومية", render: (v) => String(v.maxDailyTrades) },
  { label: "هدف الربح", render: (v) => `${v.targetPercent}%` },
  { label: "وقف الخسارة", render: (v) => `${v.stopLossPercent}%` },
  { label: "RR الافتراضية", render: (v) => `1:${v.defaultRR}` },
  { label: "أدنى RR", render: (v) => `1:${v.minimumRR}` },
  { label: "الرافعة", render: (v) => `${v.leverage}x` },
  { label: "نمط الهامش", render: (v) => (v.marginMode === "ISOLATED" ? "معزول" : "متبادل") },
  { label: "نوع الأمر", render: (v) => (v.defaultOrderType === "LIMIT" ? "Limit" : "Market") },
  { label: "عمولة صانع", render: (v) => `${v.makerFee}%` },
  { label: "عمولة مستحوذ", render: (v) => `${v.takerFee}%` },
  { label: "الانزلاق السعري", render: (v) => `${v.slippagePercent}%` },
  { label: "ملاحظات", render: (v) => v.notes || "—" },
];

export function VersionCompareDialog({
  open,
  versions,
  activeVersionId,
  onClose,
}: {
  open: boolean;
  versions: StrategyVersion[];
  activeVersionId: string;
  onClose: () => void;
}) {
  const sorted = useMemo(() => [...versions].sort((a, b) => b.version.localeCompare(a.version)), [versions]);
  const defaultA = activeVersionId ?? sorted[0]?.id ?? "";
  const defaultB = (sorted.find((v) => v.id !== defaultA) ?? sorted[0])?.id ?? "";

  const [aId, setAId] = useState(defaultA);
  const [bId, setBId] = useState(defaultB);

  const a = sorted.find((v) => v.id === aId) ?? sorted[0];
  const b = sorted.find((v) => v.id === bId) ?? sorted[1];

  const diffs = useMemo(() => {
    if (!a || !b) return new Set<number>();
    const set = new Set<number>();
    ROWS.forEach((r, i) => {
      if (r.render(a) !== r.render(b)) set.add(i);
    });
    return set;
  }, [a, b]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" slotProps={{ paper: { sx: { backgroundImage: "none" } } }}>
      <DialogTitle sx={{ fontSize: 16, fontWeight: 800, pb: 1 }}>مقارنة النسخ</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 2, mb: 2 }}>
          <FormControl size="small" fullWidth>
            <InputLabel sx={{ fontSize: 12 }}>النسخة A</InputLabel>
            <Select label="النسخة A" size="small" value={a?.id ?? ""} onChange={(e) => setAId(e.target.value)}>
              {sorted.map((v) => (
                <MenuItem key={v.id} value={v.id}>
                  <span dir="ltr">{v.version}</span> — {v.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" fullWidth>
            <InputLabel sx={{ fontSize: 12 }}>النسخة B</InputLabel>
            <Select label="النسخة B" size="small" value={b?.id ?? ""} onChange={(e) => setBId(e.target.value)}>
              {sorted.map((v) => (
                <MenuItem key={v.id} value={v.id}>
                  <span dir="ltr">{v.version}</span> — {v.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {!a || !b || a.id === b.id ? (
          <Box sx={{ fontSize: 12, color: "text.secondary" }}>اختر نسختين مختلفتين للمقارنة.</Box>
        ) : (
          <TableContainer component={Paper} variant="outlined" sx={{ backgroundImage: "none", bgcolor: "transparent" }}>
            <Table size="small">
              <TableBody>
                <TableRow>
                  <TableCell sx={{ fontWeight: 800, fontSize: 12 }}>الحقل</TableCell>
                  <TableCell sx={{ fontWeight: 800, fontSize: 12 }}>
                    <span dir="ltr">{a.version}</span>
                    {a.id === activeVersionId ? (
                      <Chip size="small" label="نشط" sx={{ mr: 1, height: 18, fontSize: 10 }} />
                    ) : null}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 800, fontSize: 12 }}>
                    <span dir="ltr">{b.version}</span>
                    {b.id === activeVersionId ? (
                      <Chip size="small" label="نشط" sx={{ mr: 1, height: 18, fontSize: 10 }} />
                    ) : null}
                  </TableCell>
                </TableRow>
                {ROWS.map((r, i) => {
                  const diff = diffs.has(i);
                  const valueSx = {
                    fontSize: 12,
                    fontWeight: diff ? 800 : 500,
                    color: diff ? "error.main" : "text.primary",
                    fontFamily: "inherit",
                    fontVariantNumeric: "tabular-nums",
                    textAlign: "right",
                  } as const;
                  return (
                    <TableRow key={r.label} sx={diff ? { bgcolor: "action.hover" } : undefined} hover>
                      <TableCell sx={{ fontSize: 12, color: "text.secondary" }}>{r.label}</TableCell>
                      <TableCell sx={valueSx} dir="ltr">
                        {diff ? "● " : ""}
                        {r.render(a)}
                      </TableCell>
                      <TableCell sx={{ ...valueSx, color: diff ? "success.main" : "text.primary" }} dir="ltr">
                        {diff ? "● " : ""}
                        {r.render(b)}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {diffs.size === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} sx={{ fontSize: 12, color: "text.secondary" }}>
                      لا توجد فروق بين النسختين.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button size="small" onClick={onClose}>
          إغلاق
        </Button>
      </DialogActions>
    </Dialog>
  );
}