import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, radius } from '@/constants/theme';

export const REJECTION_REASONS = [
  'Insufficient stock',
  'Pricing discrepancy',
  'Invalid specifications',
  'Duplicate order',
  'Customer cancelled',
  'Other',
];

type Props = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  // When set, the modal collects a reason (predefined list + "Other" free
  // text) before it lets the user confirm — used for rejection, where a
  // reason is required and there's nowhere else to type one.
  requireReason?: boolean;
  isSubmitting?: boolean;
  onCancel: () => void;
  onConfirm: (reason?: string) => void;
};

// A custom overlay + sheet, not React Native's Modal component — RN's Modal
// has known sizing bugs on web (see NewOrderModal), so every modal in this
// app uses this same pattern instead.
export function StatusActionModal({
  visible,
  title,
  message,
  confirmLabel,
  danger,
  requireReason,
  isSubmitting,
  onCancel,
  onConfirm,
}: Props) {
  const [selectedReason, setSelectedReason] = useState(REJECTION_REASONS[0]);
  const [customReason, setCustomReason] = useState('');

  useEffect(() => {
    if (visible) {
      setSelectedReason(REJECTION_REASONS[0]);
      setCustomReason('');
    }
  }, [visible]);

  if (!visible) return null;

  const isOther = selectedReason === 'Other';
  const finalReason = isOther ? customReason.trim() : selectedReason;
  const canConfirm = !requireReason || finalReason.length > 0;

  return (
    <View style={styles.overlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={isSubmitting ? undefined : onCancel} />

      <View style={styles.sheet}>
        <View style={styles.dragHandle} />
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>

        {requireReason && (
          <View style={styles.reasonSection}>
            <Text style={styles.reasonLabel}>REASON</Text>
            {REJECTION_REASONS.map((reason) => {
              const selected = selectedReason === reason;
              return (
                <Pressable
                  key={reason}
                  style={[styles.reasonRow, selected && styles.reasonRowSelected]}
                  onPress={() => setSelectedReason(reason)}
                >
                  <View style={[styles.radio, selected && styles.radioSelected]}>
                    {selected && <View style={styles.radioDot} />}
                  </View>
                  <Text style={[styles.reasonText, selected && styles.reasonTextSelected]}>{reason}</Text>
                </Pressable>
              );
            })}
            {isOther && (
              <TextInput
                style={styles.customReasonInput}
                placeholder="Describe the reason..."
                placeholderTextColor={colors.textMuted}
                value={customReason}
                onChangeText={setCustomReason}
                multiline
              />
            )}
          </View>
        )}

        <View style={styles.buttonRow}>
          <Pressable style={styles.cancelButton} onPress={onCancel} disabled={isSubmitting}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
          <Pressable
            style={[
              styles.confirmButton,
              danger && styles.confirmButtonDanger,
              (!canConfirm || isSubmitting) && styles.confirmButtonDisabled,
            ]}
            onPress={() => onConfirm(requireReason ? finalReason : undefined)}
            disabled={!canConfirm || isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.confirmButtonText}>{confirmLabel}</Text>
            )}
          </Pressable>
        </View>
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
    padding: 20,
    maxHeight: '85%',
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  message: { fontSize: 14, color: colors.textMuted, marginTop: 6, lineHeight: 20 },
  reasonSection: { marginTop: 18 },
  reasonLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5, marginBottom: 8 },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 6,
  },
  reasonRowSelected: { borderColor: colors.navy, backgroundColor: colors.background },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: colors.navy },
  radioDot: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: colors.navy },
  reasonText: { fontSize: 14, color: colors.text },
  reasonTextSelected: { fontWeight: '600' },
  customReasonInput: {
    marginTop: 4,
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    fontSize: 14,
    color: colors.text,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  buttonRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: { color: colors.text, fontWeight: '600', fontSize: 15 },
  confirmButton: {
    flex: 1,
    backgroundColor: colors.navy,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonDanger: { backgroundColor: colors.red },
  confirmButtonDisabled: { opacity: 0.4 },
  confirmButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});
