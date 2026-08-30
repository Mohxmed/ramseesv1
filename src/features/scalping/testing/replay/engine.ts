import type { BtcCandle } from "../../../bitcoin/types";
import type { ReplayCursor, ReplayState } from "../types";

/**
 * Market Replay — a deterministic playback cursor over an ordered 1m candle
 * series.
 *
 * Responsibilities: play / pause / next / reset, replay speed, and the
 * simulated wall-clock. It NEVER inspects a candle beyond the current cursor,
 * and never reads data past `currentTime` — the only way to build a
 * `ScalpingContext` without look-ahead.
 *
 * Separating this from React lets the playback loop be unit-tested and keeps
 * all the tricky clock math in one pure module.
 */

export interface ReplayOptions {
  candles: BtcCandle[];
  startIndex?: number;
  /** ms of simulated time per step (advance). */
  stepMs?: number;
  /** Real ms between automatic steps. */
  tickMs?: number;
}

export class MarketReplay {
  private readonly candles: BtcCandle[];
  private idx: number;
  private state: ReplayState = "idle";
  private stepMs: number;
  private tickMs: number;
  private speed: number; // steps per tick (1/2/5/10...)
  private listener: (() => void) | null = null;

  constructor(opts: ReplayOptions) {
    this.candles = [...opts.candles];
    this.idx = opts.startIndex ?? 0;
    this.stepMs = opts.stepMs ?? 60_000;
    this.tickMs = opts.tickMs ?? 500;
    this.speed = 1;
  }

  /** Subscribe to step/state changes. Returns an unsubscribe fn. */
  onTick(cb: () => void): () => void {
    this.listener = cb;
    return () => {
      if (this.listener === cb) this.listener = null;
    };
  }

  private emit(): void {
    this.listener?.();
  }

  get cursor(): ReplayCursor {
    const bar = this.candles[this.idx] ?? null;
    return {
      index: this.idx,
      count: this.candles.length,
      timeMs: bar ? bar.time * 1000 : 0,
      bar,
    };
  }

  get current(): BtcCandle | null {
    return this.candles[this.idx] ?? null;
  }

  get replayState(): ReplayState {
    return this.state;
  }

  get isFinished(): boolean {
    return this.idx >= this.candles.length - 1;
  }

  /** Advance forward one step (respecting speed). Returns the new cursor. */
  step(): ReplayCursor {
    if (this.candles.length === 0) return this.cursor;
    this.idx = Math.min(this.candles.length - 1, this.idx + this.speed);
    if (this.idx >= this.candles.length - 1) this.state = "finished";
    this.emit();
    return this.cursor;
  }

  play(): void {
    if (this.candles.length === 0 || this.isFinished) return;
    this.state = "playing";
    this.emit();
  }

  pause(): void {
    if (this.state !== "playing") return;
    this.state = "paused";
    this.emit();
  }

  next(): ReplayCursor {
    return this.step();
  }

  setSpeed(mult: number): void {
    this.speed = Math.max(1, Math.floor(mult));
    this.emit();
  }

  get speedValue(): number {
    return this.speed;
  }

  reset(startIndex = 0): ReplayCursor {
    this.idx = startIndex;
    this.state = this.candles.length > 0 ? "idle" : "finished";
    this.emit();
    return this.cursor;
  }

  /** Shortcut to jump to an absolute candle index (used by session restore). */
  seek(index: number): ReplayCursor {
    const clamped = Math.max(0, Math.min(this.candles.length - 1, index));
    this.idx = clamped;
    this.state = clamped >= this.candles.length - 1 ? "finished" : "idle";
    this.emit();
    return this.cursor;
  }

  get stepMsValue(): number {
    return this.stepMs;
  }

  get tickMsValue(): number {
    return this.tickMs;
  }
}
