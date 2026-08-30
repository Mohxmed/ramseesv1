"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BtcCandle } from "../../../bitcoin/types";
import { runScalpingEngine } from "../engine/ScalpingEngine";
import { buildReplayContext } from "../replay/context";
import { MarketReplay } from "../replay/engine";
import {
  saveValidationRun,
  saveValidationDecisions,
  saveValidationMetrics,
} from "../services/firestore";
import {
  buildValidationRun,
  type BuildRunResult,
} from "../validation/buildRun";
import { ENGINE_VERSION, STRATEGY_VERSION, DATASET_SOURCE } from "../validation/versions";
import type {
  DecisionSnapshot,
  EngineRunOutput,
  FeatureStateSnapshot,
  ReplayCursor,
  ReplayState,
  RunConfiguration,
  ValidationDirection,
} from "../types";

/**
 * Decision Validation Lab — orchestrator.
 *
 * Replays historical 1m BTCUSDT candles through the SAME pure decision engine
 * the live `/scalping` page uses. For every candle it freezes a
 * `DecisionSnapshot` (decision-time data only — no wallet, no positions, no
 * P&L). At `finalize()` the captured snapshots are evaluated against the full
 * series across the 30s / 60s / 120s horizons, aggregated, and persisted to an
 * immutable `validationRuns/{runId}` in batches.
 */
export interface ValidationLabParams {
  from: number;
  to: number;
  minConfidence: number;
}

export interface ValidationLabState {
  candles: BtcCandle[];
  cursor: ReplayCursor | null;
  replay: ReplayState;
  speed: number;
  decisions: DecisionSnapshot[];
  latest: EngineRunOutput | null;
  runId: string | null;
  validation: BuildRunResult | null;
  runPersistence: {
    runId: string | null;
    engineVersion: string;
    status: "idle" | "saving" | "saved" | "error";
  };
  loading: boolean;
  error: string | null;
}

export function useValidationLab() {
  const replayRef = useRef<MarketReplay | null>(null);
  const [candles, setCandles] = useState<BtcCandle[]>([]);
  const [cursor, setCursor] = useState<ReplayCursor | null>(null);
  const [replay, setReplay] = useState<ReplayState>("idle");
  const [speed, setSpeed] = useState(1);
  const [decisions, setDecisions] = useState<DecisionSnapshot[]>([]);
  const [latest, setLatest] = useState<EngineRunOutput | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [validation, setValidation] = useState<BuildRunResult | null>(null);
  const [runPersistence, setRunPersistence] = useState<ValidationLabState["runPersistence"]>({
    runId: null,
    engineVersion: ENGINE_VERSION,
    status: "idle",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const candlesRef = useRef<BtcCandle[]>([]);
  const seqRef = useRef(0);
  const prevSignalRef = useRef<EngineRunOutput["signal"] | null>(null);
  const decisionsRef = useRef<DecisionSnapshot[]>([]);
  const latestRef = useRef<EngineRunOutput | null>(null);
  const replayStateRef = useRef<ReplayState>("idle");
  const runIdRef = useRef<string | null>(null);
  const rangeRef = useRef<{ from: number; to: number; minConfidence: number }>({
    from: 0,
    to: 0,
    minConfidence: 0,
  });

  function toDirection(d: EngineRunOutput["direction"]): ValidationDirection {
    if (d === "LONG") return "LONG";
    if (d === "SHORT") return "SHORT";
    return "NEUTRAL";
  }

  const buildSnapshot = useCallback(
    (out: EngineRunOutput, idx: number, simTime: number): DecisionSnapshot | null => {
      const decision = out.decision;
      if (!decision || out.price == null) return null;

      const featureSnapshot: Record<string, FeatureStateSnapshot> = {};
      for (const f of out.features ?? []) {
        featureSnapshot[f.key] = {
          key: f.key,
          label: f.label,
          unit: f.unit,
          raw: f.raw,
          normalized: f.normalized != null ? f.normalized * 50 + 50 : null,
          direction: f.direction,
          state: f.state,
          score: f.score,
          contribution: f.contribution,
          confidence: f.confidence,
        };
      }

      const familyVotes: Record<string, number> = {};
      for (const [fam, v] of Object.entries(out.familyVotes ?? {})) {
        if (v && typeof v.vote === "number") familyVotes[fam] = v.vote;
      }

      const seq = ++seqRef.current;
      return {
        id: `dec_${seq}_${simTime}`,
        runId: runIdRef.current ?? "",
        timestamp: simTime,
        symbol: "BTCUSDT",
        timeframe: "1m",
        direction: toDirection(out.direction),
        confidence: out.confidence,
        score: out.score,
        signed: out.signed,
        primaryProbability: decision.primaryProbability,
        expectedMovePct: decision.expectedNetMovePct,
        blocked: decision.blocked,
        gate: decision.gate,
        regime: decision.regimeKey,
        regimeConfidence: decision.regimeConfidence,
        price: out.price,
        candleIndex: idx,
        seq,
        featureSnapshot,
        featureValues: out.featureValues ?? {},
        familyVotes,
        horizons: {
          "30s": { horizonS: 30, key: "30s", actualMovePct: null, directionCorrect: null, result: null, mfe: null, mae: null },
          "60s": { horizonS: 60, key: "60s", actualMovePct: null, directionCorrect: null, result: null, mfe: null, mae: null },
          "120s": { horizonS: 120, key: "120s", actualMovePct: null, directionCorrect: null, result: null, mfe: null, mae: null },
        },
      };
    },
    []
  );

  const pushDecision = useCallback((snap: DecisionSnapshot) => {
    const next = [...decisionsRef.current, snap];
    decisionsRef.current = next;
    setDecisions(next);
  }, []);

  const resetRuntime = useCallback(() => {
    seqRef.current = 0;
    prevSignalRef.current = null;
    decisionsRef.current = [];
    setDecisions([]);
    setLatest(null);
    latestRef.current = null;
    setRunId(null);
    runIdRef.current = null;
    setValidation(null);
    setRunPersistence({ runId: null, engineVersion: ENGINE_VERSION, status: "idle" });
  }, []);

  const advance = useCallback(() => {
    const replay = replayRef.current;
    if (!replay) return;
    const nextCursor = replay.step();
    const bar = nextCursor.bar;
    if (!bar) return;

    const index = nextCursor.index;
    const simTime = nextCursor.timeMs;

    const ctx = buildReplayContext(candlesRef.current, index, simTime);
    const out = runScalpingEngine({ ctx, previousSignal: prevSignalRef.current });
    prevSignalRef.current = out.signal;
    latestRef.current = out;
    setLatest(out);

    const snap = buildSnapshot(out, index, simTime);
    if (snap) pushDecision(snap);

    setCursor(nextCursor);
    setReplay(replay.replayState);
    replayStateRef.current = replay.replayState;
  }, [buildSnapshot, pushDecision]);

  const start = useCallback(
    async (params: ValidationLabParams) => {
      setLoading(true);
      setError(null);
      resetRuntime();
      rangeRef.current = { from: params.from, to: params.to, minConfidence: params.minConfidence };

      try {
        const { fetchHistoricalCandles } = await import("../historical/loader");
        const fetched = await fetchHistoricalCandles(params.from, params.to);
        if (!fetched || fetched.length < 2) {
          throw new Error("لا توجد بيانات كافية في هذا النطاق الزمني");
        }
        candlesRef.current = fetched;
        setCandles(fetched);

        const r = new MarketReplay({ candles: fetched, startIndex: 0 });
        replayRef.current = r;
        r.onTick(() => {
          setCursor(r.cursor);
          setReplay(r.replayState);
          replayStateRef.current = r.replayState;
        });
        setCursor(r.cursor);
        setReplay(r.replayState);
        replayStateRef.current = r.replayState;
      } catch (e) {
        setError(e instanceof Error ? e.message : "تعذر تحميل البيانات");
      } finally {
        setLoading(false);
      }
    },
    [resetRuntime]
  );

  const play = useCallback(() => {
    const r = replayRef.current;
    if (!r) return;
    r.play();
    setReplay(r.replayState);
    replayStateRef.current = r.replayState;
  }, []);

  const pause = useCallback(() => {
    const r = replayRef.current;
    if (!r) return;
    r.pause();
    setReplay(r.replayState);
    replayStateRef.current = r.replayState;
  }, []);

  const nextBar = useCallback(() => {
    advance();
  }, [advance]);

  const setSpeedValue = useCallback((v: number) => {
    const r = replayRef.current;
    if (!r) return;
    r.setSpeed(v);
    setSpeed(v);
  }, []);

  const reset = useCallback(() => {
    const r = replayRef.current;
    if (!r) return;
    resetRuntime();
    r.reset(0);
    setCursor(r.cursor);
    setReplay(r.replayState);
    replayStateRef.current = r.replayState;
  }, [resetRuntime]);

  const persistRun = useCallback(async (built: BuildRunResult): Promise<void> => {
    const { run, records, metrics, summary } = built;
    await saveValidationRun(run, summary);
    await saveValidationDecisions(run.runId, records);
    await saveValidationMetrics(run.runId, metrics);
  }, []);

  /** Finish: evaluate + aggregate + persist an immutable validation run. */
  const finalize = useCallback(() => {
    const r = replayRef.current;
    if (!r || candlesRef.current.length === 0) return;
    if (decisionsRef.current.length === 0) return;

    const configuration: RunConfiguration = {
      dataset: DATASET_SOURCE,
      symbol: "BTCUSDT",
      timeframe: "1m",
      from: rangeRef.current.from,
      to: rangeRef.current.to,
      minConfidence: rangeRef.current.minConfidence,
    };

    const built = buildValidationRun({
      decisions: decisionsRef.current,
      candles: candlesRef.current,
      configuration,
    });
    runIdRef.current = built.run.runId;
    setRunId(built.run.runId);
    setValidation(built);
    setRunPersistence({ runId: built.run.runId, engineVersion: ENGINE_VERSION, status: "saving" });
    void persistRun(built)
      .then(() =>
        setRunPersistence({ runId: built.run.runId, engineVersion: ENGINE_VERSION, status: "saved" })
      )
      .catch(() =>
        setRunPersistence({ runId: built.run.runId, engineVersion: ENGINE_VERSION, status: "error" })
      );
  }, [persistRun]);

  // Auto-play interval.
  const intervalIdRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (replay === "playing") {
      clearInterval(intervalIdRef.current ?? undefined);
      intervalIdRef.current = setInterval(() => advance(), 100);
    } else {
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
      }
    }
    return () => {
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
      }
    };
  }, [replay, advance]);

  return {
    candles,
    cursor,
    replay,
    speed,
    decisions,
    latest,
    runId,
    validation,
    runPersistence,
    loading,
    error,
    start,
    play,
    pause,
    nextBar,
    setSpeedValue,
    reset,
    finalize,
    engineVersion: ENGINE_VERSION,
    strategyVersion: STRATEGY_VERSION,
  };
}
