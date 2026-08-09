import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { createUser, type User } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { colors, radius } from '@/constants/theme';
import { ROLE_OPTIONS, type RoleValue } from '@/constants/roles';

type Props = {
  visible: boolean;
  onClose: () => void;
  onCreated: (user: User) => void;
};

export function CreateUserModal({ visible, onClose, onCreated }: Props) {
  const { token } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<RoleValue>('sales');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setEmail('');
      setPassword('');
      setRole('sales');
      setError(null);
    }
  }, [visible]);

  if (!visible) return null;

  const canSubmit = !!email && password.length >= 8 && !isSubmitting;

  const handleSubmit = async () => {
    if (!token) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const { user } = await createUser(token, { email: email.trim(), password, role });
      onCreated(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.overlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

      <View style={styles.sheet}>
        <View style={styles.dragHandle} />

        <View style={styles.headerRow}>
          <Text style={styles.title}>New User</Text>
          <Pressable style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={20} color={colors.text} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.sectionLabel}>ROLE</Text>
          {ROLE_OPTIONS.map((option) => {
            const selected = option.value === role;
            return (
              <Pressable
                key={option.value}
                style={[styles.roleRow, selected && styles.roleRowSelected]}
                onPress={() => setRole(option.value)}
              >
                <View style={[styles.roleIcon, selected && styles.roleIconSelected]}>
                  <Ionicons name={option.icon} size={18} color={selected ? colors.navy : colors.textMuted} />
                </View>
                <View style={styles.roleTextGroup}>
                  <Text style={styles.roleLabel}>{option.label}</Text>
                  <Text style={styles.roleDescription}>{option.description}</Text>
                </View>
                {selected && <Ionicons name="checkmark-circle" size={20} color={colors.amber} />}
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
            onPress={handleSubmit}
            disabled={!canSubmit}
          >
            {isSubmitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitButtonText}>Create User</Text>}
          </Pressable>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(16, 27, 51, 0.5)',
    zIndex: 30,
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: 10,
    paddingHorizontal: 20,
    maxHeight: '90%',
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 12,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.grayMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { paddingTop: 16, paddingBottom: 32 },
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
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleIconSelected: { backgroundColor: colors.amber },
  roleTextGroup: { flex: 1 },
  roleLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  roleDescription: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
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
  submitButtonDisabled: { opacity: 0.4 },
  submitButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});
