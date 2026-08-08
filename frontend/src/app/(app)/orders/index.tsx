import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { OrderCard } from '@/components/OrderCard';
import { colors } from '@/constants/theme';
import { useOrders } from '@/hooks/useOrders';

export default function Orders() {
  const { orders, isLoading, error } = useOrders();

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Orders</Text>

        {isLoading && <ActivityIndicator style={{ marginTop: 20 }} />}
        {error && <Text style={styles.error}>{error}</Text>}
        {!isLoading && orders.length === 0 && <Text style={styles.emptyText}>No orders yet.</Text>}

        {orders.map((order) => (
          <OrderCard key={order.id} order={order} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: 16 },
  error: { color: colors.error, marginTop: 12 },
  emptyText: { color: colors.textMuted, marginTop: 12, textAlign: 'center' },
});
