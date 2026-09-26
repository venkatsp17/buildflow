import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/AuthContext';
import { colors } from '@/constants/theme';

const DEFAULT_TABS = [
  { href: '/home', label: 'Home', icon: 'home-outline' as const },
  { href: '/orders', label: 'Orders', icon: 'clipboard-outline' as const },
  { href: '/profile', label: 'Profile', icon: 'person-outline' as const },
];

// Manager works across the whole order pipeline (not just their own orders)
// plus pricing admin, so their tabs swap Home/Profile for a dedicated
// Dashboard and a Prices tab rather than reusing the generic set. Alerts
// isn't a tab here (or for any role) — it's reached via the bell icon in
// the Dashboard/Orders header instead.
const MANAGER_TABS = [
  { href: '/home', label: 'Dashboard', icon: 'grid-outline' as const },
  { href: '/orders', label: 'Orders', icon: 'clipboard-outline' as const },
  { href: '/prices', label: 'Manage', icon: 'settings-outline' as const },
];

export function BottomTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  // Some Android devices using three-button navigation report a zero safe
  // area inset even though the system controls still occupy the bottom of
  // the screen. Keep a fallback buffer so those controls never cover tabs.
  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'android' ? 28 : 8);

  const tabs = user?.role === 'manager' ? MANAGER_TABS : DEFAULT_TABS;

  return (
    <View style={[styles.bar, { paddingBottom: bottomPadding }]}>
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        const color = active ? colors.amber : colors.textMuted;
        return (
          <Pressable key={tab.href} style={styles.tab} onPress={() => router.push(tab.href as never)}>
            <Ionicons name={tab.icon} size={22} color={color} />
            <Text style={[styles.label, { color }]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
    paddingTop: 8,
  },
  tab: { flex: 1, alignItems: 'center', gap: 2 },
  label: { fontSize: 11, fontWeight: '600' },
});
