import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getOrderQueue, updateOrderStatus, type Order, type OrderQueueStats } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { StatusActionModal } from '@/components/StatusActionModal';
import { colors, radius, statusStyle, urgencyStyle } from '@/constants/theme';
import { useNotifications } from '@/notifications/NotificationContext';
import { displayName, formatMoney } from '@/utils/format';

type PendingAction = {
  order: Order;
  targetStatus: string;
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  requireReason?: boolean;
};

function formatItemsSummary(order: Order): string {
  if (order.items.length === 0) return 'No items';
  const totalUnits = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const first = order.items[0].productName;
  const suffix = order.items.length > 1 ? ` +${order.items.length - 1} more` : '';
  return `${first}${suffix} · ${totalUnits} units total`;
}

export function ManufacturingHomeScreen() {
  const { token, logout } = useAuth();
  const router = useRouter();
  const { unreadCount } = useNotifications();

  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<OrderQueueStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const { orders: result, stats: queueStats } = await getOrderQueue(token);
      setOrders(result);
      setStats(queueStats);
    } catch {
      // Keep the last-known list; the next focus retries.
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const askApprove = (order: Order) =>
    setPendingAction({
      order,
      targetStatus: 'approved',
      title: 'Approve order?',
      message: `Approve ${order.ticketNumber} for ${order.clientName}? It'll still need a separate "Start" action (from the Orders tab) before production begins.`,
      confirmLabel: 'Approve',
    });

  const askReject = (order: Order) =>
    setPendingAction({
      order,
      targetStatus: 'rejected',
      title: 'Reject order?',
      message: `Reject ${order.ticketNumber} for ${order.clientName}? The sales rep will be notified with your reason.`,
      confirmLabel: 'Reject',
      danger: true,
      requireReason: true,
    });

  const handleConfirm = async (reason?: string) => {
    if (!token || !pendingAction) return;
    setIsSubmitting(true);
    try {
      await updateOrderStatus(token, pendingAction.order.id, pendingAction.targetStatus, reason);
      setPendingAction(null);
      await load();
    } catch (err) {
      Alert.alert('Failed to update order', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsSubmitting(false);
    }
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
            <Pressable style={styles.iconButton} onPress={() => router.push('/alerts' as never)}>
              <Ionicons name="notifications-outline" size={20} color={colors.text} />
              {unreadCount > 0 && (
                <View style={styles.headerBadge}>
                  <Text style={styles.headerBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </Pressable>
            <Pressable style={styles.iconButton} onPress={logout}>
              <Ionicons name="log-out-outline" size={20} color={colors.text} />
            </Pressable>
          </View>
        </View>

        <Text style={styles.title}>Production Queue</Text>
        <Text style={styles.subtitle}>
          {stats ? `${orders.length} awaiting approval` : ' '}
        </Text>

        <View style={styles.statsRow}>
          <StatTile label="Active" value={stats?.active} color={colors.blue} />
          <StatTile label="Delayed" value={stats?.delayed} color={colors.red} />
          <StatTile label="Dispatch" value={stats?.dispatched} color={colors.navy} />
        </View>

        <Text style={styles.sectionTitle}>Pending Approval</Text>

        {isLoading && <ActivityIndicator style={{ marginTop: 20 }} />}
        {!isLoading && orders.length === 0 && <Text style={styles.emptyText}>Nothing waiting on your review.</Text>}

        {orders.map((order) => {
          const status = statusStyle[order.status] ?? statusStyle.pending;
          const urgency = urgencyStyle[order.urgency] ?? urgencyStyle.low;
          return (
            <View key={order.id} style={styles.card}>
              <Pressable onPress={() => router.push(`/orders/${order.id}` as never)}>
                <View style={styles.cardTopRow}>
                  <View style={styles.ticketRow}>
                    <Text style={styles.ticket}>{order.ticketNumber}</Text>
                    <View style={styles.cityPill}>
                      <Ionicons name="location-outline" size={11} color={colors.textMuted} />
                      <Text style={styles.cityText}>{order.city}</Text>
                    </View>
                  </View>
                  <View style={[styles.badge, { backgroundColor: urgency.bg }]}>
                    <Text style={[styles.badgeText, { color: urgency.fg }]}>{urgency.label}</Text>
                  </View>
                </View>

                <Text style={styles.clientName}>{order.clientName}</Text>
                <Text style={styles.itemsSummary}>{formatItemsSummary(order)}</Text>
                <Text style={styles.value}>
                  {order.currency} {formatMoney(order.value)}
                </Text>

                {order.createdBy && (
                  <View style={styles.salespersonRow}>
                    <Ionicons name="person-circle-outline" size={16} color={colors.textMuted} />
                    <Text style={styles.salespersonText}>{displayName(order.createdBy.email)}</Text>
                  </View>
                )}
              </Pressable>

              <View style={styles.divider} />

              <View style={styles.actionsRow}>
                <View style={[styles.badge, { backgroundColor: status.bg }]}>
                  <Text style={[styles.badgeText, { color: status.fg }]}>{status.label}</Text>
                </View>

                <View style={styles.actionButtonsGroup}>
                  <Pressable style={styles.rejectButton} onPress={() => askReject(order)}>
                    <Text style={styles.rejectButtonText}>Reject</Text>
                  </Pressable>
                  <Pressable style={styles.approveButton} onPress={() => askApprove(order)}>
                    <Text style={styles.approveButtonText}>Approve</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <StatusActionModal
        visible={!!pendingAction}
        title={pendingAction?.title ?? ''}
        message={pendingAction?.message ?? ''}
        confirmLabel={pendingAction?.confirmLabel ?? 'Confirm'}
        danger={pendingAction?.danger}
        requireReason={pendingAction?.requireReason}
        isSubmitting={isSubmitting}
        onCancel={() => setPendingAction(null)}
        onConfirm={handleConfirm}
      />
    </View>
  );
}

function StatTile({ label, value, color }: { label: string; value?: number; color: string }) {
  return (
    <View style={styles.statTile}>
      <Text style={[styles.statValue, { color }]}>{value ?? '—'}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 100 },
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
  headerBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  headerBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '700' },
  title: { fontSize: 22, fontWeight: '700', color: colors.text, marginTop: 20 },
  subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  statTile: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    alignItems: 'center',
  },
  statValue: { fontSize: 18, fontWeight: '700' },
  statLabel: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 24, marginBottom: 12 },
  emptyText: { color: colors.textMuted, marginTop: 12, textAlign: 'center' },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ticketRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ticket: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  cityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.grayMuted,
    borderRadius: 20,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  cityText: { fontSize: 11, color: colors.textMuted },
  badge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  clientName: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 8 },
  itemsSummary: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  value: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 6 },
  salespersonRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  salespersonText: { fontSize: 12, color: colors.textMuted },
  divider: { height: 1, backgroundColor: colors.border, marginTop: 12, marginBottom: 12 },
  actionsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actionButtonsGroup: { flexDirection: 'row', gap: 8 },
  approveButton: {
    backgroundColor: colors.blue,
    borderRadius: radius.sm,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  approveButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  rejectButton: {
    borderWidth: 1,
    borderColor: colors.red,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  rejectButtonText: { color: colors.red, fontWeight: '700', fontSize: 13 },
});
