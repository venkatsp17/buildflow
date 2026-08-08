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

  return <GenericHomeScreen />;
}
