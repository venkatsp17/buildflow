import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Order } from '@/api/client';
import { colors, radius, statusStyle, urgencyStyle } from '@/constants/theme';
import { formatMoney } from '@/utils/format';

function formatItemsSummary(order: Order): string {
  if (order.items.length === 0) {
    return 'No items';
  }
  const totalUnits = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const first = order.items[0].productName;
  const suffix = order.items.length > 1 ? ` +${order.items.length - 1} more` : '';
  return `${first}${suffix} · ${totalUnits} units total`;
}

function formatValue(order: Order): string {
  return `${order.currency} ${formatMoney(order.value)}`;
}

function formatDate(dueDate: string): string {
  return dueDate.slice(0, 10);
}

export function OrderCard({ order, showPriceList = false }: { order: Order; showPriceList?: boolean }) {
  const router = useRouter();
  const status = statusStyle[order.status] ?? statusStyle.pending;
  const urgency = urgencyStyle[order.urgency] ?? urgencyStyle.low;

  return (
    <Pressable style={styles.card} onPress={() => router.push(`/orders/${order.id}` as never)}>
      <View style={styles.topRow}>
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
      {showPriceList && <Text style={styles.priceList}>{order.priceListName}</Text>}

      <View style={styles.bottomRow}>
        <View style={[styles.badge, { backgroundColor: status.bg }]}>
          <Text style={[styles.badgeText, { color: status.fg }]}>{status.label}</Text>
        </View>
        <View style={styles.valueDateGroup}>
          <Text style={styles.value}>{formatValue(order)}</Text>
          <View style={styles.dateRow}>
            <Ionicons name="calendar-outline" size={12} color={colors.textMuted} />
            <Text style={styles.dateText}>{formatDate(order.dueDate)}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ticketRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ticket: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  cityPill: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: colors.grayMuted, borderRadius: 20, paddingHorizontal: 6, paddingVertical: 2 },
  cityText: { fontSize: 11, color: colors.textMuted },
  badge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  clientName: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 8 },
  itemsSummary: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  priceList: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 12 },
  valueDateGroup: { alignItems: 'flex-end' },
  value: { fontSize: 15, fontWeight: '700', color: colors.text },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  dateText: { fontSize: 12, color: colors.textMuted },
});
