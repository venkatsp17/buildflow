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

import {
  createOrder,
  getBillingConfig,
  searchCustomers,
  searchProducts,
  type Customer,
  type Order,
  type Product,
} from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { gstStates, previewLine, taxModeFor } from '@/utils/billing';
import { colors, radius } from '@/constants/theme';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { DatePickerInput } from './DatePickerInput';
import { LeafletMapPreview } from './LeafletMapPreview';

function displayCustomerCode(customer: Customer | null): string {
  if (!customer) return '';
  if (customer.customerCode) return customer.customerCode;

  const normalizedCity = customer.city.trim().toUpperCase();
  const prefix = normalizedCity === 'DUBAI'
    ? 'DXB'
    : normalizedCity === 'ABU DHABI'
      ? 'AUH'
      : normalizedCity === 'SHARJAH'
        ? 'SHJ'
        : (normalizedCity.replace(/[^A-Z]/g, '').slice(0, 3) || 'CUS');
  return `${prefix}-${String(customer.id).padStart(5, '0')}`;
}


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
  discountPercent: string;
  gstRate: number | null;
  taxCategory: string;
  hsnCode: string;
};

function emptyItem(): ItemDraft {
  return { productId: null, productName: '', quantity: '', unitPrice: null, description: '', discountPercent: '0', gstRate: null, taxCategory: '', hsnCode: '' };
}

const CURRENCY = '₹';


type Props = {
  visible: boolean;
  onClose: () => void;
  onCreated: (order: Order) => void;
};

export function NewOrderModal({ visible, onClose, onCreated }: Props) {
  const { token } = useAuth();

  const [clientName, setClientName] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);

  const [dueDate, setDueDate] = useState('');
  const [urgency, setUrgency] = useState<(typeof PRIORITIES)[number]['value']>('medium');
  const [items, setItems] = useState<ItemDraft[]>([emptyItem()]);

  const [activeProductIndex, setActiveProductIndex] = useState<number | null>(null);
  const [productResults, setProductResults] = useState<Product[]>([]);

  const [address, setAddress] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [city, setCity] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [billingConfig, setBillingConfig] = useState<{ supplierGstin: string; supplierStateCode: string } | null>(null);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [placeOfSupplyCode, setPlaceOfSupplyCode] = useState('');
  const [showStates, setShowStates] = useState(false);

  useEffect(() => {
    if (!visible || !token) return;
    let cancelled = false;
    setBillingConfig(null);
    setBillingError(null);
    getBillingConfig(token).then(config => {
      if (!cancelled) setBillingConfig(config);
    }).catch(err => {
      if (!cancelled) setBillingError(err instanceof Error ? err.message : 'Unable to load GST settings');
    });
    return () => { cancelled = true; };
  }, [visible, token]);

  const debouncedClientName = useDebouncedValue(clientName, 300);
  const activeProductQuery = activeProductIndex !== null ? items[activeProductIndex]?.productName ?? '' : '';
  const debouncedProductQuery = useDebouncedValue(activeProductQuery, 300);

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

  const taxMode = taxModeFor(billingConfig?.supplierStateCode ?? '', placeOfSupplyCode);
  const previews = items.map(item => previewLine(item.quantity, item.unitPrice, item.discountPercent, item.gstRate, taxMode));
  const hasValidItems = items.length > 0 && items.length <= 100 && items.every((item, index) =>
    !!item.productId && !!previews[index] && !!item.taxCategory && (item.taxCategory !== 'taxable' || !!item.hsnCode));
  const canSubmit = !!selectedCustomer && !!address.trim() && !!dueDate && !!city.trim() && hasValidItems && !isSubmitting;
  const sumAmount = (field: keyof NonNullable<typeof previews[number]>) =>
    previews.reduce((sum, item) => sum + Math.round((item?.[field] ?? 0) * 100), 0) / 100;
  const orderTotal = sumAmount('lineTotal');
  const totalUnits = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

  const resetForm = () => {
    setClientName('');
    setSelectedCustomer(null);
    setCustomerResults([]);
    setDueDate('');
    setUrgency('medium');
    setItems([emptyItem()]);
    setActiveProductIndex(null);
    setProductResults([]);
    setAddress('');
    setSelectedLocation(null);
    setCity('');
    setError(null);
    setPlaceOfSupplyCode('');
    setShowStates(false);
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
    if (!token || !dueDate || !canSubmit) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const { order } = await createOrder(token, {
        clientName: clientName.trim(),
        city: city.trim(),
        address: address.trim() || undefined,
        latitude: selectedLocation?.lat,
        longitude: selectedLocation?.lon,
        placeOfSupplyCode,
        urgency,
        dueDate,
        items: items
          .filter((item) => item.productId && Number(item.quantity) > 0)
          .map((item) => ({
            productId: item.productId as number,
            description: item.description.trim() || undefined,
            quantity: Number(item.quantity),
            discountPercent: Number(item.discountPercent || 0),
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
    <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />

      <View style={[styles.sheet, { maxHeight: '92%' }]}>
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
                setSelectedCustomer(null);
                setAddress('');
                setCity('');
                setSelectedLocation(null);
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
                    setSelectedCustomer(customer);
                    setAddress(customer.address || '');
                    setCity(customer.city || '');
                    setSelectedLocation(
                      customer.latitude != null && customer.longitude != null
                        ? { lat: customer.latitude, lon: customer.longitude }
                        : null,
                    );
                    setShowCustomerSuggestions(false);
                    setCustomerResults([]);
                  }}
                >
                  <View style={styles.customerSuggestionContent}>
                    <Text style={styles.suggestionText}>{customer.name}</Text>
                    <Text style={styles.customerAddress} numberOfLines={2}>
                      {customer.address || 'No saved address'}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}

          <Text style={styles.label}>Customer ID</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="id-card-outline" size={16} color={colors.textMuted} />
            <TextInput
              style={[styles.input, styles.readOnlyInput]}
              placeholder="Select a customer to fill Customer ID"
              value={displayCustomerCode(selectedCustomer)}
              editable={false}
            />
          </View>

          <Text style={styles.label}>GST No</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="document-text-outline" size={16} color={colors.textMuted} />
            <TextInput
              style={[styles.input, styles.readOnlyInput]}
              placeholder={selectedCustomer ? 'No GST number saved' : 'Select a customer to fill GST No'}
              value={selectedCustomer?.gstNo ?? ''}
              editable={false}
            />
          </View>

          <Text style={styles.label}>Place of Supply</Text>
          <Pressable style={styles.inputWrap} onPress={() => setShowStates(value => !value)}>
            <Text style={styles.input}>{gstStates.find(([code]) => code === placeOfSupplyCode)?.[1] ?? 'Select delivery state / union territory'}</Text>
            <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
          </Pressable>
          {showStates && <View style={styles.suggestionsBox}>
            {gstStates.map(([code, name]) => <Pressable key={code} style={styles.suggestionRow} onPress={() => {
              setPlaceOfSupplyCode(code);
              setShowStates(false);
            }}><Text style={styles.suggestionText}>{name} ({code})</Text></Pressable>)}
          </View>}
          {billingConfig && <Text style={styles.customerAddress}>Supplier GSTIN {billingConfig.supplierGstin}</Text>}
          {billingError && <Text style={styles.error}>{billingError}</Text>}

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
                    updateItem(index, { productName: text, productId: null, unitPrice: null, gstRate: null, taxCategory: '', hsnCode: '' });
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
                          gstRate: product.gstRate,
                          taxCategory: product.taxCategory,
                          hsnCode: product.hsnCode,
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
                      ? `${CURRENCY}${item.unitPrice.toLocaleString()} / unit before GST`
                      : 'Pick a product for price'}
                  </Text>
                </View>
              </View>
              <Text style={styles.itemLabel}>Discount (%)</Text>
              <TextInput
                style={[styles.input, styles.plainInput]}
                accessibilityLabel={`Discount percentage for item ${index + 1}`}
                placeholder="0"
                value={item.discountPercent}
                onChangeText={text => {
                  if (/^\d*(\.\d{0,4})?$/.test(text)) updateItem(index, { discountPercent: text });
                }}
                keyboardType="decimal-pad"
              />
              {Number(item.discountPercent) > 100 && <Text style={styles.itemWarning}>Discount must be 0–100%</Text>}
              {!!item.productId && (item.unitPrice == null || item.gstRate == null || !item.taxCategory ||
                (item.taxCategory === 'taxable' && !item.hsnCode)) &&
                <Text style={styles.itemWarning}>This product needs a price and GST configuration before ordering.</Text>}
              <TextInput
                style={[styles.input, styles.plainInput, styles.notesFullInput]}
                placeholder="Specs / notes"
                value={item.description}
                onChangeText={(text) => updateItem(index, { description: text })}
              />

              {previews[index] && <View>
                <Text style={styles.itemLineTotal}>Before GST {CURRENCY}{previews[index]!.grossAmount.toFixed(2)}</Text>
                <Text style={styles.itemLineTotal}>Discount {CURRENCY}{previews[index]!.discountAmount.toFixed(2)} · Taxable {CURRENCY}{previews[index]!.taxableAmount.toFixed(2)}</Text>
                <Text style={styles.itemLineTotal}>
                  {taxMode === 'igst' ? `IGST ${item.gstRate}%: ${CURRENCY}${previews[index]!.igstAmount.toFixed(2)}` :
                    `CGST ${(item.gstRate ?? 0) / 2}%: ${CURRENCY}${previews[index]!.cgstAmount.toFixed(2)} · ${taxMode === 'cgst_utgst' ? 'UTGST' : 'SGST'} ${(item.gstRate ?? 0) / 2}%: ${CURRENCY}${(previews[index]!.sgstAmount + previews[index]!.utgstAmount).toFixed(2)}`}
                </Text>
                <Text style={styles.itemLineTotal}>Line total {CURRENCY}{previews[index]!.lineTotal.toFixed(2)}</Text>
              </View>}

            </View>
          ))}

          <Pressable style={styles.addItemButton} onPress={() => setItems((prev) => [...prev, emptyItem()])}>
            <Ionicons name="add" size={16} color={colors.textMuted} />
            <Text style={styles.addItemText}>Add Another Product</Text>
          </Pressable>

          {hasValidItems && <View>
            <Text style={styles.itemLineTotal}>Subtotal {CURRENCY}{sumAmount('grossAmount').toFixed(2)}</Text>
            <Text style={styles.itemLineTotal}>Discount {CURRENCY}{sumAmount('discountAmount').toFixed(2)}</Text>
            <Text style={styles.itemLineTotal}>Taxable {CURRENCY}{sumAmount('taxableAmount').toFixed(2)}</Text>
            <Text style={styles.itemLineTotal}>GST {CURRENCY}{(sumAmount('cgstAmount') + sumAmount('sgstAmount') + sumAmount('utgstAmount') + sumAmount('igstAmount')).toFixed(2)}</Text>
          </View>}
          {hasValidItems && (
            <View style={styles.totalCard}>
              <Text style={styles.totalCardLabel}>Total · {totalUnits} units</Text>
              <Text style={styles.totalCardValue}>
                {CURRENCY}
                {orderTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </Text>
            </View>
          )}

          <Text style={styles.label}>Delivery Address</Text>
          <View style={[styles.inputWrap, styles.multilineInputWrap]}>
            <Ionicons name="location-outline" size={16} color={colors.textMuted} style={styles.multilineInputIcon} />
            <TextInput
              style={[styles.input, styles.readOnlyInput, styles.multilineAddressInput]}
              placeholder={selectedCustomer ? 'No saved address' : 'Select a customer to fill the address'}
              value={address}
              editable={false}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

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
  customerSuggestionContent: { flex: 1, gap: 3 },
  customerAddress: { fontSize: 12, color: colors.textMuted, lineHeight: 16 },
  readOnlyInput: { color: colors.textMuted },
  multilineInputWrap: { alignItems: 'flex-start' },
  multilineInputIcon: { marginTop: 13 },
  multilineAddressInput: { minHeight: 72, lineHeight: 20 },
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
