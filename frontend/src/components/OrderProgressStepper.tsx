import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';

const STEPS = [
  { key: 'created', label: 'Created' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'dispatched', label: 'Dispatch' },
  { key: 'delivered', label: 'Delivered' },
] as const;

function stepIndexForStatus(status: string): number {
  switch (status) {
    case 'pending':
      return 1;
    case 'approved':
      return 2;
    case 'in_progress':
      return 3;
    case 'dispatched':
      return 4;
    case 'delivered':
      return 5;
    default:
      return 1;
  }
}

function StepIcon({ stepKey, color, size = 16 }: { stepKey: string; color: string; size?: number }) {
  switch (stepKey) {
    case 'created':
      return <Text style={{ color, fontWeight: '700', fontSize: size }}>#</Text>;
    case 'pending':
      return <Ionicons name="time-outline" size={size} color={color} />;
    case 'approved':
      return <Ionicons name="checkmark-circle-outline" size={size} color={color} />;
    case 'in_progress':
      return <Ionicons name="play" size={size} color={color} />;
    case 'dispatched':
      return <Ionicons name="send-outline" size={size} color={color} />;
    case 'delivered':
      return <Ionicons name="checkmark" size={size} color={color} />;
    default:
      return null;
  }
}

export function OrderProgressStepper({ status, rejectionReason }: { status: string; rejectionReason?: string }) {
  if (status === 'cancelled') {
    return (
      <View style={styles.cancelledBanner}>
        <Ionicons name="close-circle" size={18} color={colors.red} />
        <Text style={styles.cancelledText}>This order was cancelled</Text>
      </View>
    );
  }

  if (status === 'rejected') {
    return (
      <View style={styles.cancelledBanner}>
        <Ionicons name="close-circle" size={18} color={colors.red} />
        <Text style={styles.cancelledText}>
          This order was rejected{rejectionReason ? ` — ${rejectionReason}` : ''}
        </Text>
      </View>
    );
  }

  const currentIndex = stepIndexForStatus(status);
  const progressPercent = (currentIndex / (STEPS.length - 1)) * 100;

  return (
    <View style={styles.container}>
      <View style={styles.lineBackground} />
      <View style={[styles.lineProgress, { width: `${progressPercent}%` }]} />
      <View style={styles.stepsRow}>
        {STEPS.map((step, index) => {
          const isFilled = index <= currentIndex;
          const isCurrent = index === currentIndex && status !== 'delivered';
          const color = isFilled ? colors.navy : colors.textMuted;

          return (
            <View key={step.key} style={styles.step}>
              <View style={[styles.circle, isFilled ? styles.circleFilled : styles.circleUpcoming, isCurrent && styles.circleCurrent]}>
                <StepIcon stepKey={step.key} color={color} />
              </View>
              <Text style={[styles.label, isFilled && styles.labelActive]}>{step.label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const CIRCLE_SIZE = 32;

const styles = StyleSheet.create({
  container: { paddingHorizontal: CIRCLE_SIZE / 2 },
  lineBackground: {
    position: 'absolute',
    top: CIRCLE_SIZE / 2 - 1,
    left: CIRCLE_SIZE / 2,
    right: CIRCLE_SIZE / 2,
    height: 2,
    backgroundColor: colors.border,
  },
  lineProgress: {
    position: 'absolute',
    top: CIRCLE_SIZE / 2 - 1,
    left: CIRCLE_SIZE / 2,
    height: 2,
    backgroundColor: colors.amber,
  },
  stepsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  step: { alignItems: 'center', width: CIRCLE_SIZE + 16 },
  circle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleFilled: { backgroundColor: colors.amber },
  circleUpcoming: { backgroundColor: colors.grayMuted },
  circleCurrent: { borderWidth: 2, borderColor: colors.navy },
  label: { fontSize: 11, color: colors.textMuted, marginTop: 6, textAlign: 'center' },
  labelActive: { color: colors.text, fontWeight: '600' },
  cancelledBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.redMuted,
    borderRadius: 12,
    padding: 12,
  },
  cancelledText: { color: colors.red, fontWeight: '600' },
});
