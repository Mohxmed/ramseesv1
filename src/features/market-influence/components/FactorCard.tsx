"use client";

import type { MarketInfluenceFactor } from "@/features/market-influence/intelligence";
import { Badge, Dot, Status } from "@/components/ui/index";
import { Sparkline } from "./Sparkline";
import {
  corrLabel,
  corrStatusMeta,
  corrTone,
  fmtNum,
  fmtPct,
  impactTone,
  roleMeta,
  statusMeta,
} from "./format";

const categoryLabel: Record<string, string> = {
  equities: "أسهم",
  dollar: "دولار",
  rates: "عوائد",
  volatility: "تقلب",
  commodities: "سلع",
  fx: "عملات",
  liquidity: "سيولة",
};

export interface FactorCardProps {
  factor: MarketInfluenceFactor;
  onOpen: (id: string) => void;
}

export function FactorCard({ factor: f, onOpen }: FactorCardProps) {
  const role = roleMeta(f.role);
  const st = statusMeta(f.status);
  const sparkTone =
    f.direction === "up" ? "up" : f.direction === "down" ? "down" : "neutral";

  const shortCorr = f.corr["1h"] ?? f.corr["30m"] ?? f.corr["24h"] ?? null;
  const corrT = corrTone(shortCorr);

  const sigImpact = f.impactScore != null && Math.abs(f.impactScore) >= 5;

  return (
    <button
      type="button"
      onClick={() => onOpen(f.id)}
      className="group flex h-full w-full flex-col rounded-card border border-line bg-surface-1/40 p-3.5 text-right transition-colors hover:border-zinc-600 hover:bg-surface-1/70"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-xs font-bold text-zinc-100">{f.nameAr}</span>
            {f.tier === "secondary" ? (
              <span className="text-3xs text-muted">{f.nameEn}</span>
            ) : null}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-2xs text-muted">
            <span>{categoryLabel[f.category] ?? f.category}</span>
            <span aria-hidden>·</span>
            <Status label={st.label} tone={st.tone} pulse={st.pulse} />
          </div>
        </div>

        <div className="shrink-0 text-right">
          {sigImpact ? (
            <span
              className={`font-mono text-sm font-extrabold leading-none tabular-nums ${
                impactTone(f.impactScore) === "up"
                  ? "text-up-fg"
                  : impactTone(f.impactScore) === "down"
                  ? "text-down-fg"
                  : "text-zinc-300"
              }`}
            >
              {f.impactScore != null && f.impactScore > 0 ? "+" : ""}
              {f.impactScore != null ? f.impactScore.toFixed(0) : "—"}
            </span>
          ) : (
            <span className="font-mono text-sm font-extrabold leading-none tabular-nums text-zinc-500">
              —
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          {f.price != null ? (
            <p className="font-mono text-sm font-bold tabular-nums text-zinc-100" dir="ltr">
              {f.unit === "percent"
                ? `${f.price.toFixed(2)}%`
                : fmtNum(f.price)}
            </p>
          ) : (
            <p className="text-2xs text-muted">لا توجد بيانات</p>
          )}
          {f.change24hPct != null ? (
            <p
              className={`font-mono text-2xs tabular-nums ${
                f.change24hPct >= 0 ? "text-up-fg" : "text-down-fg"
              }`}
              dir="ltr"
            >
              {fmtPct(f.change24hPct)}
            </p>
          ) : null}
        </div>

        <Sparkline points={f.spark} tone={sparkTone} width={88} height={26} />
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-line/70 pt-2.5">
        <div className="flex items-center gap-1.5">
          <Badge tone={role.tone}>{role.label}</Badge>
          {f.impactScore != null && Math.abs(f.impactScore) >= 25 ? (
            <Badge tone={impactTone(f.impactScore)}>مؤثر</Badge>
          ) : null}
        </div>

        <div className="flex items-center gap-2 text-2xs text-muted">
          <span className="flex items-center gap-1">
            <Dot tone={corrT} />
            <span className="font-mono tabular-nums" dir="ltr">
              {corrLabel(shortCorr)}
            </span>
          </span>
          {f.corrStatus !== "normal" ? (
            <span className={corrStatusMeta(f.corrStatus).tone === "down" ? "text-down-fg" : "text-warn-fg"}>
              {corrStatusMeta(f.corrStatus).label}
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}