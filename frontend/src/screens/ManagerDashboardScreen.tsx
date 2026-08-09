import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getManagerDashboard, type ManagerDashboard } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { colors, radius } from '@/constants/theme';
import { useNotifications } from '@/notifications/NotificationContext';
import { formatCompactMoney, formatMoney } from '@/utils/format';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const REGION_COLORS: Record<string, string> = {
  Dubai: colors.blue,
  'Abu Dhabi': colors.green,
  Sharjah: colors.purple,
  'Northern Emirates': colors.red,
};

export function ManagerDashboardScreen() {
  const { token, logout } = useAuth();
  const router = useRouter();
  const { unreadCount } = useNotifications();

  const [dashboard, setDashboard] = useState<ManagerDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const data = await getManagerDashboard(token);
      setDashboard(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const maxRegionRevenue = Math.max(1, ...(dashboard?.revenueByRegion.map((r) => r.revenue) ?? [0]));
  const maxWeeklyOrders = Math.max(1, ...(dashboard?.weeklyOrders ?? [0]));

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

        <Text style={styles.eyebrow}>Manager Overview</Text>
        <Text style={styles.title}>Dashboard</Text>

        {isLoading && <ActivityIndicator style={{ marginTop: 24 }} />}
        {error && <Text style={styles.error}>{error}</Text>}

        {dashboard && !isLoading && (
          <>
            <View style={styles.portfolioCard}>
              <Text style={styles.portfolioLabel}>Total Portfolio Value</Text>
              <Text style={styles.portfolioValue}>
                {dashboard.currency} {formatCompactMoney(dashboard.totalValue)}
              </Text>
              <Text style={styles.portfolioSubtitle}>
                {dashboard.totalOrders} orders · {dashboard.regionCount} regions
              </Text>
            </View>

            <View style={styles.statsGrid}>
              <StatTile label="Total Orders" value={dashboard.totalOrders} fg={colors.text} bg={colors.card} bordered />
              <StatTile label="In Progress" value={dashboard.inProgress} fg={colors.blue} bg={colors.blueMuted} />
              <StatTile label="Delayed" value={dashboard.delayed} fg={colors.orange} bg={colors.orangeMuted} />
              <StatTile label="Dispatch Rdy" value={dashboard.dispatchReady} fg={colors.purple} bg={colors.purpleMuted} />
              <StatTile label="Completed" value={dashboard.completed} fg={colors.green} bg={colors.greenMuted} />
              <StatTile label="Rejected" value={dashboard.rejected} fg={colors.red} bg={colors.redMuted} />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Revenue by Region</Text>
              {dashboard.revenueByRegion.map((region) => {
                const dotColor = REGION_COLORS[region.region] ?? colors.gray;
                const pct = Math.max(4, Math.round((region.revenue / maxRegionRevenue) * 100));
                return (
                  <View key={region.region} style={styles.regionRow}>
                    <View style={styles.regionHeaderRow}>
                      <View style={styles.regionLabelRow}>
                        <View style={[styles.regionDot, { backgroundColor: dotColor }]} />
                        <Text style={styles.regionName}>{region.region}</Text>
                        <Text style={styles.regionOrders}>{region.orders} orders</Text>
                      </View>
                      <Text style={styles.regionRevenue}>
                        {dashboard.currency} {formatMoney(region.revenue)}
                      </Text>
                    </View>
                    <View style={styles.regionTrack}>
                      <View style={[styles.regionFill, { width: `${pct}%`, backgroundColor: dotColor }]} />
                    </View>
                  </View>
                );
              })}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Weekly Orders</Text>
              <View style={styles.barChart}>
                {dashboard.weeklyOrders.map((count, i) => (
                  <View key={i} style={styles.barColumn}>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.bar,
                          { height: `${Math.max(4, Math.round((count / maxWeeklyOrders) * 100))}%` },
                        ]}
                      />
                    </View>
                    <Text style={styles.barLabel}>{DAY_LABELS[i]}</Text>
                  </View>
                ))}
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function StatTile({
  label,
  value,
  fg,
  bg,
  bordered = false,
}: {
  label: string;
  value: number;
  fg: string;
  bg: string;
  bordered?: boolean;
}) {
  return (
    <View style={[styles.statTile, { backgroundColor: bg }, bordered && styles.statTileBordered]}>
      <Text style={[styles.statValue, { color: fg }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
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
  eyebrow: { fontSize: 13, color: colors.textMuted, marginTop: 20 },
  title: { fontSize: 22, fontWeight: '700', color: colors.text, marginTop: 2 },
  error: { color: colors.error, marginTop: 12 },
  portfolioCard: {
    backgroundColor: colors.navy,
    borderRadius: radius.lg,
    padding: 20,
    marginTop: 20,
  },
  portfolioLabel: { fontSize: 13, color: colors.navyMuted, fontWeight: '600' },
  portfolioValue: { fontSize: 32, color: '#FFFFFF', fontWeight: '800', marginTop: 6 },
  portfolioSubtitle: { fontSize: 13, color: colors.navyMuted, marginTop: 6 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  statTile: {
    flexBasis: '31%',
    flexGrow: 1,
    borderRadius: radius.md,
    padding: 14,
  },
  statTileBordered: { borderWidth: 1, borderColor: colors.border },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 12, color: colors.textMuted, marginTop: 4, fontWeight: '600' },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginTop: 16,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 14 },
  regionRow: { marginBottom: 14 },
  regionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  regionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  regionDot: { width: 8, height: 8, borderRadius: 4 },
  regionName: { fontSize: 14, fontWeight: '600', color: colors.text },
  regionOrders: { fontSize: 12, color: colors.textMuted },
  regionRevenue: { fontSize: 14, fontWeight: '700', color: colors.text },
  regionTrack: { height: 6, borderRadius: 3, backgroundColor: colors.grayMuted, overflow: 'hidden' },
  regionFill: { height: '100%', borderRadius: 3 },
  barChart: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 130 },
  barColumn: { flex: 1, alignItems: 'center', gap: 8 },
  barTrack: { width: 20, height: 100, justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 4, backgroundColor: colors.amber },
  barLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
});
