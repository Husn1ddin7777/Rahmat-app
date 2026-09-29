import { normalizeReminderSettings, type ReminderSettings } from '../src/domain/schedule';
import type { BrowserSubscription, Env, Registration } from './types';

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

export function json(value: unknown, status = 200, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...headers,
    },
  });
}

function object(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError(400, 'So‘rov shakli noto‘g‘ri.');
  }
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !keys.includes(key))) {
    throw new ApiError(400, 'So‘rovda ortiqcha ma’lumot bor.');
  }
  return record;
}

export function decodeBase64Url(value: unknown, expectedLength: number): Uint8Array<ArrayBuffer> {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+={0,2}$/.test(value) || value.length > 256) {
    throw new ApiError(400, 'Bildirishnoma kaliti noto‘g‘ri.');
  }
  try {
    const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    if (bytes.byteLength !== expectedLength) throw new Error();
    return bytes;
  } catch { throw new ApiError(400, 'Bildirishnoma kaliti noto‘g‘ri.'); }
}

/** Exact trusted push-service hosts only; redirects are separately forbidden. */
export function validateEndpoint(value: unknown): string {
  if (typeof value !== 'string' || value.length > 2048) {
    throw new ApiError(400, 'Bildirishnoma manzili noto‘g‘ri.');
  }
  let endpoint: URL;
  try { endpoint = new URL(value); } catch { throw new ApiError(400, 'Bildirishnoma manzili noto‘g‘ri.'); }
  const host = endpoint.hostname;
  const trusted = host === 'fcm.googleapis.com' || host === 'android.googleapis.com' ||
    /^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.push\.apple\.com$/.test(host) ||
    /^[a-z0-9-]+\.push\.services\.mozilla\.com$/.test(host);
  if (!trusted || endpoint.protocol !== 'https:' || endpoint.port || endpoint.username ||
      endpoint.password || endpoint.hash || endpoint.pathname === '/') {
    throw new ApiError(400, 'Bu bildirishnoma xizmati qo‘llab-quvvatlanmaydi.');
  }
  return endpoint.href;
}

export async function validateRegistration(input: unknown, now = Date.now()): Promise<Registration> {
  const value = object(input, ['subscription', 'settings', 'hasActiveReflections', 'timeZone']);
  const rawSubscription = object(value.subscription, ['endpoint', 'expirationTime', 'keys']);
  const rawKeys = object(rawSubscription.keys, ['p256dh', 'auth']);
  const publicKey = decodeBase64Url(rawKeys.p256dh, 65);
  decodeBase64Url(rawKeys.auth, 16);
  if (publicKey[0] !== 4) throw new ApiError(400, 'Bildirishnoma kaliti noto‘g‘ri.');
  try {
    await crypto.subtle.importKey('raw', publicKey, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  } catch { throw new ApiError(400, 'Bildirishnoma kaliti noto‘g‘ri.'); }
  const expirationTime = rawSubscription.expirationTime ?? null;
  if (expirationTime !== null && (typeof expirationTime !== 'number' ||
      !Number.isFinite(expirationTime) || expirationTime <= now)) {
    throw new ApiError(400, 'Bildirishnoma ruxsati eskirgan. Uni qayta yoqing.');
  }
  const subscription: BrowserSubscription = {
    endpoint: validateEndpoint(rawSubscription.endpoint),
    expirationTime: expirationTime as number | null,
    keys: { p256dh: rawKeys.p256dh as string, auth: rawKeys.auth as string },
  };
  const rawSettings = object(value.settings, ['enabled', 'dayStart', 'dayEnd', 'sunnahPerDay', 'times']);
  if (typeof rawSettings.enabled !== 'boolean' || !Array.isArray(rawSettings.times) ||
      !rawSettings.times.every((time) => typeof time === 'string') ||
      typeof value.hasActiveReflections !== 'boolean') {
    throw new ApiError(400, 'Eslatma sozlamalari noto‘g‘ri.');
  }
  let settings: ReminderSettings;
  try { settings = normalizeReminderSettings(rawSettings as ReminderSettings); }
  catch { throw new ApiError(400, 'Besh alohida vaqtni kunduzgi oraliqda belgilang.'); }
  if (typeof value.timeZone !== 'string' || value.timeZone.length > 100) {
    throw new ApiError(400, 'Vaqt mintaqasi noto‘g‘ri.');
  }
  let timeZone: string;
  try { timeZone = new Intl.DateTimeFormat('en', { timeZone: value.timeZone }).resolvedOptions().timeZone; }
  catch { throw new ApiError(400, 'Vaqt mintaqasi noto‘g‘ri.'); }
  return { subscription, settings, timeZone, hasActiveReflections: value.hasActiveReflections };
}

export async function readJson(request: Request): Promise<unknown> {
  if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) {
    throw new ApiError(415, 'JSON so‘rovi kerak.');
  }
  if (!request.body) throw new ApiError(400, 'So‘rov bo‘sh.');
  const reader = request.body.getReader();
  const parts: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    length += chunk.value.byteLength;
    if (length > 8192) {
      await reader.cancel();
      throw new ApiError(413, 'So‘rov juda katta.');
    }
    parts.push(chunk.value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new ApiError(400, 'JSON so‘rovi noto‘g‘ri.'); }
}

export async function deviceName(request: Request): Promise<string> {
  const match = /^Bearer ([A-Za-z0-9_-]{43,128})$/.exec(request.headers.get('Authorization') ?? '');
  if (!match?.[1]) throw new ApiError(401, 'Qurilma ruxsati kerak.');
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`rahmat-device-v1:${match[1]}`));
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function vapidConfiguration(env: Pick<Env, 'VAPID_PUBLIC_KEY' | 'VAPID_PRIVATE_KEY' | 'VAPID_SUBJECT'>) {
  try {
    const publicBytes = decodeBase64Url(env.VAPID_PUBLIC_KEY, 65);
    decodeBase64Url(env.VAPID_PRIVATE_KEY, 32);
    if (publicBytes[0] !== 4 || !env.VAPID_SUBJECT ||
        !/^(mailto:[^\s@]+@[^\s@]+\.[^\s@]+|https:\/\/[^\s]+)$/.test(env.VAPID_SUBJECT)) throw new Error();
    return { publicKey: env.VAPID_PUBLIC_KEY!, privateKey: env.VAPID_PRIVATE_KEY!, subject: env.VAPID_SUBJECT };
  } catch { throw new ApiError(503, 'Bildirishnoma xizmati hali sozlanmagan.'); }
}
