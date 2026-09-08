import Link from "next/link";
import { PageHeader } from "@/components/ui";
import {
  NetworkIcon,
  LayersIcon,
  CalculatorIcon,
  ArrowLeftIcon,
  CheckIcon,
  HistoryIcon,
} from "@/components/icons/icons";
import type { ReactNode } from "react";

interface GatewayFeature {
  text: string;
}

function Feature({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2 text-2xs leading-5 text-zinc-300">
      <CheckIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-up-fg" />
      <span>{text}</span>
    </li>
  );
}

function GatewayCard({
  href,
  eyebrow,
  icon,
  title,
  description,
  features,
  cta,
}: {
  href: string;
  eyebrow: string;
  icon: ReactNode;
  title: string;
  description: string;
  features: GatewayFeature[];
  cta: string;
}) {
  return (
    <Link
      href={href}
      className="group flex h-full flex-col justify-between gap-5 rounded-card border border-line bg-gradient-to-b from-surface-1/80 to-surface-1/40 p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-up/40 hover:shadow-pop"
    >
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-panel bg-up/10 text-up-fg ring-1 ring-inset ring-up/20">
            {icon}
          </div>
          <ArrowLeftIcon className="h-4 w-4 text-muted transition-transform duration-200 group-hover:-translate-x-1 group-hover:text-up-fg" />
        </div>
        <div className="text-3xs font-semibold uppercase tracking-[0.2em] text-muted">
          {eyebrow}
        </div>
        <h2 className="mt-2 text-lg font-bold text-zinc-100">{title}</h2>
        <p className="mt-2 text-xs leading-relaxed text-muted">{description}</p>
        <ul className="mt-4 space-y-1.5 border-t border-line/70 pt-4">
          {features.map((f) => (
            <Feature key={f.text} text={f.text} />
          ))}
        </ul>
      </div>
      <div className="flex items-center gap-1.5 text-xs font-bold text-up-fg">
        {cta}
        <ArrowLeftIcon className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-x-0.5" />
      </div>
    </Link>
  );
}

export default function StrategyCenterPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Strategy Suite"
        icon={<NetworkIcon className="h-5 w-5" />}
        title="مركز الاستراتيجيات"
        description="مساحة موحدة لأرقام الاستراتيجيات وإصداراتها وحاسبة المخاطر. كل قيمة ثوابت تداول في نسخة واحدة مفردة، والحاسبة تحسب المخاطر والأهداف والتكلفة وفق النسخة النشطة."
      />

      <div className="grid gap-5 md:grid-cols-2">
        <GatewayCard
          href="/strategy/numbers"
          eyebrow="Strategy Numbers"
          icon={<LayersIcon className="h-5 w-5" />}
          title="أرقام الاستراتيجية"
          description="إصدارات متسلسلة من أرقام المخاطر والتداول والتنفيذ لكل استراتيجية."
          features={[
            { text: "أنشئ استراتيجية وطوّرها بنسخ مستقلة لا تؤثر بعضها على بعض" },
            { text: "قارن النسخ جنبًا إلى جنب وحدد الفروق بدقة" },
            { text: "النسخة النشطة هي مصدر الأرقام للحاسبة" },
          ]}
          cta="فتح محرر الأرقام"
        />
        <GatewayCard
          href="/strategy/risk-calculator"
          eyebrow="Risk Calculator"
          icon={<CalculatorIcon className="h-5 w-5" />}
          title="حاسبة المخاطر"
          description="ضع الدخول ووقف الخسارة والهدف على صفقة LONG أو SHORT، واختر نوعي أوامر الدخول والخروج، واحصل على الحجم والهامش والرسوم وصافي النتيجة فورًا."
          features={[
            { text: "حجم المركز، الهامش، نسب المخاطرة والمكسب، والرافعة" },
            { text: "رسوم صانع/مستحوذ وانزلاق سعري لكل سيناريو" },
            { text: "استيراد أرقام الاستراتيجية بضغطة واحدة" },
          ]}
          cta="فتح الحاسبة"
        />
      </div>

      <div className="flex items-start gap-3 rounded-panel border border-line bg-surface-1/40 px-4 py-3.5">
        <HistoryIcon className="mt-0.5 h-4 w-4 shrink-0 text-up-fg" />
        <p className="text-2xs leading-relaxed text-muted">
          كل نسخة عبارة عن لقطة ثابتة: تعديل نسخة لا يمس غيرها أبدًا، والسيناريوهات المحفوظة
          في الحاسبة تلتقط صورة كاملة من القيم وقت الحفظ، فلا تتغير بأثر رجعي عند تعديل
          الاستراتيجية لاحقًا.
        </p>
      </div>
    </div>
  );
}