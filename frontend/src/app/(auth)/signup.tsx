import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AuthHeader } from '@/components/AuthHeader';
import { colors, radius } from '@/constants/theme';
import { ROLE_OPTIONS, type RoleValue } from '@/constants/roles';
import { useAuth } from '@/auth/AuthContext';

export default function Signup() {
  const { signup } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<RoleValue>('sales');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      await signup(email, password, role);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign up');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = !!email && password.length >= 8 && !isSubmitting;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <AuthHeader title="Create account." subtitle="Select your role to continue" />

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>SIGN UP AS</Text>

        {ROLE_OPTIONS.map((option) => {
          const selected = option.value === role;
          return (
            <Pressable
              key={option.value}
              style={[styles.roleRow, selected && styles.roleRowSelected]}
              onPress={() => setRole(option.value)}
            >
              <View style={[styles.roleIcon, selected && styles.roleIconSelected]}>
                <Ionicons name={option.icon} size={20} color={selected ? colors.navy : colors.textMuted} />
              </View>
              <View style={styles.roleTextGroup}>
                <Text style={styles.roleLabel}>{option.label}</Text>
                <Text style={styles.roleDescription}>{option.description}</Text>
              </View>
              {selected && <Ionicons name="checkmark-circle" size={22} color={colors.amber} />}
            </Pressable>
          );
        })}

        <Text style={styles.fieldLabel}>EMAIL</Text>
        <TextInput
          style={styles.input}
          placeholder="you@example.com"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />

        <Text style={styles.fieldLabel}>PASSWORD</Text>
        <TextInput
          style={styles.input}
          placeholder="Min 8 characters"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
          onPress={onSubmit}
          disabled={!canSubmit}
        >
          {isSubmitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitButtonText}>Sign Up</Text>}
        </Pressable>

        <Link href="/login" style={styles.link}>
          Already have an account? Log in
        </Link>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, paddingBottom: 32 },
  card: {
    marginTop: -20,
    marginHorizontal: 20,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 20,
    gap: 4,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  sectionLabel: { fontSize: 12, fontWeight: '600', color: colors.textMuted, marginBottom: 10, letterSpacing: 0.5 },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 10,
    backgroundColor: colors.card,
  },
  roleRowSelected: { borderColor: colors.amber, backgroundColor: colors.amberMuted },
  roleIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleIconSelected: { backgroundColor: colors.amber },
  roleTextGroup: { flex: 1 },
  roleLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
  roleDescription: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: colors.textMuted, marginTop: 14, marginBottom: 6, letterSpacing: 0.5 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    color: colors.text,
  },
  error: { color: colors.error, marginTop: 12 },
  submitButton: {
    marginTop: 20,
    backgroundColor: colors.navy,
    borderRadius: radius.lg,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: { opacity: 0.5 },
  submitButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  link: { marginTop: 18, textAlign: 'center', color: colors.navy },
});
