import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/AuthContext';
import { colors } from '@/constants/theme';

const DEFAULT_TABS = [
  { href: '/home', label: 'Home', icon: 'home-outline' as const },
  { href: '/orders', label: 'Orders', icon: 'clipboard-outline' as const },
  { href: '/profile', label: 'Profile', icon: 'person-outline' as const },
];

export function BottomTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();

  // Manufacturing's "Home" is the Production Queue, not a generic
  // dashboard — the tab should read that way rather than say "Home".
  const tabs =
    user?.role === 'manufacturing'
      ? [
          { href: '/home', label: 'Queue', icon: 'file-tray-stacked-outline' as const },
          ...DEFAULT_TABS.slice(1),
        ]
      : DEFAULT_TABS;

  return (
    <View style={styles.bar}>
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
    paddingBottom: 8,
    paddingTop: 8,
  },
  tab: { flex: 1, alignItems: 'center', gap: 2 },
  label: { fontSize: 11, fontWeight: '600' },
});
