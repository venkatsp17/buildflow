import { Redirect, Slot } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/AuthContext';
import { BottomTabBar } from '@/components/BottomTabBar';
import { NotificationProvider } from '@/notifications/NotificationContext';
import { ResetPasswordScreen } from '@/screens/ResetPasswordScreen';

export default function AppLayout() {
  const { token, user, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!token) {
    return <Redirect href="/login" />;
  }

  // Blocks the whole app (not just a route) until a manager-created account
  // replaces its auto-generated password — the backend enforces the same
  // block server-side, so this is a UX shortcut, not the only guard.
  if (user?.mustResetPassword) {
    return <ResetPasswordScreen />;
  }

  return (
    <NotificationProvider>
      <View style={styles.container}>
        <View style={styles.content}>
          <Slot />
        </View>
        <BottomTabBar />
      </View>
    </NotificationProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1 },
});
