import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { registerDevice, removeDevice, type RegisteredDevice } from '../api/preferences';

// Push registration for this device, kept in one module so providers never touch
// expo-notifications directly. Every failure inside it is swallowed on purpose: a device that
// cannot get a push token (permission denied, Expo Go on Android where remote push is
// unavailable since Expo SDK 53, no projectId configured yet, offline) must still use the app
// normally — it only loses push. EMAIL deliveries and the Settings toggles do not depend on any
// of this; they are server-side.

const ANDROID_CHANNEL_ID = 'swish';

export function pushCapable(): boolean {
  return Platform.OS !== 'web';
}

// Call once per app run. Only decides how pushes look while the app is OPEN (foreground):
// background pushes are always delivered by the OS. No-op on web.
export function configureForegroundPresentation(): void {
  if (!pushCapable()) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

// Android 13+ shows no permission prompt until at least one notification channel exists, so this
// must run before the token request on Android. iOS ignores it.
async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'Swish',
    importance: Notifications.AndroidImportance.HIGH,
  });
}

async function permissionGranted(): Promise<boolean> {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  const asked = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: true, allowSound: true },
  });
  return asked.granted;
}

// Real (EAS) builds require the project's UUID at token creation; `npx eas init` writes it to
// app.json `expo.extra.eas.projectId`, where expo-constants finds it. Until that lands we still
// attempt without it so an iOS Expo Go session can mint a token if its version allows it; the
// failure is caught and reported, never thrown.
function resolveProjectId(): string | undefined {
  const expoConfig = Constants.expoConfig as
    { extra?: { eas?: { projectId?: string } } } | null | undefined;
  return expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

async function fetchExpoPushToken(): Promise<string | null> {
  try {
    const projectId = resolveProjectId();
    const response = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : {});
    return response.data;
  } catch (error) {
    console.warn('[push] could not get an Expo push token:', error);
    return null;
  }
}

// The remembered row id OF the device row we created this state's registration, kept OUTSIDE
// React state because deregistration must work even when a provider has already unmounted (the
// sign-out path runs through AuthProvider while token cleanup is still pending).
let rememberedDeviceId: string | null = null;

// Truth about a successful registration, for the sign-out-deletes-the-row step. Passing null
// records "nothing registered" (permission denied, or the attempt failed silently for a reason
// that will come back on the next attempt).
export function rememberRegisteredDevice(device: RegisteredDevice | null): void {
  rememberedDeviceId = device ? device.id : null;
}

// Runs right before tokenStore is cleared on sign-out (AuthProvider.logout), so the device row
// is deleted while the access token still works. Extra safe: it is also invoked idempotently by
// the provider's cleanup for auth paths that skip the explicit logout flow.
export async function deregisterPushDevice(): Promise<void> {
  if (!pushCapable()) return;
  const deviceId = rememberedDeviceId;
  rememberedDeviceId = null;
  if (!deviceId) return;
  try {
    await removeDevice(deviceId);
  } catch (error) {
    // Tokens may already be gone if this runs after the explicit logout cleared them; the row
    // then stays registered until the same token is re-registered by the next sign-in
    // (POST /me/devices upserts by push token and reassigns ownership) or the backend stops
    // sending to it (Expo answers DeviceNotRegistered).
    console.warn('[push] could not delete the device row:', error);
  }
}

// Full silent chain: OS permission prompt (first sign-in only), Android channel, Expo push
// token, POST /me/devices. Returns the registered device, or null when push ran aground.
export async function attemptPushRegistration(): Promise<RegisteredDevice | null> {
  if (!pushCapable()) return null;
  try {
    await ensureAndroidChannel();
    if (!(await permissionGranted())) return null;
    const token = await fetchExpoPushToken();
    if (!token) return null;
    const device = await registerDevice({
      pushToken: token,
      platform: Platform.OS === 'ios' ? 'IOS' : 'ANDROID',
    });
    return device;
  } catch (error) {
    console.warn('[push] registration failed:', error);
    return null;
  }
}

// Tokens are rolled by the push services occasionally; expo-notifications emits an event when
// that happens on a running app. Re-register straight away so the backend always sends to the
// token this device can actually receive on. Returns an unsubscribe function.
export function listenPushNotificationResponses(
  onResponse: (data: Record<string, unknown>) => void,
): () => void {
  if (!pushCapable()) return () => undefined;
  // Basic deep-link handling: tapping a push opens the notification payload.
  // GAP (flagged, not invented): NotificationItem carries no orderId/saleId; deep-link
  // to a specific order or stream requires a backend schema extension (content needs
  // structured refs, not just title/body). This maps only by templateKey for now.
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const notification = response.notification;
    const payload = (notification.request?.content?.data ?? {}) as Record<string, unknown>;
    // Basic mapping: templateKey -> screen-level destination (no specific ID available).
    const templateKey = payload.templateKey ?? payload.key ?? '';
    console.log('[push] notification tapped:', templateKey, payload);
    onResponse(payload);
  });
  return () => subscription.remove();
}

export function listenPushTokenRolls(
  onToken: (device: RegisteredDevice | null) => void,
): () => void {
  if (!pushCapable()) return () => undefined;
  const subscription = Notifications.addPushTokenListener(() => {
    void attemptPushRegistration().then(onToken);
  });
  return () => subscription.remove();
}
