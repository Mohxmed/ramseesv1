import { ValidationLab } from "@/features/scalping/testing/ValidationLab";

export const metadata = {
  title: "مختبر التحقق من قرارات المحرك — RAMSEES",
  description:
    "يتحقق من دقة تنبؤ محرك القرار باتجاه BTC على بيانات تاريخية 1m عبر آفاق 30/60/120 ثانية — بدون محفظة أو أرباح، وبدون تسريب مستقبلي.",
};

export default function Page() {
  return <ValidationLab />;
}
