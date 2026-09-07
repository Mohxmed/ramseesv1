import type { AppNotification } from "./types";

/**
 * Notification source contract.
 *
 * The Header depends on this interface, never on a concrete implementation.
 * A real backend (Firebase collection, WebSocket push, SSE) only needs to
 * implement these four members and be passed to <NotificationsProvider>.
 */
export interface NotificationService {
  /** Bootstrap snapshot of existing notifications (async-ready for a backend). */
  getInitial(): Promise<AppNotification[]>;
  /** Live push channel; returns an unsubscribe fn. */
  subscribe(listener: (item: AppNotification) => void): () => void;
  markRead(id: string): void;
  markAllRead(): void;
}

/* ------------------------------------------------------------------ */
/* Mock / development source                                           */
/* ------------------------------------------------------------------ */

const MINUTE = 60_000;

function nowOffset(minutesAgo: number): number {
  return Date.now() - minutesAgo * MINUTE;
}

/** Curated seed matching the app's own kinds of events — no invented auth. */
export function seedNotifications(): AppNotification[] {
  return [
    {
      id: "n-sys-feed",
      type: "system",
      severity: "info",
      title: "تم تفعيل موجز البيانات المباشر",
      message: "الاتصال ببيانات السوق اللحظية (Binance WS) يعمل الآن.",
      timestamp: nowOffset(4),
      read: false,
      metadata: { source: "spot-ws" },
    },
    {
      id: "n-sig-scalp",
      type: "signal",
      severity: "warn",
      title: "قرب تلامس مستوي مقاومة",
      message: "BTC يقترب من منطقة مقاومة رئيسية — راقب الاستجابة قبل أي قرار.",
      timestamp: nowOffset(26),
      read: false,
      metadata: { pair: "BTCUSDT" },
    },
    {
      id: "n-market-oi",
      type: "market",
      severity: "success",
      title: "تحديث حالة السوق",
      message: "اكتمل تحليل بيانات العقود الآجلة وفتح الاهتمام.",
      timestamp: nowOffset(95),
      read: false,
      metadata: { source: "futures" },
    },
    {
      id: "n-sys-ready",
      type: "system",
      severity: "success",
      title: "النظام جاهز",
      message: "تم تحميل بيانات البيتكوين وإتاحة لوحة التحكم.",
      timestamp: nowOffset(210),
      read: true,
      metadata: { source: "rest" },
    },
  ];
}

/** Development implementation backed by in-memory data (no network). */
export class MockNotificationService implements NotificationService {
  private items: AppNotification[];
  private listeners = new Set<(item: AppNotification) => void>();
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(items: AppNotification[] = seedNotifications()) {
    this.items = items;
  }

  async getInitial(): Promise<AppNotification[]> {
    return [...this.items].sort((a, b) => b.timestamp - a.timestamp);
  }

  subscribe(listener: (item: AppNotification) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  markRead(id: string): void {
    const item = this.items.find((i) => i.id === id);
    if (item) item.read = true;
  }

  markAllRead(): void {
    for (const item of this.items) item.read = true;
  }

  /**
   * Dev-only: push a turnover of simulated events on a cadence so the popover
   * and badge are visibly live in development. Disabled until called.
   */
  startSimulation(intervalMs = 60_000): void {
    if (this.timer) return;
    let seq = 1;
    const templates: Array<
      Pick<AppNotification, "type" | "severity" | "title" | "message">
    > = [
      {
        type: "system",
        severity: "info",
        title: "فحص بيانات خلفي",
        message: "تم تحديث البيانات التاريخية بأمان.",
      },
      {
        type: "market",
        severity: "info",
        title: "تحرك جديد في السيولة",
        message: "رصد تغيّر في توزيع حجم التداول.",
      },
    ];
    this.timer = setInterval(() => {
      const t = templates[seq % templates.length];
      const item: AppNotification = {
        ...t,
        id: `n-sim-${seq++}`,
        timestamp: Date.now(),
        read: false,
        metadata: { simulated: true },
      };
      this.items.push(item);
      for (const l of this.listeners) l(item);
    }, intervalMs);
  }

  stopSimulation(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

/**
 * The default source the app is wired to today.
 *
 * Swap this single value (or pass another service to <NotificationsProvider>)
 * the day a real backend arrives — the Header code does not change.
 */
export const notificationService: NotificationService =
  new MockNotificationService();