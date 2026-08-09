import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import {
  clearAllNotifications,
  deleteNotification,
  listNotifications,
  markNotificationRead,
  registerPushToken,
  type Notification,
} from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { registerForPushNotificationsAsync } from '@/notifications/pushRegistration';

type NotificationContextValue = {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  reload: () => Promise<void>;
  markRead: (id: number) => Promise<void>;
  dismiss: (id: number) => Promise<void>;
  clearAll: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

// No polling: notifications reach the app as real device push notifications
// (delivered by Expo's push service, sent by the backend the instant a
// notification is created). This context registers the device's push token
// once, refetches the list on mount/focus, and refetches again whenever a
// push actually arrives — there's no timer anywhere in this file. Lives
// above the tab navigator so the bell badge and the Alerts screen share one
// registration instead of each screen doing its own.
export function NotificationProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const tokenRef = useRef(token);
  tokenRef.current = token;

  const reload = useCallback(async () => {
    const currentToken = tokenRef.current;
    if (!currentToken) return;
    try {
      const { notifications: result, unreadCount: count } = await listNotifications(currentToken);
      setNotifications(result);
      setUnreadCount(count);
    } catch {
      // Silently keep the last-known list — the next push or screen focus retries.
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch once when a session starts (and once more whenever it ends, to
  // clear out the previous user's notifications) — not on a timer.
  useEffect(() => {
    if (!token) {
      setNotifications([]);
      setUnreadCount(0);
      setIsLoading(false);
      return;
    }
    reload();
  }, [token, reload]);

  // Register this device for push once per session, and tell the backend
  // about it. On native this can silently no-op (permission denied, not a
  // real device, or no EAS project linked yet) — the in-app list from
  // reload() above still works regardless.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    registerForPushNotificationsAsync().then((pushToken) => {
      if (cancelled || !pushToken) return;
      registerPushToken(token, pushToken).catch(() => {});
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  // A push arriving is the actual "push" signal — refetch so the badge/list
  // reflect it immediately, whether the app is foregrounded or the user just
  // tapped the push to open it.
  useEffect(() => {
    const receivedSub = Notifications.addNotificationReceivedListener(() => {
      reload();
    });
    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      reload();
      const orderId = response.notification.request.content.data?.orderId;
      if (orderId) {
        router.push(`/orders/${orderId}` as never);
      } else {
        router.push('/alerts' as never);
      }
    });
    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, [reload]);

  const markRead = useCallback(async (id: number) => {
    const currentToken = tokenRef.current;
    if (!currentToken) return;
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
    try {
      await markNotificationRead(currentToken, id);
    } catch {
      // Best-effort — a subsequent reload reconciles state either way.
    }
  }, []);

  const dismiss = useCallback(async (id: number) => {
    const currentToken = tokenRef.current;
    if (!currentToken) return;
    const wasUnread = notifications.find((n) => n.id === id)?.read === false;
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (wasUnread) setUnreadCount((prev) => Math.max(0, prev - 1));
    try {
      await deleteNotification(currentToken, id);
    } catch {
      // Best-effort — a subsequent reload reconciles state either way.
    }
  }, [notifications]);

  const clearAll = useCallback(async () => {
    const currentToken = tokenRef.current;
    if (!currentToken) return;
    setNotifications([]);
    setUnreadCount(0);
    try {
      await clearAllNotifications(currentToken);
    } catch {
      // Best-effort — a subsequent reload reconciles state either way.
    }
  }, []);

  const value = useMemo(
    () => ({ notifications, unreadCount, isLoading, reload, markRead, dismiss, clearAll }),
    [notifications, unreadCount, isLoading, reload, markRead, dismiss, clearAll],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return ctx;
}
