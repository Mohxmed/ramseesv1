import { Sidebar } from "@/components/layout/sidebar";
import { ProtectedRoute } from "@/components/shared/protected-route";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-8">{children}</main>
      </div>
    </ProtectedRoute>
  );
}
