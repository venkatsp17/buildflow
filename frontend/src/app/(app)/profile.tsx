import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/AuthContext';
import { roleLabel } from '@/constants/roles';
import { colors, radius } from '@/constants/theme';

export default function Profile() {
  const { user, logout } = useAuth();

  return (
    <View style={styles.screen}>
      <View style={styles.avatar}>
        <Ionicons name="person" size={28} color={colors.navy} />
      </View>
      <Text style={styles.email}>{user?.email}</Text>
      {user && (
        <View style={styles.roleBadge}>
          <Text style={styles.roleBadgeText}>{roleLabel(user.role)}</Text>
        </View>
      )}

      <Pressable style={styles.logoutButton} onPress={logout}>
        <Ionicons name="log-out-outline" size={18} color="#FFFFFF" />
        <Text style={styles.logoutButtonText}>Log out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, alignItems: 'center', paddingTop: 80, gap: 8, padding: 24 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.amberMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  email: { fontSize: 17, fontWeight: '600', color: colors.text },
  roleBadge: { backgroundColor: colors.amberMuted, borderRadius: radius.sm, paddingVertical: 4, paddingHorizontal: 12 },
  roleBadgeText: { color: colors.navy, fontWeight: '600', fontSize: 13 },
  logoutButton: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.navy,
    borderRadius: radius.lg,
    paddingVertical: 12,
    paddingHorizontal: 28,
  },
  logoutButtonText: { color: '#FFFFFF', fontWeight: '600' },
});
