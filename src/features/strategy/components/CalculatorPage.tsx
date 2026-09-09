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
  CalculatorIcon,
  SaveIcon,
  RotateIcon,
  TrashIcon,
  NetworkIcon,
  ArrowLeftIcon,
} from "@/components/icons/icons";
import {
  PageHeader,
  Status,
  Badge,
  Select as UiSelect,
  Card,
} from "@/components/ui";
import { useMarketData } from "@/features/bitcoin/store/market-context";
import type { Direction, OrderType } from "../types/strategy";
import {
  DEFAULT_ACCOUNT_BALANCE,
  DEFAULT_RISK_PERCENT,
  DEFAULT_FUNDING_FEE,
  RR_PRESETS,
} from "../lib/constants";
import {
  sizePositionFromRisk,
  calculateOutcomes,
  calculateTPFromRR,
  type ResolvedPosition,
} from "../lib/calculations";
import {
  validateRiskCalculator,
  hasErrors,
  calculateRiskWarnings,
  type ValidationErrors,
} from "../lib/validation";
import type { StrategyVersion } from "../types/strategy";
import { useStrategyNumbers } from "../hooks/useStrategyNumbers";
import { useScenarios } from "../hooks/useScenarios";
import { buildSnapshot, scenarioNameSuggestion, type SavedScenario } from "../lib/scenario";
import { CalculatorResults } from "./CalculatorResults";
import { formatMoney } from "../lib/format";

interface Preset {
  strategyId: string;
  name: string;
  label: string;
}

const INHERITED_FIELDS = [
  "riskPercent",
  "fundingFeePercent",
  "leverage",
  "makerFee",
  "takerFee",
  "slippagePercent",
  "entryOrderType",
] as const;

const INITIAL = {
  accountBalance: String(DEFAULT_ACCOUNT_BALANCE),
  asset: "BTC",
  riskPercent: String(DEFAULT_RISK_PERCENT),
  leverage: "20",
  direction: "LONG" as Direction,
  entry: "40000",
  stopLoss: "39600",
  takeProfit: "41200",
  entryOrderType: "LIMIT" as OrderType,
  tpOrderType: "LIMIT" as OrderType,
  slOrderType: "MARKET" as OrderType,
  makerFee: "0.01",
  takerFee: "0.05",
  slippagePercent: "0.03",
  fundingFeePercent: String(DEFAULT_FUNDING_FEE),
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ mb: 1.5, mt: 2, "&:first-of-type": { mt: 0 }, display: "flex", alignItems: "center", gap: 1.5 }}>
      <Box sx={{ fontSize: 12, fontWeight: 800, color: "text.primary", whiteSpace: "nowrap" }}>
        {children}
      </Box>
      <Box sx={{ flex: 1, height: 1, bgcolor: "divider", opacity: 0.8 }} />
    </Box>
  );
}

function asNum(v: string): number {
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : NaN;
}

export function CalculatorPage() {
  const store = useStrategyNumbers();
  const scenarios = useScenarios();
  const market = useMarketData();
  const livePrice = market.livePrice;

  const [accountBalance, setAccountBalance] = useState(INITIAL.accountBalance);
  const [asset, setAsset] = useState(INITIAL.asset);
  const [riskPercent, setRiskPercent] = useState(INITIAL.riskPercent);
  const [leverage, setLeverage] = useState(INITIAL.leverage);
  const [direction, setDirection] = useState<Direction>(INITIAL.direction);
  const [entry, setEntry] = useState(INITIAL.entry);
  const [stopLoss, setStopLoss] = useState(INITIAL.stopLoss);
  const [takeProfit, setTakeProfit] = useState(INITIAL.takeProfit);
  const [entryOrderType, setEntryOrderType] = useState<OrderType>(INITIAL.entryOrderType);
  const [tpOrderType, setTpOrderType] = useState<OrderType>(INITIAL.tpOrderType);
  const [slOrderType, setSlOrderType] = useState<OrderType>(INITIAL.slOrderType);
  const [makerFee, setMakerFee] = useState(INITIAL.makerFee);
  const [takerFee, setTakerFee] = useState(INITIAL.takerFee);
  const [slippagePercent, setSlippagePercent] = useState(INITIAL.slippagePercent);
  const [fundingFeePercent, setFundingFeePercent] = useState(INITIAL.fundingFeePercent);

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
    setRiskPercent(String(v.riskPerTrade));
    setLeverage(String(v.leverage));
    setMakerFee(String(v.makerFee));
    setTakerFee(String(v.takerFee));
    setSlippagePercent(String(v.slippagePercent));
    setEntryOrderType(v.defaultOrderType);
    setFundingFeePercent(INITIAL.fundingFeePercent);
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
      <FormHelperText sx={{ mx: 0.5, mt: 0.5, fontSize: 10 }}>
        {inheriting(key) ? "موروثة من الاستراتيجية" : "قيمة مخصصة"}
      </FormHelperText>
    ) : null;

  // --- Derived numbers ----------------------------------------------------------
  const balanceN = asNum(accountBalance);
  const riskN = asNum(riskPercent);
  const leverageN = asNum(leverage);
  const entryN = asNum(entry);
  const stopN = asNum(stopLoss);
  const tpN = asNum(takeProfit);
  const fundingN = asNum(fundingFeePercent);
  const makerN = asNum(makerFee);
  const takerN = asNum(takerFee);
  const slipN = asNum(slippagePercent);

  const maxLoss =
    Number.isFinite(balanceN) && Number.isFinite(riskN) && balanceN > 0 && riskN > 0
      ? (balanceN * riskN) / 100
      : NaN;

  const errors: ValidationErrors = useMemo(
    () =>
      validateRiskCalculator({
        direction,
        entry: entryN,
        stopLoss: stopN,
        takeProfit: tpN,
        accountBalance: Number.isNaN(balanceN) ? 0 : balanceN,
        riskPercent: Number.isNaN(riskN) ? 0 : riskN,
        leverage: Number.isNaN(leverageN) ? 1 : leverageN,
      }),
    [direction, entryN, stopN, tpN, balanceN, riskN, leverageN]
  );

  const isValid = !hasErrors(errors);

  const result = useMemo(() => {
    if (!isValid) return null;
    const position: ResolvedPosition = sizePositionFromRisk({
      direction,
      entry: entryN,
      stopLoss: stopN,
      takeProfit: tpN,
      accountBalance: balanceN,
      riskPercent: riskN,
      leverage: leverageN,
    });
    return calculateOutcomes(position, {
      entryOrderType,
      tpOrderType,
      slOrderType,
      makerFee: makerN,
      takerFee: takerN,
      slippagePercent: slipN,
      fundingFeePercent: fundingN,
    });
  }, [isValid, direction, entryN, stopN, tpN, balanceN, riskN, leverageN, entryOrderType, tpOrderType, slOrderType, makerN, takerN, slipN, fundingN]);

  const warnings = useMemo(
    () => (result ? calculateRiskWarnings(result, activeVersion, balanceN) : []),
    [result, activeVersion, balanceN]
  );

  // --- RR presets (secondary: auto TP) ----------------------------------------
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

  const fillEntryFromMarket = () => {
    if (livePrice == null) return;
    setEntry(livePrice.toFixed(2));
  };

  // --- Save / load (presets store account, risk and fee defaults) ---------------
  const buildPresetSnapshot = () => {
    if (!result) return null;
    return buildSnapshot({
      kind: "preset",
      strategyId: preset?.strategyId ?? null,
      strategyName: preset?.name ?? null,
      versionLabel: preset?.label ?? null,
      direction,
      entry: 0,
      stopLoss: 0,
      takeProfit: 0,
      positionSize: 0,
      quantity: 0,
      leverage: leverageN,
      entryOrderType,
      tpOrderType,
      slOrderType,
      makerFee: makerN,
      takerFee: takerN,
      slippagePercent: slipN,
      riskPercent: riskN,
      fundingFeePercent: fundingN,
      accountBalance: balanceN,
      asset,
    });
  };

  const openSave = () => {
    if (!result) return;
    setSaveName("");
    setSaveOpen(true);
  };

  const confirmSave = () => {
    const snapshot = buildPresetSnapshot();
    if (!snapshot) return;
    scenarios.saveScenario(saveName, snapshot);
    setSaveOpen(false);
  };

  const loadSaved = (sc: SavedScenario) => {
    const snap = sc.snapshot;
    setAccountBalance(String(snap.accountBalance));
    setAsset(snap.asset || "BTC");
    setRiskPercent(String(snap.riskPercent ?? DEFAULT_RISK_PERCENT));
    setLeverage(String(snap.leverage));
    setMakerFee(String(snap.makerFee));
    setTakerFee(String(snap.takerFee));
    setSlippagePercent(String(snap.slippagePercent));
    setFundingFeePercent(String(snap.fundingFeePercent ?? DEFAULT_FUNDING_FEE));
    setEntryOrderType(snap.entryOrderType);
    setTpOrderType(snap.tpOrderType);
    setSlOrderType(snap.slOrderType);
    setPreset(null);
    setInherited(new Set());
    // Legacy snapshots also carry the full trade — restore it too.
    if (snap.kind !== "preset") {
      setDirection(snap.direction);
      setEntry(String(snap.entry));
      setStopLoss(String(snap.stopLoss));
      setTakeProfit(String(snap.takeProfit));
    }
  };

  const resetAll = () => {
    setAccountBalance(INITIAL.accountBalance);
    setAsset(INITIAL.asset);
    setRiskPercent(INITIAL.riskPercent);
    setLeverage(INITIAL.leverage);
    setDirection(INITIAL.direction);
    setEntry(INITIAL.entry);
    setStopLoss(INITIAL.stopLoss);
    setTakeProfit(INITIAL.takeProfit);
    setEntryOrderType(INITIAL.entryOrderType);
    setTpOrderType(INITIAL.tpOrderType);
    setSlOrderType(INITIAL.slOrderType);
    setMakerFee(INITIAL.makerFee);
    setTakerFee(INITIAL.takerFee);
    setSlippagePercent(INITIAL.slippagePercent);
    setFundingFeePercent(INITIAL.fundingFeePercent);
    setPreset(null);
    setInherited(new Set());
  };

  return (
    <Box>
      <PageHeader
        eyebrow="Strategy — Risk Calculator"
        icon={<CalculatorIcon className="h-5 w-5" />}
        title="حاسبة المخاطر"
        description="حدّد رصيد الحساب، نسبة المخاطرة، الدخول، وقف الخسارة والهدف — يُحسب حجم المركز تلقائيًا من المخاطرة ومسافة الوقف، مع الربح والخسارة الصافية والرسوم والتمويل."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Status
              label={
                scenarios.status === "saved"
                  ? "إعدادات محفوظة"
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
              حفظ الإعدادات
            </Button>
          </div>
        }
      />

      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 2.5, mt: 4 }}>
        {/* Inputs — first column in RTL flow */}
        <Box sx={{ gridColumn: { xs: "span 12", md: "span 5" }, display: "flex", flexDirection: "column", gap: 2 }}>
          <Paper variant="outlined" sx={{ p: 2.5, backgroundImage: "none", bgcolor: "rgba(24,24,27,0.6)" }}>
            <SectionTitle>الحساب</SectionTitle>
            <UiSelect
              value={preset?.strategyId ?? ""}
              onChange={choosePreset}
              label="استراتيجية (النسخة النشطة)"
              placeholder={
                strategyPresets.length
                  ? "استيراد المخاطرة والرافعة والرسوم من الاستراتيجية"
                  : "لا توجد استراتيجيات بعد — أنشئها أولًا"
              }
              options={strategyPresets.map((p) => ({
                value: p.strategy.id,
                label: `${p.strategy.name} — ${p.version.version}`,
              }))}
            />
            <FormHelperText sx={{ fontSize: 10 }}>
              {preset
                ? `الإعدادات مستوردة من ${preset.name} ${preset.label}. عدّل أي رقم ليصبح مخصصًا.`
                : "اختر استراتيجية لاستيراد نسبة المخاطرة والرافعة والرسوم."}
            </FormHelperText>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 1.75, mt: 2 }}>
              <NumField label="رصيد الحساب" value={accountBalance} onChange={setAccountBalance} error={errors.accountBalance} adornment="USD" />
              <NumField label="الأصل / العملة" value={asset} onChange={setAsset} text />
              <NumField
                label="نسبة المخاطرة %"
                value={riskPercent}
                onChange={(v) => { setRiskPercent(v); markCustom("riskPercent"); }}
                error={errors.riskPercent}
                adornment="%"
                chip={presetChip("riskPercent")}
              />
              <NumField
                label="الرافعة المالية"
                value={leverage}
                onChange={(v) => { setLeverage(v); markCustom("leverage"); }}
                error={errors.leverage}
                adornment="x"
                chip={presetChip("leverage")}
              />
            </Box>
            <Divider sx={{ my: 2 }} />
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 2,
                borderRadius: 1.5,
                p: 1.5,
                bgcolor: "rgba(239,68,68,0.05)",
                border: "1px solid rgba(239,68,68,0.18)",
              }}
            >
              <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: "text.secondary" }}>
                أقصى خسارة مسموحة لهذه الصفقة
              </Typography>
              <Typography
                sx={{
                  fontSize: 16,
                  fontWeight: 800,
                  color: "error.main",
                  fontFamily: "inherit",
                  fontVariantNumeric: "tabular-nums",
                  direction: "ltr",
                  textAlign: "right",
                }}
              >
                {Number.isFinite(maxLoss) ? `${formatMoney(maxLoss)} (${riskN}%)` : "—"}
              </Typography>
            </Box>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2.5, backgroundImage: "none", bgcolor: "rgba(24,24,27,0.6)" }}>
            <SectionTitle>الصفقة</SectionTitle>
            <Box sx={{ mb: 2 }}>
              <Typography sx={{ fontSize: 11, color: "text.secondary", mb: 0.5 }}>الاتجاه</Typography>
              <ToggleButtonGroup size="small" exclusive fullWidth value={direction} onChange={(_, v) => v && setDirection(v as Direction)}>
                <ToggleButton value="LONG" sx={{ color: "success.main" }}>
                  شراء (LONG)
                </ToggleButton>
                <ToggleButton value="SHORT" sx={{ color: "error.main" }}>
                  بيع (SHORT)
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 1.75 }}>
              <NumField label="سعر الدخول" value={entry} onChange={setEntry} error={errors.entry} adornment="USD" />
              <NumField label="وقف الخسارة (SL)" value={stopLoss} onChange={setStopLoss} error={errors.stopLoss} adornment="USD" />
              <NumField label="الهدف (TP)" value={takeProfit} onChange={setTakeProfit} error={errors.takeProfit} adornment="USD" />
            </Box>
            {livePrice != null ? (
              <Button size="small" variant="text" sx={{ mt: 1 }} onClick={fillEntryFromMarket}>
                استخدام آخر سعر السوق {formatMoney(livePrice, 0)}
              </Button>
            ) : null}
            <Divider sx={{ my: 2 }} />
            <Typography sx={{ fontSize: 11, color: "text.secondary", mb: 0.5 }}>نوع أمر الدخول</Typography>
            <ToggleButtonGroup
              size="small"
              exclusive
              fullWidth
              value={entryOrderType}
              onChange={(_, v) => {
                if (!v) return;
                setEntryOrderType(v as OrderType);
                markCustom("entryOrderType");
              }}
            >
              <ToggleButton value="LIMIT">Limit (صانع)</ToggleButton>
              <ToggleButton value="MARKET">Market (مستحوذ)</ToggleButton>
            </ToggleButtonGroup>
            <Box sx={{ mt: 2 }}>
              <Typography sx={{ fontSize: 11, color: "text.secondary", mb: 0.5 }}>ضمين TP تلقائيًا حسب نسبة العائد : المخاطرة (اختياري)</Typography>
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
            </Box>
          </Paper>

          <Card
            title="إعدادات الأوامر والرسوم"
            collapsible
            snippet={
              <span className="text-2xs text-muted">
                أنواع أوامر الخروج، عمولات الصانع/المستحوذ، الانزلاق ورسوم التمويل
              </span>
            }
          >
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 1.75 }}>
              <TypeSelect label="أمر الخروج — الهدف" value={tpOrderType} onChange={setTpOrderType} />
              <TypeSelect label="أمر الخروج — الوقف" value={slOrderType} onChange={setSlOrderType} />
              <NumField
                label="عمولة صانع %"
                value={makerFee}
                onChange={(v) => { setMakerFee(v); markCustom("makerFee"); }}
                adornment="%"
                chip={presetChip("makerFee")}
              />
              <NumField
                label="عمولة مستحوذ %"
                value={takerFee}
                onChange={(v) => { setTakerFee(v); markCustom("takerFee"); }}
                adornment="%"
                chip={presetChip("takerFee")}
              />
              <NumField
                label="الانزلاق السعري %"
                value={slippagePercent}
                onChange={(v) => { setSlippagePercent(v); markCustom("slippagePercent"); }}
                adornment="%"
                chip={presetChip("slippagePercent")}
              />
              <NumField
                label="رسوم التمويل % (فوتشرز)"
                value={fundingFeePercent}
                onChange={(v) => { setFundingFeePercent(v); markCustom("fundingFeePercent"); }}
                adornment="%"
                chip={presetChip("fundingFeePercent")}
              />
            </Box>
            <FormHelperText sx={{ fontSize: 10, mt: 1.5 }}>
              تُحسب عمولة الدخول والخروج تلقائيًا حسب نوع الأمر (Limit = صانع، Market = مستحوذ)؛ رسوم التمويل تحسب على قيمة المركز.
            </FormHelperText>
          </Card>
        </Box>

        {/* Results — second column */}
        <Box sx={{ gridColumn: { xs: "span 12", md: "span 7" } }}>
          {result ? (
            <CalculatorResults result={result} warnings={warnings} accountName={asset || "BTC"} accountBalance={balanceN} />
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

          {/* Saved presets */}
          <Paper variant="outlined" sx={{ mt: 2.5, p: 2.5, backgroundImage: "none", bgcolor: "rgba(24,24,27,0.6)" }}>
            <SectionTitle>
              إعدادات محفوظة
              <Badge tone="good" ltr>{scenarios.scenarios.length}</Badge>
            </SectionTitle>
            {scenarios.scenarios.length === 0 ? (
              <Typography sx={{ mt: 1.5, fontSize: 12, color: "text.secondary" }}>
                لا توجد إعدادات محفوظة بعد. احفظ إعدادات الحساب والمخاطرة والرسوم لاسترجاعها لأي صفقة.
              </Typography>
            ) : (
              <Box sx={{ mt: 1.5, display: "flex", flexDirection: "column", gap: 1 }}>
                {scenarios.scenarios.map((sc) => {
                  const snap = sc.snapshot;
                  const isPreset = snap.kind === "preset";
                  return (
                    <Box
                      key={sc.id}
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 1,
                        border: (t) => `1px solid ${t.palette.divider}`,
                        borderRadius: 1.5,
                        px: 1.5,
                        py: 1.25,
                        transition: "border-color 150ms ease, background-color 150ms ease",
                        "&:hover": { borderColor: "rgba(16,185,129,0.35)", bgcolor: "rgba(16,185,129,0.04)" },
                      }}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: "text.primary", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {sc.name}
                        </Typography>
                        <Box sx={{ mt: 0.5, display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                          <Badge tone={isPreset ? "quiet" : snap.direction === "LONG" ? "up" : "down"} ltr>
                            {isPreset ? "إعدادات" : snap.direction}
                          </Badge>
                          <Badge tone="quiet" ltr>
                            {snap.asset || "BTC"}
                          </Badge>
                          <Badge tone="warn" ltr>
                            مخاطرة {snap.riskPercent ?? "—"}%
                          </Badge>
                          <Typography sx={{ fontSize: 10, color: "text.disabled", direction: "ltr", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                            {formatMoney(snap.accountBalance)} · {snap.leverage}x
                          </Typography>
                        </Box>
                      </Box>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                        <Tooltip title="استخدام الإعدادات">
                          <IconButton size="small" onClick={() => loadSaved(sc)}>
                            <ArrowLeftIcon className="h-4 w-4" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="حذف">
                          <IconButton size="small" onClick={() => scenarios.deleteScenario(sc.id)} sx={{ color: "error.main" }}>
                            <TrashIcon className="h-4 w-4" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            )}
          </Paper>
        </Box>
      </Box>

      <SaveDialog
        open={saveOpen}
        defaultValue={buildPresetSnapshot() ? scenarioNameSuggestion(buildPresetSnapshot()!) : ""}
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
            dir: text ? "auto" : "ltr",
            sx: {
              fontSize: 13,
              fontFamily: "inherit",
              fontWeight: 600,
              fontVariantNumeric: "tabular-nums",
              textAlign: "right",
            },
            endAdornment: adornment ? (
              <InputAdornment position="end" sx={{ fontSize: 11, color: "text.secondary" }}>
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
}: {
  label: string;
  value: OrderType;
  onChange: (v: OrderType) => void;
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
      <DialogTitle sx={{ fontSize: 16, fontWeight: 800, pb: 1 }}>حفظ الإعدادات</DialogTitle>
      <DialogContent dividers>
        <TextField
          label="اسم الإعدادات"
          size="small"
          fullWidth
          placeholder={defaultValue}
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          helperText="تُخزَّن إعدادات الحساب والمخاطرة والرسوم كافتراضي قابل للاسترجاع لأي صفقة."
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