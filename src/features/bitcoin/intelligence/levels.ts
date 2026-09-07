import type { SupportResistanceResult } from "../analysis";

/** A single, de-duplicated price level surfaced in Key Levels. */
export type KeyLevel = {
  id: string;
  kind: "support" | "resistance";
  price: number;
  distancePercent: number;
  strength: number; // 0..100
  tests: number;
  isNearest: boolean;
};

const DEDUPE_TOLERANCE = 0.0005; // 0.05% center proximity => same level

/**
 * Selects the strongest distinct support/resistance levels from the 30m
 * structural analysis: nearest zones first, then strongest, capped per side.
 */
export function selectKeyLevels(
  analysis: SupportResistanceResult | null,
  maxPerSide = 3
): { support: KeyLevel[]; resistance: KeyLevel[] } {
  const support: KeyLevel[] = [];
  const resistance: KeyLevel[] = [];
  if (!analysis) return { support, resistance };

  const ordered = [...analysis.zones].sort((a, b) => {
    if (a.isNearest !== b.isNearest) return a.isNearest ? -1 : 1;
    return b.strength - a.strength;
  });

  for (const z of ordered) {
    const price = z.center;
    if (price <= 0 || !isFinite(price)) continue;
    const target = z.kind === "support" ? support : resistance;
    if (target.length >= maxPerSide) continue;
    if (
      target.some((l) => Math.abs(l.price - price) / l.price < DEDUPE_TOLERANCE)
    ) {
      continue;
    }
    target.push({
      id: z.id,
      kind: z.kind,
      price: z.center,
      distancePercent: z.distancePercent,
      strength: z.strength,
      tests: z.tests,
      isNearest: z.isNearest,
    });
  }

  // Support nearest-to-price first (highest price last is farthest); resistance
  // nearest-to-price first (lowest resistance is closest).
  support.sort((a, b) => b.price - a.price);
  resistance.sort((a, b) => a.price - b.price);
  return { support, resistance };
}