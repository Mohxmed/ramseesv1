"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { notificationService, type NotificationService } from "./notificationService";
import type { AppNotification, NotificationsApi } from "./types";

const MAX_ITEMS = 50;

const NotificationsContext = createContext<NotificationsApi | null>(null);

/**
 * Owns the notification state and bridges it to whatever NotificationService
 * is provided. Defaults to the mock source so the Header works today; passing
 * a real service (Firebase / WS) later requires no Header changes.
 */
export function NotificationsProvider({
  service = notificationService,
  children,
}: {
  service?: NotificationService;
  children: ReactNode;
}) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const svc = useMemo(() => service, [service]);

  useEffect(() => {
    let mounted = true;
    svc.getInitial().then((boot) => {
      if (!mounted) return;
      setItems(boot);
      setLoading(false);
    });
    const unsubscribe = svc.subscribe((item) => {
      if (!mounted) return;
      setItems((prev) => [item, ...prev].slice(0, MAX_ITEMS));
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [svc]);

  const markRead = useCallback(
    (id: string) => {
      svc.markRead(id);
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, read: true } : i))
      );
    },
    [svc]
  );

  const markAllRead = useCallback(() => {
    svc.markAllRead();
    setItems((prev) => prev.map((i) => ({ ...i, read: true })));
  }, [svc]);

  const value = useMemo<NotificationsApi>(
    () => ({
      items,
      loading,
      unreadCount: items.filter((i) => !i.read).length,
      markRead,
      markAllRead,
    }),
    [items, loading, markRead, markAllRead]
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications(): NotificationsApi {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error(
      "useNotifications must be used within a <NotificationsProvider>."
    );
  }
  return ctx;
}