import { StyleSheet, View } from 'react-native';

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

export function DatePickerInput({ value, onChange, minimumDate, maximumDate }: Props) {
  const effectiveMinDate = minimumDate === null ? undefined : (minimumDate ?? new Date());
  const effectiveMaxDate = maximumDate ?? undefined;

  return (
    <View style={styles.wrap}>
      {/* eslint-disable-next-line react/no-unknown-property */}
      <input
        type="date"
        value={value}
        min={effectiveMinDate ? effectiveMinDate.toISOString().slice(0, 10) : undefined}
        max={effectiveMaxDate ? effectiveMaxDate.toISOString().slice(0, 10) : undefined}
        onChange={(e) => onChange(e.target.value)}
        style={{
          flex: 1,
          border: 'none',
          outline: 'none',
          background: 'transparent',
          fontSize: 14,
          color: colors.text,
          fontFamily: 'inherit',
          padding: '12px 0',
          width: '100%',
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
  },
});
