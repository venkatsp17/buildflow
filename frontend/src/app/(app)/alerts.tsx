import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { Notification, NotificationType } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { colors, radius } from '@/constants/theme';
import { useNotifications } from '@/notifications/NotificationContext';
import { formatRelativeTime } from '@/utils/format';

const TYPE_META: Record<NotificationType, { icon: keyof typeof Ionicons.glyphMap; bg: string; fg: string }> = {
  order_approved: { icon: 'checkmark-circle-outline', bg: colors.greenMuted, fg: colors.green },
  order_rejected: { icon: 'close-circle-outline', bg: colors.redMuted, fg: colors.red },
  dispatch_ready: { icon: 'cube-outline', bg: colors.blueMuted, fg: colors.blue },
  order_delayed: { icon: 'alert-circle-outline', bg: colors.redMuted, fg: colors.red },
};

export default function Alerts() {
  const { logout } = useAuth();
  const router = useRouter();
  const { notifications, unreadCount, isLoading, reload, markRead, dismiss, clearAll } = useNotifications();

  // A single fetch each time this screen gains focus — not a timer — so it's
  // fresh even if a push was missed (e.g. permission denied, backgrounded).
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const unread = notifications.filter((n) => !n.read);
  const read = notifications.filter((n) => n.read);

  const handlePress = (notification: Notification) => {
    if (!notification.read) markRead(notification.id);
    router.push(`/orders/${notification.orderId}` as never);
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <View style={styles.brandRow}>
            <View style={styles.logo}>
              <Ionicons name="cube-outline" size={18} color={colors.navy} />
            </View>
            <Text style={styles.brandName}>BuildFlow</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable style={styles.iconButton} onPress={logout}>
              <Ionicons name="log-out-outline" size={20} color={colors.text} />
            </Pressable>
          </View>
        </View>

        <View style={styles.titleRow}>
          <View>
            <Text style={styles.title}>Notifications</Text>
            <Text style={styles.subtitle}>{unreadCount} unread</Text>
          </View>
          {notifications.length > 0 && (
            <Pressable onPress={clearAll}>
              <Text style={styles.clearAll}>Clear all</Text>
            </Pressable>
          )}
        </View>

        {isLoading && notifications.length === 0 && <ActivityIndicator style={{ marginTop: 20 }} />}
        {!isLoading && notifications.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="notifications-outline" size={40} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No notifications yet</Text>
            <Text style={styles.emptySubtitle}>You'll see order status updates here.</Text>
          </View>
        )}

        {unread.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>NEW</Text>
            {unread.map((notification) => (
              <NotificationRow
                key={notification.id}
                notification={notification}
                onPress={() => handlePress(notification)}
                onDismiss={() => dismiss(notification.id)}
              />
            ))}
          </>
        )}

        {read.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>EARLIER</Text>
            {read.map((notification) => (
              <NotificationRow
                key={notification.id}
                notification={notification}
                onPress={() => handlePress(notification)}
                onDismiss={() => dismiss(notification.id)}
              />
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function NotificationRow({
  notification,
  onPress,
  onDismiss,
}: {
  notification: Notification;
  onPress: () => void;
  onDismiss: () => void;
}) {
  const meta = TYPE_META[notification.type];
  return (
    <Pressable style={[styles.card, !notification.read && styles.cardUnread]} onPress={onPress}>
      <View style={[styles.cardIcon, { backgroundColor: meta.bg }]}>
        <Ionicons name={meta.icon} size={18} color={meta.fg} />
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle}>{notification.title}</Text>
        <Text style={styles.cardMessage}>{notification.message}</Text>
        <Text style={styles.cardTime}>{formatRelativeTime(notification.createdAt)}</Text>
      </View>
      {!notification.read && <View style={styles.unreadDot} />}
      <Pressable style={styles.dismissButton} onPress={onDismiss} hitSlop={8}>
        <Ionicons name="close" size={16} color={colors.textMuted} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  logo: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: { fontSize: 16, fontWeight: '700', color: colors.text },
  headerActions: { flexDirection: 'row', gap: 8 },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 20 },
  title: { fontSize: 22, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  clearAll: { fontSize: 13, color: colors.blue, fontWeight: '600' },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5, marginTop: 20, marginBottom: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 10,
  },
  cardUnread: { backgroundColor: colors.amberMuted, borderColor: colors.amber },
  cardIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  cardMessage: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  cardTime: { fontSize: 11, color: colors.textMuted, marginTop: 6 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.orange, marginTop: 4 },
  dismissButton: { padding: 2 },
  emptyState: { alignItems: 'center', gap: 6, marginTop: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  emptySubtitle: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
});
