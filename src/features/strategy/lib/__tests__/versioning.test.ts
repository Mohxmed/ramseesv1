import { describe, it, expect } from "vitest";
import {
  parseVersionLabel,
  nextVersionLabel,
  highestVersionLabel,
  compareVersionLabels,
  createVersion,
  createStrategy,
  duplicateVersion,
  patchVersion,
} from "../versioning";
import type { StrategyNumbers, StrategyVersion } from "../../types/strategy";

function v(label: string): StrategyVersion {
  return createVersion({ version: label, name: `نسخة ${label}` });
}

describe("version labels", () => {
  it("parses and delta-compares labels", () => {
    expect(parseVersionLabel("v1.0")).toEqual({ major: 1, minor: 0 });
    expect(parseVersionLabel("garbage")).toBeNull();
    expect(compareVersionLabels("v2.0", "v1.9")).toBeGreaterThan(0);
    expect(compareVersionLabels("v1.10", "v1.9")).toBeGreaterThan(0);
  });

  it("next label bumps patch of the highest version", () => {
    expect(nextVersionLabel([])).toBe("v1.0");
    expect(nextVersionLabel([v("v1.0")])).toBe("v1.1");
    expect(nextVersionLabel([v("v1.0"), v("v2.0")])).toBe("v2.1");
    expect(highestVersionLabel([v("v1.9"), v("v2.0"), v("v1.10")])).toBe("v2.0");
  });
});

describe("strategy factory", () => {
  it("creates a strategy with a single active v1.0", () => {
    const s = createStrategy({ name: "اختراق مستويات", symbol: "BTCUSD", market: "Binance", description: "وصف" });
    expect(s.versions).toHaveLength(1);
    expect(s.versions[0].version).toBe("v1.0");
    expect(s.versions[0].isActive).toBe(true);
    expect(s.activeVersionId).toBe(s.versions[0].id);
  });

  it("versions are independent snapshots — editing one never touches another", () => {
    const s: StrategyNumbers = createStrategy({ name: "أ" });
    const first = s.versions[0];
    const second = duplicateVersion(first);
    s.versions.push(second);

    const patchedFirst = patchVersion(first, { riskPerTrade: 7 });

    expect(first.riskPerTrade).toBe(1);
    expect(second.riskPerTrade).toBe(1);
    expect(patchedFirst.riskPerTrade).toBe(7);
    expect(patchedFirst.id).toBe(first.id);
    expect(second.createdFrom).toBe("v1.0");
  });
});