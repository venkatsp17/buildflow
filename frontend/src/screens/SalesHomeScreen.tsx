import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { createOrder, type Order } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { NewOrderModal } from '@/components/NewOrderModal';
import { OrderCard } from '@/components/OrderCard';
import { colors, radius } from '@/constants/theme';
import { useOrders } from '@/hooks/useOrders';
import { usePriorityOrders } from '@/hooks/usePriorityOrders';
import { useNotifications } from '@/notifications/NotificationContext';
import { displayName, formatMoney } from '@/utils/format';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning,';
  if (hour < 17) return 'Good afternoon,';
  return 'Good evening,';
}

export function SalesHomeScreen() {
  const { user, logout, token } = useAuth();
  const router = useRouter();
  const { orders, summary, error, reload } = useOrders();
  const { priorityOrders, isLoading: isPriorityLoading, reload: reloadPriority } = usePriorityOrders();
  const { unreadCount } = useNotifications();
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [isNewOrderOpen, setIsNewOrderOpen] = useState(false);

  const handleOrderCreated = async (order: Order) => {
    setIsNewOrderOpen(false);
    await Promise.all([reload(), reloadPriority()]);
    router.push(`/orders/${order.id}` as never);
  };

  const handleDuplicate = async () => {
    if (!token || orders.length === 0) return;
    const source = orders[0];
    setIsDuplicating(true);
    try {
      const { order: newOrder } = await createOrder(token, {
        clientName: source.clientName,
        city: source.city,
        address: source.address,
        priceListName: source.priceListName,
        urgency: source.urgency,
        currency: source.currency,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        items: source.items.map((item) => ({
          productName: item.productName,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
        })),
      });
      await Promise.all([reload(), reloadPriority()]);
      Alert.alert(
        'Order duplicated',
        `${newOrder.ticketNumber} created for ${newOrder.clientName} (${newOrder.currency} ${formatMoney(newOrder.value)}), based on ${source.ticketNumber}.`,
      );
    } catch (err) {
      Alert.alert('Failed to duplicate order', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsDuplicating(false);
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

        <Text style={styles.greeting}>{getGreeting()}</Text>
        <Text style={styles.userName}>{user ? displayName(user.email) : ''}</Text>

        <View style={styles.valueCard}>
          <View>
            <Text style={styles.valueLabel}>My Orders Value</Text>
            <Text style={styles.valueAmount}>
              {summary ? `${summary.currency} ${formatMoney(summary.totalValue)}` : '—'}
            </Text>
          </View>
          <View style={styles.valueIcon}>
            <Ionicons name="cash-outline" size={20} color={colors.navy} />
          </View>
        </View>

        <View style={styles.statsRow}>
          <StatTile label="Total" value={summary?.total} color={colors.text} />
          <StatTile label="Active" value={summary?.active} color={colors.blue} />
          <StatTile label="Pending" value={summary?.pending} color={colors.orange} />
          <StatTile label="Urgent" value={summary?.urgent} color={colors.red} />
        </View>

        <View style={styles.actionsRow}>
          <Pressable style={styles.newOrderButton} onPress={() => setIsNewOrderOpen(true)}>
            <Ionicons name="add" size={18} color="#FFFFFF" />
            <Text style={styles.newOrderButtonText}>New Order</Text>
          </Pressable>
          <Pressable
            style={[styles.duplicateButton, (isDuplicating || orders.length === 0) && styles.buttonDisabled]}
            onPress={handleDuplicate}
            disabled={isDuplicating || orders.length === 0}
          >
            {isDuplicating ? (
              <ActivityIndicator color={colors.navy} />
            ) : (
              <>
                <Ionicons name="copy-outline" size={16} color={colors.navy} />
                <Text style={styles.duplicateButtonText}>Duplicate</Text>
              </>
            )}
          </Pressable>
        </View>

        <View style={styles.ordersHeaderRow}>
          <Text style={styles.sectionTitle}>Priority Orders</Text>
          <Text style={styles.ordersCount}>{priorityOrders.length} orders</Text>
        </View>

        {isPriorityLoading && <ActivityIndicator style={{ marginTop: 20 }} />}
        {error && <Text style={styles.error}>{error}</Text>}
        {!isPriorityLoading && priorityOrders.length === 0 && (
          <Text style={styles.emptyText}>No urgent or high priority orders.</Text>
        )}

        {priorityOrders.map((order) => (
          <OrderCard key={order.id} order={order} />
        ))}
      </ScrollView>

      <Pressable style={styles.fab} onPress={() => setIsNewOrderOpen(true)}>
        <Ionicons name="add" size={26} color="#FFFFFF" />
      </Pressable>

      <NewOrderModal
        visible={isNewOrderOpen}
        onClose={() => setIsNewOrderOpen(false)}
        onCreated={handleOrderCreated}
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
  greeting: { fontSize: 14, color: colors.textMuted, marginTop: 20 },
  userName: { fontSize: 22, fontWeight: '700', color: colors.text, marginTop: 2 },
  valueCard: {
    backgroundColor: colors.navy,
    borderRadius: radius.lg,
    padding: 18,
    marginTop: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  valueLabel: { color: colors.navyMuted, fontSize: 13 },
  valueAmount: { color: '#FFFFFF', fontSize: 24, fontWeight: '700', marginTop: 4 },
  valueIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
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
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  newOrderButton: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    backgroundColor: colors.navy,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newOrderButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 15 },
  duplicateButton: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  duplicateButtonText: { color: colors.navy, fontWeight: '600', fontSize: 15 },
  buttonDisabled: { opacity: 0.5 },
  ordersHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  ordersCount: { fontSize: 13, color: colors.amber, fontWeight: '600' },
  error: { color: colors.error, marginTop: 12 },
  emptyText: { color: colors.textMuted, marginTop: 12, textAlign: 'center' },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
});
