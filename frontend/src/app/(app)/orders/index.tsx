import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { searchCustomers, updateOrderStatus, type Customer, type Order } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { DatePickerInput } from '@/components/DatePickerInput';
import { NewOrderModal } from '@/components/NewOrderModal';
import { OrderCard } from '@/components/OrderCard';
import { StatusActionModal } from '@/components/StatusActionModal';
import { approvedSubStatusFilters, colors, radius, sortOptions, superStatusFilters } from '@/constants/theme';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { defaultDateFrom, useOrdersList } from '@/hooks/useOrdersList';
import { useNotifications } from '@/notifications/NotificationContext';

const APPROVED_SUB_KEYS = new Set(approvedSubStatusFilters.map((f) => f.key));

// Pending/Approved/Rejected are the super states shown as the primary pill
// row; Approved's own sub-states (in_progress/dispatched/delayed/delivered)
// render as a second row underneath only while Approved (or one of its
// sub-states) is selected, so the hierarchy reads visually instead of
// dumping 8 flat options into one row.
function superStatusFor(status: string): string {
  if (status === 'pending' || status === 'rejected') return status;
  if (status === 'approved' || APPROVED_SUB_KEYS.has(status)) return 'approved';
  return 'all';
}

type PendingAction = {
  order: Order;
  targetStatus: string;
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  requireReason?: boolean;
};

export default function Orders() {
  const { token, user, logout } = useAuth();
  const router = useRouter();
  const {
    orders,
    total,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    search,
    setSearch,
    status,
    setStatus,
    customer,
    setCustomer,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    sort,
    setSort,
    loadMore,
    reload,
  } = useOrdersList();
  const { unreadCount } = useNotifications();
  const [isNewOrderOpen, setIsNewOrderOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const canApprove = user?.role === 'manufacturing' || user?.role === 'manager';

  const [customerQuery, setCustomerQuery] = useState('');
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const debouncedCustomerQuery = useDebouncedValue(customerQuery, 300);

  useEffect(() => {
    if (!token || !showCustomerSuggestions) {
      setCustomerResults([]);
      return;
    }
    let cancelled = false;
    searchCustomers(token, debouncedCustomerQuery.trim())
      .then(({ customers }) => {
        if (!cancelled) setCustomerResults(customers);
      })
      .catch(() => {
        if (!cancelled) setCustomerResults([]);
      });
    return () => {
      cancelled = true;
    };
  }, [token, debouncedCustomerQuery, showCustomerSuggestions]);

  const hasActiveAdvancedFilters =
    !!customer || dateFrom !== defaultDateFrom() || !!dateTo || sort !== 'newest';

  const handleOrderCreated = async (order: Order) => {
    setIsNewOrderOpen(false);
    await reload();
    void order;
  };

  const askApprove = (order: Order) =>
    setPendingAction({
      order,
      targetStatus: 'approved',
      title: 'Approve order?',
      message: `Approve ${order.ticketNumber} for ${order.clientName}? It'll still need a separate "Start" action (from the order detail page) before production begins.`,
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

  const askDispatchReady = (order: Order) =>
    setPendingAction({
      order,
      targetStatus: 'dispatched',
      title: 'Mark dispatch ready?',
      message: `Mark ${order.ticketNumber} for ${order.clientName} as ready for dispatch?`,
      confirmLabel: 'Mark Dispatch Ready',
    });

  const askMarkDelivered = (order: Order) =>
    setPendingAction({
      order,
      targetStatus: 'delivered',
      title: 'Mark delivered?',
      message: `Mark ${order.ticketNumber} for ${order.clientName} as delivered? This completes the order.`,
      confirmLabel: 'Mark Delivered',
    });

  // Single next-stage action per status — pending gets Approve/Reject
  // instead, handled separately below.
  function primaryActionFor(order: Order): { label: string; onPress: () => void } | undefined {
    if (!canApprove) return undefined;
    if (order.status === 'in_progress') return { label: 'Mark Dispatch Ready', onPress: () => askDispatchReady(order) };
    if (order.status === 'dispatched') return { label: 'Mark Delivered', onPress: () => askMarkDelivered(order) };
    return undefined;
  }

  const handleConfirmAction = async (reason?: string) => {
    if (!token || !pendingAction) return;
    setIsSubmittingAction(true);
    try {
      await updateOrderStatus(token, pendingAction.order.id, pendingAction.targetStatus, reason);
      setPendingAction(null);
      await reload();
    } catch (err) {
      Alert.alert('Failed to update order', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const clearAdvancedFilters = () => {
    setCustomer(null);
    setCustomerQuery('');
    setDateFrom(defaultDateFrom());
    setDateTo('');
    setSort('newest');
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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

        <Text style={styles.title}>My Orders</Text>
        <Text style={styles.count}>
          {isLoading ? 'Loading…' : `Showing ${orders.length} of ${total} orders`}
        </Text>

        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={18} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search orders, customers, products..."
              placeholderTextColor={colors.textMuted}
              value={search}
              onChangeText={setSearch}
            />
          </View>
          <Pressable
            style={[styles.filtersButton, (showFilters || hasActiveAdvancedFilters) && styles.filtersButtonActive]}
            onPress={() => setShowFilters((v) => !v)}
          >
            <Ionicons
              name="options-outline"
              size={18}
              color={showFilters || hasActiveAdvancedFilters ? '#FFFFFF' : colors.text}
            />
            {hasActiveAdvancedFilters && !showFilters && <View style={styles.filtersDot} />}
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillsRow} contentContainerStyle={styles.pillsContent}>
          {superStatusFilters.map((filter) => {
            const active = superStatusFor(status) === filter.key;
            return (
              <Pressable
                key={filter.key}
                style={[styles.pill, active && styles.pillActive]}
                onPress={() => setStatus(filter.key)}
              >
                <Text style={[styles.pillText, active && styles.pillTextActive]}>{filter.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {superStatusFor(status) === 'approved' && (
          <View style={styles.subPillsWrap}>
            <View style={styles.subPillsConnector} />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.subPillsRow}
              contentContainerStyle={styles.pillsContent}
            >
              {approvedSubStatusFilters.map((filter) => {
                const active = status === filter.key;
                return (
                  <Pressable
                    key={filter.key}
                    style={[styles.subPill, active && styles.subPillActive]}
                    onPress={() => setStatus(active ? 'approved' : filter.key)}
                  >
                    <Text style={[styles.subPillText, active && styles.subPillTextActive]}>{filter.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

        {showFilters && (
          <View style={styles.filtersPanel}>
            <View style={styles.filtersLabelRow}>
              <Text style={styles.filtersLabel}>DUE DATE RANGE</Text>
              {!!(dateFrom || dateTo) && (
                <Pressable
                  onPress={() => {
                    setDateFrom('');
                    setDateTo('');
                  }}
                >
                  <Text style={styles.allTimeText}>View all-time history</Text>
                </Pressable>
              )}
            </View>
            <Text style={styles.filtersHint}>Defaults to the last month — widen or clear to reach older orders.</Text>
            <View style={styles.dateRow}>
              <View style={styles.dateField}>
                <DatePickerInput
                  value={dateFrom}
                  onChange={setDateFrom}
                  placeholder="From"
                  minimumDate={null}
                  maximumDate={new Date()}
                />
              </View>
              <View style={styles.dateField}>
                <DatePickerInput value={dateTo} onChange={setDateTo} placeholder="To" minimumDate={null} />
              </View>
            </View>

            <Text style={styles.filtersLabel}>CUSTOMER</Text>
            {customer ? (
              <Pressable style={styles.customerChip} onPress={() => setCustomer(null)}>
                <Text style={styles.customerChipText}>{customer.name}</Text>
                <Ionicons name="close" size={14} color={colors.navy} />
              </Pressable>
            ) : (
              <View style={styles.inputWrap}>
                <Ionicons name="person-outline" size={16} color={colors.textMuted} />
                <TextInput
                  style={styles.plainSearchInput}
                  placeholder="Filter by customer..."
                  value={customerQuery}
                  onChangeText={(text) => {
                    setCustomerQuery(text);
                    setShowCustomerSuggestions(true);
                  }}
                  onFocus={() => setShowCustomerSuggestions(true)}
                  onBlur={() => {
                    // Delayed so a tap on a suggestion below still registers
                    // before the list unmounts — otherwise the blur (which
                    // fires first) would hide it out from under the tap.
                    setTimeout(() => setShowCustomerSuggestions(false), 150);
                  }}
                />
              </View>
            )}
            {!customer && showCustomerSuggestions && customerResults.length > 0 && (
              <View style={styles.suggestionsBox}>
                {customerResults.map((c) => (
                  <Pressable
                    key={c.id}
                    style={styles.suggestionRow}
                    onPress={() => {
                      setCustomer(c);
                      setCustomerQuery('');
                      setShowCustomerSuggestions(false);
                      setCustomerResults([]);
                    }}
                  >
                    <Text style={styles.suggestionText}>{c.name}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            <Text style={styles.filtersLabel}>SORT BY</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsContent}>
              {sortOptions.map((option) => {
                const active = sort === option.key;
                return (
                  <Pressable
                    key={option.key}
                    style={[styles.pill, active && styles.pillActive]}
                    onPress={() => setSort(option.key)}
                  >
                    <Text style={[styles.pillText, active && styles.pillTextActive]}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {hasActiveAdvancedFilters && (
              <Pressable style={styles.clearFiltersButton} onPress={clearAdvancedFilters}>
                <Text style={styles.clearFiltersText}>Clear filters</Text>
              </Pressable>
            )}
          </View>
        )}

        {isLoading && <ActivityIndicator style={{ marginTop: 20 }} />}
        {error && <Text style={styles.error}>{error}</Text>}
        {!isLoading && orders.length === 0 && <Text style={styles.emptyText}>No orders found.</Text>}

        <View style={styles.cardsList}>
          {orders.map((order) => {
            const primaryAction = primaryActionFor(order);
            return (
              <OrderCard
                key={order.id}
                order={order}
                onApprove={canApprove && order.status === 'pending' ? () => askApprove(order) : undefined}
                onReject={canApprove && order.status === 'pending' ? () => askReject(order) : undefined}
                onPrimaryAction={primaryAction?.onPress}
                primaryActionLabel={primaryAction?.label}
              />
            );
          })}
        </View>

        {!isLoading && hasMore && (
          <Pressable style={styles.loadMoreButton} onPress={loadMore} disabled={isLoadingMore}>
            {isLoadingMore ? (
              <ActivityIndicator color={colors.navy} size="small" />
            ) : (
              <Text style={styles.loadMoreText}>Load more ({total - orders.length} remaining)</Text>
            )}
          </Pressable>
        )}
      </ScrollView>

      <Pressable style={styles.fab} onPress={() => setIsNewOrderOpen(true)}>
        <Ionicons name="add" size={26} color="#FFFFFF" />
      </Pressable>

      <NewOrderModal
        visible={isNewOrderOpen}
        onClose={() => setIsNewOrderOpen(false)}
        onCreated={handleOrderCreated}
      />

      <StatusActionModal
        visible={!!pendingAction}
        title={pendingAction?.title ?? ''}
        message={pendingAction?.message ?? ''}
        confirmLabel={pendingAction?.confirmLabel ?? 'Confirm'}
        danger={pendingAction?.danger}
        requireReason={pendingAction?.requireReason}
        isSubmitting={isSubmittingAction}
        onCancel={() => setPendingAction(null)}
        onConfirm={handleConfirmAction}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingTop: 20, paddingBottom: 100 },
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
  count: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  searchRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text, outlineStyle: 'none' as never },
  filtersButton: {
    width: 46,
    height: 46,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filtersButtonActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  filtersDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.amber,
  },
  pillsRow: { marginTop: 14 },
  pillsContent: { gap: 8, paddingRight: 12 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  pillText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  pillTextActive: { color: '#FFFFFF' },
  subPillsWrap: { flexDirection: 'row', alignItems: 'center', marginTop: 8, paddingLeft: 4 },
  subPillsConnector: {
    width: 14,
    height: 14,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: colors.border,
    borderBottomLeftRadius: 6,
    marginRight: 6,
    alignSelf: 'flex-start',
    marginTop: -2,
  },
  subPillsRow: { flex: 1 },
  subPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.blueMuted,
    borderWidth: 1,
    borderColor: colors.blueMuted,
  },
  subPillActive: { backgroundColor: colors.blue, borderColor: colors.blue },
  subPillText: { fontSize: 12, fontWeight: '600', color: colors.blue },
  subPillTextActive: { color: '#FFFFFF' },
  filtersPanel: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginTop: 14,
  },
  filtersLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5, marginBottom: 8 },
  filtersLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  allTimeText: { fontSize: 11, color: colors.blue, fontWeight: '600', marginBottom: 8 },
  filtersHint: { fontSize: 11, color: colors.textMuted, marginTop: -4, marginBottom: 8 },
  dateRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  dateField: { flex: 1 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
  },
  plainSearchInput: { flex: 1, paddingVertical: 12, fontSize: 14, color: colors.text, outlineStyle: 'none' as never },
  customerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.amberMuted,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.amber,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  customerChipText: { fontSize: 14, color: colors.navy, fontWeight: '600' },
  suggestionsBox: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    marginTop: 4,
    overflow: 'hidden',
  },
  suggestionRow: { paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  suggestionText: { fontSize: 14, color: colors.text },
  clearFiltersButton: { marginTop: 16, alignItems: 'center' },
  clearFiltersText: { fontSize: 13, color: colors.blue, fontWeight: '600' },
  cardsList: { marginTop: 16 },
  error: { color: colors.error, marginTop: 12 },
  emptyText: { color: colors.textMuted, marginTop: 20, textAlign: 'center' },
  loadMoreButton: {
    marginTop: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadMoreText: { fontSize: 14, fontWeight: '600', color: colors.navy },
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
