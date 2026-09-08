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
  Divider,
} from "@mui/material";
import type { StrategyMetaPatch, StrategyVersionPatch, StrategyNumbers, OrderType, MarginMode } from "../types/strategy";
import { DEFAULT_VERSION_VALUES, ORDER_TYPE_LABELS, MARGIN_MODE_LABELS, FIRST_VERSION_LABEL } from "../lib/constants";
import { SectionHeading, TextFieldAdapter } from "./fields";

export interface StrategyFormResult {
  meta: StrategyMetaPatch;
  versionLabel?: string;
  defaults?: Partial<StrategyVersionPatch>;
}

const FIELD_ROWS: Array<{ label: string; key: keyof Omit<StrategyVersionPatch, "name" | "notes" | "marginMode" | "defaultOrderType">; suffix?: string }> = [
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

function toNumber(v: string, fallback: number): number {
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

export function StrategyFormDialog({
  open,
  mode,
  initial,
  onClose,
  onSubmit,
}: {
  open: boolean;
  mode: "create" | "edit";
  initial?: StrategyNumbers | null;
  onClose: () => void;
  onSubmit: (result: StrategyFormResult) => void;
}) {
  const defaults: Record<string, number> = DEFAULT_VERSION_VALUES as unknown as Record<string, number>;

  // State is mounted fresh via the parent's `key` per opened strategy so the
  // dialog starts clean every time it is opened for a different target.
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [symbol, setSymbol] = useState(initial?.symbol ?? "BTCUSD");
  const [market, setMarket] = useState(initial?.market ?? "Binance Futures");
  const [versionLabel, setVersionLabel] = useState(FIRST_VERSION_LABEL);
  const [notes, setNotes] = useState("");
  const [nameError, setNameError] = useState(false);

  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(FIELD_ROWS.map((r) => [r.key, String(defaults[r.key])]))
  );
  const [marginMode, setMarginMode] = useState<MarginMode>(DEFAULT_VERSION_VALUES.marginMode);
  const [orderType, setOrderType] = useState<OrderType>(DEFAULT_VERSION_VALUES.defaultOrderType);

  const handleSubmit = () => {
    if (!name.trim()) {
      setNameError(true);
      return;
    }

    const meta: StrategyMetaPatch = {
      name: name.trim(),
      description: description.trim(),
      symbol: symbol.trim() || "BTCUSD",
      market: market.trim() || "Binance Futures",
    };

    if (mode === "create") {
      const defaultsObj: Partial<StrategyVersionPatch> = {
        riskPerTrade: toNumber(values.riskPerTrade, defaults.riskPerTrade),
        maxDrawdown: toNumber(values.maxDrawdown, defaults.maxDrawdown),
        maxDailyRisk: toNumber(values.maxDailyRisk, defaults.maxDailyRisk),
        maxConsecutiveLosses: toNumber(values.maxConsecutiveLosses, defaults.maxConsecutiveLosses),
        maxOpenPositions: toNumber(values.maxOpenPositions, defaults.maxOpenPositions),
        maxDailyTrades: toNumber(values.maxDailyTrades, defaults.maxDailyTrades),
        targetPercent: toNumber(values.targetPercent, defaults.targetPercent),
        stopLossPercent: toNumber(values.stopLossPercent, defaults.stopLossPercent),
        defaultRR: toNumber(values.defaultRR, defaults.defaultRR),
        minimumRR: toNumber(values.minimumRR, defaults.minimumRR),
        leverage: toNumber(values.leverage, defaults.leverage),
        makerFee: toNumber(values.makerFee, defaults.makerFee),
        takerFee: toNumber(values.takerFee, defaults.takerFee),
        slippagePercent: toNumber(values.slippagePercent, defaults.slippagePercent),
        marginMode,
        defaultOrderType: orderType,
        notes: notes.trim(),
      };
      onSubmit({
        meta,
        versionLabel: versionLabel.trim() || FIRST_VERSION_LABEL,
        defaults: defaultsObj,
      });
    } else {
      onSubmit({ meta });
    }
    onClose();
  };

  const renderVersionBlock = () => (
    <>
      {mode === "create" ? (
        <Box>
          <SectionHeading title="عام" hint="بيانات التعريف الاستراتيجية وبدء النسخة الأولى." />
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 2 }}>
            <TextField
              label="تسمية النسخة الأولى"
              size="small"
              dir="ltr"
              value={versionLabel}
              onChange={(e) => setVersionLabel(e.target.value)}
              slotProps={{ input: { sx: { fontSize: 13, fontFamily: "inherit" } } }}
            />
          </Box>
        </Box>
      ) : null}

      <Box>
        <SectionHeading title="إدارة المخاطر" />
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 2 }}>
          {FIELD_ROWS.slice(0, 6).map((r) => (
            <TextField
              key={r.key}
              label={r.label}
              size="small"
              value={values[r.key]}
              inputMode="decimal"
              onChange={(e) => setValues((v) => ({ ...v, [r.key]: e.target.value }))}
              slotProps={{
                input: {
                  endAdornment: r.suffix ? r.suffix : undefined,
                },
              }}
            />
          ))}
        </Box>
      </Box>

      <Box>
        <SectionHeading title="أهداف التداول" />
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 2 }}>
          {FIELD_ROWS.slice(6, 10).map((r) => (
            <TextField
              key={r.key}
              label={r.label}
              size="small"
              value={values[r.key]}
              inputMode="decimal"
              onChange={(e) => setValues((v) => ({ ...v, [r.key]: e.target.value }))}
              slotProps={{
                input: {
                  endAdornment: r.suffix ? r.suffix : undefined,
                },
              }}
            />
          ))}
        </Box>
      </Box>

      <Box>
        <SectionHeading title="تنفيذ الصفقات" />
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 2 }}>
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
          {FIELD_ROWS.slice(10).map((r) => (
            <TextField
              key={r.key}
              label={r.label}
              size="small"
              value={values[r.key]}
              inputMode="decimal"
              onChange={(e) => setValues((v) => ({ ...v, [r.key]: e.target.value }))}
              slotProps={{
                input: {
                  endAdornment: r.suffix ? r.suffix : undefined,
                },
              }}
            />
          ))}
        </Box>
      </Box>

      <Box>
        <SectionHeading title="ملاحظات" />
        <TextField
          label="ملاحظات النسخة"
          size="small"
          multiline
          minRows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          slotProps={{ input: { sx: { fontSize: 13 } } }}
        />
      </Box>
    </>
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
        {mode === "create" ? "إنشاء استراتيجية جديدة" : "تعديل الاستراتيجية"}
      </DialogTitle>
      <DialogContent dividers>
        <Box>
          <Box>
            <SectionHeading title="عام" hint="البيانات التعريفية للاستراتيجية." />
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 2 }}>
              <TextField
                required
                label="اسم الاستراتيجية"
                size="small"
                error={nameError}
                helperText={nameError ? "الاسم مطلوب." : undefined}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (e.target.value.trim()) setNameError(false);
                }}
                autoFocus
              />
              <TextFieldAdapter label="رمز السوق" value={symbol} onChange={(e) => setSymbol(e.target.value)} />
              <TextFieldAdapter label="السوق" value={market} onChange={(e) => setMarket(e.target.value)} />
            </Box>
            <Box sx={{ mt: 2 }}>
              <TextFieldAdapter
                label="وصف الاستراتيجية"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Box>
          </Box>

          <Divider sx={{ my: 2 }} />

          {renderVersionBlock()}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button size="small" onClick={onClose}>
          إلغاء
        </Button>
        <Button size="small" variant="contained" onClick={handleSubmit}>
          {mode === "create" ? "إنشاء" : "حفظ"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}