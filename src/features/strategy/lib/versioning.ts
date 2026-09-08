/**
 * Versioning helpers: version labels ("v1.0" → "v1.1"), immutable snapshots
 * and the strategy/version factory builders.
 */

import type { StrategyNumbers, StrategyVersion, StrategyVersionPatch, StrategyMetaPatch } from "../types/strategy";
import { DEFAULT_VERSION_VALUES, FIRST_VERSION_LABEL } from "./constants";

export function parseVersionLabel(label: string): { major: number; minor: number } | null {
  const match = /^v(\d+)\.(\d+)$/.exec(label.trim().toLowerCase());
  if (!match) return null;
  return { major: parseInt(match[1], 10), minor: parseInt(match[2], 10) };
}

/** Order two labels: returns negative if a < b, positive if a > b, 0 equal. */
export function compareVersionLabels(a: string, b: string): number {
  const pa = parseVersionLabel(a);
  const pb = parseVersionLabel(b);
  if (!pa || !pb) return a.localeCompare(b);
  return pa.major * 1000 + pa.minor - (pb.major * 1000 + pb.minor);
}

/** Highest version label among the versions of a strategy. */
export function highestVersionLabel(versions: StrategyVersion[]): string {
  if (!versions.length) return FIRST_VERSION_LABEL;
  return versions.map((v) => v.version).sort(compareVersionLabels)[versions.length - 1];
}

/** Default next label: patch bump of the highest existing version. */
export function nextVersionLabel(versions: StrategyVersion[]): string {
  if (!versions.length) return FIRST_VERSION_LABEL;
  const highest = highestVersionLabel(versions);
  const parsed = parseVersionLabel(highest);
  if (!parsed) return FIRST_VERSION_LABEL;
  return `v${parsed.major}.${parsed.minor + 1}`;
}

let seed = 0;
export function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${(seed += 1)}`;
}

export function createVersion(
  source: Partial<StrategyVersion>
): StrategyVersion {
  const now = Date.now();
  return {
    id: source.id ?? uid("ver"),
    version: source.version ?? FIRST_VERSION_LABEL,
    name: source.name ?? DEFAULT_VERSION_VALUES.name,
    riskPerTrade: source.riskPerTrade ?? DEFAULT_VERSION_VALUES.riskPerTrade,
    maxDrawdown: source.maxDrawdown ?? DEFAULT_VERSION_VALUES.maxDrawdown,
    maxDailyRisk: source.maxDailyRisk ?? DEFAULT_VERSION_VALUES.maxDailyRisk,
    maxConsecutiveLosses: source.maxConsecutiveLosses ?? DEFAULT_VERSION_VALUES.maxConsecutiveLosses,
    maxOpenPositions: source.maxOpenPositions ?? DEFAULT_VERSION_VALUES.maxOpenPositions,
    maxDailyTrades: source.maxDailyTrades ?? DEFAULT_VERSION_VALUES.maxDailyTrades,
    targetPercent: source.targetPercent ?? DEFAULT_VERSION_VALUES.targetPercent,
    stopLossPercent: source.stopLossPercent ?? DEFAULT_VERSION_VALUES.stopLossPercent,
    defaultRR: source.defaultRR ?? DEFAULT_VERSION_VALUES.defaultRR,
    minimumRR: source.minimumRR ?? DEFAULT_VERSION_VALUES.minimumRR,
    leverage: source.leverage ?? DEFAULT_VERSION_VALUES.leverage,
    marginMode: source.marginMode ?? DEFAULT_VERSION_VALUES.marginMode,
    defaultOrderType: source.defaultOrderType ?? DEFAULT_VERSION_VALUES.defaultOrderType,
    makerFee: source.makerFee ?? DEFAULT_VERSION_VALUES.makerFee,
    takerFee: source.takerFee ?? DEFAULT_VERSION_VALUES.takerFee,
    slippagePercent: source.slippagePercent ?? DEFAULT_VERSION_VALUES.slippagePercent,
    notes: source.notes ?? DEFAULT_VERSION_VALUES.notes,
    createdAt: now,
    updatedAt: now,
    createdFrom: source.createdFrom ?? null,
    isActive: source.isActive ?? false,
  };
}

function applyPatch(version: StrategyVersion, patch: StrategyVersionPatch): StrategyVersion {
  return {
    ...version,
    ...patch,
    updatedAt: Date.now(),
  };
}

/** Deep clone with fresh identity for a duplicate snapshot. */
export function duplicateVersion(
  source: StrategyVersion,
  overrides: Partial<StrategyVersion> = {}
): StrategyVersion {
  const copy = createVersion({ ...source, ...overrides });
  copy.createdFrom = source.version;
  copy.id = uid("ver");
  copy.createdAt = Date.now();
  copy.updatedAt = Date.now();
  copy.isActive = true;
  return copy;
}

export function createStrategy(
  meta: StrategyMetaPatch,
  initial: {
    versionLabel?: string;
    defaults?: Partial<StrategyVersionPatch>;
  } = {}
): StrategyNumbers {
  const now = Date.now();
  const version = createVersion({
    version: initial.versionLabel ?? FIRST_VERSION_LABEL,
    name: meta.name ?? DEFAULT_VERSION_VALUES.name,
    ...(initial.defaults ?? {}),
  } as Partial<StrategyVersion>);
  version.isActive = true;

  return {
    id: uid("strat"),
    name: meta.name?.trim() || "استراتيجية جديدة",
    description: meta.description?.trim() ?? "",
    symbol: meta.symbol?.trim() || "BTCUSD",
    market: meta.market?.trim() || "Binance Futures",
    createdAt: now,
    updatedAt: now,
    activeVersionId: version.id,
    versions: [version],
  };
}

/** Implicit next strategy/version plumbing used by the hook & dialogs. */
export function patchVersion(
  version: StrategyVersion,
  patch: StrategyVersionPatch
): StrategyVersion {
  return applyPatch(cloneVersion(version), patch);
}

export function cloneVersion(version: StrategyVersion): StrategyVersion {
  return JSON.parse(JSON.stringify(version)) as StrategyVersion;
}

/** Keep the active marker consistent after any setVersion change. */
export function normalizeVersions(
  version: StrategyVersion,
  activeVersionId: string
): StrategyVersion {
  return { ...version, isActive: version.id === activeVersionId };
}