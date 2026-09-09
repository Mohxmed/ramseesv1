"use client";

import { Box, Paper, Typography, Alert } from "@mui/material";
import { formatMoney, formatQty, formatRR, formatPercent } from "../lib/format";
import type { CalculatorResult } from "../lib/calculations";
import type { RiskWarning } from "../lib/validation";
import { RiskRewardBar } from "./RiskRewardBar";

function Row({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" | "neutral" }) {
  const color = tone === "up" ? "success.main" : tone === "down" ? "error.main" : "text.primary";
  return (
    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 2, py: 0.7 }}>
      <Typography sx={{ fontSize: 12, color: "text.secondary" }}>{label}</Typography>
      <Typography
        sx={{
          fontSize: 13,
          fontWeight: 700,
          color,
          fontFamily: "inherit",
          fontVariantNumeric: "tabular-nums",
          direction: "ltr",
          textAlign: "right",
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}

function Metric({
  label,
  value,
  tone = "neutral",
  hint,
}: {
  label: string;
  value: string;
  tone?: "up" | "down" | "neutral";
  hint?: string;
}) {
  const color = tone === "up" ? "success.main" : tone === "down" ? "error.main" : "text.primary";
  return (
    <Paper variant="outlined" sx={{ p: 2, backgroundImage: "none", bgcolor: (t) => t.palette.background.paper + "99" }}>
      <Typography sx={{ fontSize: 11, fontWeight: 700, color: "text.secondary" }}>{label}</Typography>
      <Typography
        sx={{
          mt: 1,
          fontSize: 24,
          fontWeight: 800,
          lineHeight: 1.15,
          color,
          fontFamily: "inherit",
          fontVariantNumeric: "tabular-nums",
          direction: "ltr",
          textAlign: "right",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {value}
      </Typography>
      {hint ? (
        <Typography
          sx={{ mt: 0.75, fontSize: 10, color: "text.disabled", fontFamily: "inherit", fontVariantNumeric: "tabular-nums", direction: "ltr", textAlign: "right" }}
        >
          {hint}
        </Typography>
      ) : null}
    </Paper>
  );
}

export function CalculatorResults({
  result,
  warnings,
  accountName,
  accountBalance,
}: {
  result: CalculatorResult;
  warnings: RiskWarning[];
  accountName: string;
  accountBalance: number;
}) {
  const r = result;
  const pctOfBalance = (amount: number) =>
    accountBalance > 0 ? formatPercent((amount / accountBalance) * 100) : "—";
  const profitCost = r.profit.fees + r.profit.slippage + r.profit.funding;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      {warnings.length ? (
        <Alert severity="warning" sx={{ fontSize: 12, py: 0.5 }}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
            {warnings.map((w, i) => (
              <span key={i}>{w.message}</span>
            ))}
          </Box>
        </Alert>
      ) : null}

      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 1.5 }}>
        <Metric
          label="حجم المركز"
          value={formatMoney(r.position.size)}
          hint={`الكمية ${formatQty(r.position.quantity)} ${accountName || "BTC"}`}
        />
        <Metric
          label="قيمة المخاطرة"
          value={formatMoney(r.risk.riskAmount)}
          tone="down"
          hint={`${formatPercent(r.risk.riskPercentOfAccount)} من رأس المال`}
        />
        <Metric
          label="الربح المتوقع"
          value={`+${formatMoney(r.profit.net)}`}
          tone="up"
          hint={`${pctOfBalance(r.profit.net)} من رأس المال — صافي الرسوم`}
        />
        <Metric label="العائد : المخاطرة" value={formatRR(r.reward.rr)} tone="up" hint="من مسافة الدخول إلى الهدف" />
      </Box>

      <Paper variant="outlined" sx={{ p: 2.25, backgroundImage: "none", bgcolor: (t) => t.palette.background.paper + "99" }}>
        <Typography sx={{ fontSize: 12, fontWeight: 800, color: "text.primary", mb: 0.75 }}>
          تفاصيل الصفقة
        </Typography>
        <Row label="الكمية" value={`${formatQty(r.position.quantity)} ${accountName || "BTC"}`} />
        <Row label="مسافة وقف الخسارة" value={formatPercent(r.risk.riskPercent)} tone="down" />
        <Row label="مسافة الهدف" value={formatPercent(r.reward.rewardPercent)} tone="up" />
        <Row label="الهامش المطلوب" value={formatMoney(r.position.margin)} />
        <Row label="رسوم الدخول" value={formatMoney(r.fees.entry)} />
        <Row label="تبعيات الوصول للهدف" value={`${formatMoney(profitCost)} (${formatPercent(r.profit.costPercent)})`} tone="down" />
      </Paper>

      <Paper
        variant="outlined"
        sx={{ p: 2.5, backgroundImage: "none", bgcolor: (t) => t.palette.background.paper + "99", borderColor: (t) => t.palette.divider }}
      >
        <Typography sx={{ fontSize: 12, fontWeight: 800, color: "text.primary", mb: 1.25 }}>
          صافي النتيجة
        </Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 2 }}>
          <Box sx={{ p: 1.5, borderRadius: 1.5, bgcolor: (t) => t.palette.success.main + "0d", border: "1px solid rgba(16,185,129,0.18)" }}>
            <Typography sx={{ fontSize: 11, color: "success.main", fontWeight: 800 }}>عند الوصول للهدف (TP)</Typography>
            <Row label="الربح الصافي" value={`+${formatMoney(r.profit.net)}`} tone="up" />
            <Row label="مسافة الهدف" value={`+${formatPercent(r.reward.rewardPercent)}`} tone="up" />
            <Row label="نسبة من رأس المال" value={`+${pctOfBalance(r.profit.net)}`} tone="up" />
          </Box>
          <Box sx={{ p: 1.5, borderRadius: 1.5, bgcolor: (t) => t.palette.error.main + "0d", border: "1px solid rgba(239,68,68,0.18)" }}>
            <Typography sx={{ fontSize: 11, color: "error.main", fontWeight: 800 }}>عند الوصول لوقف الخسارة (SL)</Typography>
            <Row label="صافي الخسارة" value={`-${formatMoney(Math.abs(r.loss.net))}`} tone="down" />
            <Row label="مسافة الوقف" value={`-${formatPercent(r.risk.riskPercent)}`} tone="down" />
            <Row label="نسبة من رأس المال" value={`-${pctOfBalance(Math.abs(r.loss.net))}`} tone="down" />
          </Box>
        </Box>
        <RiskRewardBar rr={r.reward.rr} riskPercent={r.risk.riskPercent} rewardPercent={r.reward.rewardPercent} />
      </Paper>
    </Box>
  );
}