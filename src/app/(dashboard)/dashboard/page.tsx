"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { useStrategies } from "@/features/decision/hooks/useStrategies";
import {
  PageHeader,
  Card,
  MetricCard,
  Badge,
  Progress,
} from "@/components/ui/index";

export default function DashboardPage() {
  const { user } = useAuth();
  const { strategies } = useStrategies();

  const available = strategies.filter((s) => s.enabled).length;
  const enabledPct = strategies.length
    ? Math.round((available / strategies.length) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Overview"
        title="لوحة التحكم"
        description="نظرة عامة على النظام والوصول السريع إلى الميزات."
        right={<Badge tone="good">نشط</Badge>}
      />

      <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-3">
        <Link
          href="/strategies"
          className="group flex flex-col rounded-card border border-line bg-surface-1/40 p-5 transition-colors hover:border-zinc-600"
        >
          <CardInner
            icon="🧩"
            title="الاستراتيجيات"
            body={
              <div className="mt-4 flex flex-1 flex-col justify-between gap-4">
                <div className="flex items-end justify-between gap-2">
                  <MetricCard label="الإجمالي" value={strategies.length} />
                  <MetricCard label="مفعّلة" value={available} tone="up" />
                </div>
                <div className="rounded-panel border border-line bg-surface-2/30 px-3 py-2">
                  <div className="text-2xs text-muted">نسبة التفعيل</div>
                  <div className="mt-1">
                    <Progress pct={enabledPct} tone="up" showLabel />
                  </div>
                </div>
              </div>
            }
          />
        </Link>

        <Link
          href="/decision-center"
          className="group flex flex-col rounded-card border border-line bg-surface-1/40 p-5 transition-colors hover:border-zinc-600"
        >
          <CardInner
            icon="🎯"
            title="مركز القرارات"
            body={
              <div className="mt-4 flex flex-1 flex-col justify-end gap-4">
                <div className="rounded-panel border border-line bg-surface-2/30 px-3 py-2">
                  <div className="text-2xs text-muted">الحالة</div>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge tone="warn">تقييم مباشر</Badge>
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-md border border-line px-3 py-2 text-xs font-semibold text-zinc-300 transition-colors group-hover:border-zinc-500 group-hover:text-zinc-100">
                  فتح مركز القرارات <span aria-hidden>←</span>
                </div>
              </div>
            }
          />
        </Link>

        <Card
          title="الحساب"
          actions={<Badge tone="quiet">متصل</Badge>}
          bodyClassName="flex flex-1 flex-col justify-between gap-4"
        >
          <p className="truncate text-xs text-muted">
            مرحبًا، {user?.displayName ?? user?.email ?? "مستخدم"}
          </p>
          <div className="mt-3">
            <LogoutButton />
          </div>
        </Card>
      </div>
    </div>
  );
}

/** Internal helper: title row for the dashboard quick links (keeps markup consistent). */
function CardInner({
  icon,
  title,
  body,
}: {
  icon: string;
  title: string;
  body: ReactNode;
}) {
  return (
    <>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
        <span aria-hidden className="text-lg">{icon}</span>
      </div>
      {body}
    </>
  );
}