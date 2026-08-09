import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { createProduct, type Product } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { colors, radius } from '@/constants/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  onCreated: (product: Product) => void;
};

export function CreateProductModal({ visible, onClose, onCreated }: Props) {
  const { token } = useAuth();
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setName('');
      setUnit('');
      setDescription('');
      setError(null);
    }
  }, [visible]);

  if (!visible) return null;

  const canSubmit = !!name.trim() && !!unit.trim() && !isSubmitting;

  const handleSubmit = async () => {
    if (!token) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const { product } = await createProduct(token, {
        name: name.trim(),
        unit: unit.trim(),
        description: description.trim() || undefined,
      });
      onCreated(product);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create product');
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
          <Text style={styles.title}>New Product</Text>
          <Pressable style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={20} color={colors.text} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.fieldLabel}>NAME</Text>
          <TextInput style={styles.input} placeholder="e.g. Cement Bags 50kg" value={name} onChangeText={setName} />

          <Text style={styles.fieldLabel}>UNIT</Text>
          <TextInput style={styles.input} placeholder="e.g. bags, tons, m3" value={unit} onChangeText={setUnit} />

          <Text style={styles.fieldLabel}>DESCRIPTION (OPTIONAL)</Text>
          <TextInput
            style={[styles.input, styles.multilineInput]}
            placeholder="Specs, grade, notes..."
            value={description}
            onChangeText={setDescription}
            multiline
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit}
          >
            {isSubmitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitButtonText}>Create Product</Text>}
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
  multilineInput: { minHeight: 70, textAlignVertical: 'top' },
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
