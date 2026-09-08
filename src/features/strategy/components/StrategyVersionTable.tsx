"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Box,
} from "@mui/material";
import { CheckIcon, PencilIcon, TrashIcon } from "@/components/icons/icons";
import { Badge } from "@/components/ui";
import type { StrategyVersion } from "../types/strategy";

const cellSx = { fontSize: 12, py: 1, borderColor: "divider" } as const;

export function StrategyVersionTable({
  versions,
  activeVersionId,
  onSetActive,
  onEdit,
  onDelete,
}: {
  versions: StrategyVersion[];
  activeVersionId: string;
  onSetActive: (versionId: string) => void;
  onEdit: (version: StrategyVersion) => void;
  onDelete: (versionId: string) => void;
}) {
  const sorted = [...versions].sort((a, b) => b.version.localeCompare(a.version));
  const canDelete = versions.length > 1;

  return (
    <Box>
      <TableContainer
        component={Paper}
        variant="outlined"
        sx={{ backgroundImage: "none", bgcolor: "transparent" }}
      >
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ ...cellSx, fontWeight: 800 }}>الإصدار</TableCell>
              <TableCell sx={{ ...cellSx, fontWeight: 800 }}>الاسم</TableCell>
              <TableCell sx={{ ...cellSx, fontWeight: 800 }}>المخاطرة</TableCell>
              <TableCell sx={{ ...cellSx, fontWeight: 800 }}>الهدف</TableCell>
              <TableCell sx={{ ...cellSx, fontWeight: 800 }}>الوقف</TableCell>
              <TableCell sx={{ ...cellSx, fontWeight: 800 }}>RR</TableCell>
              <TableCell sx={{ ...cellSx, fontWeight: 800 }}>الرافعة</TableCell>
              <TableCell sx={{ ...cellSx, fontWeight: 800 }}>الحالة</TableCell>
              <TableCell align="left" sx={{ ...cellSx, fontWeight: 800 }}>
                إجراءات
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sorted.map((v) => {
              const active = v.id === activeVersionId;
              return (
                <TableRow key={v.id} hover sx={{ "&:last-child td": { borderBottom: 0 } }}>
                  <TableCell sx={{ ...cellSx, dir: "ltr", fontFamily: "monospace" }}>
                    <Box sx={{ fontWeight: 700, color: active ? "success.main" : "text.primary" }}>
                      {v.version}
                    </Box>
                    {v.createdFrom ? (
                      <Box sx={{ fontSize: 10, color: "text.secondary" }}>من {v.createdFrom}</Box>
                    ) : null}
                  </TableCell>
                  <TableCell sx={cellSx}>{v.name}</TableCell>
                  <TableCell sx={cellSx} dir="ltr">
                    {v.riskPerTrade}%
                  </TableCell>
                  <TableCell sx={cellSx} dir="ltr">
                    {v.targetPercent}%
                  </TableCell>
                  <TableCell sx={cellSx} dir="ltr">
                    {v.stopLossPercent}%
                  </TableCell>
                  <TableCell sx={cellSx} dir="ltr">
                    1:{v.defaultRR}
                  </TableCell>
                  <TableCell sx={cellSx} dir="ltr" style={{ direction: "ltr" }}>
                    {v.leverage}x
                  </TableCell>
                  <TableCell sx={cellSx}>
                    {active ? (
                      <Badge tone="good">نشط</Badge>
                    ) : (
                      <Box sx={{ fontSize: 11, color: "text.secondary" }}>غير نشط</Box>
                    )}
                  </TableCell>
                  <TableCell align="left" sx={{ ...cellSx, width: 132 }}>
                    <Tooltip title={active ? "النسخة النشطة" : "تعيين كنسخة نشطة"}>
                      <span>
                        <IconButton
                          size="small"
                          disabled={active}
                          onClick={() => onSetActive(v.id)}
                          sx={{ color: active ? "success.main" : "action.active" }}
                        >
                          <CheckIcon className="h-4 w-4" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="تعديل النسخة">
                      <IconButton size="small" onClick={() => onEdit(v)}>
                        <PencilIcon className="h-4 w-4" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={canDelete ? "حذف النسخة" : "أبقِ نسخة واحدة على الأقل"}>
                      <span>
                        <IconButton
                          size="small"
                          disabled={!canDelete}
                          onClick={() => onDelete(v.id)}
                          sx={{ color: "error.main" }}
                        >
                          <TrashIcon className="h-4 w-4" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}