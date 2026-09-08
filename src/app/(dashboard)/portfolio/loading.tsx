import { PageSkeleton } from "@/components/loading/PageSkeleton";

export default function PortfolioRouteLoading() {
  return <PageSkeleton title metrics={4} chart tables />;
}