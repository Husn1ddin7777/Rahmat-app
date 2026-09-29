import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as schedule from '../src/domain/schedule';
import type { ReminderSettings } from '../src/domain/schedule';

const settings: ReminderSettings = {
  enabled: true, dayStart: 7, dayEnd: 21, sunnahPerDay: 2,
  times: ['08:00', '11:00', '14:00', '17:00', '20:00'],
};

type FetchCall = { path: string; method: string; body?: Record<string, unknown>; headers: Record<string, string> };
function webHarness(memory = new Map<string, string>()) {
  let randomByte = 7;
  const state = {
    pwa: { ios: false, installed: true, supported: true, secure: true },
    permission: 'default' as NotificationPermission,
    requestedPermission: 'granted' as NotificationPermission,
    permissionCalls: 0,
    subscription: false,
    subscriptionCalls: 0,
    unsubscribeCalls: 0,
    unsubscribeResult: true,
    offline: false,
    statuses: new Map<string, number>(),
    diagnostic: { registered: true, pending: false, result: null } as Record<string, unknown>,
    calls: [] as FetchCall[],
    events: [] as string[],
    messageListener: undefined as undefined | ((event: { data: unknown }) => void),
    beforeFetch: undefined as undefined | ((path: string) => Promise<void>),
  };
  const subscription = {
    endpoint: 'https://push.example.test/public-endpoint',
    toJSON() { return { endpoint: this.endpoint, expirationTime: null, keys: { p256dh: 'public-key', auth: 'subscription-auth' } }; },
    async unsubscribe() {
      state.events.push('unsubscribe'); state.unsubscribeCalls += 1;
      if (state.unsubscribeResult) state.subscription = false;
      return state.unsubscribeResult;
    },
  };
  const registration = {
    pushManager: {
      async getSubscription() { return state.subscription ? subscription : null; },
      async subscribe(options: { userVisibleOnly: boolean; applicationServerKey: Uint8Array }) {
        assert.equal(options.userVisibleOnly, true);
        assert.equal(options.applicationServerKey.length, 65);
        state.events.push('subscribe'); state.subscriptionCalls += 1; state.subscription = true;
        return subscription;
      },
    },
  };
  const context = {
    URL, Promise, Error, Uint8Array, Intl, Date, AbortSignal,
    atob: (value: string) => Buffer.from(value, 'base64').toString('binary'),
    crypto: { getRandomValues(array: Uint8Array) { array.fill(randomByte++); return array; } },
    // Unref diagnostic timeout handles so this test does not wait twelve seconds after ready wins.
    setTimeout: (callback: () => void, milliseconds: number) => setTimeout(callback, milliseconds).unref(),
    clearTimeout,
    location: { href: 'https://rahmat.example.test/?screen=istighfar&quoteId=choose-gentleness' },
    localStorage: {
      getItem(key: string) { return memory.get(key) ?? null; },
      setItem(key: string, value: string) { memory.set(key, value); },
      removeItem(key: string) { memory.delete(key); },
    },
    Notification: {
      get permission() { return state.permission; },
      requestPermission() {
        state.events.push('permission'); state.permissionCalls += 1;
        state.permission = state.requestedPermission;
        return Promise.resolve(state.permission);
      },
    },
    navigator: { serviceWorker: {
      ready: Promise.resolve(registration),
      async getRegistration() { return registration; },
      addEventListener(_type: string, callback: typeof state.messageListener) { state.messageListener = callback; },
      removeEventListener() { state.messageListener = undefined; },
    } },
    async fetch(url: string, options: { method: string; body?: string; headers: Record<string, string> }) {
      const path = url.replace('/api/push/', '');
      state.events.push(`fetch:${options.method}:${path}`);
      state.calls.push({ path, method: options.method, body: options.body ? JSON.parse(options.body) : undefined, headers: options.headers });
      if (state.beforeFetch) await state.beforeFetch(path);
      if (state.offline) throw new Error('Network unavailable');
      const status = state.statuses.get(path) ?? 200;
      return { ok: status >= 200 && status < 300, status, async json() {
        return path === 'config' ? { publicKey: Buffer.alloc(65, 1).toString('base64url') } : path === 'status' ? state.diagnostic : { ok: true };
      } };
    },
  };
  const filename = resolve(__dirname, '../src/services/notifications.web.ts');
  const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const module = { exports: {} };
  const load = (id: string) => {
    if (id === '../domain/schedule') return schedule;
    if (id === './pwa.web') return {
      getPwaState: () => ({ ...state.pwa }),
      async preparePwa() { state.events.push('prepare'); },
    };
    throw new Error(`Unexpected web service dependency: ${id}`);
  };
  const execute = runInNewContext(`(function(require,module,exports){${outputText}\n})`, context, { filename });
  execute(load, module, module.exports);
  return { state, memory, api: module.exports as typeof import('../src/services/notifications.web') };
}

test('web permission is requested synchronously in the explicit enable call before queued work', async () => {
  const { state, api } = webHarness();
  state.pwa.ios = true;
  const result = api.syncReminders(settings, true, true);
  assert.equal(state.permissionCalls, 1, 'the user gesture must reach Notification.requestPermission before awaiting anything');
  assert.deepEqual(state.events, ['permission']);
  assert.equal((await result).status, 'enabled');
  assert.equal(state.subscriptionCalls, 1);
  assert.equal(state.events.indexOf('permission') < state.events.indexOf('prepare'), true);
});

test('passive sync never prompts and iOS installation or unsupported contexts return actionable states', async () => {
  const { state, api } = webHarness();
  assert.equal((await api.syncReminders(settings, true)).status, 'disabled');
  assert.equal(state.permissionCalls, 0);
  assert.equal(state.calls.length, 0);
  state.pwa.ios = true; state.pwa.installed = false;
  assert.equal((await api.syncReminders(settings, true, true)).status, 'install-required');
  assert.equal(state.permissionCalls, 0);
  state.pwa.ios = false; state.pwa.supported = false;
  assert.equal((await api.syncReminders(settings, true, true)).status, 'unavailable');
  state.pwa.supported = true; state.pwa.secure = false;
  assert.equal((await api.syncReminders(settings, true, true)).status, 'unavailable');
  assert.equal(state.permissionCalls, 0);
});

test('web registration sends public subscription/settings only and identical passive sync is idempotent', async () => {
  const { state, api } = webHarness();
  assert.equal((await api.syncReminders(settings, true, true)).scheduled, 7);
  const put = state.calls.find((call) => call.method === 'PUT')!;
  assert.deepEqual(Object.keys(put.body!).sort(), ['hasActiveReflections', 'settings', 'subscription', 'timeZone']);
  assert.deepEqual(Object.keys(put.body!.settings as object).sort(), ['dayEnd', 'dayStart', 'enabled', 'sunnahPerDay', 'times']);
  assert.match(put.headers.Authorization!, /^Bearer [a-f0-9]{64}$/);
  assert.equal(/label|note|counts|createdAt|reflections/.test(JSON.stringify(put.body)), false);
  const before = state.calls.length;
  await api.syncReminders(settings, true);
  assert.equal(state.calls.length, before);
  await api.syncReminders(settings, false);
  assert.equal(state.calls.length, before + 1);
  assert.equal(state.calls.at(-1)?.body?.hasActiveReflections, false);
});

test('offline disable unsubscribes locally before attempting server cleanup', async () => {
  const { state, memory, api } = webHarness();
  await api.syncReminders(settings, true, true);
  state.events.length = 0; state.offline = true;
  assert.equal((await api.syncReminders({ ...settings, enabled: false }, false, true)).status, 'disabled');
  assert.equal(state.subscription, false);
  assert.equal(state.unsubscribeCalls, 1);
  assert.deepEqual(state.events, ['unsubscribe', 'fetch:DELETE:subscription']);
  assert.equal(memory.get('rahmat.push.cleanup.v1'), '1');
  state.offline = false;
  await api.syncReminders({ ...settings, enabled: false }, false, true);
  assert.equal(memory.has('rahmat.push.cleanup.v1'), false);
});

test('failed local unsubscribe is an error rather than false disabled success', async () => {
  const { state, api } = webHarness();
  await api.syncReminders(settings, true, true);
  state.unsubscribeResult = false;
  await assert.rejects(api.syncReminders({ ...settings, enabled: false }, false, true), /o‘chirib bo‘lmadi/);
  assert.equal(state.subscription, true);
});

test('503 configuration, subscription and test responses never report successful reminders', async () => {
  for (const failingPath of ['config', 'subscription', 'test']) {
    const { state, api } = webHarness();
    if (failingPath === 'test') await api.syncReminders(settings, true, true);
    state.statuses.set(failingPath, 503);
    await assert.rejects(failingPath === 'test' ? api.sendTestNotification() : api.syncReminders(settings, true, true), /hali ulanmagan/);
    if (failingPath === 'config') assert.equal(state.subscriptionCalls, 0);
    state.statuses.delete(failingPath);
    assert.equal((await api.syncReminders(settings, true, true)).status, 'enabled');
  }
});

test('test diagnostics distinguish pending, provider acceptance and rejection without claiming phone delivery', async () => {
  const { state, api } = webHarness();
  await api.syncReminders(settings, true, true);
  state.diagnostic = { registered: true, pending: true, result: null };
  assert.match(await api.getTestNotificationStatus(), /hali yuborilmoqda/);
  state.diagnostic = { registered: true, pending: false, result: { outcome: 'sent' } };
  assert.match(await api.getTestNotificationStatus(), /xizmatiga topshirildi/);
  state.diagnostic = { registered: true, pending: false, result: { outcome: 'rejected', httpStatus: 403 } };
  assert.match(await api.getTestNotificationStatus(), /qabul qilmadi \(403\)/);
  assert.ok(state.calls.filter(call => call.path === 'status').every(call => call.method === 'GET' && call.headers.Authorization?.startsWith('Bearer ')));
  state.statuses.set('test', 429);
  await assert.rejects(api.sendTestNotification(), /bir daqiqa/);
});

test('queued disable wins over an enable waiting for its server response', async () => {
  const { state, api } = webHarness();
  let release!: () => void;
  let reached!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const started = new Promise<void>((resolve) => { reached = resolve; });
  state.beforeFetch = async (path) => { if (path === 'config') { reached(); await gate; } };
  const enabling = api.syncReminders(settings, true, true);
  await started;
  const disabling = api.syncReminders({ ...settings, enabled: false }, false, true);
  release();
  assert.equal((await enabling).status, 'disabled');
  assert.equal((await disabling).status, 'disabled');
  assert.equal(state.subscription, false);
  assert.equal(state.calls.at(-1)?.method, 'DELETE');
});

test('permission denial unsubscribes an existing endpoint and never asks during passive sync', async () => {
  const { state, api } = webHarness();
  await api.syncReminders(settings, true, true);
  state.permission = 'denied';
  const asks = state.permissionCalls;
  assert.equal((await api.syncReminders(settings, true)).status, 'denied');
  assert.equal(state.permissionCalls, asks);
  assert.equal(state.subscription, false);
});

test('passive sync restores a missing subscription after permission was already granted', async () => {
  const { state, api } = webHarness();
  state.permission = 'granted';
  const result = await api.syncReminders(settings, true);
  assert.equal(result.status, 'enabled');
  assert.equal(state.permissionCalls, 0);
  assert.equal(state.subscriptionCalls, 1);
  assert.equal(state.calls.at(-1)?.method, 'PUT');
});

test('subscription-change messages reconcile enabled settings and stay disabled after opt-out', async () => {
  const { state, api } = webHarness();
  const unsubscribe = api.subscribeToReminderOpen(() => {});
  await api.syncReminders(settings, true, true);
  state.subscription = false;
  state.messageListener?.({ data: { type: 'RAHMAT_PUSH_SUBSCRIPTION_CHANGED' } });
  // This queued read of the same plan also waits for message-triggered reconciliation.
  await api.syncReminders(settings, true);
  assert.equal(state.subscriptionCalls, 2);
  await api.syncReminders({ ...settings, enabled: false }, false, true);
  state.messageListener?.({ data: { type: 'RAHMAT_PUSH_SUBSCRIPTION_CHANGED' } });
  await assert.rejects(api.sendTestNotification(), /Avval/);
  assert.equal(state.subscriptionCalls, 2);
  assert.equal(state.subscription, false);
  unsubscribe();
});

test('web notification links route only to supported screens and unsubscribe their listener', () => {
  const { state, api } = webHarness();
  const routes: Array<[string, string | undefined]> = [];
  const unsubscribe = api.subscribeToReminderOpen((screen, quoteId) => routes.push([screen, quoteId]));
  assert.deepEqual(routes, [['istighfar', 'choose-gentleness']]);
  state.messageListener?.({ data: { type: 'RAHMAT_NOTIFICATION_OPEN', screen: 'today', quoteId: 'cheerful-face' } });
  state.messageListener?.({ data: { type: 'RAHMAT_NOTIFICATION_OPEN', screen: 'reflections' } });
  state.messageListener?.({ data: { type: 'UNKNOWN', screen: 'today' } });
  assert.deepEqual(routes, [['istighfar', 'choose-gentleness'], ['today', 'cheerful-face']]);
  unsubscribe();
  assert.equal(state.messageListener, undefined);
});


test('a stale window cannot recreate reminders after another window explicitly disables them', async () => {
  const shared = new Map<string, string>();
  const a = webHarness(shared); const b = webHarness(shared);
  await a.api.syncReminders(settings, true, true);
  b.state.permission = 'granted'; b.state.subscription = true;
  await b.api.syncReminders({ ...settings, enabled: false }, false, true);
  a.state.subscription = false;
  const subscriptions = a.state.subscriptionCalls;
  assert.equal((await a.api.syncReminders(settings, true)).status, 'disabled');
  assert.equal(a.state.subscriptionCalls, subscriptions);
  assert.equal(a.state.subscription, false);
});

test('passive stale OFF or old times cannot cancel or overwrite a newer explicit plan', async () => {
  const shared = new Map<string, string>();
  const a = webHarness(shared); const b = webHarness(shared);
  const newer = { ...settings, times: ['08:30', '11:30', '14:30', '17:30', '20:30'] };
  await b.api.syncReminders(newer, true, true);
  a.state.permission = 'granted'; a.state.subscription = true;
  assert.equal((await a.api.syncReminders({ ...settings, enabled: false }, false)).status, 'enabled');
  assert.equal(a.state.unsubscribeCalls, 0);
  assert.deepEqual(a.state.calls.at(-1)?.body?.settings, newer);
  await a.api.syncReminders(settings, true);
  assert.deepEqual(a.state.calls.at(-1)?.body?.settings, newer);
});
