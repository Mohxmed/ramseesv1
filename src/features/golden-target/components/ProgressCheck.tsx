"use client";

import { useState, type FormEvent } from "react";
import type {
  GoldenTargetMove,
  ProgressCheckInput,
  ProgressCheckResult,
} from "../types";
import { evaluateCheck, formatNumber, calculateGrowth } from "../utils";

type ProgressCheckProps = {
  move: GoldenTargetMove;
  saving: boolean;
  onPreview: (input: ProgressCheckInput) => ProgressCheckResult | null;
  onConfirm: (input: ProgressCheckInput) => void;
  onClose: () => void;
};

export function ProgressCheck({
  move,
  saving,
  onPreview,
  onConfirm,
  onClose,
}: ProgressCheckProps) {
  const [startingValue, setStartingValue] = useState<string>("");
  const [endingValue, setEndingValue] = useState<string>("");
  const [result, setResult] = useState<ProgressCheckResult | null>(null);
  const [computed, setComputed] = useState(false);

  function handleChange(type: "start" | "end", value: string) {
    if (type === "start") setStartingValue(value);
    else setEndingValue(value);
    setResult(null);
    setComputed(false);
  }

  function handleCompute(e: FormEvent) {
    e.preventDefault();
    const start = parseFloat(startingValue);
    const end = parseFloat(endingValue);
    if (isNaN(start) || isNaN(end) || start <= 0 || end <= 0) return;
    const preview = onPreview({
      move: move.move,
      startingValue: start,
      endingValue: end,
    });
    if (preview) {
      setResult(preview);
      setComputed(true);
    }
  }

  function handleConfirm() {
    const start = parseFloat(startingValue);
    const end = parseFloat(endingValue);
    if (isNaN(start) || isNaN(end) || start <= 0 || end <= 0) return;
    onConfirm({
      move: move.move,
      startingValue: start,
      endingValue: end,
    });
  }

  const start = parseFloat(startingValue);
  const end = parseFloat(endingValue);
  const showGrowth = start > 0 && end > 0;
  const growth = showGrowth ? calculateGrowth(start, end) : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="animate-pop-in w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-zinc-50">
              فحص الحركة {String(move.move).padStart(2, "0")}
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              الهدف: {formatNumber(move.targetValue)} (+100%)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
            aria-label="إغلاق"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="startingValue"
                className="block text-xs font-medium text-zinc-400"
              >
                قيمة البداية
              </label>
              <input
                id="startingValue"
                type="number"
                step="any"
                min="0"
                required
                value={startingValue}
                onChange={(e) => handleChange("start", e.target.value)}
                className="mt-1 block w-full rounded-md border border-zinc-700 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-100 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                dir="ltr"
              />
            </div>
            <div>
              <label
                htmlFor="endingValue"
                className="block text-xs font-medium text-zinc-400"
              >
                قيمة النهاية
              </label>
              <input
                id="endingValue"
                type="number"
                step="any"
                min="0"
                required
                value={endingValue}
                onChange={(e) => handleChange("end", e.target.value)}
                className="mt-1 block w-full rounded-md border border-zinc-700 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-100 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                dir="ltr"
              />
            </div>
          </div>

          {showGrowth && (
            <div className="rounded-lg bg-zinc-800/40 p-3 text-center">
              <p className="text-xs text-zinc-400">نسبة النمو المتوقعة</p>
              <p className="mt-1 text-2xl font-bold text-zinc-100">
                {growth >= 0 ? "+" : ""}
                {growth.toFixed(2)}%
              </p>
            </div>
          )}

          {result && (
            <div
              className={`animate-pop-in rounded-lg border p-4 text-sm ${
                result.achieved
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  : "border-red-500/40 bg-red-500/10 text-red-300"
              }`}
            >
              {result.achieved ? (
                <p>
                  <span className="font-semibold">✓ الهدف محقق</span> — وصلت
                  القيمة إلى ضعف البداية أو أكثر.
                </p>
              ) : (
                <p>
                  <span className="font-semibold">✕ الهدف غير محقق</span> — تحتاج
                  لمضاعفة القيمة (×{result.targetMultiplier}) على الأقل لإكمال
                  الحركة.
                </p>
              )}
            </div>
          )}

          <div className="flex flex-col gap-3 pt-2">
            <button
              type="button"
              onClick={handleCompute}
              disabled={!showGrowth || saving}
              className="w-full rounded-md border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-800 disabled:opacity-40"
            >
              احسب النتيجة
            </button>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleConfirm}
                disabled={saving || !computed || !result?.achieved}
                className="flex-1 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-40"
              >
                {saving ? "جارٍ الحفظ..." : "إكمال الحركة"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
