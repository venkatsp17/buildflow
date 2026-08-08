import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';

export default function Alerts() {
  return (
    <View style={styles.screen}>
      <Ionicons name="notifications-outline" size={40} color={colors.textMuted} />
      <Text style={styles.title}>No alerts yet</Text>
      <Text style={styles.subtitle}>You'll see order and system alerts here.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: 6, padding: 24 },
  title: { fontSize: 16, fontWeight: '600', color: colors.text },
  subtitle: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
});
