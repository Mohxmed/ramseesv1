/**
 * Notification domain types.
 *
 * The Header's <NotificationCenter> consumes ONLY this shape through
 * `useNotifications()`. Nothing about the source (mock vs Firebase vs
 * WebSocket) leaks into components — swap the service and the UI stays as-is.
 */

export type NotificationSeverity = "info" | "success" | "warn" | "error";

export type NotificationType =
  | "signal"
  | "system"
  | "market"
  | "trade"
  | "account";

export type AppNotification = {
  id: string;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  message: string;
  /** Epoch ms. */
  timestamp: number;
  read: boolean;
  /** Optional deep-link consumed by the notification center. */
  actionUrl?: string;
  /** Free-form payload kept opaque to the UI (source-specific extras). */
  metadata?: Record<string, unknown>;
};

/** The full API the Header's notification center needs. */
export type NotificationsApi = {
  items: AppNotification[];
  loading: boolean;
  unreadCount: number;
  markRead: (id: string) => void;
  markAllRead: () => void;
};