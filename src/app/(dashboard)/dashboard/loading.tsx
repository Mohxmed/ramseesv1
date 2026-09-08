import { PageSkeleton } from "@/components/loading/PageSkeleton";

export default function DashboardRouteLoading() {
  return <PageSkeleton title metrics={4} chart tables />;
}