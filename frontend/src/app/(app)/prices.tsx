import { Redirect } from 'expo-router';

import { useAuth } from '@/auth/AuthContext';
import { PricesScreen } from '@/screens/PricesScreen';

export default function Prices() {
  const { user } = useAuth();

  // Price list management is manager-only — anyone else hitting this route
  // directly (e.g. a stale deep link) just lands back on their own home.
  if (user?.role !== 'manager') {
    return <Redirect href="/home" />;
  }

  return <PricesScreen />;
}
