import { ProtectedRoute } from "@/components/shared/protected-route";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { MarketDataProvider } from "@/features/bitcoin/store/market-context";
import { CrossMarketProvider } from "@/features/market-influence/store/cross-market-context";
import { NotificationsProvider } from "@/features/notifications/NotificationsProvider";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <MarketDataProvider>
        <CrossMarketProvider>
          <NotificationsProvider>
            <DashboardShell>{children}</DashboardShell>
          </NotificationsProvider>
        </CrossMarketProvider>
      </MarketDataProvider>
    </ProtectedRoute>
  );
}
