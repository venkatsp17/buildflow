import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { getPriorityOrders, type Order } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';

export function usePriorityOrders() {
  const { token } = useAuth();
  const [priorityOrders, setPriorityOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const { orders } = await getPriorityOrders(token);
      setPriorityOrders(orders);
    } catch {
      setPriorityOrders([]);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return { priorityOrders, isLoading, reload: load };
}
