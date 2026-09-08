"use client";

import { useState } from "react";
import {
  Paper,
  Box,
  Chip,
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
  CheckIcon,
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
        borderColor: open ? "rgba(16,185,129,0.4)" : tokens.colors.line,
      }}
    >
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "flex-start", justifyContent: "space-between" }}>
        <Box sx={{ minWidth: 0, flex: "1 1 280px" }}>
          <Box sx={{ display: "flex", flexDirection: "row", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
            <Typography sx={{ fontSize: 15, fontWeight: 800, color: "text.primary" }}>
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
            <Typography sx={{ mt: 0.75, fontSize: 12, color: "text.secondary" }}>
              {strategy.description}
            </Typography>
          ) : null}
          <Box sx={{ mt: 1.5 }}>
            <Status label={`النشطة: ${active.version}`} tone="good" />
          </Box>
        </Box>

        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
          {summary.map((s) => (
            <Chip
              key={s.label}
              label={
                <Box sx={{ fontSize: 11, display: "flex", alignItems: "center", gap: 0.75 }}>
                  <Box component="span" sx={{ color: "text.secondary" }}>{s.label}</Box>
                  <Box component="span" dir="ltr" sx={{ fontWeight: 800 }}>{s.value}</Box>
                </Box>
              }
              size="small"
              variant="outlined"
              sx={{ borderColor: tokens.colors.line, height: 26 }}
            />
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
            <CheckIcon className="h-3.5 w-3.5 text-muted" />
          </Box>
        )}
      </Box>

      {open ? (
        <Box sx={{ mt: 2.5 }}>
          <Box sx={{ mb: 1.5, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Box sx={{ fontSize: 12, fontWeight: 800, color: "text.primary" }}>
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