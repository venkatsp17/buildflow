import { StyleSheet, View } from 'react-native';

import { colors, radius } from '@/constants/theme';

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export function DatePickerInput({ value, onChange }: Props) {
  return (
    <View style={styles.wrap}>
      {/* eslint-disable-next-line react/no-unknown-property */}
      <input
        type="date"
        value={value}
        min={new Date().toISOString().slice(0, 10)}
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
