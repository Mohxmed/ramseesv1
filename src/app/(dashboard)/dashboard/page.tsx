"use client";

import { useAuth } from "@/features/auth/hooks/useAuth";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { Card } from "@/components/ui/card";

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
        Dashboard
      </h1>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        System overview and quick access to features.
      </p>

      <div className="mt-8 grid gap-6">
        <Card title="Account">
          <div className="space-y-2">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Welcome, {user?.email ?? user?.displayName ?? "User"}
            </p>
            {user?.displayName && (
              <p className="text-sm text-zinc-500 dark:text-zinc-500">
                {user.email}
              </p>
            )}
          </div>
          <div className="mt-4">
            <LogoutButton />
          </div>
        </Card>
      </div>
    </div>
  );
}
