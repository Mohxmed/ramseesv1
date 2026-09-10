import { PageHeader, Badge } from "@/components/ui/index";
import { TrophyIcon } from "@/components/icons/icons";
import { formatGrowth, formatNumber } from "../utils";

type GoalsHeaderProps = {
  perMoveGrowthPercent: number;
  monthlyGrowthPercent: number;
  walletLabel?: string | null;
  walletValue?: number | null;
};

export function GoalsHeader({
  perMoveGrowthPercent,
  monthlyGrowthPercent,
  walletLabel,
  walletValue,
}: GoalsHeaderProps) {
  return (
    <PageHeader
      eyebrow="Goals"
      icon={<TrophyIcon className="h-5 w-5 text-muted" />}
      title="الأهداف"
      description="شبكة 30 دورة لشهر كامل — كل دورة هي 10% نمو على الرصيد السابق (تراكمي حتى هدف الشهر). السلم يُرسى تلقائيًا على رصيد محفظتك الحالي، وكل دورة تُفتتح تلقائيًا بمجرد نمو المحفظة إليها."
      actions={
        <>
          <Badge tone="up">30 دورة</Badge>
          <Badge tone="good">{formatGrowth(perMoveGrowthPercent)} للدورة</Badge>
          <Badge tone="good">{formatGrowth(monthlyGrowthPercent)} للشهر</Badge>
          {walletLabel && walletValue != null && walletValue > 0 && (
            <Badge tone="neutral" className="hidden md:inline-flex">
              المرساة: {walletLabel} ·{" "}
              <span dir="ltr">${formatNumber(walletValue)}</span>
            </Badge>
          )}
        </>
      }
    />
  );
}