import { Redirect, Slot } from 'expo-router';

import { useAuth } from '@/auth/AuthContext';

export default function AppLayout() {
  const { token, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!token) {
    return <Redirect href="/login" />;
  }

  return <Slot />;
}
