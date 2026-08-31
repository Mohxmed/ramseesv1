import { MultiAssetPage } from "@/features/multi-asset/MultiAssetPage";

export const metadata = {
  title: "ارتباط التأخر متعدد الأصول — RAMSEES",
  description: "قياس ارتباط وبيتا وتأخر السعر لكل عملة رقمية مقابل BTC من بيانات السوق الحية.",
};

export default function Page() {
  return <MultiAssetPage />;
}