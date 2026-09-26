import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { listOrders, type Customer, type Order, type OrderSort } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

const PAGE_SIZE = 20;

// Default due-date range floor: one month back from today. Combined with
// row-count pagination, this keeps the default view small even for an
// account with years of history — old orders are still fully reachable by
// widening or clearing the date range, not gone.
export function defaultDateFrom(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
}

// Search text, status, customer, date range, and sort are all sent to the
// backend as query params (search debounced) rather than filtered/sorted/
// paged client-side, so the query stays fast and bounded as an account's
// order history grows. Only one page of orders is ever held in state at a
// time, appended to via loadMore — never the full history at once.
export function useOrdersList() {
  const { token } = useAuth();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [dateFrom, setDateFrom] = useState(defaultDateFrom());
  const [dateTo, setDateTo] = useState('');
  const [sort, setSort] = useState<OrderSort>('newest');

  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debouncedSearch = useDebouncedValue(search, 300);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    setIsLoading(true);
    try {
      const { orders: result, total: count } = await listOrders(token, {
        search: debouncedSearch,
        status,
        customerId: customer?.id,
        dateFrom,
        dateTo,
        sort,
        limit: PAGE_SIZE,
        offset: 0,
      });
      setOrders(result);
      setTotal(count);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load orders');
    } finally {
      setIsLoading(false);
    }
  }, [token, debouncedSearch, status, customer, dateFrom, dateTo, sort]);

  const loadMore = useCallback(async () => {
    if (!token || isLoadingMore || orders.length >= total) return;
    setIsLoadingMore(true);
    try {
      const { orders: result } = await listOrders(token, {
        search: debouncedSearch,
        status,
        customerId: customer?.id,
        dateFrom,
        dateTo,
        sort,
        limit: PAGE_SIZE,
        offset: orders.length,
      });
      setOrders((prev) => [...prev, ...result]);
    } catch {
      // Best-effort — the user can just tap "Load more" again.
    } finally {
      setIsLoadingMore(false);
    }
  }, [token, debouncedSearch, status, customer, dateFrom, dateTo, sort, orders.length, total, isLoadingMore]);

  // Re-runs both on focus transitions and whenever `load`'s own
  // dependencies change (a filter changed) while already focused.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return {
    orders,
    total,
    isLoading,
    isLoadingMore,
    hasMore: orders.length < total,
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
    reload: load,
  };
}
