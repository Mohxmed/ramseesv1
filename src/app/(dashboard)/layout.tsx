import { ProtectedRoute } from "@/components/shared/protected-route";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { MarketDataProvider } from "@/features/bitcoin/store/market-context";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <MarketDataProvider>
        <DashboardShell>{children}</DashboardShell>
      </MarketDataProvider>
    </ProtectedRoute>
  );
}
