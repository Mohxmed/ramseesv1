"use client";

import { useState } from "react";
import { Card, Badge, Stat, DataRow, Status, Progress } from "@/components/ui/index";
import { Tabs } from "@/components/ui/controls";
import { num } from "@/components/ui/design-tokens";
import { MULTI_ASSET_CONFIG } from "../config";
import type { AssetCorrelation, MultiAssetSnapshot } from "../types";

/**
 * Multi-Asset Lead-Lag Correlation dashboard panel.
 *
 * Reads the engine snapshot (useMultiAssetCorrelation) and renders:
 *   * An asset tab strip (SOL / ETH / AVAX / NEAR / DOGE).
 *   * A primary lead-lag card for the selected asset: correlation, beta and
 *     the lag badge (emerald when the asset clearly trails BTC at >=200ms,
 *     amber when it tracks BTC tightly at <200ms) plus a glowing signal bar.
 *   * A compact overview grid of all assets with the top opportunity row
 *     highlighted.
 *
 * Suppression integrity: signals are rendered muted/suppressed whenever the
 * stream is (re)connecting or the correlation falls below the confidence floor
 * — the same honesty rule used across the app (real data only).
 */

type Tone = AssetCorrelation["signal"];

/** Long/short label text indexed by signal tone. */
const SIGNAL_LABEL: Record<Tone, string> = {
  long: "Long",
  short: "Short",
  neutral: "متوازن (لا توجد فجوة)",
};

/** Lag badge: emerald when the asset trails BTC (>=200ms), amber when tight. */
function lagTone(lagMs: number | null): "good" | "warn" {
  return lagMs != null && lagMs >= MULTI_ASSET_CONFIG.lagSlowAtOrAboveMs
    ? "good"
    : "warn";
}

function pct(v: number | null | undefined, d = "—"): string {
  return v == null || !isFinite(v)
    ? d
    : `${v > 0 ? "+" : ""}${(v * 100).toFixed(2)}%`;
}

function corrLabel(v: number | null): string {
  return v == null || !isFinite(v) ? "—" : (v * 100).toFixed(1) + "%";
}

function fmtMs(v: number | null): string {
  return v == null || !isFinite(v) ? "—" : `${Math.round(v)} ms`;
}

/** The glowing headline signal bar for the selected asset. */
function SignalBar({
  asset,
  reconnecting,
}: {
  asset: AssetCorrelation | null;
  reconnecting: boolean;
}) {
  if (!asset) {
    return <div className="text-2xs text-muted">جارٍ تحميل البيانات…</div>;
  }

  const suppressed =
    reconnecting || asset.suppressed || asset.collecting;

  if (suppressed) {
    return (
      <div className="rounded-md border border-warn/40 bg-warn/10 px-3 py-2 text-2xs text-warn-fg">
        ⏸ إشارات متوقفة مؤقتاً — {reconnecting || asset.suppressed
          ? "اتصال قاعدة البيانات قيد إعادة الربط، نمنع الإشارات للحفاظ على النزاهة."
          : "جمع بيانات كافية للارتباط…"}
        {asset.correlation != null && asset.correlation < MULTI_ASSET_CONFIG.suppressCorrBelow
          ? " (الارتباط دون 65%.)"
          : ""}
      </div>
    );
  }

  const isLong = asset.signal === "long";
  const isShort = asset.signal === "short";
  const glow = isLong
    ? "border-up/60 bg-up/10 text-up-fg shadow-[0_0_18px_-2px_rgba(16,185,129,0.55)]"
    : isShort
      ? "border-down/60 bg-down/10 text-down-fg shadow-[0_0_18px_-2px_rgba(239,68,68,0.55)]"
      : "border-line bg-surface-2/40 text-zinc-300";

  const glyph = isLong ? "⚡" : isShort ? "⚡" : "•";
  const text =
    isLong
      ? `إشارة Long خاطفة على ${asset.label} (تأخر السعر)`
      : isShort
        ? `إشارة Short خاطفة على ${asset.label} (تأخر السعر)`
        : SIGNAL_LABEL.neutral;

  return (
    <div className={`rounded-md border px-3 py-2 text-2xs font-semibold ${glow}`}>
      <span className="ml-1">{glyph}</span>
      {text}
      {asset.spreadPct != null ? (
        <span className="font-mono tabular-nums text-[10px] opacity-80">
          {"  "}spread {pct(asset.spreadPct)} · corr {corrLabel(asset.correlation)}
        </span>
      ) : null}
    </div>
  );
}

function PrimaryCard({
  asset,
  reconnecting,
}: {
  asset: AssetCorrelation | null;
  reconnecting: boolean;
}) {
  return (
    <Card
      title={asset ? `${asset.label} مقابل BTC` : "العملة المختارة مقابل BTC"}
      eyebrow="Lead-Lag Correlation"
      actions={
        asset ? (
          <Badge
            tone={asset.signal === "long" ? "up" : asset.signal === "short" ? "down" : "neutral"}
            ltr
          >
            {asset.signal.toUpperCase()}
          </Badge>
        ) : (
          <Badge tone="quiet">—</Badge>
        )
      }
    >
      {!asset ? (
        <div className="py-6 text-center text-2xs text-muted">لا توجد بيانات بعد.</div>
      ) : (
        <div className="space-y-4">
          {/* Headline metrics */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="الارتباط (R)" value={corrLabel(asset.correlation)} tone={asset.correlation != null && asset.correlation >= MULTI_ASSET_CONFIG.suppressCorrBelow ? "good" : "neutral"} />
            <Stat label="بيتا" value={asset.beta == null || !isFinite(asset.beta) ? "—" : (asset.beta as number).toFixed(2)} />
            <Stat
              label="تأخر السعر"
              value={fmtMs(asset.lagMs)}
              tone={lagTone(asset.lagMs)}
              hint={asset.lagMs != null && asset.lagMs >= MULTI_ASSET_CONFIG.lagSlowAtOrAboveMs ? "BTC المتقدم — فرصة متأخرة" : "متابعة محكمة"}
            />
            <Stat label="الفجوة (Spread)" value={pct(asset.spreadPct)} tone={asset.spreadPct != null ? (asset.spreadPct > 0 ? "up" : "down") : "neutral"} />
          </div>

          {/* Signal bar */}
          <SignalBar asset={asset} reconnecting={reconnecting} />

          {/* Detail rows */}
          <div className="rounded-panel border border-line bg-surface-2/20 p-3">
            <DataRow label="سعر المرجع (BTC)" value={asset.refPrice != null ? asset.refPrice.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "—"} ltr />
            <DataRow label={`سعر ${asset.label}`} value={asset.assetPrice != null ? asset.assetPrice.toLocaleString("en-US", { maximumFractionDigits: 6 }) : "—"} ltr />
            <DataRow label="حركة BTC (1ث)" value={pct(asset.expectedMovePct != null ? asset.expectedMovePct / (asset.beta ?? 1) : null)} />
            <DataRow label={`حركة ${asset.label} (1ث)`} value={pct(asset.assetMovePct)} tone={asset.assetMovePct != null ? (asset.assetMovePct > 0 ? "up" : "down") : "neutral"} />
            <DataRow
              label="المتوقع (BTC × بيتا)"
              value={pct(asset.expectedMovePct)}
              tone={asset.expectedMovePct != null ? (asset.expectedMovePct > 0 ? "up" : "down") : "neutral"}
            />
            <DataRow label="نقاط الارتباط" value={asset.sampleSize > 0 ? String(asset.sampleSize) : "—"} ltr />
          </div>

          {asset.collecting && (
            <div className="text-2xs text-muted">
              <Progress pct={asset.sampleSize ? Math.min(100, (asset.sampleSize / Math.max(20, MULTI_ASSET_CONFIG.corrWindow)) * 100) : 0} tone="warn" showLabel />
              <div className="mt-1">جمع بيانات حقيقية للارتباط…</div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function AssetRow({
  asset,
  active,
  onSelect,
}: {
  asset: AssetCorrelation;
  active: boolean;
  onSelect: () => void;
}) {
  const score = asset.correlation != null && asset.spreadPct != null
    ? Math.abs(asset.spreadPct) * asset.correlation
    : null;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left transition-colors ${
        active ? "border-accent/50 bg-accent/5" : "border-line bg-surface-2/20 hover:border-zinc-600"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-zinc-100">{asset.label}</span>
        <Badge
          tone={asset.signal === "long" ? "up" : asset.signal === "short" ? "down" : "neutral"}
          ltr
        >
          {SIGNAL_LABEL[asset.signal] === "متوازن (لا توجد فجوة)" ? "—" : asset.signal.toUpperCase()}
        </Badge>
      </div>
      <div className="flex items-center gap-3">
        <span className={`${num} text-2xs text-muted`}>R {corrLabel(asset.correlation)}</span>
        {score != null ? (
          <span className={`${num} text-2xs ${score > 0.5 ? "text-up-fg" : "text-muted"}`}>
            {pct(asset.spreadPct)}
          </span>
        ) : (
          <span className="text-2xs text-muted">{asset.collecting ? "جمع…" : "—"}</span>
        )}
      </div>
    </button>
  );
}

export function MultiAssetCorrelationPanel({ snap }: { snap: MultiAssetSnapshot }) {
  const [active, setActive] = useState<string>(MULTI_ASSET_CONFIG.assets[0].symbol.toLowerCase());

  const activeAsset = snap.assets.find((a) => a.symbol === active) ?? snap.assets[0] ?? null;

  const tabItems = MULTI_ASSET_CONFIG.assets.map((a) => ({
    value: a.symbol.toLowerCase(),
    label: a.label,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Tabs value={active} onChange={setActive} items={tabItems} variant="scrollable" />
        <Status
          label={
            snap.health.reconnecting || snap.health.stale
              ? "إعادة ربط…"
              : snap.health.connected
                ? "مباشر"
                : "متصل"
          }
          tone={snap.health.reconnecting || snap.health.stale ? "warn" : "good"}
          pulse={snap.health.connected && !snap.health.reconnecting}
        />
      </div>

      <PrimaryCard asset={activeAsset} reconnecting={snap.health.reconnecting || snap.health.stale} />

      {/* Compact overview grid — all assets, top opportunity highlighted row first */}
      <Card title="نظرة عامة على جميع العملات" eyebrow="Opportunity Scan" actions={<Badge tone="quiet" ltr>{snap.assets.length} أصول</Badge>}>
        <div className="space-y-2">
          {[...snap.assets]
            .sort((a, b) => {
              const sa = a.correlation != null && a.spreadPct != null ? Math.abs(a.spreadPct) * a.correlation : 0;
              const sb = b.correlation != null && b.spreadPct != null ? Math.abs(b.spreadPct) * b.correlation : 0;
              return sb - sa;
            })
            .map((a) => {
              const isTop = snap.top?.symbol === a.symbol;
              return (
                <div key={a.symbol} className={isTop ? "rounded-md ring-1 ring-up/40" : ""}>
                  <AssetRow asset={a} active={a.symbol === active} onSelect={() => setActive(a.symbol)} />
                  {isTop && a.signal !== "neutral" && (
                    <div className="px-3 pb-1 text-2xs text-up-fg">★ أفضل فرصة (أعلى فجوة × ارتباط)</div>
                  )}
                </div>
              );
            })}
        </div>
      </Card>
    </div>
  );
}
