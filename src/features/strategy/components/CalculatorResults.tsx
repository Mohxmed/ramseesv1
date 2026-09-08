"use client";

import { Box, Paper, Typography, Alert } from "@mui/material";
import { formatMoney, formatQty, formatRR, formatPercent } from "../lib/format";
import type { CalculatorResult } from "../lib/calculations";
import type { RiskWarning } from "../lib/validation";
import { RiskRewardBar } from "./RiskRewardBar";

function Row({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" | "neutral" }) {
  const color = tone === "up" ? "success.main" : tone === "down" ? "error.main" : "text.primary";
  return (
    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", py: 0.75 }}>
      <Typography sx={{ fontSize: 11, color: "text.secondary" }}>{label}</Typography>
      <Typography sx={{ fontSize: 12, fontWeight: 700, color, fontFamily: "monospace", direction: "ltr" }}>
        {value}
      </Typography>
    </Box>
  );
}

function ResultCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Paper
      variant="outlined"
      sx={{ p: 2, backgroundImage: "none", bgcolor: "rgba(24,24,27,0.6)" }}
    >
      <Typography sx={{ fontSize: 11, fontWeight: 800, color: "text.secondary", mb: 1 }}>{title}</Typography>
      {children}
    </Paper>
  );
}

export function CalculatorResults({
  result,
  warnings,
  accountName,
}: {
  result: CalculatorResult;
  warnings: RiskWarning[];
  accountName: string;
}) {
  const r = result;

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

      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 1.5 }}>
        <ResultCard title="حجم المركز">
          <Row label="حجم المركز" value={`${formatMoney(r.position.size, 2)} (بما في ذلك الرافعة)`} />
          <Row label="الكمية" value={`${formatQty(r.position.quantity)} ${accountName || "BTC"}`} />
          <Row label="الهامش المطلوب" value={formatMoney(r.position.margin)} />
          <Row label="الرافعة المالية" value={formatQty(r.position.leverage, 0) + "x"} />
        </ResultCard>

        <ResultCard title="المخاطرة">
          <Row
            label="الخسارة المحتملة"
            value={formatMoney(r.risk.riskAmount)}
            tone="down"
          />
          <Row label="المسافة لوقف الخسارة" value={formatPercent(r.risk.riskPercent)} tone="down" />
          <Row label="نسبة من رأس المال" value={formatPercent(r.risk.riskPercentOfAccount)} tone="down" />
          <Row label="المسافة بالسعر" value={formatQty(r.risk.distanceToStop)} />
        </ResultCard>

        <ResultCard title="المكسب">
          <Row
            label="الربح المحتمل"
            value={formatMoney(r.reward.rewardAmount)}
            tone="up"
          />
          <Row label="المسافة للهدف" value={formatPercent(r.reward.rewardPercent)} tone="up" />
          <Row label="نسبة العائد : المخاطرة" value={formatRR(r.reward.rr)} tone="up" />
          <Row label="المسافة بالسعر" value={formatQty(r.reward.distanceToTarget)} />
        </ResultCard>

        <ResultCard title="الرسوم والانزلاق">
          <Row label="رسوم الدخول" value={formatMoney(r.fees.entry)} />
          <Row label="رسوم الخروج (هدف)" value={`${formatMoney(r.fees.tpExit)}`} />
          <Row label="رسوم الخروج (وقف)" value={`${formatMoney(r.fees.slExit)}`} />
          <Row label="تكلفة السيناريو الناجح" value={`${formatPercent(result.profit.costPercent)}`} />
          <Row label="تكلفة سيناريو الخسارة" value={`${formatPercent(result.loss.costPercent)}`} />
        </ResultCard>
      </Box>

      <Paper
        variant="outlined"
        sx={{ p: 2.5, backgroundImage: "none", bgcolor: "rgba(24,24,27,0.6)", borderColor: (t) => t.palette.divider }}
      >
        <Typography sx={{ fontSize: 11, fontWeight: 800, color: "text.secondary", mb: 1 }}>
          صافي النتيجة
        </Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 2 }}>
          <Box>
            <Typography sx={{ fontSize: 11, color: "success.main", fontWeight: 700 }}>عند الوصول للهدف (TP)</Typography>
            <Row label="الربح الإجمالي" value={formatMoney(r.profit.gross)} tone="up" />
            <Row label="الرسوم + الانزلاق" value={`${formatMoney(r.profit.fees + r.profit.slippage)} (${formatPercent(r.profit.costPercent)})`} tone="down" />
            <Row label="صافي الربح" value={formatMoney(r.profit.net)} tone="up" />
          </Box>
          <Box>
            <Typography sx={{ fontSize: 11, color: "error.main", fontWeight: 700 }}>عند الوصول لوقف الخسارة (SL)</Typography>
            <Row label="الخسارة الإجمالية" value={formatMoney(r.loss.gross)} tone="down" />
            <Row label="الرسوم + الانزلاق" value={`${formatMoney(r.loss.fees + r.loss.slippage)} (${formatPercent(r.loss.costPercent)})`} tone="down" />
            <Row label="صافي الخسارة" value={formatMoney(r.loss.net)} tone="down" />
          </Box>
        </Box>
        <RiskRewardBar rr={r.reward.rr} riskPercent={r.risk.riskPercent} rewardPercent={r.reward.rewardPercent} />
      </Paper>
    </Box>
  );
}