/**
 * Validation for calculator inputs + risk warnings derived from the
 * strategy limits. Validation can block calculation (logically impossible
 * inputs); the warnings never block — they only warn.
 */

import { WARN_LIMITS } from "./constants";
import type { Direction } from "../types/strategy";
import type { CalculatorResult } from "./calculations";
import type { StrategyVersion } from "../types/strategy";

export interface CalculatorInputs {
  direction: Direction;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  accountBalance: number;
  positionSize: number;
  quantity: number;
  leverage: number;
}

/** Field → error message (empty string = valid). */
export type ValidationErrors = Partial<
  Record<"entry" | "stopLoss" | "takeProfit" | "accountBalance" | "positionSize" | "quantity" | "leverage", string>
>;

const num = (v: number) => Number.isFinite(v) && v > 0;

export function validateCalculator(inputs: CalculatorInputs): ValidationErrors {
  const errors: ValidationErrors = {};
  const { direction, entry, stopLoss, takeProfit } = inputs;

  if (!num(entry)) errors.entry = "سعر الدخول يجب أن يكون أكبر من صفر.";
  if (!num(stopLoss)) errors.stopLoss = "سعر وقف الخسارة يجب أن يكون أكبر من صفر.";
  if (!num(takeProfit)) errors.takeProfit = "سعر الهدف يجب أن يكون أكبر من صفر.";
  if (!num(inputs.accountBalance)) errors.accountBalance = "رصيد الحساب يجب أن يكون أكبر من صفر.";
  if (inputs.leverage < 1) errors.leverage = "الرافعة المالية يجب أن تكون 1 على الأقل.";
  if (inputs.positionSize <= 0) errors.positionSize = "حجم المركز يجب أن يكون أكبر من صفر.";

  if (num(entry) && num(stopLoss) && num(takeProfit)) {
    if (direction === "LONG") {
      if (stopLoss >= entry) errors.stopLoss = "يجب أن يكون وقف الخسارة أدنى من سعر الدخول للصفقات الشرائية (LONG).";
      if (entry >= takeProfit) errors.takeProfit = "يجب أن يكون الهدف أعلى من سعر الدخول للصفقات الشرائية (LONG).";
    } else {
      if (stopLoss <= entry) errors.stopLoss = "يجب أن يكون وقف الخسارة أعلى من سعر الدخول للصفقات البيعية (SHORT).";
      if (entry <= takeProfit) errors.takeProfit = "يجب أن يكون الهدف أدنى من سعر الدخول للصفقات البيعية (SHORT).";
    }
  }

  if (errors.positionSize === undefined && !Number.isFinite(inputs.quantity)) {
    errors.quantity = "كمية العملة غير صالحة.";
  }

  return errors;
}

export function hasErrors(errors: ValidationErrors): boolean {
  return Object.values(errors).some((m) => Boolean(m));
}

export interface RiskWarning {
  tone: "warn" | "high" | "critical";
  message: string;
}

/**
 * Compare the computed risk exposure against the active version's limits.
 * Warnings are advisory and never block the calculator.
 */
export function calculateRiskWarnings(
  result: CalculatorResult,
  version: StrategyVersion | null,
  accountBalanceAllocation: number
): RiskWarning[] {
  const warnings: RiskWarning[] = [];
  const riskPctOfAccount = result.risk.riskPercentOfAccount;

  if (riskPctOfAccount > WARN_LIMITS.critical) {
    warnings.push({
      tone: "critical",
      message: `الخسارة المحتملة (${riskPctOfAccount.toFixed(2)}% من الحساب) تتجاوز الحد الحرج (${WARN_LIMITS.critical}%).`,
    });
  } else if (riskPctOfAccount > WARN_LIMITS.riskPerTradeHigh) {
    warnings.push({
      tone: "high",
      message: `الخسارة المحتملة (${riskPctOfAccount.toFixed(2)}% من الحساب) تتجاوز حد المخاطرة المرتفع (${WARN_LIMITS.riskPerTradeHigh}%).`,
    });
  }

  if (version) {
    if (riskPctOfAccount > version.riskPerTrade) {
      warnings.push({
        tone: "warn",
        message: `مخاطرة الصفقة (${riskPctOfAccount.toFixed(2)}%) تتجاوز الحد المسموح في الإصدار ${version.version} (${version.riskPerTrade}%).`,
      });
    }
    if (riskPctOfAccount > version.maxDailyRisk) {
      warnings.push({
        tone: "warn",
        message: `مخاطرة الصفقة (${riskPctOfAccount.toFixed(2)}%) تتجاوز الحد اليومي ${version.version} (${version.maxDailyRisk}%).`,
      });
    }
    if (riskPctOfAccount > version.maxDrawdown) {
      warnings.push({
        tone: "warn",
        message: `مخاطرة الصفقة (${riskPctOfAccount.toFixed(2)}%) تتجاوز السحب الأقصى ${version.version} (${version.maxDrawdown}%).`,
      });
    }
    if (accountBalanceAllocation > 0 && result.position.margin > accountBalanceAllocation) {
      warnings.push({
        tone: "warn",
        message: `الهامش المطلوب (${result.position.margin.toFixed(2)}) يتجاوز المبلغ المخصص من الحساب (${accountBalanceAllocation.toFixed(2)}).`,
      });
    }
    if (result.reward.rr < version.minimumRR) {
      warnings.push({
        tone: "warn",
        message: `نسبة العائد إلى المخاطرة (1:${result.reward.rr.toFixed(2)}) أقل من الحد الأدنى ${version.version} (1:${version.minimumRR}).`,
      });
    }
  }

  return warnings;
}