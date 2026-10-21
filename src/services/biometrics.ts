// Device unlock (fingerprint, face or the phone's own passcode) as a shortcut to the
// app lock. The PIN always remains the fallback; nothing biometric is stored by Rahmat.
import { toScript, type Script } from '../domain/script';

let module: Promise<typeof import('expo-local-authentication')> | undefined;
function auth() { return module ??= import('expo-local-authentication'); }

export async function biometricsAvailable(): Promise<boolean> {
  try {
    const local = await auth();
    return await local.hasHardwareAsync() && await local.isEnrolledAsync();
  } catch { return false; }
}

export async function unlockWithBiometrics(script: Script = 'latin'): Promise<boolean> {
  try {
    const local = await auth();
    const result = await local.authenticateAsync({
      promptMessage: toScript('Rahmatni ochish', script),
      cancelLabel: toScript('PIN kod', script),
      disableDeviceFallback: false,
    });
    return result.success;
  } catch { return false; }
}
