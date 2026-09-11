"use client";

import Image from "next/image";
import { num } from "@/components/ui/design-tokens";
import type {
  BootMode,
  BootPhase,
  BootTaskKey,
  BootTaskStatus,
} from "@/features/boot/boot-core";

const TASK_LABEL: Record<BootTaskKey, (mode: BootMode) => string> = {
  kernel: () => "تهيئة المحرك الأساسي",
  config: (mode) =>
    mode === "restore" ? "استعادة الإعدادات المحفوظة" : "تحميل مساحة العمل",
  session: (mode) =>
    mode === "restore" ? "استعادة الجلسة" : "التحقق من الجلسة",
  data: () => "تحميل بيانات الحساب",
  shell: () => "تجهيز واجهة التداول",
};

const KICKER: Record<BootMode, { en: string; ar: string }> = {
  init: { en: "System Initializing", ar: "تهيئة منفذ التداول" },
  restore: { en: "Workspace Restore", ar: "استعادة مساحة العمل" },
};

function TaskDot({ status }: { status: BootTaskStatus["status"] }) {
  if (status === "done") {
    return (
      <span className="flex h-4 w-4 items-center justify-center rounded-full border border-gold/40 bg-gold/10 text-[9px] font-bold text-gold-fg">
        ✓
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="flex h-4 w-4 items-center justify-center rounded-full border border-down/40 bg-down/10 text-[9px] font-bold text-down-fg">
        ✕
      </span>
    );
  }
  if (status === "running") {
    return (
      <span className="h-2 w-2 animate-pulse rounded-full bg-gold motion-reduce:animate-none" />
    );
  }
  return <span className="h-2 w-2 rounded-full bg-zinc-600" />;
}

function TaskTime({ task }: { task: BootTaskStatus }) {
  if (task.status === "done") return <span className="text-gold-fg">تم</span>;
  if (task.status === "error") {
    return <span className="text-down-fg">{task.timedOut ? "انتهت المهلة" : "فشل"}</span>;
  }
  if (task.status === "running" && task.elapsedMs != null) {
    return <span>{`${(task.elapsedMs / 1000).toFixed(1)}s`}</span>;
  }
  return <span>—</span>;
}

/**
 * Premium startup screen — dark, minimal, task-based. State comes exclusively
 * from the boot machine; there is no fake progress bar here.
 */
export function BootScreen({
  tasks,
  mode,
  phase,
}: {
  tasks: BootTaskStatus[];
  mode: BootMode;
  phase: BootPhase;
}) {
  const kicker = KICKER[mode];

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy={phase === "booting"}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-zinc-950"
    >
      {/* Ambient glows */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(201,169,97,0.09),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-[radial-gradient(circle_at_50%_120%,rgba(201,169,97,0.06),transparent_70%)]" />

      <div className="relative flex flex-col items-center px-6">
        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-card border border-gold/30 bg-surface-1 shadow-pop shadow-[0_0_44px_-14px_rgba(201,169,97,0.55)]">
          <Image
            src="/favicon.png"
            alt=""
            width={64}
            height={64}
            priority
            className="h-full w-full object-cover"
          />
        </div>

        <p className={`${num} mt-5 text-[10px] font-bold uppercase tracking-[0.35em] text-gold-fg`}>
          {kicker.en}
        </p>
        <h1 className="mt-1.5 text-3xl font-bold tracking-wide text-zinc-50">
          RAMSEES
        </h1>
        <p className="text-xs text-zinc-400">{kicker.ar}</p>

        <div className="mx-auto mt-7 h-px w-20 bg-gradient-to-r from-transparent via-gold/50 to-transparent" />

        {/* Task list — mirrors real boot state */}
        <ul className="mt-4 w-64 space-y-1">
          {tasks.map((task) => (
            <li key={task.key} className="flex items-center justify-between gap-3 py-1">
              <span
                className={`flex items-center gap-2 text-2xs ${
                  task.status === "error" ? "text-down-fg" : "text-zinc-300"
                }`}
              >
                <TaskDot status={task.status} />
                {TASK_LABEL[task.key](mode)}
              </span>
              <span className={`${num} text-2xs text-muted`}>
                <TaskTime task={task} />
              </span>
            </li>
          ))}
        </ul>

        {/* Indeterminate line — real-state driven, calm, motion-safe */}
        <div className="mt-5 h-px w-64 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full w-1/3 animate-pulse bg-gradient-to-r from-gold/50 via-gold-fg to-gold/50 motion-reduce:animate-none" />
        </div>
        <p className="mt-3 text-2xs tracking-wide text-muted">
          RAMSEES · MARKET INTELLIGENCE SYSTEM
        </p>
      </div>
    </div>
  );
}