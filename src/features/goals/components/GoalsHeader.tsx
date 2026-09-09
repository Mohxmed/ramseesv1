import { PageHeader, Badge } from "@/components/ui/index";
import { TrophyIcon } from "@/components/icons/icons";
import { formatGrowth } from "../utils";

type GoalsHeaderProps = {
  perMoveGrowthPercent: number;
  monthlyGrowthPercent: number;
  strategyName: string | null;
  version: string | null;
};

export function GoalsHeader({
  perMoveGrowthPercent,
  monthlyGrowthPercent,
  strategyName,
  version,
}: GoalsHeaderProps) {
  return (
    <PageHeader
      eyebrow="Goals"
      icon={<TrophyIcon className="h-5 w-5 text-muted" />}
      title="الأهداف"
      description="شبكة نمو لشهر كامل: 30 كارد (كارد لكل يوم)، الهدف في كل كارد هو نسبة زيادة المحفظة المشتقة من أرقام استراتيجيتك الحالية — مخاطرة الصفقة × RR — وتتضاعف تراكميًا حتى هدف الشهر."
      actions={
        <>
          <Badge tone="up">30 كارد</Badge>
          <Badge tone="good">{formatGrowth(perMoveGrowthPercent)} للكارد</Badge>
          <Badge tone="good">{formatGrowth(monthlyGrowthPercent)} للشهر</Badge>
          {strategyName && version ? (
            <Badge tone="neutral" className="hidden sm:inline-flex">
              المصدر: {strategyName} · {version}
            </Badge>
          ) : null}
        </>
      }
    />
  );
}