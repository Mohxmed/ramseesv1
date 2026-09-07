import { ProtectedRoute } from "@/components/shared/protected-route";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { MarketDataProvider } from "@/features/bitcoin/store/market-context";
import { NotificationsProvider } from "@/features/notifications/NotificationsProvider";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <MarketDataProvider>
        <NotificationsProvider>
          <DashboardShell>{children}</DashboardShell>
        </NotificationsProvider>
      </MarketDataProvider>
    </ProtectedRoute>
  );
}
