import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Show the alert/sound/badge while the app is foregrounded — otherwise a
// push that arrives while the user is already looking at the app would be
// silently swallowed.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Requests permission and returns this device's Expo push token, or null if
// permission was denied or (most likely during local dev) no EAS project is
// linked yet — getExpoPushTokenAsync requires one. Web isn't covered here:
// Expo's push service delivers to native devices via APNs/FCM; browser push
// needs a separate VAPID/service-worker setup this project doesn't have.
//
// iOS simulators are skipped — Apple's APNs has no simulator support, it's
// a hard OS limitation. Android emulators are NOT skipped: with a
// Google-Play-enabled system image they register real FCM tokens and
// receive real push, so gating them out the same way would just make the
// feature untestable without a physical device for no real benefit.
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  if (Platform.OS === 'ios' && !Device.isDevice) return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  try {
    const { data } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    return data;
  } catch {
    return null;
  }
}
