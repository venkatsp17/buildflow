import { StyleSheet, View } from 'react-native';

import { colors, radius } from '@/constants/theme';
import { buildLeafletHtml } from './leafletHtml';

type Props = { latitude: number; longitude: number };

export function LeafletMapPreview({ latitude, longitude }: Props) {
  return (
    <View style={styles.container}>
      {/* eslint-disable-next-line react/no-unknown-property */}
      <iframe
        style={{ width: '100%', height: '100%', border: 0 }}
        srcDoc={buildLeafletHtml(latitude, longitude)}
        title="Delivery location map"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 160,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
});
