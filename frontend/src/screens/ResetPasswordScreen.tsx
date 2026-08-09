import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { resetPassword } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { colors, radius } from '@/constants/theme';

// Shown instead of the app whenever the logged-in user has
// mustResetPassword set — a manager-created account can't be used until its
// auto-generated password is replaced. There's no way to dismiss this short
// of logging out; the backend enforces the same block on every other route,
// so skipping this screen wouldn't get anywhere anyway.
export function ResetPasswordScreen() {
  const { token, logout, refreshUser } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = newPassword.length >= 8 && newPassword === confirmPassword && !isSubmitting;

  const onSubmit = async () => {
    if (!token) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await resetPassword(token, newPassword);
      await refreshUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.title}>Set a new password</Text>
        <Text style={styles.subtitle}>
          Your account was created with a temporary password. Choose your own before continuing.
        </Text>

        <Text style={styles.fieldLabel}>NEW PASSWORD</Text>
        <TextInput
          style={styles.input}
          placeholder="Min 8 characters"
          secureTextEntry
          value={newPassword}
          onChangeText={setNewPassword}
        />

        <Text style={styles.fieldLabel}>CONFIRM PASSWORD</Text>
        <TextInput
          style={styles.input}
          placeholder="Re-enter password"
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />

        {confirmPassword.length > 0 && newPassword !== confirmPassword && (
          <Text style={styles.error}>Passwords don't match.</Text>
        )}
        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]} onPress={onSubmit} disabled={!canSubmit}>
          {isSubmitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitButtonText}>Set Password</Text>}
        </Pressable>

        <Pressable style={styles.logoutLink} onPress={() => logout()}>
          <Text style={styles.logoutLinkText}>Log out instead</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 6, lineHeight: 19 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: colors.textMuted, marginTop: 18, marginBottom: 6, letterSpacing: 0.5 },
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
  logoutLink: { marginTop: 16, alignItems: 'center' },
  logoutLinkText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
});
