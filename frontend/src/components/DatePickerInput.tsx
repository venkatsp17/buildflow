import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '@/constants/theme';

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  // Defaults to today, matching the original due-date-picking use case
  // (can't schedule delivery in the past). Pass null to allow any date —
  // e.g. filtering order history, which needs past dates.
  minimumDate?: Date | null;
  // No cap by default. Pass a Date (e.g. today) to disallow picking a
  // future date — e.g. a "from" filter that shouldn't start in the future.
  maximumDate?: Date | null;
};

function formatDisplay(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

export function DatePickerInput({ value, onChange, placeholder = 'Select date', minimumDate, maximumDate }: Props) {
  const [showPicker, setShowPicker] = useState(false);
  const effectiveMinDate = minimumDate === null ? undefined : (minimumDate ?? new Date());
  const effectiveMaxDate = maximumDate ?? undefined;

  return (
    <View style={styles.wrap}>
      <Pressable style={styles.trigger} onPress={() => setShowPicker(true)}>
        <Text style={[styles.text, !value && styles.placeholderText]}>
          {value ? formatDisplay(value) : placeholder}
        </Text>
        <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
      </Pressable>
      {showPicker && (
        <DateTimePicker
          value={value ? new Date(`${value}T00:00:00`) : new Date()}
          mode="date"
          display="default"
          minimumDate={effectiveMinDate}
          maximumDate={effectiveMaxDate}
          onChange={(_event, selectedDate) => {
            setShowPicker(false);
            if (selectedDate) {
              onChange(selectedDate.toISOString().slice(0, 10));
            }
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  text: { fontSize: 14, color: colors.text },
  placeholderText: { color: colors.textMuted },
});
