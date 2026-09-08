"use client";

import { useMemo, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  ToggleButtonGroup,
  ToggleButton,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip,
  Divider,
  FormHelperText,
} from "@mui/material";
import {
  ArrowLeftIcon,
  CalculatorIcon,
  SaveIcon,
  RotateIcon,
  TrashIcon,
  NetworkIcon,
} from "@/components/icons/icons";
import {
  PageHeader,
  Status,
  Select as UiSelect,
} from "@/components/ui";
import type { Direction, OrderType } from "../types/strategy";
import {
  DEFAULT_ACCOUNT_BALANCE,
  DEFAULT_POSITION_SIZE,
  RR_PRESETS,
} from "../lib/constants";
import {
  calculateOutcomes,
  calculatePositionSize,
  calculateQuantity,
  calculateTPFromRR,
  type ResolvedPosition,
} from "../lib/calculations";
import {
  validateCalculator,
  hasErrors,
  calculateRiskWarnings,
  type ValidationErrors,
} from "../lib/validation";
import type { StrategyVersion } from "../types/strategy";
import { useStrategyNumbers } from "../hooks/useStrategyNumbers";
import { useScenarios } from "../hooks/useScenarios";
import { buildSnapshot, scenarioNameSuggestion, type SavedScenario } from "../lib/scenario";
import { CalculatorResults } from "./CalculatorResults";
import { formatQty } from "../lib/format";

type SizeMode = "size" | "quantity";

interface Preset {
  strategyId: string;
  name: string;
  label: string;
}

const INHERITED_FIELDS = ["leverage", "makerFee", "takerFee", "slippagePercent", "entryOrderType"] as const;

const INITIAL = {
  accountBalance: String(DEFAULT_ACCOUNT_BALANCE),
  asset: "BTC",
  direction: "LONG" as Direction,
  entry: "40000",
  stopLoss: "39600",
  takeProfit: "41200",
  positionSize: String(DEFAULT_POSITION_SIZE),
  quantity: "",
  leverage: "20",
  entryOrderType: "LIMIT" as OrderType,
  tpOrderType: "LIMIT" as OrderType,
  slOrderType: "MARKET" as OrderType,
  makerFee: "0.01",
  takerFee: "0.05",
  slippagePercent: "0.03",
};

function asNum(v: string): number {
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : NaN;
}

export function CalculatorPage() {
  const store = useStrategyNumbers();
  const scenarios = useScenarios();

  const [accountBalance, setAccountBalance] = useState(INITIAL.accountBalance);
  const [asset, setAsset] = useState(INITIAL.asset);
  const [direction, setDirection] = useState<Direction>(INITIAL.direction);
  const [entry, setEntry] = useState(INITIAL.entry);
  const [stopLoss, setStopLoss] = useState(INITIAL.stopLoss);
  const [takeProfit, setTakeProfit] = useState(INITIAL.takeProfit);
  const [sizeMode, setSizeMode] = useState<SizeMode>("size");
  const [positionSize, setPositionSize] = useState(INITIAL.positionSize);
  const [quantity, setQuantity] = useState(INITIAL.quantity);
  const [leverage, setLeverage] = useState(INITIAL.leverage);
  const [entryOrderType, setEntryOrderType] = useState<OrderType>(INITIAL.entryOrderType);
  const [tpOrderType, setTpOrderType] = useState<OrderType>(INITIAL.tpOrderType);
  const [slOrderType, setSlOrderType] = useState<OrderType>(INITIAL.slOrderType);
  const [makerFee, setMakerFee] = useState(INITIAL.makerFee);
  const [takerFee, setTakerFee] = useState(INITIAL.takerFee);
  const [slippagePercent, setSlippagePercent] = useState(INITIAL.slippagePercent);

  const [preset, setPreset] = useState<Preset | null>(null);
  const [inherited, setInherited] = useState<Set<string>>(() => new Set());

  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");

  // --- Strategy preset plumbing -------------------------------------------------
  const strategyPresets = useMemo(() => {
    return store.strategies.map((s) => {
      const active = s.versions.find((v) => v.id === s.activeVersionId) ?? s.versions[0];
      return { strategy: s, version: active };
    });
  }, [store.strategies]);

  const activeVersion: StrategyVersion | null = useMemo(() => {
    const found = strategyPresets.find((p) => p.strategy.id === preset?.strategyId);
    return found?.version ?? null;
  }, [strategyPresets, preset]);

  const choosePreset = (strategyId: string) => {
    if (!strategyId) {
      setPreset(null);
      setInherited(new Set());
      return;
    }
    const found = strategyPresets.find((p) => p.strategy.id === strategyId);
    if (!found) return;
    const v = found.version;
    setLeverage(String(v.leverage));
    setMakerFee(String(v.makerFee));
    setTakerFee(String(v.takerFee));
    setSlippagePercent(String(v.slippagePercent));
    setEntryOrderType(v.defaultOrderType);
    setPreset({ strategyId, name: found.strategy.name, label: v.version });
    setInherited(new Set(INHERITED_FIELDS));
  };

  const markCustom = (key: string) => {
    setInherited((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  const inheriting = (key: string) => (preset ? inherited.has(key) : false);

  const presetChip = (key: string) =>
    preset ? (
      <FormHelperText sx={{ mx: 0.5, mt: 0.5, fontSize: 9 }}>
        {inheriting(key) ? "موروثة من الاستراتيجية" : "قيمة مخصصة"}
      </FormHelperText>
    ) : null;

  // --- Derived position -----------------------------------------------------------
  const entryN = asNum(entry);
  const stopN = asNum(stopLoss);
  const tpN = asNum(takeProfit);
  const leverageN = asNum(leverage);
  const balanceN = asNum(accountBalance);

  const sizeN = sizeMode === "size" ? asNum(positionSize) : calculatePositionSize(asNum(quantity), entryN);
  const qtyN = sizeMode === "size" ? calculateQuantity(sizeN, entryN) : asNum(quantity);
  const coerceSize = sizeMode === "size" ? positionSize : formatQty(sizeN, 8);
  const coerceQty = sizeMode === "size" ? formatQty(qtyN, 8) : quantity;

  const errors: ValidationErrors = useMemo(() => {
    if (Number.isNaN(entryN) || Number.isNaN(stopN) || Number.isNaN(tpN)) return {};
    return validateCalculator({
      direction,
      entry: entryN,
      stopLoss: stopN,
      takeProfit: tpN,
      accountBalance: Number.isNaN(balanceN) ? 0 : balanceN,
      positionSize: Number.isNaN(sizeN) ? 0 : sizeN,
      quantity: Number.isNaN(qtyN) ? 0 : qtyN,
      leverage: Number.isNaN(leverageN) ? 1 : leverageN,
    });
  }, [direction, entryN, stopN, tpN, balanceN, sizeN, qtyN, leverageN]);

  const isValid = !hasErrors(errors);

  const result = useMemo(() => {
    if (!isValid || Number.isNaN(sizeN) || Number.isNaN(qtyN)) return null;
    const position: ResolvedPosition = {
      direction,
      entry: entryN,
      stopLoss: stopN,
      takeProfit: tpN,
      accountBalance: balanceN,
      positionSize: sizeN,
      quantity: qtyN,
      leverage: leverageN,
    };
    return calculateOutcomes(position, {
      entryOrderType,
      tpOrderType,
      slOrderType,
      makerFee: asNum(makerFee),
      takerFee: asNum(takerFee),
      slippagePercent: asNum(slippagePercent),
    });
  }, [isValid, sizeN, qtyN, direction, entryN, stopN, tpN, balanceN, leverageN, entryOrderType, tpOrderType, slOrderType, makerFee, takerFee, slippagePercent]);

  const warnings = useMemo(
    () => (result ? calculateRiskWarnings(result, activeVersion, balanceN) : []),
    [result, activeVersion, balanceN]
  );

  // --- RR presets --------------------------------------------------------------
  const activeRR: number | null = useMemo(() => {
    if (Number.isNaN(entryN) || Number.isNaN(stopN) || Number.isNaN(tpN)) return null;
    for (const rr of RR_PRESETS) {
      if (Math.abs(calculateTPFromRR(entryN, stopN, rr) - tpN) < 0.01) return rr;
    }
    return null;
  }, [entryN, stopN, tpN]);

  const applyRR = (rr: number) => {
    if (Number.isNaN(entryN) || Number.isNaN(stopN)) return;
    setTakeProfit(String(calculateTPFromRR(entryN, stopN, rr)));
  };

  // --- Save / load scenarios ----------------------------------------------------
  const openSave = () => {
    if (!result) return;
    setSaveName("");
    setSaveOpen(true);
  };

  const confirmSave = () => {
    if (!result) return;
    const snapshot = buildSnapshot({
      strategyId: preset?.strategyId ?? null,
      strategyName: preset?.name ?? null,
      versionLabel: preset?.label ?? null,
      direction,
      entry: entryN,
      stopLoss: stopN,
      takeProfit: tpN,
      positionSize: sizeN,
      quantity: qtyN,
      leverage: leverageN,
      entryOrderType,
      tpOrderType,
      slOrderType,
      makerFee: asNum(makerFee),
      takerFee: asNum(takerFee),
      slippagePercent: asNum(slippagePercent),
      accountBalance: balanceN,
      asset,
    });
    scenarios.saveScenario(saveName, snapshot);
    setSaveOpen(false);
  };

  const loadScenario = (sc: SavedScenario) => {
    const snap = sc.snapshot;
    setAccountBalance(String(snap.accountBalance));
    setAsset(snap.asset || "BTC");
    setDirection(snap.direction);
    setEntry(String(snap.entry));
    setStopLoss(String(snap.stopLoss));
    setTakeProfit(String(snap.takeProfit));
    setLeverage(String(snap.leverage));
    setMakerFee(String(snap.makerFee));
    setTakerFee(String(snap.takerFee));
    setSlippagePercent(String(snap.slippagePercent));
    setEntryOrderType(snap.entryOrderType);
    setTpOrderType(snap.tpOrderType);
    setSlOrderType(snap.slOrderType);
    setPositionSize(String(snap.positionSize));
    setQuantity(String(snap.quantity));
    setPreset(null);
    setInherited(new Set());
  };

  const resetAll = () => {
    setAccountBalance(INITIAL.accountBalance);
    setAsset(INITIAL.asset);
    setDirection(INITIAL.direction);
    setEntry(INITIAL.entry);
    setStopLoss(INITIAL.stopLoss);
    setTakeProfit(INITIAL.takeProfit);
    setPositionSize(INITIAL.positionSize);
    setQuantity(INITIAL.quantity);
    setLeverage(INITIAL.leverage);
    setEntryOrderType(INITIAL.entryOrderType);
    setTpOrderType(INITIAL.tpOrderType);
    setSlOrderType(INITIAL.slOrderType);
    setMakerFee(INITIAL.makerFee);
    setTakerFee(INITIAL.takerFee);
    setSlippagePercent(INITIAL.slippagePercent);
    setPreset(null);
    setInherited(new Set());
  };

  return (
    <Box>
      <PageHeader
        eyebrow="Strategy — Risk Calculator"
        icon={<CalculatorIcon className="h-5 w-5" />}
        title="حاسبة المخاطر"
        description="قم بتعيين الدخول، وقف الخسارة، والهدف على صفقة LONG أو SHORT، واختر نوعي أوامر الدخول والخروج، واحصل على الحجم، الهامش، نسب المخاطرة والمكسب، الرسوم والانزلاق السعري، وصافي الربح/الخسارة."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Status
              label={
                scenarios.status === "saved"
                  ? "سيناريوهات محفوظة"
                  : scenarios.status === "saving"
                    ? "جارٍ الحفظ…"
                    : scenarios.status === "error"
                      ? "خطأ في المزامنة"
                      : "محلي"
              }
              tone={scenarios.status === "saved" || scenarios.status === "local" ? "good" : scenarios.status === "error" ? "down" : "warn"}
            />
            <Button size="small" variant="outlined" startIcon={<RotateIcon className="h-4 w-4" />} onClick={resetAll}>
              إعادة الضبط
            </Button>
            <Button
              size="small"
              variant="contained"
              startIcon={<SaveIcon className="h-4 w-4" />}
              disabled={!result}
              onClick={openSave}
            >
              حفظ السيناريو
            </Button>
          </div>
        }
      />

      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 2.5, mt: 4 }}>
        {/* Inputs — first column in RTL flow */}
        <Box sx={{ gridColumn: { xs: "span 12", md: "span 5" }, display: "flex", flexDirection: "column", gap: 2 }}>
          <Paper variant="outlined" sx={{ p: 2.5, backgroundImage: "none", bgcolor: "rgba(24,24,27,0.6)" }}>
            <Typography sx={{ fontSize: 11, fontWeight: 800, color: "text.secondary", mb: 1.5 }}>
              الاستراتيجية
            </Typography>
            <UiSelect
              value={preset?.strategyId ?? ""}
              onChange={choosePreset}
              label="استراتيجية (النسخة النشطة)"
              placeholder={
                strategyPresets.length
                  ? "اختر استراتيجية لاستيراد أرقامها"
                  : "لا توجد استراتيجيات بعد — أنشئها أولًا"
              }
              options={strategyPresets.map((p) => ({
                value: p.strategy.id,
                label: `${p.strategy.name} — ${p.version.version}`,
              }))}
            />
            {preset ? (
              <FormHelperText sx={{ fontSize: 10 }}>
                الإعدادات النشطة مستوردة من {preset.name} {preset.label}. عدّل أي رقم ليصبح مخصصًا.
              </FormHelperText>
            ) : (
              <FormHelperText sx={{ fontSize: 10 }}>
                اختر استراتيجية لاستيراد الرافعة والرسوم والانزلاق ونوع الأمر.
              </FormHelperText>
            )}
          </Paper>

          <Paper variant="outlined" sx={{ p: 2.5, backgroundImage: "none", bgcolor: "rgba(24,24,27,0.6)" }}>
            <Typography sx={{ fontSize: 11, fontWeight: 800, color: "text.secondary", mb: 1.5 }}>
              الحساب والصفقة
            </Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 1.75 }}>
              <NumField label="رصيد الحساب ($)" value={accountBalance} onChange={setAccountBalance} error={errors.accountBalance} />
              <NumField label="اسم الأصل / العقد" value={asset} onChange={setAsset} text />
              <Box>
                <Typography sx={{ fontSize: 11, color: "text.secondary", mb: 0.5 }}>الاتجاه</Typography>
                <ToggleButtonGroup
                  size="small"
                  exclusive
                  fullWidth
                  value={direction}
                  onChange={(_, v) => v && setDirection(v as Direction)}
                >
                  <ToggleButton value="LONG" sx={{ color: "success.main" }}>
                    LONG
                  </ToggleButton>
                  <ToggleButton value="SHORT" sx={{ color: "error.main" }}>
                    SHORT
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>
              <NumField label="سعر الدخول ($)" value={entry} onChange={(v) => { setEntry(v); }} error={errors.entry} />
              <NumField label="وقف الخسارة ($)" value={stopLoss} onChange={setStopLoss} error={errors.stopLoss} />
              <NumField label="الهدف (TP) ($)" value={takeProfit} onChange={setTakeProfit} error={errors.takeProfit} />
            </Box>

            <Box sx={{ mt: 2 }}>
              <Typography sx={{ fontSize: 11, color: "text.secondary", mb: 0.5 }}>حجم المركز: حدد أحد الوجهين، والآخر يُحسب تلقائيًا</Typography>
              <ToggleButtonGroup
                size="small"
                exclusive
                fullWidth
                value={sizeMode}
                onChange={(_, v) => v && setSizeMode(v as SizeMode)}
              >
                <ToggleButton value="size">الحجم بالعملة ($)</ToggleButton>
                <ToggleButton value="quantity">الكمية ({asset || "BTC"})</ToggleButton>
              </ToggleButtonGroup>
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 1.75, mt: 1.5 }}>
                <NumField
                  label="حجم المركز ($)"
                  value={coerceSize}
                  onChange={sizeMode === "size" ? setPositionSize : () => undefined}
                  readOnly={sizeMode !== "size"}
                  error={sizeMode === "size" ? errors.positionSize : undefined}
                />
                <NumField
                  label={`الكمية (${asset || "BTC"})`}
                  value={coerceQty}
                  onChange={sizeMode === "quantity" ? setQuantity : () => undefined}
                  readOnly={sizeMode !== "quantity"}
                  error={sizeMode === "quantity" ? errors.quantity : undefined}
                />
              </Box>
              <Box sx={{ mt: 1.5, maxWidth: 200 }}>
                <NumField
                  label="الرافعة المالية"
                  value={leverage}
                  onChange={(v) => { setLeverage(v); markCustom("leverage"); }}
                  error={errors.leverage}
                  adornment="x"
                  chip={presetChip("leverage")}
                />
              </Box>
            </Box>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2.5, backgroundImage: "none", bgcolor: "rgba(24,24,27,0.6)" }}>
            <Typography sx={{ fontSize: 11, fontWeight: 800, color: "text.secondary", mb: 1 }}>
              نسب العائد إلى المخاطرة (TP تلقائي)
            </Typography>
            <ToggleButtonGroup size="small" exclusive value={activeRR ?? ""} onChange={(_, v) => v && applyRR(Number(v))}>
              {RR_PRESETS.map((rr) => (
                <ToggleButton key={rr} value={rr}>
                  1:{rr}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            <FormHelperText sx={{ fontSize: 10 }}>
              عند اختيار نسبة، يُعاد حساب الهدف تلقائيًا من الدخول ووقف الخسارة.
            </FormHelperText>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2.5, backgroundImage: "none", bgcolor: "rgba(24,24,27,0.6)" }}>
            <Typography sx={{ fontSize: 11, fontWeight: 800, color: "text.secondary", mb: 1 }}>
              أوامر الدخول والخروج
            </Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 1.75 }}>
              <TypeSelect label="أمر الدخول" value={entryOrderType} onChange={(v) => { setEntryOrderType(v); markCustom("entryOrderType"); }} chip={presetChip("entryOrderType")} />
              <TypeSelect label="أمر الخروج عند الهدف" value={tpOrderType} onChange={setTpOrderType} />
              <TypeSelect label="أمر الخروج عند الوقف" value={slOrderType} onChange={setSlOrderType} />
            </Box>
            <Divider sx={{ my: 2 }} />
            <Typography sx={{ fontSize: 11, fontWeight: 800, color: "text.secondary", mb: 1 }}>
              الرسوم والانزلاق
            </Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 1.75 }}>
              <NumField label="عمولة صانع (%)" value={makerFee} onChange={(v) => { setMakerFee(v); markCustom("makerFee"); }} chip={presetChip("makerFee")} />
              <NumField label="عمولة مستحوذ (%)" value={takerFee} onChange={(v) => { setTakerFee(v); markCustom("takerFee"); }} chip={presetChip("takerFee")} />
              <NumField label="الانزلاق السعري (%)" value={slippagePercent} onChange={(v) => { setSlippagePercent(v); markCustom("slippagePercent"); }} chip={presetChip("slippagePercent")} />
            </Box>
          </Paper>
        </Box>

        {/* Results — second column */}
        <Box sx={{ gridColumn: { xs: "span 12", md: "span 7" } }}>
          {result ? (
            <CalculatorResults result={result} warnings={warnings} accountName={asset || "BTC"} />
          ) : (
            <Paper variant="outlined" sx={{ p: 6, backgroundImage: "none", bgcolor: "rgba(24,24,27,0.6)", textAlign: "center" }}>
              <NetworkIcon className="mx-auto h-8 w-8 text-muted" />
              <Typography sx={{ mt: 2, fontSize: 13, color: "text.secondary" }}>
                أدخل قيمًا صحيحة لعرض النتائج.
              </Typography>
              {Object.entries(errors).length ? (
                <Typography sx={{ mt: 1, fontSize: 11, color: "error.main" }}>
                  {Object.values(errors).filter(Boolean)[0]}
                </Typography>
              ) : null}
            </Paper>
          )}

          {/* Saved scenarios */}
          <Paper variant="outlined" sx={{ mt: 2.5, p: 2.5, backgroundImage: "none", bgcolor: "rgba(24,24,27,0.6)" }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Typography sx={{ fontSize: 11, fontWeight: 800, color: "text.secondary" }}>
                سيناريوهات محفوظة
              </Typography>
              <Status label={`${scenarios.scenarios.length}`} tone="good" />
            </Box>
            {scenarios.scenarios.length === 0 ? (
              <Typography sx={{ mt: 1.5, fontSize: 12, color: "text.secondary" }}>
                لا توجد سيناريوهات محفوظة بعد. احفظ حسابًا لاسترجاعه لاحقًا.
              </Typography>
            ) : (
              <Box sx={{ mt: 1, display: "flex", flexDirection: "column", gap: 1 }}>
                {scenarios.scenarios.map((sc) => (
                  <Box
                    key={sc.id}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 1,
                      border: (t) => `1px solid ${t.palette.divider}`,
                      borderRadius: 1,
                      px: 1.5,
                      py: 1,
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontSize: 12, fontWeight: 700, color: "text.primary", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {sc.name}
                      </Typography>
                      <Typography sx={{ fontSize: 10, color: "text.secondary", direction: "ltr", textAlign: "right" }}>
                        {new Date(sc.createdAt).toLocaleString("ar")}
                      </Typography>
                    </Box>
                    <Tooltip title="تحميل السيناريو">
                      <IconButton size="small" onClick={() => loadScenario(sc)}>
                        <ArrowLeftIcon className="h-4 w-4" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="حذف السيناريو">
                      <IconButton size="small" onClick={() => scenarios.deleteScenario(sc.id)} sx={{ color: "error.main" }}>
                        <TrashIcon className="h-4 w-4" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                ))}
              </Box>
            )}
          </Paper>
        </Box>
      </Box>

      <SaveDialog
        open={saveOpen}
        defaultValue={result ? scenarioNameSuggestion(
          buildSnapshot({
            strategyId: preset?.strategyId ?? null,
            strategyName: preset?.name ?? null,
            versionLabel: preset?.label ?? null,
            direction,
            entry: entryN,
            stopLoss: stopN,
            takeProfit: tpN,
            positionSize: sizeN,
            quantity: qtyN,
            leverage: leverageN,
            entryOrderType,
            tpOrderType,
            slOrderType,
            makerFee: asNum(makerFee),
            takerFee: asNum(takerFee),
            slippagePercent: asNum(slippagePercent),
            accountBalance: balanceN,
            asset,
          })
        ) : ""}
        value={saveName}
        onValueChange={setSaveName}
        onClose={() => setSaveOpen(false)}
        onConfirm={confirmSave}
      />
    </Box>
  );
}

function NumField({
  label,
  value,
  onChange,
  error,
  adornment,
  readOnly,
  text,
  chip,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  adornment?: string;
  readOnly?: boolean;
  text?: boolean;
  chip?: React.ReactNode;
}) {
  return (
    <Box>
      <TextField
        label={label}
        size="small"
        fullWidth
        error={Boolean(error)}
        helperText={error}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode={text ? undefined : "decimal"}
        dir={text ? "auto" : "ltr"}
        slotProps={{
          input: {
            readOnly,
            sx: { fontSize: 13, fontFamily: text ? "inherit" : "monospace" },
            startAdornment: adornment ? (
              <InputAdornment position="start" sx={{ fontSize: 11, color: "text.secondary" }}>
                {adornment}
              </InputAdornment>
            ) : undefined,
          },
        }}
      />
      {chip ?? null}
    </Box>
  );
}

function TypeSelect({
  label,
  value,
  onChange,
  chip,
}: {
  label: string;
  value: OrderType;
  onChange: (v: OrderType) => void;
  chip?: React.ReactNode;
}) {
  return (
    <Box>
      <UiSelect
        value={value}
        onChange={onChange}
        label={label}
        options={[
          { value: "LIMIT", label: "Limit (صانع)" },
          { value: "MARKET", label: "Market (مستحوذ)" },
        ]}
      />
      {chip ?? null}
    </Box>
  );
}

function SaveDialog({
  open,
  defaultValue,
  value,
  onValueChange,
  onClose,
  onConfirm,
}: {
  open: boolean;
  defaultValue: string;
  value: string;
  onValueChange: (v: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" slotProps={{ paper: { sx: { backgroundImage: "none" } } }}>
      <DialogTitle sx={{ fontSize: 16, fontWeight: 800, pb: 1 }}>حفظ السيناريو</DialogTitle>
      <DialogContent dividers>
        <TextField
          label="اسم السيناريو"
          size="small"
          fullWidth
          placeholder={defaultValue}
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          helperText="يُحفظ كصورة كاملة من القيم الحالية ولا يتأثر بالتعديلات اللاحقة."
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button size="small" onClick={onClose}>
          إلغاء
        </Button>
        <Button size="small" variant="contained" onClick={onConfirm}>
          حفظ
        </Button>
      </DialogActions>
    </Dialog>
  );
}