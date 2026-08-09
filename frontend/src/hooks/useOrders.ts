import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

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

  // Refetch every time a screen using this hook regains focus (e.g.
  // navigating back to the Orders tab after creating an order elsewhere),
  // not just on first mount — screens under expo-router's implicit stack
  // navigators stay mounted rather than remounting on revisit.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return { orders, summary, isLoading, error, reload: load };
}
