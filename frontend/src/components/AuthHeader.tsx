import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '@/constants/theme';

type Props = { title: string; subtitle: string };

export function AuthHeader({ title, subtitle }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.brandRow}>
        <View style={styles.logo}>
          <Ionicons name="cube-outline" size={22} color={colors.navy} />
        </View>
        <View>
          <Text style={styles.brandName}>BuildFlow</Text>
          <Text style={styles.brandTagline}>Manufacturing Order System</Text>
        </View>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.navy,
    paddingTop: 64,
    paddingBottom: 40,
    paddingHorizontal: 24,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 28 },
  logo: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  brandTagline: { color: colors.navyMuted, fontSize: 13 },
  title: { color: '#FFFFFF', fontSize: 28, fontWeight: '700', marginBottom: 6 },
  subtitle: { color: colors.navyMuted, fontSize: 15 },
});
