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

type CreatedResult = { user: User; temporaryPassword: string };

export function CreateUserModal({ visible, onClose, onCreated }: Props) {
  const { token } = useAuth();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<RoleValue>('sales');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [created, setCreated] = useState<CreatedResult | null>(null);

  useEffect(() => {
    if (visible) {
      setName('');
      setUsername('');
      setRole('sales');
      setError(null);
      setCreated(null);
    }
  }, [visible]);

  if (!visible) return null;

  const canSubmit = !!name.trim() && !!username.trim() && !isSubmitting;

  const handleSubmit = async () => {
    if (!token) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await createUser(token, { name: name.trim(), username: username.trim(), role });
      setCreated(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDone = () => {
    if (created) onCreated(created.user);
  };

  return (
    <View style={styles.overlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={created ? handleDone : onClose} />

      <View style={styles.sheet}>
        <View style={styles.dragHandle} />

        {created ? (
          <>
            <View style={styles.headerRow}>
              <Text style={styles.title}>User Created</Text>
            </View>
            <ScrollView contentContainerStyle={styles.content}>
              <View style={styles.successIcon}>
                <Ionicons name="checkmark-circle" size={40} color={colors.green} />
              </View>
              <Text style={styles.successNote}>
                Share this temporary password with {created.user.name} — it won't be shown again. They'll be asked to
                set their own password the first time they log in.
              </Text>

              <Text style={styles.fieldLabel}>USERNAME</Text>
              <View style={styles.credentialBox}>
                <Text style={styles.credentialText}>{created.user.username}</Text>
              </View>

              <Text style={styles.fieldLabel}>TEMPORARY PASSWORD</Text>
              <View style={styles.credentialBox}>
                <Text style={styles.credentialText} selectable>
                  {created.temporaryPassword}
                </Text>
              </View>

              <Pressable style={styles.submitButton} onPress={handleDone}>
                <Text style={styles.submitButtonText}>Done</Text>
              </Pressable>
            </ScrollView>
          </>
        ) : (
          <>
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

              <Text style={styles.fieldLabel}>NAME</Text>
              <TextInput style={styles.input} placeholder="Full name" value={name} onChangeText={setName} />

              <Text style={styles.fieldLabel}>USERNAME</Text>
              <TextInput
                style={styles.input}
                placeholder="username"
                autoCapitalize="none"
                value={username}
                onChangeText={setUsername}
              />

              <Text style={styles.hint}>A password is generated automatically — you'll get it after creating the user.</Text>

              {error && <Text style={styles.error}>{error}</Text>}

              <Pressable
                style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={!canSubmit}
              >
                {isSubmitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitButtonText}>Create User</Text>}
              </Pressable>
            </ScrollView>
          </>
        )}
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
  hint: { fontSize: 12, color: colors.textMuted, marginTop: 10 },
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
  successIcon: { alignItems: 'center', marginBottom: 8 },
  successNote: { fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 19 },
  credentialBox: {
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  credentialText: { fontSize: 16, fontWeight: '700', color: colors.text, letterSpacing: 0.5 },
});
