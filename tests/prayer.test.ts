import test from 'node:test';
import assert from 'node:assert/strict';
import sunnah from '../src/data/sunnah.json';
import prayer from '../src/data/prayer.json';
import {
  buildReminderPlan, istighfarPrompts, normalizeReminderSettings, PRAYER_NAMES, timeToMinutes,
  type ReminderSettings, type SunnahReminder,
} from '../src/domain/schedule';
import { createInitialState, StateValidationError, validateState } from '../src/domain/model';

const content = sunnah.reminders as SunnahReminder[];
const day = new Date(2026, 9, 22, 12);
const prayerSettings: ReminderSettings = {
  enabled: true, dayStart: 7, dayEnd: 21, sunnahPerDay: 3,
  times: ['08:00', '11:00', '14:00', '17:00', '20:00'],
  istighfarAnchor: 'prayer', prayerTimes: ['05:40', '13:20', '16:50', null, '20:45'],
};

test('after-prayer prompts use the prayers that have a time, in order, one per session', () => {
  const settings = normalizeReminderSettings(prayerSettings);
  assert.deepEqual(istighfarPrompts(settings, 5).map((prompt) => prompt.prayer), ['Bomdod', 'Peshin', 'Asr', 'Xufton']);
  assert.deepEqual(istighfarPrompts(settings, 2).map((prompt) => [prompt.index, prompt.minute]), [[0, 340], [1, 800]]);
  assert.deepEqual(istighfarPrompts(settings, 0), []);
  const plan = buildReminderPlan(prayerSettings, 3, content, day);
  const prompts = plan.filter((item) => item.screen === 'istighfar');
  assert.deepEqual(prompts.map((item) => item.title), ['Bomdod namozidan so‘ng', 'Peshin namozidan so‘ng', 'Asr namozidan so‘ng']);
  assert.deepEqual(prompts.map((item) => item.identifier), ['rahmah.istighfar.0', 'rahmah.istighfar.1', 'rahmah.istighfar.2']);
  assert.ok(prompts.every((item) => item.outsideWindow && item.trigger.type === 'daily'));
  assert.ok(prompts.every((item) => !/niyat|qayd/i.test(item.body)), 'generic wording');
});

test('Sunnah reminders keep away from prayer prompts and stay in the daytime window', () => {
  for (let date = 1; date <= 28; date += 1) {
    const plan = buildReminderPlan(prayerSettings, 4, content, new Date(2026, 1, date, 12));
    const prayerMinutes = plan.filter((item) => item.screen === 'istighfar').map((item) => item.trigger.hour * 60 + item.trigger.minute);
    for (const item of plan.filter((entry) => entry.trigger.type === 'weekly')) {
      const minute = item.trigger.hour * 60 + item.trigger.minute;
      assert.ok(minute >= 7 * 60 && minute < 21 * 60);
      assert.ok(prayerMinutes.every((used) => used !== minute));
    }
  }
});

test('prayer times are checked: at least one, valid, in prayer order; clock times then need not fit the window', () => {
  assert.throws(() => normalizeReminderSettings({ ...prayerSettings, prayerTimes: [null, null, null, null, null] }), /Kamida bitta/);
  assert.throws(() => normalizeReminderSettings({ ...prayerSettings, prayerTimes: ['13:20', '05:40', null, null, null] }), /tartib/);
  assert.throws(() => normalizeReminderSettings({ ...prayerSettings, prayerTimes: ['5:40', null, null, null, null] }));
  assert.throws(() => normalizeReminderSettings({ ...prayerSettings, prayerTimes: ['05:40', null] }));
  assert.throws(() => normalizeReminderSettings({ ...prayerSettings, istighfarAnchor: 'sunrise' as 'clock' }));
  const early = normalizeReminderSettings({ ...prayerSettings, dayStart: 9, times: ['06:00', '07:00', '08:00', '09:00', '10:00'] });
  assert.equal(early.istighfarAnchor, 'prayer');
  assert.throws(() => normalizeReminderSettings({ ...prayerSettings, istighfarAnchor: 'clock', dayStart: 9, times: ['06:00', '07:00', '08:00', '09:00', '10:00'] }));
  assert.deepEqual(normalizeReminderSettings({ ...prayerSettings, prayerTimes: ['', '13:20', null, null, null] }).prayerTimes, [null, '13:20', null, null, null]);
  assert.deepEqual(normalizeReminderSettings({ ...prayerSettings, istighfarAnchor: 'clock', prayerTimes: undefined }).prayerTimes, [null, null, null, null, null]);
});

test('a Cyrillic plan words every notification in Cyrillic, keeping hadith references', () => {
  const plan = buildReminderPlan({ ...prayerSettings, script: 'cyrillic', eveningTime: '21:30', fastingReminders: true }, 5, content, day);
  for (const item of plan) {
    const rest = `${item.title} ${item.body}`.replace(/\d+[a-z]\b/g, '');
    assert.ok(!/[A-Za-z]/.test(rest), rest);
  }
  assert.equal(plan.find((item) => item.screen === 'istighfar')!.title, 'Бомдод намозидан сўнг');
  const latin = buildReminderPlan(prayerSettings, 5, content, day);
  const cyrillic = buildReminderPlan({ ...prayerSettings, script: 'cyrillic' }, 5, content, day);
  assert.deepEqual(cyrillic.map((item) => [item.identifier, item.trigger, item.contentId]), latin.map((item) => [item.identifier, item.trigger, item.contentId]), 'switching script only re-words');
});

test('saved 1.1 data gains the new settings with safe defaults; invalid values are refused', () => {
  const state = createInitialState();
  const legacy = { ...state, settings: { enabled: false, dayStart: 7, dayEnd: 21, sunnahPerDay: 2, times: [...state.settings.times], eveningTime: null } };
  const upgraded = validateState(JSON.parse(JSON.stringify(legacy)));
  assert.deepEqual(upgraded.settings, state.settings);
  for (const change of [{ script: 'arabic' }, { hijriOffset: 5 }, { fastingReminders: 1 }, { istighfarAnchor: 'prayer' }, { prayerTimes: 'x' }]) {
    assert.throws(() => validateState({ ...state, settings: { ...state.settings, ...change } }), StateValidationError);
  }
});

test('the after-prayer note is a sourced paraphrase', () => {
  assert.equal(prayer.afterPrayer.source, 'Sahih Muslim 591');
  assert.equal(prayer.afterPrayer.url, 'https://sunnah.com/muslim:591');
  assert.ok(prayer.afterPrayer.text.includes('Rasululloh ﷺ'));
  assert.equal(prayer.afterPrayer.contentType, 'paraphrase');
  assert.ok(['pending', 'approved'].includes(prayer.scholarReview.status));
  assert.equal(PRAYER_NAMES.length, 5);
  assert.equal(timeToMinutes('05:40'), 340);
});
