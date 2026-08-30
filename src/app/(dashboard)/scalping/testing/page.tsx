import { SimulationLab } from "@/features/scalping/testing/SimulationLab";

export const metadata = {
  title: "مختبر المحاكاة واختبار الاستراتيجية — RAMSEES",
  description:
    "محاكاة واختبار محرك المضاربة على بيانات تاريخية BTCUSDT 1m عبر نفس محرك القرار المباشر — بدون تسريب مستقبلي.",
};

export default function Page() {
  return <SimulationLab />;
}
