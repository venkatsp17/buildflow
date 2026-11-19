import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { createProduct, type Product, type TaxCategory } from '@/api/client';
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
  const [hsnCode, setHSNCode] = useState('');
  const [gstRate, setGSTRate] = useState('');
  const [taxCategory, setTaxCategory] = useState<TaxCategory>('taxable');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setName('');
      setUnit('');
      setDescription('');
      setHSNCode('');
      setGSTRate('');
      setTaxCategory('taxable');
      setError(null);
    }
  }, [visible]);

  if (!visible) return null;

  const validHSN = /^(\d{4}|\d{6}|\d{8})$/.test(hsnCode);
  const validRate = /^\d+(\.\d{0,4})?$/.test(gstRate) && Number(gstRate) <= 100;
  const validTax = taxCategory === 'taxable' ? validHSN && validRate && Number(gstRate) > 0 : Number(gstRate) === 0 && validRate && (!hsnCode || validHSN);
  const canSubmit = !!name.trim() && !!unit.trim() && validTax && !isSubmitting;

  const handleSubmit = async () => {
    if (!token || !canSubmit) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const { product } = await createProduct(token, {
        name: name.trim(),
        unit: unit.trim(),
        description: description.trim() || undefined,
        hsnCode: hsnCode || undefined,
        gstRate: Number(gstRate),
        taxCategory,
      });
      onCreated(product);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create product');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
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

          <Text style={styles.fieldLabel}>HSN CODE</Text>
          <TextInput style={styles.input} placeholder="4, 6 or 8 digits" value={hsnCode}
            onChangeText={text => setHSNCode(text.replace(/[^0-9]/g, '').slice(0, 8))} keyboardType="number-pad" />
          <Text style={styles.fieldLabel}>TAX CATEGORY</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {(['taxable', 'nil_rated', 'exempt', 'non_gst'] as const).map(category => (
              <Pressable key={category} style={[styles.input, { backgroundColor: category === taxCategory ? colors.amberMuted : colors.card }]}
                onPress={() => { setTaxCategory(category); setGSTRate(category === 'taxable' ? '' : '0'); }}>
                <Text style={{ color: colors.text }}>{category.replace('_', ' ')}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.fieldLabel}>GST RATE (%)</Text>
          <TextInput style={styles.input} placeholder="Enter applicable GST rate" value={gstRate}
            onChangeText={text => { if (/^\d*(\.\d{0,4})?$/.test(text)) setGSTRate(text); }} keyboardType="decimal-pad"
            editable={taxCategory === 'taxable'} />

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
    </KeyboardAvoidingView>
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
