import { Redirect } from 'expo-router';

import { useAuth } from '@/auth/AuthContext';
import { GenericHomeScreen } from '@/screens/GenericHomeScreen';
import { ManagerHomeScreen } from '@/screens/ManagerHomeScreen';
import { SalesHomeScreen } from '@/screens/SalesHomeScreen';

export default function Home() {
  const { user } = useAuth();

  if (user?.role === 'sales') {
    return <SalesHomeScreen />;
  }

  if (user?.role === 'manager') {
    return <ManagerHomeScreen />;
  }

  // Manufacturing has no separate landing dashboard — Orders (pre-filtered
  // to Pending) is their one screen, so there's nothing distinct to show
  // here; send them straight there instead of a redundant Home tab.
  if (user?.role === 'manufacturing') {
    return <Redirect href="/orders" />;
  }

  return <GenericHomeScreen />;
}
