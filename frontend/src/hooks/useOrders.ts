import { useCallback, useEffect, useState } from 'react';

import { getOrderSummary, listOrders, type Order, type OrderSummary } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';

export function useOrders() {
  const { token } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [summary, setSummary] = useState<OrderSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const [ordersRes, summaryRes] = await Promise.all([listOrders(token), getOrderSummary(token)]);
      setOrders(ordersRes.orders);
      setSummary(summaryRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load orders');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  return { orders, summary, isLoading, error, reload: load };
}
