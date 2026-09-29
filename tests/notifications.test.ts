import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInThisContext } from 'node:vm';
import ts from 'typescript';
import * as schedule from '../src/domain/schedule';
import sunnah from '../src/data/sunnah.json';
import type { ReminderSettings } from '../src/domain/schedule';

type Request = {
  identifier: string;
  content: { title: string; body: string; sound?: string; data: Record<string, unknown> };
  trigger: { type: string; seconds?: number; hour?: number; minute?: number; weekday?: number; channelId?: string };
};
type Response = {
  actionIdentifier: string;
  notification: { date: number; request: { identifier: string; content: { data: Record<string, unknown> } } };
};
type Permission = { granted: boolean; canAskAgain: boolean; ios?: { status: number } };

const settings: ReminderSettings = {
  enabled: true, dayStart: 7, dayEnd: 21, sunnahPerDay: 3,
  times: ['08:00', '11:00', '14:00', '17:00', '20:00'],
};

/**
 * Execute the production service with only the OS boundary replaced.
 * This needs the existing TypeScript dev dependency, no native runtime or Jest.
 * A fresh instance per test also isolates the production mutation queue.
 */
function nativeHarness(platform: 'android' | 'ios' = 'android') {
  const state = {
    pending: [] as Request[],
    permission: { granted: false, canAskAgain: true } as Permission,
    permissionRequests: 0,
    scheduleCalls: 0,
    cancelCalls: 0,
    failAfter: Infinity,
    channels: [] as Array<{ id: string; options: Record<string, unknown> }>,
    lastResponse: null as Response | null,
    listener: undefined as ((response: Response) => void) | undefined,
    clearResponseCalls: 0,
  };
  const native = {
    setNotificationHandler() {},
    async setNotificationChannelAsync(id: string, options: Record<string, unknown>) { state.channels.push({ id, options }); },
    AndroidImportance: { DEFAULT: 3 },
    AndroidNotificationVisibility: { PRIVATE: 0 },
    IosAuthorizationStatus: { AUTHORIZED: 2, PROVISIONAL: 3, EPHEMERAL: 4 },
    SchedulableTriggerInputTypes: { DAILY: 'daily', WEEKLY: 'weekly', TIME_INTERVAL: 'timeInterval' },
    DEFAULT_ACTION_IDENTIFIER: 'open',
    async getPermissionsAsync() { return state.permission; },
    async requestPermissionsAsync() {
      state.permissionRequests += 1;
      state.permission = { granted: true, canAskAgain: true, ...(platform === 'ios' ? { ios: { status: 2 } } : {}) };
      return state.permission;
    },
    async cancelAllScheduledNotificationsAsync() { state.cancelCalls += 1; state.pending = []; },
    async getAllScheduledNotificationsAsync() { return state.pending; },
    async scheduleNotificationAsync(request: Request) {
      if (state.scheduleCalls++ >= state.failAfter) throw new Error('Native scheduling failed');
      state.pending = state.pending.filter((item) => item.identifier !== request.identifier);
      state.pending.push(request);
      return request.identifier;
    },
    addNotificationResponseReceivedListener(callback: (response: Response) => void) {
      state.listener = callback;
      return { remove() { state.listener = undefined; } };
    },
    getLastNotificationResponse() { return state.lastResponse; },
    clearLastNotificationResponse() { state.clearResponseCalls += 1; state.lastResponse = null; },
  };
  const sourcePath = resolve(__dirname, '../src/services/notifications.ts');
  const { outputText } = ts.transpileModule(readFileSync(sourcePath, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  });
  const module = { exports: {} };
  const load = (id: string) => {
    if (id === 'react-native') return { Platform: { OS: platform } };
    if (id === 'expo-notifications') return native;
    if (id === '../domain/schedule') return schedule;
    if (id === '../data/sunnah.json') return sunnah;
    throw new Error(`Unexpected service dependency: ${id}`);
  };
  const execute = runInThisContext(`(function(require, module, exports) { ${outputText}\n})`, { filename: sourcePath });
  execute(load, module, module.exports);
  return { state, api: module.exports as typeof import('../src/services/notifications') };
}

function response(screen: 'today' | 'istighfar', date = 100): Response {
  return {
    actionIdentifier: 'open',
    notification: { date, request: { identifier: `rahmah.${screen}`, content: { data: { app: 'rahmah', screen } } } },
  };
}

test('passive foreground sync never prompts; explicit enable creates a private channel and prompts', async () => {
  const { state, api } = nativeHarness();
  assert.deepEqual(await api.syncReminders(settings, true), { status: 'denied', scheduled: 0 });
  assert.equal(state.permissionRequests, 0);
  assert.equal(state.channels.length, 0);
  assert.deepEqual(await api.syncReminders(settings, true, true), { status: 'enabled', scheduled: 26 });
  assert.equal(state.permissionRequests, 1);
  assert.equal(state.pending.length, 26);
  assert.equal(state.channels[0]?.options.lockscreenVisibility, 0);
  assert.equal(state.channels[0]?.options.showBadge, false);
  assert.ok(state.pending.every((item) => item.trigger.channelId === 'rahmah-reminders'));
});

test('a permanent permission denial is returned without another prompt', async () => {
  const { state, api } = nativeHarness();
  state.permission.canAskAgain = false;
  assert.deepEqual(await api.syncReminders(settings, true, true), { status: 'denied', scheduled: 0 });
  assert.equal(state.permissionRequests, 0);
  assert.equal(state.pending.length, 0);
});

test('iOS provisional authorization is usable even when the root granted flag is false', async () => {
  const { state, api } = nativeHarness('ios');
  state.permission = { granted: false, canAskAgain: false, ios: { status: 3 } };
  assert.deepEqual(await api.syncReminders(settings, false), { status: 'enabled', scheduled: 21 });
  assert.equal(state.permissionRequests, 0);
  assert.equal(state.channels.length, 0);
});

test('same plan is idempotent and schedule metadata never includes reflections or counts', async () => {
  const { state, api } = nativeHarness();
  state.permission.granted = true;
  await api.syncReminders(settings, true);
  const before = state.scheduleCalls;
  await api.syncReminders(settings, true);
  assert.equal(state.scheduleCalls, before);
  assert.ok(state.pending.every((item) => Object.keys(item.content.data).sort().join(',') === 'app,scheduleKey,screen'));
  assert.equal(state.pending.filter((item) => item.trigger.type === 'daily').length, 5);
  assert.equal(state.pending.filter((item) => item.trigger.type === 'weekly').length, 21);
});

test('a queued disable wins over an earlier in-flight sync and clears every schedule', async () => {
  const { state, api } = nativeHarness();
  state.permission.granted = true;
  const enabling = api.syncReminders(settings, true);
  const disabling = api.syncReminders({ ...settings, enabled: false }, true);
  const results = await Promise.all([enabling, disabling]);
  assert.equal(results[1]?.status, 'disabled');
  assert.equal(state.pending.length, 0);
  assert.equal(state.permissionRequests, 0);
});

test('partial native failure cancels the partial plan, rejects, and permits a subsequent retry', async () => {
  const { state, api } = nativeHarness();
  state.permission.granted = true;
  state.failAfter = 3;
  await assert.rejects(api.syncReminders(settings, true), /Native scheduling failed/);
  assert.equal(state.pending.length, 0);
  state.failAfter = Infinity;
  assert.deepEqual(await api.syncReminders(settings, true), { status: 'enabled', scheduled: 26 });
  assert.equal(state.pending.length, 26);
});

test('the explicit test notification schedules a generic five-second reminder', async () => {
  const { state, api } = nativeHarness();
  assert.deepEqual(await api.sendTestNotification(), { status: 'enabled', scheduled: 1 });
  assert.equal(state.permissionRequests, 1);
  const item = state.pending[0];
  assert.equal(item?.identifier, 'rahmah.test');
  assert.equal(item?.trigger.type, 'timeInterval');
  assert.equal(item?.trigger.seconds, 5);
  assert.deepEqual(item?.content.data, { app: 'rahmah', screen: 'today' });
});

test('cold and warm notification opens route once, ignore unknown payloads, and unsubscribe', () => {
  const { state, api } = nativeHarness();
  const cold = response('istighfar');
  state.lastResponse = cold;
  const routes: string[] = [];
  const unsubscribe = api.subscribeToReminderOpen((screen) => routes.push(screen));
  assert.deepEqual(routes, ['istighfar']);
  assert.equal(state.clearResponseCalls, 1);
  assert.equal(state.lastResponse, null);
  assert.ok(state.listener);
  state.listener(cold);
  assert.deepEqual(routes, ['istighfar']);
  state.listener(response('today', 101));
  assert.deepEqual(routes, ['istighfar', 'today']);
  const unrelated = response('today', 102);
  unrelated.notification.request.content.data.app = 'another-app';
  state.listener(unrelated);
  assert.deepEqual(routes, ['istighfar', 'today']);
  unsubscribe();
  assert.equal(state.listener, undefined);
});
