import { PageHeader, Badge } from "@/components/ui/index";
import { TrophyIcon } from "@/components/icons/icons";
import { formatGrowth, formatNumber } from "../utils";

type GoalsHeaderProps = {
  perMoveGrowthPercent: number;
  monthlyGrowthPercent: number;
  strategyName: string | null;
  version: string | null;
  walletLabel?: string | null;
  walletValue?: number | null;
};

export function GoalsHeader({
  perMoveGrowthPercent,
  monthlyGrowthPercent,
  strategyName,
  version,
  walletLabel,
  walletValue,
}: GoalsHeaderProps) {
  return (
    <PageHeader
      eyebrow="Goals"
      icon={<TrophyIcon className="h-5 w-5 text-muted" />}
      title="الأهداف"
      description="شبكة نمو لشهر كامل: 30 كارد (كارد لكل يوم)، الهدف في كل كارد هو نسبة زيادة المحفظة المشتقة من أرقام استراتيجيتك الحالية — مخاطرة الصفقة × RR — وتتضاعف تراكميًا حتى هدف الشهر. الأهداف تُرسى وتتحدث تلقائيًا بحسب حجم محفظتك الحالي."
      actions={
        <>
          <Badge tone="up">30 كارد</Badge>
          <Badge tone="good">{formatGrowth(perMoveGrowthPercent)} للكارد</Badge>
          <Badge tone="good">{formatGrowth(monthlyGrowthPercent)} للشهر</Badge>
          {walletLabel && walletValue != null && walletValue > 0 && (
            <Badge tone="neutral" className="hidden md:inline-flex">
              المرساة: {walletLabel} ·{" "}
              <span dir="ltr">${formatNumber(walletValue)}</span>
            </Badge>
          )}
          {strategyName && version ? (
            <Badge tone="neutral" className="hidden lg:inline-flex">
              المصدر: {strategyName} · {version}
            </Badge>
          ) : null}
        </>
      }
    />
  );
}