import test from 'node:test';
import assert from 'node:assert/strict';
import { saveReminderSettings, LocalSettingsSaveError } from '../src/services/reminder-settings';
import type { ReminderResult, ReminderSettings } from '../src/domain/schedule';

const enabled: ReminderSettings = { enabled: true, dayStart: 7, dayEnd: 21, sunnahPerDay: 2, times: ['08:00', '11:00', '14:00', '17:00', '20:00'] };
const edited: ReminderSettings = { ...enabled, times: ['08:30', '11:30', '14:30', '17:30', '20:30'] };

function harness(sync: () => Promise<ReminderResult>, persistFails = false) {
  const saved: ReminderSettings[] = [];
  const order: string[] = [];
  return {
    saved, order,
    deps: {
      persist: async (settings: ReminderSettings) => { order.push('persist'); if (persistFails) throw new Error('disk'); saved.push(settings); },
      sync: (_settings: ReminderSettings, _active: boolean, requestPermission: boolean) => { order.push(`sync:${requestPermission}`); return sync(); },
    },
  };
}

test('a failed push request leaves the edited times saved and visible', async () => {
  const h = harness(() => Promise.reject(new Error('Eslatma serveriga ulanib bo‘lmadi. Internet aloqasini tekshiring.')));
  const outcome = await saveReminderSettings(edited, enabled, true, h.deps);
  assert.equal(outcome.synced, false);
  assert.deepEqual(outcome.settings, edited);
  assert.deepEqual(h.saved.at(-1), edited);
  assert.match(outcome.syncError!, /Internet/);
});

test('the sync (and iOS permission prompt) starts before any awaited local work', async () => {
  const h = harness(async () => ({ status: 'enabled', scheduled: 7 }));
  const pending = saveReminderSettings(edited, enabled, true, h.deps);
  assert.equal(h.order[0], 'sync:true');
  const outcome = await pending;
  assert.equal(outcome.synced, true);
  assert.deepEqual(h.saved.at(-1), edited);
});

test('a first enable is not stored as on until the service confirms it', async () => {
  const off = { ...enabled, enabled: false };
  const failing = harness(() => Promise.reject(new Error('offline')));
  const outcome = await saveReminderSettings(edited, off, true, failing.deps);
  assert.equal(outcome.settings.enabled, false);
  assert.deepEqual(outcome.settings.times, edited.times);

  const ok = harness(async () => ({ status: 'enabled', scheduled: 7 }));
  assert.equal((await saveReminderSettings(edited, off, true, ok.deps)).settings.enabled, true);
  assert.equal(ok.saved.at(-1)!.enabled, true);

  const denied = harness(async () => ({ status: 'denied', scheduled: 0 }));
  const result = await saveReminderSettings(edited, enabled, true, denied.deps);
  assert.equal(result.settings.enabled, false);
  assert.equal(denied.saved.at(-1)!.enabled, false);
});

test('a local storage failure is reported rather than claiming a save', async () => {
  const h = harness(async () => ({ status: 'enabled', scheduled: 7 }), true);
  await assert.rejects(saveReminderSettings(edited, enabled, true, h.deps), LocalSettingsSaveError);
});

test('invalid times are rejected before anything is saved or sent', async () => {
  const h = harness(async () => ({ status: 'enabled', scheduled: 7 }));
  await assert.rejects(saveReminderSettings({ ...enabled, times: ['8', '11:00', '14:00', '17:00', '20:00'] }, enabled, true, h.deps));
  assert.deepEqual(h.order, []);
});
