import { istighfarPrompts, normalizeIstighfarSlots, normalizeReminderSettings, type NormalizedReminderSettings, type ReminderScreen, type ReminderSettings, type ReminderResult } from '../domain/schedule';
import type { Script } from '../domain/script';
import { getPwaState, preparePwa } from './pwa.web';
export type { ReminderScreen, ReminderSettings, ReminderResult } from '../domain/schedule';

const DEVICE_KEY = 'rahmat.push.device.v1';
const CLEANUP_KEY = 'rahmat.push.cleanup.v1';
const PREFERENCE_KEY = 'rahmat.push.preference.v1';
type Plan = { settings: NormalizedReminderSettings; istighfarSlots: number };
type SharedPreference = Plan & { version: 1; id: string };
let queue: Promise<unknown> = Promise.resolve();
let syncedKey = '';
let latestSettings: Plan | undefined;
function serialize<T>(work: () => Promise<T>): Promise<T> {
  // A supported origin-wide lock also orders operations from separate app windows.
  const locked = () => navigator.locks?.request ? navigator.locks.request('rahmat-push-operations', work) : work();
  const pending = queue.then(locked, locked);
  queue = pending.catch(() => undefined);
  return pending;
}
function randomToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
}
function sharedPreference(): SharedPreference | undefined {
  const raw = localStorage.getItem(PREFERENCE_KEY);
  if (raw === null) return undefined;
  try {
    const value = JSON.parse(raw) as Partial<SharedPreference> & { hasActiveReflections?: unknown };
    if (value.version !== 1 || typeof value.id !== 'string' || !/^[a-f0-9]{64}$/.test(value.id)
      || !value.settings || typeof value.settings.enabled !== 'boolean') throw new Error();
    // Records written before routines only stored whether any intention was active.
    const istighfarSlots = normalizeIstighfarSlots(value.istighfarSlots ?? value.hasActiveReflections);
    return { version: 1, id: value.id, settings: normalizeReminderSettings(value.settings), istighfarSlots };
  } catch { throw new Error('Saqlangan eslatma sozlamalarini o‘qib bo‘lmadi. Ilovani qayta oching.'); }
}
// The legacy flag keeps an older Rahmat window, still open in another tab, able to read the choice.
function writePreference(value: SharedPreference): void {
  localStorage.setItem(PREFERENCE_KEY, JSON.stringify({ ...value, hasActiveReflections: value.istighfarSlots > 0 }));
}
function preferenceChanged(stamp: string | null): boolean { return localStorage.getItem(PREFERENCE_KEY) !== stamp; }
function currentPlan(requested: Plan): Plan {
  const shared = sharedPreference();
  if (!shared) return requested;
  // Settings from a stale window cannot reverse an explicit choice in another window.
  // A matching current settings snapshot can still report that entries became active/inactive.
  if (shared.settings.enabled && requested.settings.enabled
    && JSON.stringify(shared.settings) === JSON.stringify(requested.settings)
    && shared.istighfarSlots !== requested.istighfarSlots) {
    writePreference({ ...shared, istighfarSlots: requested.istighfarSlots });
    return { settings: shared.settings, istighfarSlots: requested.istighfarSlots };
  }
  return { settings: shared.settings, istighfarSlots: shared.istighfarSlots };
}
function deviceToken(create = false): string | null {
  let token = localStorage.getItem(DEVICE_KEY);
  if (!token && create) {
    token = randomToken();
    localStorage.setItem(DEVICE_KEY, token);
  }
  return token;
}
async function api(path: string, method = 'GET', body?: unknown, token?: string | null): Promise<any> {
  const response = await fetch(`/api/push/${path}`, {
    method, cache: 'no-store', credentials: 'same-origin',
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(
    response.status === 429 ? 'Sinov uchun bir daqiqa kuting. Kuniga 5 tagacha sinov mumkin.' :
    response.status === 409 ? 'Avval bildirishnomalarni qayta yoqing.' :
    response.status === 503 ? 'Eslatma xizmati hali ulanmagan. Keyinroq qayta urinib ko‘ring.' :
    'Eslatma xizmati bilan bog‘lanib bo‘lmadi. Internetni tekshiring.');
  return result;
}
function applicationKey(value: string): Uint8Array<ArrayBuffer> {
  const raw = atob(value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '='));
  return Uint8Array.from(raw, char => char.charCodeAt(0));
}
async function registration(): Promise<ServiceWorkerRegistration> {
  await preparePwa();
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Ilovani yangilab, qayta urinib ko‘ring.')), 12000)),
  ]);
}
async function disable(stamp: string | null): Promise<ReminderResult | null> {
  syncedKey = '';
  const token = deviceToken();
  const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration('/') : undefined;
  const subscription = await reg?.pushManager?.getSubscription();
  if (preferenceChanged(stamp)) return null;
  // Stop delivery locally even when the server cannot be reached.
  if (subscription && !await subscription.unsubscribe()) throw new Error('Eslatmalarni o‘chirib bo‘lmadi. Qayta urinib ko‘ring.');
  if (preferenceChanged(stamp)) return null;
  if (token) {
    localStorage.setItem(CLEANUP_KEY, '1');
    try { await api('subscription', 'DELETE', undefined, token); localStorage.removeItem(CLEANUP_KEY); }
    catch { /* The invalid subscription is also removed by the server on 404/410. */ }
  }
  if (preferenceChanged(stamp)) return null;
  return { status: 'disabled', scheduled: 0 };
}
export function syncReminders(settings: ReminderSettings, istighfarSlots: number, requestPermission = false): Promise<ReminderResult> {
  let requested: Plan;
  try { requested = { settings: normalizeReminderSettings(settings), istighfarSlots: normalizeIstighfarSlots(istighfarSlots) }; }
  catch (error) { return Promise.reject(error); }
  latestSettings = requested;
  const state = getPwaState();
  if (settings.enabled && state.ios && !state.installed) return Promise.resolve({ status: 'install-required', scheduled: 0 });
  if (settings.enabled && (!state.supported || !state.secure)) return Promise.resolve({ status: 'unavailable', scheduled: 0 });
  // iOS requires this call directly in the user's click, before any awaited work.
  const permission = settings.enabled && requestPermission && Notification.permission === 'default' ? Notification.requestPermission() : undefined;
  // Avoid an unhandled rejection while earlier serialized network work is still finishing.
  void permission?.catch(() => undefined);
  let ownChoice: SharedPreference | undefined;
  let previousPreference: string | null = null;
  try {
    if (requestPermission) {
      previousPreference = localStorage.getItem(PREFERENCE_KEY);
      ownChoice = { version: 1, id: randomToken(), ...requested };
      // Persist an explicit opt-out before any awaited work, so old windows stop immediately.
      writePreference(ownChoice);
    }
  } catch (error) { return Promise.reject(error); }
  return serialize<ReminderResult>(async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const plan = currentPlan(requested);
      const stamp = localStorage.getItem(PREFERENCE_KEY);
      if (!plan.settings.enabled) {
        const stopped = await disable(stamp);
        if (stopped) return stopped;
        continue;
      }
      const allowed = permission && sharedPreference()?.id === ownChoice?.id ? await permission : (state.supported ? Notification.permission : 'default');
      if (preferenceChanged(stamp)) continue;
      if (allowed !== 'granted') {
        if (allowed === 'denied') {
          const stopped = await disable(stamp);
          if (!stopped) continue;
        }
        return { status: allowed === 'denied' ? 'denied' : 'disabled', scheduled: 0 };
      }
      const normalized = plan.settings;
      const reg = await registration();
      if (preferenceChanged(stamp)) continue;
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const token = deviceToken(true)!;
      let subscription = await reg.pushManager.getSubscription();
      if (preferenceChanged(stamp)) continue;
      if (!subscription) {
        const config = await api('config');
        if (preferenceChanged(stamp)) continue;
        if (typeof config.publicKey !== 'string' || !config.publicKey) throw new Error('Eslatma xizmati hali ulanmagan.');
        subscription = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationKey(config.publicKey) });
        if (preferenceChanged(stamp)) continue;
      }
      const key = JSON.stringify([normalized, plan.istighfarSlots, timeZone, new Date().toDateString(), subscription.endpoint]);
      if (key !== syncedKey || requestPermission || localStorage.getItem(CLEANUP_KEY)) {
        // normalizeReminderSettings explicitly selects the public settings fields; only a slot count, never an entry, is sent.
        await api('subscription', 'PUT', { subscription: subscription.toJSON(), settings: normalized, istighfarSlots: plan.istighfarSlots, timeZone }, token);
        if (preferenceChanged(stamp)) { syncedKey = ''; continue; }
        localStorage.removeItem(CLEANUP_KEY);
        syncedKey = key;
      }
      return { status: 'enabled', scheduled: istighfarPrompts(normalized, plan.istighfarSlots).length + normalized.sunnahPerDay + (normalized.eveningTime ? 1 : 0) };
    }
    throw new Error('Eslatma sozlamalari boshqa oynada o‘zgardi. Qayta urinib ko‘ring.');
  }).catch((error) => {
    // An unsuccessful enable cannot become a saved global opt-in. Never undo a newer choice.
    if (ownChoice?.settings.enabled && sharedPreference()?.id === ownChoice.id) {
      if (previousPreference === null) localStorage.removeItem(PREFERENCE_KEY);
      else localStorage.setItem(PREFERENCE_KEY, previousPreference);
    }
    throw error;
  });
}
/** The server words the test in the script saved with the device's settings. */
export function sendTestNotification(_script?: Script): Promise<ReminderResult> {
  return serialize(async () => {
    const state = getPwaState();
    if (state.ios && !state.installed) return { status: 'install-required', scheduled: 0 };
    if (!state.supported || !state.secure) return { status: 'unavailable', scheduled: 0 };
    if (sharedPreference()?.settings.enabled === false) throw new Error('Avval bildirishnomalarni yoqing.');
    if (Notification.permission !== 'granted') return { status: 'denied', scheduled: 0 };
    const token = deviceToken();
    const reg = await navigator.serviceWorker.getRegistration('/');
    if (!token || !await reg?.pushManager?.getSubscription()) throw new Error('Avval bildirishnomalarni yoqing.');
    await api('test', 'POST', undefined, token);
    return { status: 'enabled', scheduled: 1 };
  });
}
export async function getTestNotificationStatus(): Promise<string> {
  const state = getPwaState();
  if (state.ios && !state.installed) return 'Rahmatni bosh ekrandagi belgisidan oching.';
  if (!state.supported || Notification.permission !== 'granted') return 'Avval bildirishnomalarga ruxsat bering.';
  const token = deviceToken();
  if (!token) return 'Avval bildirishnomalarni yoqing.';
  const status = await api('status', 'GET', undefined, token);
  if (!status.registered) return 'Bildirishnoma ulanishi eskirgan. Bildirishnomalarni o‘chirib, qayta yoqing.';
  if (status.pending) return 'Sinov xabari hali yuborilmoqda. Birozdan so‘ng holatini yana tekshiring.';
  if (!status.result) return 'Hali sinov natijasi yo‘q. Sinov eslatmasini bosing.';
  if (status.result.outcome === 'sent') return 'Xabar bildirishnoma xizmatiga topshirildi. Telefonda ko‘rinmasa, Rahmat uchun bildirishnomalar va Focus rejimini tekshiring.';
  if (status.result.outcome === 'rejected') return `Bildirishnoma xizmati xabarni qabul qilmadi${Number.isInteger(status.result.httpStatus) ? ` (${status.result.httpStatus})` : ''}. Shu xabarni yordam uchun yuboring.`;
  if (status.result.failure === 'prepare') return 'Serverda eslatmani tayyorlashda xato yuz berdi. Shu xabarni yordam uchun yuboring.';
  if (status.result.failure === 'network') return 'Server bildirishnoma xizmatiga ulana olmadi. Birozdan so‘ng qayta sinang.';
  return 'Sinov xabarini yetkazib bo‘lmadi. Internetni tekshiring va bir daqiqadan so‘ng qayta sinang.';
}

export function subscribeToReminderOpen(listener: (tab: ReminderScreen, quoteId?: string) => void): () => void {
  function route(screen: unknown, quoteId?: unknown) {
    if (screen === 'today' || screen === 'istighfar' || screen === 'reflections') listener(screen, typeof quoteId === 'string' ? quoteId : undefined);
  }
  const parameters = new URL(location.href).searchParams;
  route(parameters.get('screen'), parameters.get('quoteId'));
  const onMessage = (event: MessageEvent) => {
    if (event.data?.type === 'RAHMAT_NOTIFICATION_OPEN') route(event.data.screen, event.data.quoteId);
    if (event.data?.type === 'RAHMAT_PUSH_SUBSCRIPTION_CHANGED' && latestSettings?.settings.enabled) {
      syncedKey = '';
      void syncReminders(latestSettings.settings, latestSettings.istighfarSlots).catch(() => { syncedKey = ''; });
    }
  };
  navigator.serviceWorker?.addEventListener('message', onMessage);
  return () => navigator.serviceWorker?.removeEventListener('message', onMessage);
}
