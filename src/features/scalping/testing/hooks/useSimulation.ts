"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BtcCandle } from "../../../bitcoin/types";
import {
  computeSessionAnalytics,
  runValidation,
} from "../analytics/analytics";
import { runScalpingEngine } from "../engine/ScalpingEngine";
import { buildReplayContext } from "../replay/context";
import { MarketReplay } from "../replay/engine";
import {
  openPosition,
  closePosition,
  checkPositionExit,
  trackExcursion,
  resolveDecisionOutcome,
} from "../execution/SimulationExecution";
import {
  saveSession,
  appendDecision,
  appendTrade,
  saveAnalytics,
  updateSessionMeta,
  saveValidationRun,
  saveValidationDecisions,
  saveValidationMetrics,
} from "../services/firestore";
import {
  buildValidationRun,
  type BuildRunResult,
} from "../validation/buildRun";
import { ENGINE_VERSION, STRATEGY_VERSION } from "../validation/versions";
import type {
  ActionTaken,
  DecisionSnapshot,
  EngineRunOutput,
  LedgerEntry,
  PositionState,
  ReplayCursor,
  ReplayState,
  SimMode,
  SimSession,
  SimStrategyConfig,
  TradeResult,
} from "../types";

/** Default virtual-wallet + strategy params (all real-world cost model). */
export const DEFAULT_CONFIG: SimStrategyConfig = {
  riskPerTrade: 0.01,
  slFraction: 0.004,
  tpFraction: 0.006,
  feeBps: 0.0004,
  slippageBps: 0.0002,
  minConfidence: 60,
  requireDirectional: true,
};

export const INITIAL_BALANCE = 10_000;
export const DEFAULT_RANGE_DAYS = 3;

export interface SimExperimentParams {
  startMs: number;
  endMs: number;
  mode: SimMode;
  config?: Partial<SimStrategyConfig>;
}

export interface SimState {
  candles: BtcCandle[];
  cursor: ReplayCursor | null;
  replay: ReplayState;
  speed: number;
  mode: SimMode;
  config: SimStrategyConfig;
  balance: number;
  position: PositionState | null;
  decisions: DecisionSnapshot[];
  trades: TradeResult[];
  ledger: LedgerEntry[];
  latest: EngineRunOutput | null;
  pending: DecisionSnapshot | null;
  session: SimSession | null;
  analytics: ReturnType<typeof computeSessionAnalytics> | null;
  validation: ReturnType<typeof runValidation> | null;
  loading: boolean;
  error: string | null;
}

/**
 * Scalping Simulation orchestrator.
 *
 * Bridges `HistoricalReplayLoader` (data) → `MarketReplay` (cursor) →
 * `ScalpingEngine` (shared decision code) → `SimulationExecution` (virtual
 * execution) → Firestore + analytics. The engine code is IDENTICAL to the live
 * page; only the data source (history) and execution (paper) differ, so a
 * replay is a faithful historical run of the same decision logic.
 */
export function useSimulation() {
  const replayRef = useRef<MarketReplay | null>(null);
  const [candles, setCandles] = useState<BtcCandle[]>([]);
  const [cursor, setCursor] = useState<ReplayCursor | null>(null);
  const [replay, setReplay] = useState<ReplayState>("idle");
  const [speed, setSpeed] = useState(1);
  const [mode, setMode] = useState<SimMode>("AUTO");
  const [config, setConfig] = useState<SimStrategyConfig>(DEFAULT_CONFIG);
  const [balance, setBalance] = useState(INITIAL_BALANCE);
  const [position, setPosition] = useState<PositionState | null>(null);
  const [decisions, setDecisions] = useState<DecisionSnapshot[]>([]);
  const [trades, setTrades] = useState<TradeResult[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [latest, setLatest] = useState<EngineRunOutput | null>(null);
  const [pending, setPending] = useState<DecisionSnapshot | null>(null);
  const [session, setSession] = useState<SimSession | null>(null);
  const [analytics, setAnalytics] = useState<ReturnType<typeof computeSessionAnalytics> | null>(null);
  const [validation, setValidation] = useState<ReturnType<typeof runValidation> | null>(null);
  const [runPersistence, setRunPersistence] = useState<{
    runId: string | null;
    engineVersion: string;
    status: "idle" | "saving" | "saved" | "error";
  }>({ runId: null, engineVersion: ENGINE_VERSION, status: "idle" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mutable counters that must be read synchronously inside the loop.
  const candlesRef = useRef<BtcCandle[]>([]);
  const seqRef = useRef(0);
  const prevSignalRef = useRef<EngineRunOutput["signal"] | null>(null);
  const positionRef = useRef<PositionState | null>(null);
  const balanceRef = useRef(INITIAL_BALANCE);
  const decisionsRef = useRef<DecisionSnapshot[]>([]);
  const tradesRef = useRef<TradeResult[]>([]);
  const ledgerRef = useRef<LedgerEntry[]>([]);
  const configRef = useRef(config);
  const modeRef = useRef(mode);
  const sessionIdRef = useRef<string | null>(null);
  const replayStateRef = useRef<ReplayState>("idle");
  const latestRef = useRef<EngineRunOutput | null>(null);
  const rangeRef = useRef<{ from: number; to: number }>({ from: 0, to: 0 });

  useEffect(() => {
    configRef.current = config;
  }, [config]);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const setPositionBoth = useCallback((p: PositionState | null) => {
    positionRef.current = p;
    setPosition(p);
  }, []);
  const setBalanceBoth = useCallback((b: number) => {
    balanceRef.current = b;
    setBalance(b);
  }, []);
  const setSessionMeta = useCallback((s: SimSession | null, patch?: Partial<SimSession>) => {
    if (patch && s) {
      const merged = { ...s, ...patch };
      setSession(merged);
      if (sessionIdRef.current) {
        void updateSessionMeta(sessionIdRef.current, patch);
      }
      return;
    }
    setSession(s);
  }, []);

  const resetRuntime = useCallback(() => {
    seqRef.current = 0;
    prevSignalRef.current = null;
    positionRef.current = null;
    balanceRef.current = INITIAL_BALANCE;
    decisionsRef.current = [];
    tradesRef.current = [];
    ledgerRef.current = [];
    setPosition(null);
    setBalance(INITIAL_BALANCE);
    setDecisions([]);
    setTrades([]);
    setLedger([]);
    setLatest(null);
    setPending(null);
    setAnalytics(null);
    setValidation(null);
    setRunPersistence({ runId: null, engineVersion: ENGINE_VERSION, status: "idle" });
  }, []);

  const buildSnapshot = useCallback(
    (
      out: EngineRunOutput,
      idx: number,
      simTime: number
    ): DecisionSnapshot | null => {
      const decision = out.decision;
      if (!decision || out.price == null) return null;
      const dir = decision.direction;
      const sign = dir === "LONG" ? 1 : dir === "SHORT" ? -1 : 0;
      const positionSidePx =
        sign !== 0
          ? {
              sl:
                dir === "LONG"
                  ? out.price * (1 - configRef.current.slFraction)
                  : out.price * (1 + configRef.current.slFraction),
              tp:
                dir === "LONG"
                  ? out.price * (1 + configRef.current.tpFraction)
                  : out.price * (1 - configRef.current.tpFraction),
            }
          : null;
      const fv = out.featureValues ?? {};
      const trend =
        fv["market-regime"] != null
          ? fv["market-regime"]! >= 0.3
            ? "bullish"
            : fv["market-regime"]! <= -0.3
            ? "bearish"
            : "range"
          : null;
      const presence = (k: string) => (fv[k] != null ? fv[k]! : null);
      const snap: DecisionSnapshot = {
        id: `dec_${seqRef.current}_${simTime}`,
        sessionId: sessionIdRef.current ?? "",
        timestamp: simTime,
        symbol: "BTCUSDT",
        timeframe: "1m",
        decision: dir,
        confidence: out.confidence,
        score: out.score,
        signed: out.signed,
        primaryProbability: decision.primaryProbability,
        expectedMovePct: decision.expectedNetMovePct,
        blocked: decision.blocked,
        gate: decision.gate,
        regime: decision.regimeKey,
        entry: sign !== 0 ? out.price : null,
        stopLoss: positionSidePx?.sl ?? null,
        takeProfit: positionSidePx?.tp ?? null,
        riskReward:
          positionSidePx && configRef.current.slFraction > 0
            ? configRef.current.tpFraction / configRef.current.slFraction
            : null,
        trend,
        momentum: presence("micro-momentum"),
        support: presence("sr-distance") != null && fv["sr-distance"]! < 0 ? Math.abs(fv["sr-distance"]!) : null,
        resistance: presence("sr-distance") != null && fv["sr-distance"]! > 0 ? Math.abs(fv["sr-distance"]!) : null,
        volume: presence("volume-delta"),
        liquidity: presence("book-imbalance"),
        volatility: presence("short-volatility"),
        features: fv,
        conditions: {},
        familyVotes: {},
        price: out.price,
        candleIndex: idx,
        seq: seqRef.current,
        action: "WAIT",
      };
      return snap;
    },
    []
  );

  const flagCondition = useCallback((snap: DecisionSnapshot) => {
    const c = snap.conditions;
    c["trend-bullish"] = snap.trend === "bullish";
    c["trend-bearish"] = snap.trend === "bearish";
    c["strong-momentum"] = snap.momentum != null && Math.abs(snap.momentum) >= 0.05;
    c["high-volume"] = snap.volume != null && snap.volume >= 60;
    c["high-liquidity"] = snap.liquidity != null && snap.liquidity >= 0.5;
    c["high-volatility"] = snap.volatility != null && snap.volatility >= 0.3;
    return snap;
  }, []);

  const pushDecision = useCallback((snap: DecisionSnapshot) => {
    const next = [...decisionsRef.current, snap];
    decisionsRef.current = next;
    setDecisions(next);
    if (sessionIdRef.current) void appendDecision(sessionIdRef.current, snap);
  }, []);

  const pushTrade = useCallback((trade: TradeResult) => {
    const next = [...tradesRef.current, trade];
    tradesRef.current = next;
    setTrades(next);
    if (sessionIdRef.current) void appendTrade(sessionIdRef.current, trade);
  }, []);

  const pushLedger = useCallback((entry: LedgerEntry) => {
    const next = [...ledgerRef.current, entry];
    ledgerRef.current = next;
    setLedger(next);
  }, []);

  const replaceDecision = useCallback((snap: DecisionSnapshot) => {
    const next = decisionsRef.current.map((d) => (d.seq === snap.seq ? snap : d));
    decisionsRef.current = next;
    setDecisions(next);
  }, []);

  /** Open a paper position against an executed decision. */
  const open = useCallback(
    (snap: DecisionSnapshot, out: EngineRunOutput) => {
      if (positionRef.current || snap.entry == null) return;
      if (snap.decision !== "LONG" && snap.decision !== "SHORT") return;
      const side: "LONG" | "SHORT" = snap.decision;
      const res = openPosition(
        configRef.current,
        balanceRef.current,
        side,
        snap.entry,
        snap.candleIndex,
        snap.timestamp,
        snap.id
      );
      if (!res.position) return;
      setBalanceBoth(res.newBalance);
      pushLedger({
        id: `ledger_${snap.seq}`,
        sessionId: snap.sessionId,
        atMs: snap.timestamp,
        type: side === "LONG" ? "OPEN_LONG" : "OPEN_SHORT",
        tradeId: null,
        amount: -res.costs,
        balance: res.newBalance,
      });
      setPositionBoth(res.position);
      const executed: DecisionSnapshot = { ...snap, action: "EXECUTE", tradeId: null };
      replaceDecision(executed);
      latestRef.current = out;
    },
    [pushLedger, setBalanceBoth, setPositionBoth, replaceDecision]
  );

  /** Advance one candle: run the engine, manage exits and auto-execution. */
  const advance = useCallback(() => {
    const replay = replayRef.current;
    if (!replay) return;
    const nextCursor = replay.step();
    const bar = nextCursor.bar;
    if (!bar) return;

    const index = nextCursor.index;
    const simTime = nextCursor.timeMs;

    // 1. If we have an open position, check exit against the new bar first.
    if (positionRef.current) {
      trackExcursion(positionRef.current, bar);
      const exit = checkPositionExit(positionRef.current, bar);
      if (exit) {
        const p = positionRef.current;
        const res = closePosition(
          configRef.current,
          p,
          exit.exitPrice,
          exit.reason,
          index,
          simTime,
          balanceRef.current
        );
        setBalanceBoth(res.newBalance);
        const trade = { ...res.trade, sessionId: sessionIdRef.current ?? "", decisionId: p.sourceDecisionId ?? "" };
        pushTrade(trade);
        pushLedger({
          id: `ledger_close_${trade.id}`,
          sessionId: trade.sessionId,
          atMs: simTime,
          type: "CLOSE",
          tradeId: trade.id,
          amount: res.trade.netPnl,
          balance: res.newBalance,
        });
        // Resolve the source decision with the trade outcome.
        const srcIdx = decisionsRef.current.findIndex((d) => d.id === p.sourceDecisionId);
        if (srcIdx >= 0) {
          const src = decisionsRef.current[srcIdx];
          const up = trade.result === "WIN" ? trade.side === "LONG" : trade.result === "LOSS" ? !(trade.side === "LONG") : null;
          const o = up == null ? 0.5 : up ? 1 : 0;
          const p = src.primaryProbability ?? 0.5;
          const brier = (p - o) * (p - o);
          const resolved = {
            ...src,
            tradeId: trade.id,
            resolution: {
              up,
              realReturnPct: trade.netPnlPct,
              winner: trade.result === "WIN" ? true : trade.result === "LOSS" ? false : null,
              brier,
            },
          } as DecisionSnapshot;
          decisionsRef.current = decisionsRef.current.map((d, i) => (i === srcIdx ? resolved : d));
          setDecisions([...decisionsRef.current]);
        }
        setPositionBoth(null);
      }
    }

    // 2. Run the shared engine for the new bar.
    const ctx = buildReplayContext(candlesRef.current, index, simTime);
    const out = runScalpingEngine({ ctx, previousSignal: prevSignalRef.current });
    prevSignalRef.current = out.signal;
    latestRef.current = out;
    setLatest({ ...out, signal: out.signal });

    // 3. Decide whether to act (modes).
    const actionable =
      (out.direction === "LONG" || out.direction === "SHORT") &&
      out.confidence >= configRef.current.minConfidence;

    const seq = ++seqRef.current;
    const snapId = `dec_${seq}_${simTime}`;
    const snap = buildSnapshot(out, index, simTime);
    if (snap) {
      flagCondition(snap);
      snap.id = snapId;
      snap.seq = seq;
      pushDecision(snap);

      let action: ActionTaken = "SKIP";
      if (actionable) {
        if (positionRef.current) {
          action = "WAIT";
        } else if (modeRef.current === "AUTO") {
          action = "EXECUTE";
        } else {
          // Manual / assisted: pause for user confirmation.
          action = "WAIT";
          setPending(snap);
          if (replayStateRef.current === "playing") replay.pause();
          setReplay(replay.replayState);
        }
      }
      const snapActioned = { ...snap, action };
      replaceDecision(snapActioned);
    }

    setCursor(nextCursor);
    setReplay(replay.replayState);
    replayStateRef.current = replay.replayState;
  }, [
    buildSnapshot,
    flagCondition,
    pushDecision,
    pushLedger,
    pushTrade,
    replaceDecision,
    setBalanceBoth,
    setPositionBoth,
  ]);

  /** User responds to a pending manual/assisted decision. */
  const respond = useCallback(
    (execute: boolean) => {
      const snap = pending;
      if (!snap) return;
      setPending(null);
      if (execute) {
        const out = latestRef.current;
        if (out) open(snap, out);
        else {
          const acted = { ...snap, action: "EXECUTE" as ActionTaken };
          replaceDecision(acted);
        }
      } else {
        replaceDecision({ ...snap, action: "SKIP" });
      }
    },
    [pending, open, replaceDecision]
  );

  /** Start a new experiment: fetch data, reset runtime, persist the session. */
  const start = useCallback(
    async (params: SimExperimentParams) => {
      setLoading(true);
      setError(null);
      resetRuntime();
      setMode(params.mode);
      modeRef.current = params.mode;
      const mergedConfig = { ...DEFAULT_CONFIG, ...(params.config ?? {}) };
      setConfig(mergedConfig);
      configRef.current = mergedConfig;

      try {
        const { fetchHistoricalCandles } = await import("../historical/loader");
        const fetched = await fetchHistoricalCandles(params.startMs, params.endMs);
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

        rangeRef.current = { from: params.startMs, to: params.endMs };
        const sessionId = `sim_${Date.now()}`;
        sessionIdRef.current = sessionId;
        const meta = {
          candleCount: fetched.length,
          firstCandleAtMs: fetched[0].time * 1000,
          lastCandleAtMs: fetched[fetched.length - 1].time * 1000,
        };
        const s: SimSession = {
          id: sessionId,
          symbol: "BTCUSDT",
          timeframe: "1m",
          mode: params.mode,
          startMs: params.startMs,
          endMs: params.endMs,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          status: "active",
          label: `${params.mode.toLowerCase()} ${new Date(params.startMs).toISOString().slice(0, 10)}`,
          lastSeq: 0,
          wallet: {
            initialBalance: INITIAL_BALANCE,
            currentBalance: INITIAL_BALANCE,
            feesPaid: 0,
            slippagePaid: 0,
          },
          config: mergedConfig,
          validation: null,
          analytics: null,
          meta,
        };
        setSession(s);
        setSessionMeta(s);
        void saveSession(s);
      } catch (e) {
        setError(e instanceof Error ? e.message : "تعذر تحميل البيانات");
      } finally {
        setLoading(false);
      }
    },
    [resetRuntime, setSessionMeta]
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

  /** Persist an immutable validation run to Firestore in batches. */
  const persistRun = useCallback(async (built: BuildRunResult): Promise<void> => {
    const { run, records, metrics, summary } = built;
    await saveValidationRun(run, summary);
    await saveValidationDecisions(run.runId, records);
    await saveValidationMetrics(run.runId, metrics);
  }, []);

  /** Finish the session: resolve remaining outcomes, analytics, validation. */
  const finalize = useCallback(() => {
    const r = replayRef.current;
    if (!r || !sessionIdRef.current) return;
    const sid = sessionIdRef.current;

    // Resolve any non-executed directional decisions against the full series.
    const decisionsResolved = decisionsRef.current.map((d) => {
      if (d.action === "EXECUTE" && d.tradeId) return d;
      if (d.resolution) return d;
      if (d.decision === "LONG" || d.decision === "SHORT") {
        const res = resolveDecisionOutcome(
          {
            direction: d.decision,
            confidence: d.confidence,
            primaryProbability: d.primaryProbability,
            price: d.price,
          },
          candlesRef.current,
          d.candleIndex,
          120
        );
        return { ...d, resolution: res };
      }
      return d;
    });
    decisionsRef.current = decisionsResolved;
    setDecisions(decisionsResolved);

    const sessionAnalytics = computeSessionAnalytics(
      sid,
      decisionsResolved,
      tradesRef.current,
      ledgerRef.current,
      INITIAL_BALANCE
    );
    setAnalytics(sessionAnalytics);
    const report = runValidation(candlesRef.current, decisionsResolved, tradesRef.current);
    setValidation(report);

    void saveAnalytics(sid, sessionAnalytics);
    void updateSessionMeta(sid, {
      status: "finished",
      analytics: sessionAnalytics,
      validation: report,
      lastSeq: seqRef.current,
    });

    // --- Immutable validation run: built once, written in batches. ---------
    const rng = rangeRef.current;
    if (candlesRef.current.length > 0 && decisionsResolved.length > 0) {
      const built = buildValidationRun({
        decisions: decisionsResolved,
        candles: candlesRef.current,
        config: configRef.current,
        symbol: "BTCUSDT",
        timeframe: "1m",
        from: rng.from,
        to: rng.to,
      });
      setRunPersistence({ runId: built.run.runId, engineVersion: ENGINE_VERSION, status: "saving" });
      void persistRun(built)
        .then(() =>
          setRunPersistence({ runId: built.run.runId, engineVersion: ENGINE_VERSION, status: "saved" })
        )
        .catch(() =>
          setRunPersistence({ runId: built.run.runId, engineVersion: ENGINE_VERSION, status: "error" })
        );
    }
  }, [persistRun]);

  // Auto-play interval for AUTO mode.
  const intervalIdRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (replay === "playing" && modeRef.current === "AUTO") {
      clearInterval(intervalIdRef.current ?? undefined);
      intervalIdRef.current = setInterval(() => advance(), 400);
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
  }, [replay, mode, advance]);

  return {
    candles,
    cursor,
    replay,
    speed,
    mode,
    setMode,
    config,
    balance,
    position,
    decisions,
    trades,
    ledger,
    latest,
    pending,
    session,
    analytics,
    validation,
    loading,
    error,
    start,
    play,
    pause,
    nextBar,
    respond,
    setSpeedValue,
    reset,
    finalize,
    replayValue: replay,
    stats: analytics?.performance,
    runPersistence,
    engineVersion: ENGINE_VERSION,
    strategyVersion: STRATEGY_VERSION,
  };
}
