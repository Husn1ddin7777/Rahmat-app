import { xchacha20poly1305 } from '@noble/ciphers/chacha';
import { scryptAsync } from '@noble/hashes/scrypt';
import { localDateKey, validateState, type AppState } from './model';

/**
 * A backup is one JSON file: a readable header and the whole app state, sealed
 * with XChaCha20-Poly1305 under a key derived from the user's secret phrase by
 * scrypt (memory-hard, so guessing is expensive even with graphics cards).
 * Nothing leaves the phone unless the user shares the file themselves.
 */
export const BACKUP_VERSION = 1;
export const BACKUP_KDF = { N: 2 ** 13, r: 8, p: 1 } as const;
export const MIN_PASSPHRASE_LENGTH = 8;
export const MAX_PASSPHRASE_LENGTH = 200;
/** Thirty days of history fit in a few hundred kilobytes; anything far larger is not ours. */
export const MAX_BACKUP_CHARS = 4_000_000;

export type BackupEnvelope = {
  app: 'rahmat';
  kind: 'backup';
  version: number;
  createdAt: string;
  kdf: { name: 'scrypt'; N: number; r: number; p: number; salt: string };
  cipher: { name: 'xchacha20-poly1305'; nonce: string };
  data: string;
};

export type BackupErrorCode = 'format' | 'version' | 'passphrase' | 'content' | 'size';

export class BackupError extends Error {
  constructor(public readonly code: BackupErrorCode, message: string) {
    super(message);
    this.name = 'BackupError';
  }
}

export type BackupSummary = { createdAt: string; reflections: number; days: number; habits: number; lock: boolean };

// --- Small codecs that do not depend on TextEncoder/atob being present on every engine.

export function utf8Encode(text: string): Uint8Array {
  const bytes: number[] = [];
  for (const symbol of text) {
    const code = symbol.codePointAt(0)!;
    if (code < 0x80) bytes.push(code);
    else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 63));
    else if (code < 0x10000) bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
    else bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 63), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
  }
  return Uint8Array.from(bytes);
}

export function utf8Decode(bytes: Uint8Array): string {
  let text = '';
  let index = 0;
  const fail = () => { throw new BackupError('content', 'Zaxira ichidagi matn buzilgan.'); };
  const continuation = () => {
    const byte = bytes[index++];
    if (byte === undefined || (byte & 0xc0) !== 0x80) fail();
    return byte! & 63;
  };
  while (index < bytes.length) {
    const byte = bytes[index++]!;
    let code: number;
    if (byte < 0x80) code = byte;
    else if (byte >= 0xc2 && byte < 0xe0) code = ((byte & 31) << 6) | continuation();
    else if (byte >= 0xe0 && byte < 0xf0) { code = ((byte & 15) << 12) | (continuation() << 6) | continuation(); if (code < 0x800 || (code >= 0xd800 && code < 0xe000)) fail(); }
    else if (byte >= 0xf0 && byte < 0xf5) { code = ((byte & 7) << 18) | (continuation() << 12) | (continuation() << 6) | continuation(); if (code < 0x10000 || code > 0x10ffff) fail(); }
    else { fail(); code = 0; }
    text += String.fromCodePoint(code);
  }
  return text;
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function toBase64(bytes: Uint8Array): string {
  let out = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index]!, b = bytes[index + 1], c = bytes[index + 2];
    const triple = (a << 16) | ((b ?? 0) << 8) | (c ?? 0);
    out += ALPHABET[(triple >> 18) & 63]! + ALPHABET[(triple >> 12) & 63]!
      + (b === undefined ? '=' : ALPHABET[(triple >> 6) & 63]!) + (c === undefined ? '=' : ALPHABET[triple & 63]!);
  }
  return out;
}

export function fromBase64(text: string): Uint8Array {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(text)) {
    throw new BackupError('format', 'Zaxira fayli buzilgan.');
  }
  const padding = text.endsWith('==') ? 2 : text.endsWith('=') ? 1 : 0;
  const bytes = new Uint8Array(text.length / 4 * 3 - padding);
  let offset = 0;
  for (let index = 0; index < text.length; index += 4) {
    const values = [0, 1, 2, 3].map((step) => { const char = text[index + step]!; return char === '=' ? 0 : ALPHABET.indexOf(char); });
    const triple = (values[0]! << 18) | (values[1]! << 12) | (values[2]! << 6) | values[3]!;
    for (const shift of [16, 8, 0]) if (offset < bytes.length) bytes[offset++] = (triple >> shift) & 255;
  }
  return bytes;
}

// --- Backup format

function cleanPassphrase(passphrase: string): string {
  return passphrase.trim().normalize('NFC');
}

export function passphraseProblem(passphrase: string): string | null {
  const clean = cleanPassphrase(passphrase);
  if (clean.length < MIN_PASSPHRASE_LENGTH) return `Maxfiy so‘z kamida ${MIN_PASSPHRASE_LENGTH} ta belgidan iborat bo‘lsin.`;
  if (clean.length > MAX_PASSPHRASE_LENGTH) return 'Maxfiy so‘z juda uzun.';
  return null;
}

function associatedData(envelope: Pick<BackupEnvelope, 'version' | 'createdAt' | 'kdf'>): Uint8Array {
  const { N, r, p } = envelope.kdf;
  return utf8Encode(`rahmat-backup|${envelope.version}|${envelope.createdAt}|scrypt:${N}:${r}:${p}`);
}

async function deriveKey(passphrase: string, salt: Uint8Array, kdf: { N: number; r: number; p: number }): Promise<Uint8Array> {
  try {
    return await scryptAsync(utf8Encode(cleanPassphrase(passphrase)), salt, { N: kdf.N, r: kdf.r, p: kdf.p, dkLen: 32, maxmem: 64 * 1024 * 1024 });
  } catch {
    throw new BackupError('format', 'Zaxira fayli buzilgan.');
  }
}

export function backupFileName(now = new Date()): string {
  return `rahmat-zaxira-${localDateKey(now)}.json`;
}

export async function createBackup(
  state: AppState,
  passphrase: string,
  options: { randomBytes: (length: number) => Uint8Array; now?: Date; kdf?: { N: number; r: number; p: number } },
): Promise<string> {
  const problem = passphraseProblem(passphrase);
  if (problem) throw new BackupError('passphrase', problem);
  const kdf = options.kdf ?? BACKUP_KDF;
  const salt = options.randomBytes(16);
  const nonce = options.randomBytes(24);
  if (salt.length !== 16 || nonce.length !== 24) throw new Error('Tasodifiy sonlar manbai ishlamadi.');
  const createdAt = (options.now ?? new Date()).toISOString();
  const header = {
    app: 'rahmat' as const, kind: 'backup' as const, version: BACKUP_VERSION, createdAt,
    kdf: { name: 'scrypt' as const, N: kdf.N, r: kdf.r, p: kdf.p, salt: toBase64(salt) },
    cipher: { name: 'xchacha20-poly1305' as const, nonce: toBase64(nonce) },
  };
  // Re-validating first means a backup can always be restored by this version.
  const plaintext = utf8Encode(JSON.stringify({ state: validateState(state) }));
  const key = await deriveKey(passphrase, salt, kdf);
  const sealed = xchacha20poly1305(key, nonce, associatedData(header)).encrypt(plaintext);
  key.fill(0);
  const envelope: BackupEnvelope = { ...header, data: toBase64(sealed) };
  return `${JSON.stringify(envelope, null, 1)}\n`;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Checks the readable header only; the content needs the secret phrase. */
export function readBackupEnvelope(text: string): BackupEnvelope {
  if (typeof text !== 'string' || text.length > MAX_BACKUP_CHARS) throw new BackupError('size', 'Fayl juda katta — bu Rahmat zaxirasi emas.');
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new BackupError('format', 'Bu fayl Rahmat zaxirasi emas.'); }
  if (!record(value) || value.app !== 'rahmat' || value.kind !== 'backup') throw new BackupError('format', 'Bu fayl Rahmat zaxirasi emas.');
  if (value.version !== BACKUP_VERSION) {
    throw new BackupError('version', 'Bu zaxira Rahmatning boshqa versiyasida yaratilgan. Ilovani yangilab, qayta urinib ko‘ring.');
  }
  const { kdf, cipher } = value;
  const integer = (input: unknown, min: number, max: number) => typeof input === 'number' && Number.isInteger(input) && input >= min && input <= max;
  if (typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt)) || value.createdAt.length > 40
    // Bounded so a crafted file cannot make the phone allocate more than 32 MB.
    || !record(kdf) || kdf.name !== 'scrypt' || !integer(kdf.N, 1024, 32768) || ((kdf.N as number) & ((kdf.N as number) - 1)) !== 0
    || !integer(kdf.r, 1, 8) || kdf.p !== 1 || typeof kdf.salt !== 'string'
    || !record(cipher) || cipher.name !== 'xchacha20-poly1305' || typeof cipher.nonce !== 'string'
    || typeof value.data !== 'string') {
    throw new BackupError('format', 'Zaxira fayli buzilgan.');
  }
  if (fromBase64(kdf.salt).length !== 16 || fromBase64(cipher.nonce).length !== 24 || fromBase64(value.data).length < 17) {
    throw new BackupError('format', 'Zaxira fayli buzilgan.');
  }
  return value as BackupEnvelope;
}

export async function openBackup(text: string, passphrase: string): Promise<AppState> {
  const envelope = readBackupEnvelope(text);
  const key = await deriveKey(passphrase, fromBase64(envelope.kdf.salt), envelope.kdf);
  let plaintext: Uint8Array;
  try {
    plaintext = xchacha20poly1305(key, fromBase64(envelope.cipher.nonce), associatedData(envelope)).decrypt(fromBase64(envelope.data));
  } catch {
    throw new BackupError('passphrase', 'Maxfiy so‘z mos kelmadi yoki fayl o‘zgartirilgan.');
  } finally {
    key.fill(0);
  }
  let parsed: unknown;
  try { parsed = JSON.parse(utf8Decode(plaintext)); } catch { throw new BackupError('content', 'Zaxira ichidagi ma’lumotni o‘qib bo‘lmadi.'); }
  if (!record(parsed)) throw new BackupError('content', 'Zaxira ichidagi ma’lumotni o‘qib bo‘lmadi.');
  try {
    return validateState(parsed.state);
  } catch {
    throw new BackupError('content', 'Zaxiradagi ma’lumot formati bu versiyaga mos emas.');
  }
}

export function summarizeBackup(state: AppState, createdAt: string): BackupSummary {
  return {
    createdAt,
    reflections: state.reflections.length,
    days: Object.keys(state.days).length,
    habits: state.habits.length,
    lock: state.lock.mode !== 'off',
  };
}
