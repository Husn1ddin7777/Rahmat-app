import { pbkdf2 } from '@noble/hashes/pbkdf2';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import type { LockMode, LockSettings, PinRecord } from './model';

/**
 * The app lock is a privacy screen for shared phones, not encryption. On the phone
 * the whole state already lives in OS-encrypted SecureStore; the browser version
 * stores it unencrypted in IndexedDB. The PIN is never stored or sent as written.
 * About 0.2 s per check on an interpreter without JIT, which approximates Hermes.
 */
export const PIN_ITERATIONS = 1200;
export const MAX_ATTEMPTS_BEFORE_PAUSE = 5;

export function validPin(pin: string): boolean {
  return /^\d{4,6}$/.test(pin);
}

/** Uniqueness is all a salt needs here; it is not a secret. */
export function newSalt(random: () => number = Math.random): string {
  return Array.from({ length: 16 }, () => Math.floor(random() * 256).toString(16).padStart(2, '0')).join('');
}

function derive(pin: string, salt: string, iterations: number): string {
  return bytesToHex(pbkdf2(sha256, `rahmat-pin-v1:${pin}`, salt, { c: iterations, dkLen: 32 }));
}

export function createPinRecord(pin: string, salt = newSalt(), iterations = PIN_ITERATIONS): PinRecord {
  if (!validPin(pin)) throw new Error('PIN kod 4–6 ta raqamdan iborat bo‘lishi kerak.');
  return { salt, hash: derive(pin, salt, iterations), iterations, length: pin.length };
}

export function verifyPin(pin: string, record: PinRecord): boolean {
  if (!validPin(pin) || pin.length !== record.length) return false;
  const candidate = derive(pin, record.salt, record.iterations);
  // Compare every character so timing does not reveal how much matched.
  let difference = candidate.length ^ record.hash.length;
  for (let index = 0; index < candidate.length; index += 1) {
    difference |= candidate.charCodeAt(index) ^ (record.hash.charCodeAt(index) || 0);
  }
  return difference === 0;
}

/** Seconds to wait after repeated wrong PINs: 30 s, then doubling, at most 10 minutes. */
export function pauseAfterFailures(failures: number): number {
  if (failures < MAX_ATTEMPTS_BEFORE_PAUSE) return 0;
  const step = failures - MAX_ATTEMPTS_BEFORE_PAUSE;
  return Math.min(600, 30 * 2 ** step);
}

export function lockWith(mode: LockMode, pin: PinRecord | null, biometrics: boolean): LockSettings {
  if (mode !== 'off' && !pin) throw new Error('Qulfni yoqish uchun avval PIN kod o‘rnating.');
  return { mode, pin: mode === 'off' ? null : pin, biometrics: mode === 'off' ? false : biometrics };
}
