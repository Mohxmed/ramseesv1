"use client";

import { useState } from "react";
import {
  Paper,
  Box,
  Tooltip,
  IconButton,
  Button,
  Typography,
} from "@mui/material";
import {
  LayersIcon,
  CopyIcon,
  GitCompareIcon,
  PencilIcon,
  TrashIcon,
  PlusIcon,
} from "@/components/icons/icons";
import {
  Badge,
  Status,
  tokens,
} from "@/components/ui";
import type { StrategyNumbers, StrategyVersion } from "../types/strategy";
import { StrategyVersionTable } from "./StrategyVersionTable";

function activeVersion(s: StrategyNumbers): StrategyVersion {
  return s.versions.find((v) => v.id === s.activeVersionId) ?? s.versions[0];
}

export function StrategyCard({
  strategy,
  open,
  onToggleOpen,
  onEditMeta,
  onDuplicate,
  onDelete,
  onCompare,
  onCreateVersion,
  onSetActiveVersion,
  onEditVersion,
  onDeleteVersion,
}: {
  strategy: StrategyNumbers;
  open: boolean;
  onToggleOpen: () => void;
  onEditMeta: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onCompare: () => void;
  onCreateVersion: () => void;
  onSetActiveVersion: (versionId: string) => void;
  onEditVersion: (version: StrategyVersion) => void;
  onDeleteVersion: (versionId: string) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const active = activeVersion(strategy);

  const summary: Array<{ label: string; value: string }> = [
    { label: "مخاطرة", value: `${active.riskPerTrade}%` },
    { label: "هدف", value: `${active.targetPercent}%` },
    { label: "وقف", value: `${active.stopLossPercent}%` },
    { label: "RR", value: `1:${active.defaultRR}` },
    { label: "رافعة", value: `${active.leverage}x` },
  ];

  return (
    <Paper
      variant="outlined"
      sx={{
        backgroundImage: "none",
        borderRadius: 2,
        p: 3,
        bgcolor: "rgba(24,24,27,0.6)",
        borderColor: open ? tokens.colors.up : tokens.colors.line,
      }}
    >
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2.5, alignItems: "flex-start", justifyContent: "space-between" }}>
        <Box sx={{ minWidth: 260, flex: "1 1 280px" }}>
          <Box sx={{ display: "flex", flexDirection: "row", gap: 1.5, alignItems: "center", flexWrap: "wrap" }}>
            <Typography sx={{ fontSize: 16, fontWeight: 800, color: "text.primary" }}>
              {strategy.name}
            </Typography>
            <Badge tone="neutral" ltr>
              {strategy.symbol}
            </Badge>
            <Badge tone="quiet" ltr>
              {strategy.market}
            </Badge>
            {strategy.versions.length > 1 ? (
              <Badge tone="good">{strategy.versions.length} نسخ</Badge>
            ) : (
              <Badge tone="quiet">نسخة واحدة</Badge>
            )}
          </Box>
          {strategy.description ? (
            <Typography sx={{ mt: 1, fontSize: 12.5, color: "text.secondary" }}>
              {strategy.description}
            </Typography>
          ) : null}
          <Box sx={{ mt: 2 }}>
            <Status label={`النشطة: ${active.version}`} tone="good" />
          </Box>
        </Box>

        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
          {summary.map((s) => (
            <div
              key={s.label}
              className="inline-flex items-baseline gap-1.5 rounded-chip border border-line bg-surface-2/40 px-2 py-1 text-2xs leading-4"
            >
              <span className="text-muted">{s.label}</span>
              <span dir="ltr" className="font-bold tabular-nums text-zinc-100">
                {s.value}
              </span>
            </div>
          ))}
        </Box>
      </Box>

      <Box sx={{ mt: 2, display: "flex", flexWrap: "wrap", gap: 0.5 }}>
        <Button
          size="small"
          variant={open ? "outlined" : "contained"}
          startIcon={<LayersIcon className="h-4 w-4" />}
          onClick={onToggleOpen}
        >
          {open ? "إغلاق الإصدارات" : "عرض الإصدارات"}
        </Button>
        <Tooltip title="أضف نسخة مستقلة جديدة">
          <IconButton size="small" onClick={onCreateVersion} sx={{ color: "success.main" }}>
            <PlusIcon className="h-4 w-4" />
          </IconButton>
        </Tooltip>
        <Tooltip title="نسخ الاستراتيجية">
          <IconButton size="small" onClick={onDuplicate}>
            <CopyIcon className="h-4 w-4" />
          </IconButton>
        </Tooltip>
        <Tooltip title="مقارنة النسخ">
          <IconButton size="small" onClick={onCompare}>
            <GitCompareIcon className="h-4 w-4" />
          </IconButton>
        </Tooltip>
        <Tooltip title="تعديل البيانات">
          <IconButton size="small" onClick={onEditMeta}>
            <PencilIcon className="h-4 w-4" />
          </IconButton>
        </Tooltip>
        {!confirmDelete ? (
          <Tooltip title="حذف الاستراتيجية">
            <IconButton size="small" onClick={() => setConfirmDelete(true)} sx={{ color: "error.main" }}>
              <TrashIcon className="h-4 w-4" />
            </IconButton>
          </Tooltip>
        ) : (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Button size="small" color="error" onClick={() => { setConfirmDelete(false); onDelete(); }}>
              تأكيد الحذف
            </Button>
            <Button size="small" onClick={() => setConfirmDelete(false)}>
              إلغاء
            </Button>
          </Box>
        )}
      </Box>

      {open ? (
        <Box sx={{ mt: 2.5 }}>
          <Box sx={{ mb: 1.5, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Box sx={{ fontSize: 13, fontWeight: 800, color: "text.primary" }}>
              سجل الإصدارات
            </Box>
            <Button size="small" startIcon={<PlusIcon className="h-4 w-4" />} onClick={onCreateVersion}>
              إنشاء نسخة
            </Button>
          </Box>
          <StrategyVersionTable
            versions={strategy.versions}
            activeVersionId={strategy.activeVersionId}
            onSetActive={onSetActiveVersion}
            onEdit={onEditVersion}
            onDelete={onDeleteVersion}
          />
        </Box>
      ) : null}
    </Paper>
  );
}