/** Freshness / data-health primitives (pure, deterministic). */

export type FreshnessLevel = "fresh" | "old" | "stale";

export const FRESH_MS = 30_000;
export const OLD_MS = 120_000;

export type Freshness = {
  secondsAgo: number | null;
  level: FreshnessLevel;
};

/** Classifies how old a last-update timestamp is relative to `nowMs`. */
export function freshnessOf(
  nowMs: number,
  updatedAt: number | null | undefined
): Freshness {
  if (updatedAt == null || !isFinite(updatedAt)) {
    return { secondsAgo: null, level: "stale" };
  }
  const diff = nowMs - updatedAt;
  if (!isFinite(diff) || diff < 0) return { secondsAgo: 0, level: "fresh" };
  const secondsAgo = Math.floor(diff / 1000);
  const level: FreshnessLevel =
    diff <= FRESH_MS ? "fresh" : diff <= OLD_MS ? "old" : "stale";
  return { secondsAgo, level };
}

/** Arabic relative-time label for a seconds-ago value. */
export function formatAgo(secondsAgo: number | null): string {
  if (secondsAgo == null || !isFinite(secondsAgo)) return "غير معروف";
  if (secondsAgo < 5) return "الآن";
  if (secondsAgo < 60) return `قبل ${secondsAgo}ث`;
  const m = Math.floor(secondsAgo / 60);
  if (m < 60) return `قبل ${m}د`;
  const h = Math.floor(m / 60);
  return `قبل ${h}س ${m % 60}د`;
}

export type SourceStatus =
  | "live"
  | "periodic"
  | "old"
  | "stale"
  | "missing";

export type DataSourceHealth = {
  id: string;
  label: string;
  present: boolean;
  updatedAt: number | null;
  status: SourceStatus;
  detail?: string;
};

export type SourcesInput = {
  nowMs: number;
  spotWs: { connected: boolean | null; updatedAt: number | null };
  futuresWs: { live: boolean | null; stale: boolean | null; updatedAt: number | null };
  restSpot: { present: boolean; updatedAt: number | null };
  restFutures: { present: boolean; updatedAt: number | null };
  coingecko: { present: boolean; updatedAt: number | null };
  options: { present: boolean; updatedAt: number | null };
};

function statusOf(f: Freshness): SourceStatus {
  return f.level === "fresh" ? "live" : f.level === "old" ? "periodic" : "stale";
}

/** Current health of every data source the Command Center reads. */
export function computeDataSources(input: SourcesInput): DataSourceHealth[] {
  const { nowMs } = input;
  const out: DataSourceHealth[] = [];

  if (input.spotWs.connected === true) {
    const f = freshnessOf(nowMs, input.spotWs.updatedAt);
    out.push({
      id: "spot-ws",
      label: "قناة السوق الفوري (Spot WS)",
      present: true,
      updatedAt: input.spotWs.updatedAt,
      status: f.level === "fresh" ? "live" : statusOf(f),
    });
  } else {
    out.push({
      id: "spot-ws",
      label: "قناة السوق الفوري (Spot WS)",
      present: false,
      updatedAt: input.spotWs.updatedAt,
      status:
        input.spotWs.connected === null
          ? "missing"
          : "stale",
      detail: input.spotWs.connected === null ? "جارٍ الاتصال" : "منقطعة",
    });
  }

  if (input.futuresWs.live === true && !input.futuresWs.stale) {
    const f = freshnessOf(nowMs, input.futuresWs.updatedAt);
    out.push({
      id: "futures-ws",
      label: "قناة العقود الآجلة (Futures WS)",
      present: true,
      updatedAt: input.futuresWs.updatedAt,
      status: f.level === "fresh" ? "live" : statusOf(f),
    });
  } else if (input.futuresWs.live === true) {
    out.push({
      id: "futures-ws",
      label: "قناة العقود الآجلة (Futures WS)",
      present: true,
      updatedAt: input.futuresWs.updatedAt,
      status: "stale",
      detail: "قناة بطيئة (watchdog)",
    });
  } else {
    out.push({
      id: "futures-ws",
      label: "قناة العقود الآجلة (Futures WS)",
      present: false,
      updatedAt: input.futuresWs.updatedAt,
      status: "missing",
      detail: "غير متصلة",
    });
  }

  const restCandidates: [string, string, { present: boolean; updatedAt: number | null }][] = [
    ["rest-spot", "واجهة REST — السوق الفوري", input.restSpot],
    ["rest-futures", "واجهة REST — العقود الآجلة", input.restFutures],
    ["coingecko", "CoinGecko — نظرة عامة", input.coingecko],
    ["options", "Deribit — عقود الخيارات", input.options],
  ];
  for (const [id, label, src] of restCandidates) {
    if (!src.present) {
      out.push({
        id,
        label,
        present: false,
        updatedAt: src.updatedAt,
        status: "missing",
        detail: "غير متاح",
      });
      continue;
    }
    const f = freshnessOf(nowMs, src.updatedAt);
    out.push({
      id,
      label,
      present: true,
      updatedAt: src.updatedAt,
      status: f.level === "fresh" ? "live" : statusOf(f),
    });
  }

  return out;
}

export function computeCoverage(present: number, total: number): number {
  return total > 0 ? Math.max(0, Math.min(1, present / total)) : 0;
}