"use client";

import { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Box,
} from "@mui/material";
import type { StrategyVersion, StrategyVersionPatch, OrderType, MarginMode } from "../types/strategy";
import { ORDER_TYPE_LABELS, MARGIN_MODE_LABELS } from "../lib/constants";
import { SectionHeading } from "./fields";

const NUMERIC_FIELDS: Array<{ label: string; key: keyof StrategyVersionPatch; suffix?: string }> = [
  { label: "المخاطرة لكل صفقة", key: "riskPerTrade", suffix: "%" },
  { label: "أقصى سحب مسموح", key: "maxDrawdown", suffix: "%" },
  { label: "أقصى مخاطرة يومية", key: "maxDailyRisk", suffix: "%" },
  { label: "خسائر متتالية", key: "maxConsecutiveLosses" },
  { label: "صفقات مفتوحة كحد أقصى", key: "maxOpenPositions" },
  { label: "صفقات يومية كحد أقصى", key: "maxDailyTrades" },
  { label: "هدف الربح", key: "targetPercent", suffix: "%" },
  { label: "وقف الخسارة", key: "stopLossPercent", suffix: "%" },
  { label: "نسبة RR الافتراضية", key: "defaultRR" },
  { label: "أدنى RR مسموح", key: "minimumRR" },
  { label: "الرافعة المالية", key: "leverage", suffix: "x" },
  { label: "عمولة صانع السوق", key: "makerFee", suffix: "%" },
  { label: "عمولة مستحوذ السوق", key: "takerFee", suffix: "%" },
  { label: "الانزلاق السعري", key: "slippagePercent", suffix: "%" },
];

const RISK_KEYS = NUMERIC_FIELDS.slice(0, 6);
const TRADE_KEYS = NUMERIC_FIELDS.slice(6, 10);
const EXEC_KEYS = NUMERIC_FIELDS.slice(10);

function str(v: number): string {
  return String(v);
}

export function VersionFormDialog({
  open,
  version,
  strategyName,
  onClose,
  onSubmit,
}: {
  open: boolean;
  version: StrategyVersion | null;
  strategyName: string;
  onClose: () => void;
  onSubmit: (patch: StrategyVersionPatch) => void;
}) {
  const [name, setName] = useState(version?.name ?? "");
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(NUMERIC_FIELDS.map((f) => [f.key, str(Number((version?.[f.key] ?? 0))) ]))
  );
  const [notes, setNotes] = useState(version?.notes ?? "");
  const [marginMode, setMarginMode] = useState<MarginMode>(version?.marginMode ?? "ISOLATED");
  const [orderType, setOrderType] = useState<OrderType>(version?.defaultOrderType ?? "LIMIT");
  const [nameError, setNameError] = useState(false);

  const submit = () => {
    if (!name.trim()) {
      setNameError(true);
      return;
    }
    const patch: StrategyVersionPatch = {
      name: name.trim(),
      notes: notes.trim(),
      marginMode,
      defaultOrderType: orderType,
    };
    for (const f of NUMERIC_FIELDS) {
      const n = Number.parseFloat(values[f.key]);
      (patch as Record<string, string | number>)[f.key] = Number.isFinite(n) ? n : Number((version?.[f.key] ?? 0));
    }
    onSubmit(patch);
    onClose();
  };

  const renderFields = (
    keys: typeof RISK_KEYS,
    section: string,
    hint: string
  ) => (
    <Box>
      <SectionHeading title={section} hint={hint} />
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 2 }}>
        {keys.map((f) => (
          <TextField
            key={f.key}
            label={f.label}
            size="small"
            value={values[f.key]}
            inputMode="decimal"
            onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
            slotProps={{
              input: { endAdornment: f.suffix ?? undefined },
            }}
          />
        ))}

        {section === "تنفيذ الصفقات" ? (
          <>
            <FormControl size="small">
              <InputLabel sx={{ fontSize: 12 }}>نمط الهامش</InputLabel>
              <Select
                label="نمط الهامش"
                size="small"
                value={marginMode}
                onChange={(e) => setMarginMode(e.target.value as MarginMode)}
              >
                {Object.entries(MARGIN_MODE_LABELS).map(([k, l]) => (
                  <MenuItem key={k} value={k}>
                    {l}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small">
              <InputLabel sx={{ fontSize: 12 }}>نوع الأمر الافتراضي</InputLabel>
              <Select
                label="نوع الأمر الافتراضي"
                size="small"
                value={orderType}
                onChange={(e) => setOrderType(e.target.value as OrderType)}
              >
                {Object.entries(ORDER_TYPE_LABELS).map(([k, l]) => (
                  <MenuItem key={k} value={k}>
                    {l}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </>
        ) : null}
      </Box>
    </Box>
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      slotProps={{ paper: { sx: { backgroundImage: "none" } } }}
    >
      <DialogTitle sx={{ fontSize: 16, fontWeight: 800, pb: 1 }}>
        تعديل النسخة {version?.version ?? ""} — {strategyName}
      </DialogTitle>
      <DialogContent dividers>
        <Box>
          <SectionHeading title="عام" hint="تعديل النسخة لا يغيّر أي نسخة أخرى أبدًا." />
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 2 }}>
            <TextField
              required
              label="اسم النسخة"
              size="small"
              error={nameError}
              helperText={nameError ? "الاسم مطلوب." : undefined}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (e.target.value.trim()) setNameError(false);
              }}
            />
            <TextField
              label="التسمية (قراءة فقط)"
              size="small"
              dir="ltr"
              disabled
              value={version?.version ?? ""}
            />
          </Box>

          <Box sx={{ mt: 2 }}>{renderFields(RISK_KEYS, "إدارة المخاطر", "")}</Box>
          <Box>{renderFields(TRADE_KEYS, "أهداف التداول", "")}</Box>
          <Box>{renderFields(EXEC_KEYS, "تنفيذ الصفقات", "")}</Box>

          <Box>
            <SectionHeading title="ملاحظات" />
            <TextField
              label="ملاحظات النسخة"
              size="small"
              multiline
              minRows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button size="small" onClick={onClose}>
          إلغاء
        </Button>
        <Button size="small" variant="contained" onClick={submit}>
          حفظ النسخة
        </Button>
      </DialogActions>
    </Dialog>
  );
}