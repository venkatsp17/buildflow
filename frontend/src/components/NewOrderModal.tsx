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
  createOrder,
  searchCustomers,
  searchGeocode,
  searchProducts,
  type Customer,
  type GeocodeResult,
  type Order,
  type Product,
} from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { colors, radius } from '@/constants/theme';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { DatePickerInput } from './DatePickerInput';
import { LeafletMapPreview } from './LeafletMapPreview';

const DEFAULT_PRICE_LIST = 'Dubai Standard';

const PRIORITIES = [
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
] as const;

type ItemDraft = {
  productId: number | null;
  productName: string;
  quantity: string;
  unitPrice: number | null;
  description: string;
};

function emptyItem(): ItemDraft {
  return { productId: null, productName: '', quantity: '', unitPrice: null, description: '' };
}

const CURRENCY = '₹';

function lineTotal(item: ItemDraft): number {
  return (Number(item.quantity) || 0) * (item.unitPrice ?? 0);
}

type Props = {
  visible: boolean;
  onClose: () => void;
  onCreated: (order: Order) => void;
};

export function NewOrderModal({ visible, onClose, onCreated }: Props) {
  const { token } = useAuth();
  const { height: windowHeight } = useWindowDimensions();

  const [clientName, setClientName] = useState('');
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);

  const [dueDate, setDueDate] = useState('');
  const [urgency, setUrgency] = useState<(typeof PRIORITIES)[number]['value']>('medium');
  const [items, setItems] = useState<ItemDraft[]>([emptyItem()]);

  const [activeProductIndex, setActiveProductIndex] = useState<number | null>(null);
  const [productResults, setProductResults] = useState<Product[]>([]);

  const [address, setAddress] = useState('');
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
  const [addressResults, setAddressResults] = useState<GeocodeResult[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [city, setCity] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debouncedClientName = useDebouncedValue(clientName, 300);
  const activeProductQuery = activeProductIndex !== null ? items[activeProductIndex]?.productName ?? '' : '';
  const debouncedProductQuery = useDebouncedValue(activeProductQuery, 300);
  const debouncedAddress = useDebouncedValue(address, 400);

  // Empty search text still hits the API — the backend returns its default
  // alphabetical list in that case — so focusing the field shows a
  // prepopulated list before the user types anything.
  useEffect(() => {
    if (!token) {
      setCustomerResults([]);
      return;
    }
    let cancelled = false;
    searchCustomers(token, debouncedClientName.trim())
      .then(({ customers }) => {
        if (!cancelled) setCustomerResults(customers);
      })
      .catch(() => {
        if (!cancelled) setCustomerResults([]);
      });
    return () => {
      cancelled = true;
    };
  }, [token, debouncedClientName]);

  useEffect(() => {
    if (!token || activeProductIndex === null) {
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

  useEffect(() => {
    if (!token || debouncedAddress.trim().length < 3) {
      setAddressResults([]);
      return;
    }
    let cancelled = false;
    setIsGeocoding(true);
    searchGeocode(token, debouncedAddress.trim())
      .then(({ results }) => {
        if (!cancelled) setAddressResults(results);
      })
      .catch(() => {
        if (!cancelled) setAddressResults([]);
      })
      .finally(() => {
        if (!cancelled) setIsGeocoding(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, debouncedAddress]);

  const hasValidItems = items.some((item) => item.productId && Number(item.quantity) > 0);
  const canSubmit = !!clientName.trim() && !!dueDate && !!city.trim() && hasValidItems && !isSubmitting;
  const orderTotal = items.reduce((sum, item) => sum + lineTotal(item), 0);
  const totalUnits = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

  const resetForm = () => {
    setClientName('');
    setCustomerResults([]);
    setDueDate('');
    setUrgency('medium');
    setItems([emptyItem()]);
    setActiveProductIndex(null);
    setProductResults([]);
    setAddress('');
    setAddressResults([]);
    setSelectedLocation(null);
    setCity('');
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const updateItem = (index: number, patch: Partial<ItemDraft>) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!token || !dueDate) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const { order } = await createOrder(token, {
        clientName: clientName.trim(),
        city: city.trim(),
        address: address.trim() || undefined,
        latitude: selectedLocation?.lat,
        longitude: selectedLocation?.lon,
        priceListName: DEFAULT_PRICE_LIST,
        urgency,
        dueDate,
        items: items
          .filter((item) => item.productId && Number(item.quantity) > 0)
          .map((item) => ({
            productId: item.productId as number,
            description: item.description.trim() || undefined,
            quantity: Number(item.quantity),
          })),
      });
      resetForm();
      onCreated(order);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create order');
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
          <View>
            <Text style={styles.title}>New Order</Text>
            <Text style={styles.ticketPlaceholder}>TKT-AUTO</Text>
          </View>
          <Pressable style={styles.closeButton} onPress={handleClose}>
            <Ionicons name="close" size={20} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.divider} />

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Customer</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="search-outline" size={16} color={colors.textMuted} />
            <TextInput
              style={styles.input}
              placeholder="Search customer..."
              value={clientName}
              onChangeText={(text) => {
                setClientName(text);
                setShowCustomerSuggestions(true);
              }}
              onFocus={() => setShowCustomerSuggestions(true)}
            />
          </View>
          {showCustomerSuggestions && customerResults.length > 0 && (
            <View style={styles.suggestionsBox}>
              {customerResults.map((customer) => (
                <Pressable
                  key={customer.id}
                  style={styles.suggestionRow}
                  onPress={() => {
                    setClientName(customer.name);
                    setShowCustomerSuggestions(false);
                    setCustomerResults([]);
                  }}
                >
                  <Text style={styles.suggestionText}>{customer.name}</Text>
                </Pressable>
              ))}
            </View>
          )}

          <Text style={styles.label}>Due Date</Text>
          <DatePickerInput value={dueDate} onChange={setDueDate} placeholder="Select date" />

          <Text style={styles.label}>Priority</Text>
          <View style={styles.priorityRow}>
            {PRIORITIES.map((p) => {
              const selected = p.value === urgency;
              return (
                <Pressable
                  key={p.value}
                  style={[styles.priorityPill, selected && styles.priorityPillSelected]}
                  onPress={() => setUrgency(p.value)}
                >
                  <Text style={[styles.priorityText, selected && styles.priorityTextSelected]}>{p.label}</Text>
                </Pressable>
              );
            })}
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
                    // Clear the match whenever the text no longer reflects a
                    // confirmed catalog selection — it must come from picking
                    // a suggestion below, never be typed in directly (there's
                    // no way to order a product that isn't in the catalog).
                    updateItem(index, { productName: text, productId: null, unitPrice: null });
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
                      style={[styles.suggestionRow, styles.suggestionRowBetween]}
                      onPress={() => {
                        updateItem(index, {
                          productId: product.id,
                          productName: product.name,
                          description: product.description || item.description,
                          unitPrice: product.unitPrice ?? null,
                        });
                        setActiveProductIndex(null);
                        setProductResults([]);
                      }}
                    >
                      <Text style={styles.suggestionText}>{product.name}</Text>
                      {product.unitPrice != null && (
                        <Text style={styles.suggestionPrice}>
                          {CURRENCY}
                          {product.unitPrice.toLocaleString()}
                        </Text>
                      )}
                    </Pressable>
                  ))}
                </View>
              )}
              {!item.productId && !!item.productName && (
                <Text style={styles.itemWarning}>Pick a product from the list above</Text>
              )}

              <View style={styles.itemFieldsRow}>
                <TextInput
                  style={[styles.input, styles.plainInput, styles.qtyInput]}
                  placeholder="Qty (units)"
                  value={item.quantity}
                  onChangeText={(text) => updateItem(index, { quantity: text.replace(/[^0-9]/g, '') })}
                  keyboardType="number-pad"
                />
                <View style={[styles.priceDisplay, styles.qtyInput]}>
                  <Text style={item.unitPrice != null ? styles.priceDisplayValue : styles.priceDisplayEmpty}>
                    {item.unitPrice != null
                      ? `${CURRENCY}${item.unitPrice.toLocaleString()} / unit`
                      : 'Pick a product for price'}
                  </Text>
                </View>
              </View>
              <TextInput
                style={[styles.input, styles.plainInput, styles.notesFullInput]}
                placeholder="Specs / notes"
                value={item.description}
                onChangeText={(text) => updateItem(index, { description: text })}
              />

              {lineTotal(item) > 0 && (
                <Text style={styles.itemLineTotal}>
                  {item.quantity || 0} × {CURRENCY}
                  {item.unitPrice} = {CURRENCY}
                  {lineTotal(item).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </Text>
              )}
            </View>
          ))}

          <Pressable style={styles.addItemButton} onPress={() => setItems((prev) => [...prev, emptyItem()])}>
            <Ionicons name="add" size={16} color={colors.textMuted} />
            <Text style={styles.addItemText}>Add Another Product</Text>
          </Pressable>

          {orderTotal > 0 && (
            <View style={styles.totalCard}>
              <Text style={styles.totalCardLabel}>Total · {totalUnits} units</Text>
              <Text style={styles.totalCardValue}>
                {CURRENCY}
                {orderTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </Text>
            </View>
          )}

          <Text style={styles.label}>City</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="business-outline" size={16} color={colors.textMuted} />
            <TextInput
              style={styles.input}
              placeholder="City"
              value={city}
              onChangeText={setCity}
            />
          </View>

          <Text style={styles.label}>Delivery Address</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="location-outline" size={16} color={colors.textMuted} />
            <TextInput
              style={styles.input}
              placeholder="Site address..."
              value={address}
              onChangeText={(text) => {
                setAddress(text);
                setShowAddressSuggestions(true);
                setSelectedLocation(null);
              }}
              onFocus={() => setShowAddressSuggestions(true)}
            />
            {isGeocoding && <ActivityIndicator size="small" color={colors.textMuted} />}
          </View>
          {showAddressSuggestions && addressResults.length > 0 && (
            <View style={styles.suggestionsBox}>
              {addressResults.map((result, i) => (
                <Pressable
                  key={i}
                  style={styles.suggestionRow}
                  onPress={() => {
                    setAddress(result.displayName);
                    setSelectedLocation({ lat: result.latitude, lon: result.longitude });
                    if (result.city) setCity(result.city);
                    setShowAddressSuggestions(false);
                    setAddressResults([]);
                  }}
                >
                  <Text style={styles.suggestionText} numberOfLines={2}>
                    {result.displayName}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {selectedLocation && (
            <View style={styles.mapWrap}>
              <LeafletMapPreview latitude={selectedLocation.lat} longitude={selectedLocation.lon} />
            </View>
          )}

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>Create Order</Text>
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
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  ticketPlaceholder: { fontSize: 12, fontWeight: '700', color: colors.amber, marginTop: 4 },
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
  plainInput: {
    paddingHorizontal: 12,
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  suggestionsBox: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    marginTop: 4,
    overflow: 'hidden',
  },
  suggestionRow: { paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  suggestionRowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  suggestionText: { fontSize: 14, color: colors.text },
  suggestionPrice: { fontSize: 13, color: colors.amber, fontWeight: '600' },
  priorityRow: { flexDirection: 'row', gap: 8 },
  priorityPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  priorityPillSelected: { backgroundColor: colors.amberMuted, borderColor: colors.amber },
  priorityText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  priorityTextSelected: { color: colors.navy },
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
  itemFieldsRow: { flexDirection: 'row', gap: 8 },
  qtyInput: { flex: 1 },
  notesFullInput: { marginTop: 8 },
  priceDisplay: {
    justifyContent: 'center',
    backgroundColor: colors.grayMuted,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  priceDisplayValue: { fontSize: 14, color: colors.text, fontWeight: '600' },
  priceDisplayEmpty: { fontSize: 12, color: colors.textMuted },
  itemLineTotal: { fontSize: 12, fontWeight: '600', color: colors.textMuted, marginTop: 8, textAlign: 'right' },
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
  totalCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.navy,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 16,
  },
  totalCardLabel: { fontSize: 13, color: colors.navyMuted },
  totalCardValue: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  mapWrap: { marginTop: 10 },
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
