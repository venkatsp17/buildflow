import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { colors, radius } from '@/constants/theme';
import { buildLeafletHtml } from './leafletHtml';

type Props = { latitude: number; longitude: number };

export function LeafletMapPreview({ latitude, longitude }: Props) {
  return (
    <View style={styles.container}>
      <WebView
        style={styles.webview}
        originWhitelist={['*']}
        source={{ html: buildLeafletHtml(latitude, longitude) }}
        scrollEnabled={false}
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
  webview: { flex: 1 },
});
