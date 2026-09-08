import Link from "next/link";
import { PageHeader } from "@/components/ui";
import {
  NetworkIcon,
  LayersIcon,
  CalculatorIcon,
  ArrowLeftIcon,
} from "@/components/icons/icons";
import type { ReactNode } from "react";

function GatewayCard({
  href,
  icon,
  title,
  description,
  cta,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  description: string;
  cta: string;
}) {
  return (
    <Link
      href={href}
      className="group block h-full rounded-card border border-line bg-surface-1/60 p-5 transition-colors hover:border-up/40 hover:bg-surface-1"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-panel bg-up/10 text-up-fg">
          {icon}
        </div>
        <ArrowLeftIcon className="h-4 w-4 text-muted transition-transform group-hover:-translate-x-0.5 group-hover:text-up-fg" />
      </div>
      <h2 className="mt-4 text-base font-bold text-zinc-100">{title}</h2>
      <p className="mt-1.5 text-xs leading-relaxed text-muted">{description}</p>
      <div className="mt-4 text-xs font-bold text-up-fg">{cta}</div>
    </Link>
  );
}

export default function StrategyCenterPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Strategy Suite"
        icon={<NetworkIcon className="h-5 w-5" />}
        title="مركز الاستراتيجيات"
        description="مساحة موحدة لأرقام الاستراتيجيات وإصداراتها وحاسبة المخاطر — كل قيمة ثوابت تداول في نسخة مفردة، وحساب أرقام المخاطر والأهداف والتكلفة وفقها."
      />

      <div className="grid gap-4 md:grid-cols-2">
        <GatewayCard
          href="/strategy/numbers"
          icon={<LayersIcon className="h-5 w-5" />}
          title="أرقام الاستراتيجية"
          description="إصدارات متسلسلة من أرقام المخاطر والتداول والتنفيذ. أنشئ استراتيجية، وطوّرها بنسخ إصدارات مستقلة، وقارن بينها، وحدّد الإصدار النشط الذي تعتمد عليه الحاسبة."
          cta="فتح محرر الأرقام"
        />
        <GatewayCard
          href="/strategy/risk-calculator"
          icon={<CalculatorIcon className="h-5 w-5" />}
          title="حاسبة المخاطر"
          description="ضع الدخول ووقف الخسارة والهدف على صفقة LONG أو SHORT، واختر نوعي أوامر الدخول والخروج، واحصل على حجم المركز، الهامش، نسب المخاطرة والمكسب، الرسوم، والانزلاق، وصافي النتيجة."
          cta="فتح الحاسبة"
        />
      </div>

      <div className="rounded-panel border border-line bg-surface-1/40 px-4 py-3 text-2xs leading-relaxed text-muted">
        كل نسخة عبارة عن لقطة ثابتة: تعديل نسخة لا يمس غيرها أبدًا، والسيناريوهات المحفوظة في
        الحاسبة تلتقط صورة كاملة من القيم وقت الحفظ، فلا تتغير بأثر رجعي عند تعديل
        الاستراتيجية لاحقًا.
      </div>
    </div>
  );
}