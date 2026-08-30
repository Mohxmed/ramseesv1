import { ValidationFeatureLab } from "@/features/scalping/testing/ValidationFeatureLab";

export const metadata = {
  title: "مختبر بحث الخصائص — RAMSEES",
  description:
    "يدرس تاريخياً القيمة التنبؤية لكل خاصية على حدة (قطار/تحقق/عينة خارجية) عبر آفاق 30/60/120 ثانية قبل أن يستهلكها محرك القرار، دون تعديل أوزانه.",
};

export default function Page() {
  return <ValidationFeatureLab />;
}
