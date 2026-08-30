"use client";

import { useCallback, useEffect, useState } from "react";
import type { BtcCandle } from "../../../bitcoin/types";
import { runFeatureResearch, type ResearchOptions } from "../research/engine";
import type {
  FeatureResearchRun,
  FeatureResearchRunSummaryDoc,
  ValidationProfileId,
} from "../research/types";
import {
  listResearchRuns,
  saveResearcherRun,
  getResearchRun,
} from "../services/firestoreResearch";
import { ENGINE_VERSION, DATASET_SOURCE } from "../validation/versions";

export interface ResearchParams {
  from: number;
  to: number;
  profileId: ValidationProfileId;
  featureVersion: string;
}

export interface FeatureResearchState {
  candles: BtcCandle[];
  result: FeatureResearchRun | null;
  runs: (FeatureResearchRunSummaryDoc & { runId: string })[];
  selected: (FeatureResearchRun & { summary: FeatureResearchRunSummaryDoc }) | null;
  persistence: {
    runId: string | null;
    status: "idle" | "saving" | "saved" | "error";
  };
  loading: boolean;
  error: string | null;
  range: { from: number; to: number };
}

export function useFeatureResearch() {
  const [candles, setCandles] = useState<BtcCandle[]>([]);
  const [result, setResult] = useState<FeatureResearchRun | null>(null);
  const [runs, setRuns] = useState<FeatureResearchState["runs"]>([]);
  const [selected, setSelected] = useState<FeatureResearchState["selected"]>(null);
  const [persistence, setPersistence] = useState<FeatureResearchState["persistence"]>({
    runId: null,
    status: "idle",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<{ from: number; to: number }>({ from: 0, to: 0 });

  const loadRuns = useCallback(async () => {
    try {
      const list = await listResearchRuns();
      setRuns(list);
    } catch {
      setRuns([]);
    }
  }, []);

  useEffect(() => {
    // Defer past the render pass so the initial list load is not a synchronous
    // setState-from-effect (avoids cascading-render warnings while still
    // populating the runs list on mount).
    const id = setTimeout(() => void loadRuns(), 0);
    return () => clearTimeout(id);
  }, [loadRuns]);

  /** Load candles over [from,to] and run the full per-feature research. */
  const run = useCallback(async (params: ResearchParams) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const { fetchHistoricalCandles } = await import("../historical/loader");
      const fetched = await fetchHistoricalCandles(params.from, params.to);
      if (!fetched || fetched.length < 300) {
        throw new Error("لا توجد بيانات كافية للبحث (تحتاج على الأقل ~300 شمعة)");
      }
      setCandles(fetched);
      setRange({ from: params.from, to: params.to });

      const options: ResearchOptions = {
        candles: fetched,
        featureVersion: params.featureVersion,
        profileId: params.profileId,
        symbol: "BTCUSDT",
        timeframe: "1m",
        fromMs: params.from,
        toMs: params.to,
      };
      const built = runFeatureResearch(options);

      setResult(built);
      setPersistence({ runId: built.runId, status: "saving" });
      await saveResearcherRun(built);
      setPersistence({ runId: built.runId, status: "saved" });
      await loadRuns();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر إكمال بحث الخصائص");
      setPersistence({ runId: null, status: "error" });
    } finally {
      setLoading(false);
    }
  }, [loadRuns]);

  /** Load a prior run's full doc for the historical comparison layer. */
  const selectRun = useCallback(async (runId: string) => {
    setSelected(null);
    try {
      const doc = await getResearchRun(runId);
      setSelected(doc);
    } catch {
      setSelected(null);
    }
  }, []);

  return {
    candles,
    result,
    runs,
    selected,
    persistence,
    loading,
    error,
    range,
    run,
    selectRun,
    engineVersion: ENGINE_VERSION,
    datasetVersion: DATASET_SOURCE,
  };
}
