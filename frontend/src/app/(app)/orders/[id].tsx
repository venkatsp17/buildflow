import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { createOrder, getOrder, type Order } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { OrderProgressStepper } from '@/components/OrderProgressStepper';
import { colors, radius, statusStyle, urgencyStyle } from '@/constants/theme';
import { displayName, formatMoney } from '@/utils/format';

function formatDate(dueDate: string): string {
  return dueDate.slice(0, 10);
}

export default function OrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { token } = useAuth();

  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDuplicating, setIsDuplicating] = useState(false);

  const load = useCallback(async () => {
    if (!token || !id) return;
    setIsLoading(true);
    setError(null);
    try {
      const { order: fetched } = await getOrder(token, id);
      setOrder(fetched);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load order');
    } finally {
      setIsLoading(false);
    }
  }, [token, id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDuplicate = async () => {
    if (!token || !order) return;
    setIsDuplicating(true);
    try {
      const { order: newOrder } = await createOrder(token, {
        clientName: order.clientName,
        city: order.city,
        address: order.address,
        priceListName: order.priceListName,
        urgency: order.urgency,
        currency: order.currency,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        items: order.items.map((item) => ({
          productName: item.productName,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
        })),
      });
      Alert.alert(
        'Order duplicated',
        `${newOrder.ticketNumber} created for ${newOrder.clientName} (${newOrder.currency} ${formatMoney(newOrder.value)}), based on ${order.ticketNumber}.`,
      );
      router.push(`/orders/${newOrder.id}` as never);
    } catch (err) {
      Alert.alert('Failed to duplicate order', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsDuplicating(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error || !order) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error ?? 'Order not found'}</Text>
      </View>
    );
  }

  const status = statusStyle[order.status] ?? statusStyle.pending;
  const urgency = urgencyStyle[order.urgency] ?? urgencyStyle.low;
  const totalUnits = order.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.header}>
        <Pressable style={styles.backRow} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={18} color={colors.amber} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <View style={styles.headerTopRow}>
          <View style={styles.ticketRow}>
            <Text style={styles.ticket}>{order.ticketNumber}</Text>
            <View style={styles.pill}>
              <Ionicons name="location-outline" size={11} color={colors.navyMuted} />
              <Text style={styles.pillText}>{order.city}</Text>
            </View>
          </View>
          <View style={[styles.badge, { backgroundColor: urgency.bg }]}>
            <Text style={[styles.badgeText, { color: urgency.fg }]}>{urgency.label}</Text>
          </View>
        </View>

        <Text style={styles.clientName}>{order.clientName}</Text>
        <Text style={styles.itemsSubtitle}>
          {order.items.length} products · {totalUnits} units
        </Text>

        <View style={styles.headerBottomRow}>
          <View style={styles.pill}>
            <Ionicons name="pricetag-outline" size={12} color={colors.navyMuted} />
            <Text style={styles.pillText}>
              {order.currency} {formatMoney(order.value)} · {order.priceListName}
            </Text>
          </View>
        </View>

        <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
          <Ionicons name="time-outline" size={13} color={status.fg} />
          <Text style={[styles.statusPillText, { color: status.fg }]}>{status.label}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>PROGRESS</Text>
        <OrderProgressStepper status={order.status} />
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardLabel}>PRODUCTS</Text>
          <View style={styles.itemsCountPill}>
            <Text style={styles.itemsCountText}>{order.items.length} items</Text>
          </View>
        </View>

        {order.items.map((item) => (
          <View key={item.id} style={styles.productRow}>
            <View style={styles.productInfo}>
              <Text style={styles.productName}>{item.productName}</Text>
              <Text style={styles.productMeta}>
                {item.quantity} {item.unit} @ {order.currency} {formatMoney(item.unitPrice)}/unit
              </Text>
              {!!item.description && <Text style={styles.productDescription}>{item.description}</Text>}
            </View>
            <Text style={styles.productTotal}>
              {order.currency} {formatMoney(item.quantity * item.unitPrice)}
            </Text>
          </View>
        ))}

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total · {totalUnits} units</Text>
          <Text style={styles.totalValue}>
            {order.currency} {formatMoney(order.value)}
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>ORDER DETAILS</Text>

        <DetailRow icon="pricetag-outline" label="TICKET ID" value={order.ticketNumber} />
        <DetailRow icon="person-outline" label="CUSTOMER" value={order.clientName} />
        <DetailRow icon="location-outline" label="REGION" value={order.city} />
        <DetailRow icon="pricetag-outline" label="PRICE LIST" value={order.priceListName} />
        <DetailRow icon="calendar-outline" label="DUE DATE" value={formatDate(order.dueDate)} />
        {!!order.address && <DetailRow icon="location-outline" label="ADDRESS" value={order.address} />}
        <DetailRow
          icon="person-outline"
          label="SALESPERSON"
          value={order.createdBy ? displayName(order.createdBy.email) : '—'}
        />
        <DetailRow
          icon="construct-outline"
          label="ASSIGNEE"
          value={order.assignee ? displayName(order.assignee.email) : 'Unassigned'}
          last
        />
      </View>

      <Pressable
        style={[styles.duplicateButton, isDuplicating && styles.buttonDisabled]}
        onPress={handleDuplicate}
        disabled={isDuplicating}
      >
        {isDuplicating ? (
          <ActivityIndicator color={colors.navy} />
        ) : (
          <>
            <Ionicons name="copy-outline" size={16} color={colors.navy} />
            <Text style={styles.duplicateButtonText}>Duplicate Order</Text>
          </>
        )}
      </Pressable>
    </ScrollView>
  );
}

function DetailRow({
  icon,
  label,
  value,
  last = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.detailRow, !last && styles.detailRowBorder]}>
      <Ionicons name={icon} size={16} color={colors.textMuted} style={styles.detailIcon} />
      <View>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  error: { color: colors.error },
  header: {
    backgroundColor: colors.navy,
    padding: 20,
    paddingTop: 50,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
  },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  backText: { color: colors.amber, fontSize: 14, fontWeight: '600' },
  headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ticketRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ticket: { color: colors.amber, fontSize: 13, fontWeight: '700' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pillText: { color: colors.navyMuted, fontSize: 11, fontWeight: '600' },
  badge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  clientName: { color: '#FFFFFF', fontSize: 22, fontWeight: '700', marginTop: 12 },
  itemsSubtitle: { color: colors.navyMuted, fontSize: 13, marginTop: 2 },
  headerBottomRow: { flexDirection: 'row', marginTop: 14 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 10,
  },
  statusPillText: { fontSize: 12, fontWeight: '600' },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 16,
    marginHorizontal: 20,
    marginTop: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemsCountPill: { backgroundColor: colors.grayMuted, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  itemsCountText: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
  productRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 16,
  },
  productInfo: { flex: 1, paddingRight: 12 },
  productName: { fontSize: 15, fontWeight: '700', color: colors.text },
  productMeta: { fontSize: 12, color: colors.blue, marginTop: 2 },
  productDescription: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  productTotal: { fontSize: 14, fontWeight: '700', color: colors.text },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  totalLabel: { fontSize: 13, color: colors.textMuted },
  totalValue: { fontSize: 15, fontWeight: '700', color: colors.text },
  detailRow: { flexDirection: 'row', gap: 12, paddingVertical: 12 },
  detailRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  detailIcon: { marginTop: 2 },
  detailLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '600', letterSpacing: 0.5 },
  detailValue: { fontSize: 14, color: colors.text, marginTop: 2, fontWeight: '600' },
  duplicateButton: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: 14,
    marginHorizontal: 20,
    marginTop: 16,
  },
  duplicateButtonText: { color: colors.navy, fontWeight: '600', fontSize: 15 },
  buttonDisabled: { opacity: 0.5 },
});
