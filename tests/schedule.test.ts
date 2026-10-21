import test from 'node:test';
import assert from 'node:assert/strict';
import sunnah from '../src/data/sunnah.json';
import {
  buildReminderPlan,
  MAX_FASTING_REMINDERS,
  MAX_SCHEDULED_REMINDERS,
  normalizeReminderSettings,
  reminderPlanKey,
  timeToMinutes,
  type ReminderSettings,
  type SunnahReminder,
} from '../src/domain/schedule';

const settings: ReminderSettings = {
  enabled: true, dayStart: 7, dayEnd: 21, sunnahPerDay: 3,
  times: ['08:00', '11:00', '14:00', '17:00', '20:00'],
};
const content = sunnah.reminders as SunnahReminder[];
const day = new Date(2026, 8, 27, 12);

test('all active entries share five daily prompts and at most 26 calendar requests', () => {
  const plan = buildReminderPlan(settings, 5, content, day);
  const daily = plan.filter((item) => item.trigger.type === 'daily');
  assert.equal(daily.length, 5);
  assert.deepEqual(daily.map((item) => item.trigger.hour * 60 + item.trigger.minute), settings.times.map(timeToMinutes));
  assert.equal(plan.length, MAX_SCHEDULED_REMINDERS - 1 - MAX_FASTING_REMINDERS, 'without the optional evening and fasting prompts');
  assert.equal(new Set(plan.map((item) => item.identifier)).size, plan.length);
});

test('every weekday receives the requested number of distinct daylight reminders', () => {
  for (const sunnahPerDay of [1, 2, 3] as const) {
    for (let date = 1; date <= 31; date += 1) {
      const plan = buildReminderPlan({ ...settings, sunnahPerDay }, 5, content, new Date(2026, 0, date));
      assert.ok(plan.length <= MAX_SCHEDULED_REMINDERS);
      for (let weekday = 1; weekday <= 7; weekday += 1) {
        const items = plan.filter((item) => item.trigger.type === 'daily' || (item.trigger.type === 'weekly' && item.trigger.weekday === weekday));
        const minutes = items.map((item) => item.trigger.hour * 60 + item.trigger.minute);
        assert.equal(items.length, 5 + sunnahPerDay);
        assert.equal(new Set(minutes).size, minutes.length);
        assert.ok(minutes.every((minute) => minute >= 7 * 60 && minute < 21 * 60));
      }
    }
  }
});

test('a narrow valid waking window still has five unique slots and no collisions', () => {
  const narrow: ReminderSettings = { ...settings, dayStart: 10, dayEnd: 11, times: ['10:00', '10:01', '10:02', '10:03', '10:04'] };
  const plan = buildReminderPlan(narrow, 5, content, day);
  for (let weekday = 1; weekday <= 7; weekday += 1) {
    const minutes = plan.filter((item) => item.trigger.type === 'daily' || (item.trigger.type === 'weekly' && item.trigger.weekday === weekday))
      .map((item) => item.trigger.hour * 60 + item.trigger.minute);
    assert.equal(new Set(minutes).size, 8);
    assert.ok(minutes.every((minute) => minute >= 600 && minute < 660));
  }
});

test('plans remain stable that local day and change on a new day', () => {
  const first = buildReminderPlan(settings, 5, content, day);
  const later = new Date(2026, 8, 27, 23, 59);
  assert.deepEqual(first, buildReminderPlan(settings, 5, content, later));
  assert.equal(reminderPlanKey(first, day), reminderPlanKey(first, later));
  assert.notDeepEqual(first, buildReminderPlan(settings, 5, content, new Date(2026, 8, 28)));
});

test('disabling cancels the plan; no active entries removes only the istighfar prompts', () => {
  assert.deepEqual(buildReminderPlan({ ...settings, enabled: false }, 5, content, day), []);
  const plan = buildReminderPlan(settings, 0, content, day);
  assert.equal(plan.length, 21);
  assert.ok(plan.every((item) => item.screen === 'today' && item.trigger.type === 'weekly'));
});

test('invalid or duplicate times cannot silently become different scheduled times', () => {
  assert.throws(() => timeToMinutes('25:00'));
  assert.throws(() => timeToMinutes('08:60'));
  assert.throws(() => timeToMinutes('8:00'));
  assert.throws(() => normalizeReminderSettings({ ...settings, times: ['08:00'] }));
  assert.throws(() => normalizeReminderSettings({ ...settings, times: ['08:00', '08:00', '14:00', '17:00', '20:00'] }));
  assert.throws(() => normalizeReminderSettings({ ...settings, times: ['06:59', '11:00', '14:00', '17:00', '20:00'] }));
  assert.throws(() => normalizeReminderSettings({ ...settings, times: ['08:00', '11:00', '14:00', '17:00', '21:00'] }));
  assert.throws(() => normalizeReminderSettings({ ...settings, dayStart: 21, dayEnd: 7 }));
});

test('notification payloads contain only public Sunnah content and generic prompts', () => {
  const withPrivateExtras = { ...settings, reflectionNotes: 'SECRET_NOTE', reflectionCount: 987654 };
  const plan = buildReminderPlan(withPrivateExtras, 5, content, day);
  assert.ok(!JSON.stringify(plan).includes('SECRET_NOTE'));
  assert.ok(!JSON.stringify(plan).includes('987654'));
  const daily = plan.filter((item) => item.screen === 'istighfar');
  assert.equal(new Set(daily.map((item) => item.title + item.body)).size, 1);
  assert.ok(daily.every((item) => !/100|500|gunoh|qayd/i.test(item.title + item.body)));
  for (const item of plan.filter((item) => item.screen === 'today')) {
    assert.ok(content.some((source) => item.title === source.title && item.body === `${source.text}\n${source.source} · Mazmunan`));
  }
});

test('public content absence never creates an invalid weekly request', () => {
  assert.equal(buildReminderPlan(settings, 5, [], day).length, 5);
  assert.deepEqual(buildReminderPlan(settings, 0, [], day), []);
});

test('istighfar prompts follow the routine: a 2-session routine uses the first two chosen times', () => {
  const plan = buildReminderPlan(settings, 2, content, day);
  const istighfar = plan.filter((item) => item.screen === 'istighfar');
  assert.deepEqual(istighfar.map((item) => item.trigger.hour * 60 + item.trigger.minute), settings.times.slice(0, 2).map(timeToMinutes));
  assert.equal(plan.length, 2 + 21);
  assert.throws(() => buildReminderPlan(settings, 6, content, day));
  assert.throws(() => buildReminderPlan(settings, 1.5, content, day));
});

test('the optional evening Muhosaba prompt is generic, may fall after the daytime window and avoids Sunnah minutes', () => {
  const evening = { ...settings, eveningTime: '21:30' };
  const plan = buildReminderPlan(evening, 5, content, day);
  assert.equal(plan.length, MAX_SCHEDULED_REMINDERS - MAX_FASTING_REMINDERS);
  const prompt = plan.find((item) => item.screen === 'reflections')!;
  assert.deepEqual(prompt.trigger, { type: 'daily', hour: 21, minute: 30 });
  assert.equal(prompt.identifier, 'rahmah.evening');
  assert.ok(!/qayd|niyat:|gunoh/i.test(prompt.title + prompt.body));
  const atNoon = buildReminderPlan({ ...settings, eveningTime: '12:00' }, 0, content, day);
  for (let weekday = 1; weekday <= 7; weekday += 1) {
    const minutes = atNoon.filter((item) => item.trigger.type === 'daily' || (item.trigger.type === 'weekly' && item.trigger.weekday === weekday))
      .map((item) => item.trigger.hour * 60 + item.trigger.minute);
    assert.equal(new Set(minutes).size, minutes.length);
  }
  assert.throws(() => normalizeReminderSettings({ ...settings, eveningTime: '9:00' }));
  assert.equal(normalizeReminderSettings(settings).eveningTime, null);
});
