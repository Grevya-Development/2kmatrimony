import * as LocalAuthentication from 'expo-local-authentication';
import { securePrefs } from './secure-store';

const KEY = 'biometric_enabled';
export const LOCK_AFTER_MS = 5 * 60_000;

export async function biometricAvailable(): Promise<boolean> {
  const [hw, enrolled] = await Promise.all([LocalAuthentication.hasHardwareAsync(), LocalAuthentication.isEnrolledAsync()]);
  return hw && enrolled;
}

export async function isBiometricEnabled(): Promise<boolean> {
  return (await securePrefs.get(KEY)) === '1';
}

export async function authenticate(prompt = 'Unlock 2K Marriage'): Promise<boolean> {
  const r = await LocalAuthentication.authenticateAsync({ promptMessage: prompt, cancelLabel: 'Cancel', disableDeviceFallback: false });
  return r.success;
}

/** Enabling requires a successful biometric check first. */
export async function setBiometricEnabled(enabled: boolean): Promise<boolean> {
  if (enabled) {
    if (!(await biometricAvailable())) return false;
    if (!(await authenticate('Confirm to enable biometric unlock'))) return false;
    await securePrefs.set(KEY, '1');
    return true;
  }
  await securePrefs.remove(KEY);
  return true;
}
