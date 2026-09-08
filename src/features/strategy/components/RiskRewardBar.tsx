"use client";

import { Box, Typography } from "@mui/material";
import { tokens } from "@/components/ui";

/**
 * Horizontal risk:reward ratio bar — red risk segment vs green reward segment
 * scaled so the visual ratio always matches the computed R:R (1:n).
 */
export function RiskRewardBar({
  rr,
  riskPercent,
  rewardPercent,
}: {
  rr: number;
  riskPercent: number;
  rewardPercent: number;
}) {
  const safeRr = Number.isFinite(rr) && rr > 0 ? Math.min(rr, 12) : 1;
  const total = 1 + safeRr;
  const riskW = (1 / total) * 100;
  const rewardW = (safeRr / total) * 100;

  return (
    <Box sx={{ mt: 2 }}>
      <Box
        sx={{
          display: "flex",
          height: 8,
          borderRadius: 1,
          overflow: "hidden",
          bgcolor: tokens.colors.surface2,
          direction: "ltr",
        }}
      >
        <Box sx={{ width: `${riskW}%`, bgcolor: tokens.colors.down }} />
        <Box sx={{ width: `${rewardW}%`, bgcolor: tokens.colors.up }} />
      </Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mt: 1 }}>
        <Typography
          sx={{
            fontSize: 11,
            fontWeight: 700,
            color: "error.main",
            fontFamily: "inherit",
            fontVariantNumeric: "tabular-nums",
            direction: "ltr",
          }}
        >
          وقف {Number.isFinite(riskPercent) ? ` -${riskPercent.toFixed(2)}%` : ""}
        </Typography>
        <Typography
          sx={{
            fontSize: 11,
            fontWeight: 800,
            color: "text.primary",
            fontFamily: "inherit",
            fontVariantNumeric: "tabular-nums",
            direction: "ltr",
          }}
        >
          1 : {Number.isFinite(rr) ? rr.toFixed(2) : "—"}
        </Typography>
        <Typography
          sx={{
            fontSize: 11,
            fontWeight: 700,
            color: "success.main",
            fontFamily: "inherit",
            fontVariantNumeric: "tabular-nums",
            direction: "ltr",
          }}
        >
          هدف {Number.isFinite(rewardPercent) ? ` +${rewardPercent.toFixed(2)}%` : ""}
        </Typography>
      </Box>
    </Box>
  );
}