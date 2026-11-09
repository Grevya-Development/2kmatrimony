import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { api } from './api';
import { config } from './config';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: true }),
});

/**
 * Ask for permission, fetch the Expo push token and register the device with the
 * API. Returns the token, or null when unavailable (simulator, denied, no EAS project id).
 */
export async function registerForPush(): Promise<string | null> {
  if (!Device.isDevice) return null;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', { name: 'Default', importance: Notifications.AndroidImportance.DEFAULT, lightColor: '#7a2e3c' });
  }
  const existing = await Notifications.getPermissionsAsync();
  let granted = existing.granted;
  if (!granted && existing.canAskAgain) granted = (await Notifications.requestPermissionsAsync()).granted;
  if (!granted) return null;
  if (!config.easProjectId) {
    console.warn('[push] No EAS projectId configured — push registration skipped. See docs/MOBILE.md.');
    return null;
  }
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: config.easProjectId });
  await api.post('/devices', {
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
    deviceName: Device.deviceName ?? Device.modelName ?? null,
    pushToken: token,
    pushProvider: 'expo',
    appVersion: config.appVersion,
  });
  return token;
}
