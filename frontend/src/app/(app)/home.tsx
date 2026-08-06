import { Pressable, StyleSheet, Text, View } from 'react-native';

import { roleLabel } from '@/constants/roles';
import { colors, radius } from '@/constants/theme';
import { useAuth } from '@/auth/AuthContext';

export default function Home() {
  const { user, logout } = useAuth();

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.title}>You're logged in</Text>
        <Text style={styles.email}>{user ? user.email : 'Loading user...'}</Text>
        {user && (
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>{roleLabel(user.role)}</Text>
          </View>
        )}
        <Pressable style={styles.logoutButton} onPress={logout}>
          <Text style={styles.logoutButtonText}>Log out</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', padding: 24 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  email: { fontSize: 15, color: colors.textMuted },
  roleBadge: {
    backgroundColor: colors.amberMuted,
    borderRadius: radius.sm,
    paddingVertical: 4,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  roleBadgeText: { color: colors.navy, fontWeight: '600', fontSize: 13 },
  logoutButton: {
    marginTop: 16,
    backgroundColor: colors.navy,
    borderRadius: radius.lg,
    paddingVertical: 12,
    paddingHorizontal: 28,
  },
  logoutButtonText: { color: '#FFFFFF', fontWeight: '600' },
});
