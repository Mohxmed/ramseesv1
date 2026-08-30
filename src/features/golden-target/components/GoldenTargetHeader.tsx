import { PageHeader, Badge } from "@/components/ui/index";

export function GoldenTargetHeader() {
  return (
    <PageHeader
      eyebrow="Golden Target"
      title="الهدف الذهبي"
      description="استراتيجية نمو تراكمي: في كل حركة تستهدف مضاعفة قيمة رأس المال بنسبة 100%، بدءًا من قيمة 2 وصولًا إلى 1,048,576 بعد 20 حركة."
      actions={
        <>
          <Badge tone="up">20 حركة</Badge>
          <Badge tone="good">نمو 100%</Badge>
        </>
      }
    />
  );
}