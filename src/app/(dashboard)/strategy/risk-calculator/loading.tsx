import { PageSkeleton } from "@/components/loading/PageSkeleton";

export default function RiskCalculatorLoading() {
  return <PageSkeleton chart metrics={4} />;
}