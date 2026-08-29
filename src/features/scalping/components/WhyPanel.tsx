"use client";

import type { ScalpingSignal } from "../types";
import { Panel } from "./ui";

export function WhyPanel({ signal }: { signal: ScalpingSignal | null }) {
  if (!signal || signal.state === "NEUTRAL") {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="WHY THIS SIGNAL?">
          <div className="text-center text-xs text-zinc-500">
            لا إشارة اتجاهية حاليًا — الضغط متوازن أو البيانات غير كافية.
          </div>
        </Panel>
        <Panel title="RISKS / WARNINGS">
          <div className="text-center text-xs text-zinc-500">—</div>
        </Panel>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Panel title="WHY THIS SIGNAL? — لماذا هذا الاتجاه؟">
        {signal.reasons.length ? (
          <ul className="space-y-1.5">
            {signal.reasons.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-zinc-300">
                <span className="mt-1 text-emerald-400">◆</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-xs text-zinc-500">لا عوامل داعمة كافية.</div>
        )}
      </Panel>

      <Panel title="RISKS / WARNINGS — المخاطر والتحذيرات">
        {signal.warnings.length ? (
          <ul className="space-y-1.5">
            {signal.warnings.map((w, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-amber-200/90">
                <span className="mt-1 text-amber-400">▲</span>
                <span>{w}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-xs text-zinc-500">لا تحذيرات بارزة.</div>
        )}
      </Panel>
    </div>
  );
}
