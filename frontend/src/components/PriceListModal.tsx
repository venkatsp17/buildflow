import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import {
  createPriceList,
  searchProducts,
  updatePriceList,
  type PriceList,
  type Product,
} from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { colors, radius } from '@/constants/theme';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

type ItemDraft = { productId: number | null; productName: string; unitPrice: string };

function emptyItem(): ItemDraft {
  return { productId: null, productName: '', unitPrice: '' };
}

type Props = {
  visible: boolean;
  onClose: () => void;
  onSaved: (priceList: PriceList) => void;
  editing?: PriceList | null;
};

export function PriceListModal({ visible, onClose, onSaved, editing }: Props) {
  const { token } = useAuth();
  const { height: windowHeight } = useWindowDimensions();

  const [name, setName] = useState('');
  const [items, setItems] = useState<ItemDraft[]>([emptyItem()]);
  const [activeProductIndex, setActiveProductIndex] = useState<number | null>(null);
  const [productResults, setProductResults] = useState<Product[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeProductQuery = activeProductIndex !== null ? items[activeProductIndex]?.productName ?? '' : '';
  const debouncedProductQuery = useDebouncedValue(activeProductQuery, 300);

  useEffect(() => {
    if (editing) {
      setName(editing.name);
      setItems(
        editing.items.map((item) => ({
          productId: item.productId,
          productName: item.product?.name ?? '',
          unitPrice: String(item.unitPrice),
        })),
      );
    } else {
      setName('');
      setItems([emptyItem()]);
    }
    setError(null);
  }, [editing, visible]);

  useEffect(() => {
    if (!token || activeProductIndex === null || !debouncedProductQuery.trim()) {
      setProductResults([]);
      return;
    }
    let cancelled = false;
    searchProducts(token, debouncedProductQuery.trim())
      .then(({ products }) => {
        if (!cancelled) setProductResults(products);
      })
      .catch(() => {
        if (!cancelled) setProductResults([]);
      });
    return () => {
      cancelled = true;
    };
  }, [token, activeProductIndex, debouncedProductQuery]);

  const updateItem = (index: number, patch: Partial<ItemDraft>) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const hasValidItems = items.some((item) => item.productId && Number(item.unitPrice) > 0);
  const canSubmit = !!name.trim() && hasValidItems && !isSubmitting;

  const handleClose = () => {
    onClose();
  };

  const handleSubmit = async () => {
    if (!token) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const input = {
        name: name.trim(),
        items: items
          .filter((item) => item.productId && Number(item.unitPrice) > 0)
          .map((item) => ({ productId: item.productId as number, unitPrice: Number(item.unitPrice) })),
      };
      const { priceList } = editing
        ? await updatePriceList(token, editing.id, input)
        : await createPriceList(token, input);
      onSaved(priceList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save price list');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!visible) {
    return null;
  }

  return (
    <View style={styles.overlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />

      <View style={[styles.sheet, { maxHeight: windowHeight * 0.92 }]}>
        <View style={styles.dragHandle} />

        <View style={styles.headerRow}>
          <Text style={styles.title}>{editing ? 'Edit Price List' : 'New Price List'}</Text>
          <Pressable style={styles.closeButton} onPress={handleClose}>
            <Ionicons name="close" size={20} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.divider} />

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Name</Text>
          <View style={styles.inputWrap}>
            <TextInput style={styles.input} placeholder="e.g. Abu Dhabi Standard" value={name} onChangeText={setName} />
          </View>

          <View style={styles.productsHeaderRow}>
            <Text style={styles.label}>Products</Text>
            <View style={styles.itemCountPill}>
              <Text style={styles.itemCountText}>
                {items.length} item{items.length === 1 ? '' : 's'}
              </Text>
            </View>
          </View>

          {items.map((item, index) => (
            <View key={index} style={styles.itemCard}>
              <View style={styles.itemCardHeader}>
                <Text style={styles.itemLabel}>ITEM {index + 1}</Text>
                {items.length > 1 && (
                  <Pressable onPress={() => removeItem(index)}>
                    <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                  </Pressable>
                )}
              </View>

              <View style={styles.inputWrap}>
                <Ionicons name="search-outline" size={16} color={colors.textMuted} />
                <TextInput
                  style={styles.input}
                  placeholder="Select product..."
                  value={item.productName}
                  onChangeText={(text) => {
                    updateItem(index, { productName: text, productId: null });
                    setActiveProductIndex(index);
                  }}
                  onFocus={() => setActiveProductIndex(index)}
                />
              </View>
              {activeProductIndex === index && productResults.length > 0 && (
                <View style={styles.suggestionsBox}>
                  {productResults.map((product) => (
                    <Pressable
                      key={product.id}
                      style={styles.suggestionRow}
                      onPress={() => {
                        updateItem(index, { productId: product.id, productName: product.name });
                        setActiveProductIndex(null);
                        setProductResults([]);
                      }}
                    >
                      <Text style={styles.suggestionText}>{product.name}</Text>
                    </Pressable>
                  ))}
                </View>
              )}

              <TextInput
                style={[styles.input, styles.plainInput, styles.priceInput]}
                placeholder="Unit price (₹)"
                value={item.unitPrice}
                onChangeText={(text) => updateItem(index, { unitPrice: text.replace(/[^0-9.]/g, '') })}
                keyboardType="decimal-pad"
              />
              {!item.productId && !!item.productName && (
                <Text style={styles.itemWarning}>Pick a product from the list above</Text>
              )}
            </View>
          ))}

          <Pressable style={styles.addItemButton} onPress={() => setItems((prev) => [...prev, emptyItem()])}>
            <Ionicons name="add" size={16} color={colors.textMuted} />
            <Text style={styles.addItemText}>Add Another Product</Text>
          </Pressable>

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>{editing ? 'Save Changes' : 'Create Price List'}</Text>
            )}
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
    zIndex: 20,
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: 10,
    paddingHorizontal: 20,
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
  divider: { height: 1, backgroundColor: colors.border, marginTop: 14 },
  scrollView: { flexShrink: 1 },
  content: { paddingTop: 16, paddingBottom: 32 },
  label: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 8, marginTop: 16 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
  },
  input: { flex: 1, paddingVertical: 12, fontSize: 14, color: colors.text },
  plainInput: { paddingHorizontal: 12 },
  priceInput: { marginTop: 8 },
  suggestionsBox: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    marginTop: 4,
    overflow: 'hidden',
  },
  suggestionRow: { paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  suggestionText: { fontSize: 14, color: colors.text },
  productsHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemCountPill: {
    backgroundColor: colors.grayMuted,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 16,
  },
  itemCountText: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
  itemCard: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 10,
    gap: 8,
  },
  itemCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5 },
  itemWarning: { fontSize: 11, color: colors.error },
  addItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    paddingVertical: 12,
  },
  addItemText: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  error: { color: colors.error, marginTop: 16, textAlign: 'center' },
  submitButton: {
    marginTop: 24,
    backgroundColor: colors.navy,
    borderRadius: radius.lg,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: { opacity: 0.4 },
  submitButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});
