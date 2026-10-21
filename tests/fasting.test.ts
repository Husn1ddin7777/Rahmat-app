import test from 'node:test';
import assert from 'node:assert/strict';
import fasting from '../src/data/fasting.json';
import { addDays, FASTING_DAYS, fastingReminders, nearFastingDays, upcomingFastingDays } from '../src/domain/fasting';
import { hijriForDateKey, hijriToJdn, jdnToDateKey } from '../src/domain/hijri';
import { buildReminderPlan, MAX_FASTING_REMINDERS, normalizeReminderSettings, type ReminderSettings } from '../src/domain/schedule';

const settings: ReminderSettings = {
  enabled: true, dayStart: 7, dayEnd: 21, sunnahPerDay: 2,
  times: ['08:00', '11:00', '14:00', '17:00', '20:00'], fastingReminders: true,
};

test('marked days fall on the Hijri dates their sources name', () => {
  const events = upcomingFastingDays('2026-10-22', 0, 400);
  const byId = (id: string) => events.find((event) => event.day.id === id)!;
  assert.deepEqual(byId('arafah').hijri, { year: 1448, month: 12, day: 9 });
  assert.equal(byId('arafah').dateKey, jdnToDateKey(hijriToJdn(1448, 12, 9)));
  assert.deepEqual(byId('tasua').hijri, { year: 1449, month: 1, day: 9 });
  assert.deepEqual(byId('ashura').hijri, { year: 1449, month: 1, day: 10 });
  assert.equal(byId('shawwal').hijri.day, 2, 'Shawwal fasting starts after the day of Eid');
  assert.equal(byId('shaban').hijri.day, 1);
  assert.ok(!events.some((event) => event.day.when.type === 'weekly' || event.day.when.type === 'monthly'), 'general notes are not listed by date');
  for (let index = 1; index < events.length; index += 1) assert.ok(events[index - 1]!.dateKey <= events[index]!.dateKey);
});

test('a month already under way is shown as ongoing on the first day of the list', () => {
  const midMuharram = jdnToDateKey(hijriToJdn(1449, 1, 5));
  const [first] = upcomingFastingDays(midMuharram, 0, 3);
  assert.equal(first?.day.id, 'muharram');
  assert.equal(first?.ongoing, true);
  assert.equal(first?.dateKey, midMuharram);
});

test('the correction shifts every marked day by the same number of days', () => {
  for (const offset of [-2, -1, 1, 2]) {
    const base = upcomingFastingDays('2026-10-22', 0, 300).filter((event) => event.day.when.type === 'date');
    const shifted = upcomingFastingDays('2026-10-22', offset, 300).filter((event) => event.day.when.type === 'date');
    for (const event of shifted) {
      const original = base.find((item) => item.day.id === event.day.id && item.hijri.year === event.hijri.year);
      if (original) assert.equal(event.dateKey, addDays(original.dateKey, -offset), `${event.day.id} ${offset}`);
      assert.deepEqual(hijriForDateKey(event.dateKey, offset), event.hijri);
    }
  }
});

test('reminders come the evening before, only for days chosen for reminding, at most four ahead', () => {
  const reminders = fastingReminders('2026-10-22', 0);
  assert.equal(reminders.length, MAX_FASTING_REMINDERS);
  assert.deepEqual(reminders.map((item) => item.day.id), ['shawwal', 'arafah', 'tasua', 'ashura']);
  for (const reminder of reminders) {
    assert.equal(reminder.eveDateKey, addDays(reminder.eventDateKey, -1));
    assert.ok(reminder.day.remind && reminder.day.reminderTitle);
  }
  // On the eve itself the reminder is still due that evening.
  const eve = reminders[1]!.eveDateKey;
  assert.equal(fastingReminders(eve, 0, 400, 1)[0]?.eveDateKey, eve);
  assert.notEqual(fastingReminders(addDays(eve, 1), 0, 400, 1)[0]?.day.id, 'arafah');
});

test('the Today card appears on the day and the day before only', () => {
  const arafah = jdnToDateKey(hijriToJdn(1448, 12, 9));
  assert.deepEqual(nearFastingDays(addDays(arafah, -1)).map((event) => [event.day.id, event.tomorrow]), [['arafah', true]]);
  assert.deepEqual(nearFastingDays(arafah).map((event) => [event.day.id, event.tomorrow]), [['arafah', false]]);
  assert.deepEqual(nearFastingDays(addDays(arafah, 1)), []);
  assert.deepEqual(nearFastingDays('2026-10-22'), [], 'ordinary days stay quiet');
});

test('dated fasting reminders enter the plan only when chosen, worded generically with their source', () => {
  const now = new Date(2026, 9, 22, 12);
  const plan = buildReminderPlan(settings, 4, [], now);
  const dated = plan.filter((item) => item.trigger.type === 'date');
  assert.equal(dated.length, MAX_FASTING_REMINDERS);
  for (const item of dated) {
    assert.equal(item.screen, 'today');
    assert.equal(item.outsideWindow, true);
    assert.deepEqual([item.trigger.hour, item.trigger.minute], [20, 0]);
    assert.match(item.body, /Sahih (Muslim|al-Buxoriy).* · Mazmunan · Sana taxminiy$/);
  }
  assert.equal(buildReminderPlan({ ...settings, fastingReminders: false }, 4, [], now).filter((item) => item.trigger.type === 'date').length, 0);
  assert.equal(normalizeReminderSettings({ ...settings, fastingReminders: undefined }).fastingReminders, false);
});

test('fasting texts are sourced paraphrases from Sahih al-Bukhari or Sahih Muslim', () => {
  assert.ok(['pending', 'approved'].includes(fasting.scholarReview.status));
  assert.match(fasting.verifiedOn, /^\d{4}-\d{2}-\d{2}$/);
  const ids = new Set<string>();
  for (const day of FASTING_DAYS) {
    assert.ok(!ids.has(day.id)); ids.add(day.id);
    assert.equal(day.contentType, 'paraphrase');
    assert.ok(day.text.includes('Rasululloh ﷺ'), day.id);
    assert.ok(day.text.length <= 200, `${day.id} fits a notification`);
    const bukhari = /^Sahih al-Buxoriy, (\d+)$/.exec(day.source);
    const muslim = /^Sahih Muslim (\d+[a-z]?)$/.exec(day.source);
    assert.ok(bukhari ? day.url === `https://sunnah.com/bukhari:${bukhari[1]}` : muslim && day.url === `https://sunnah.com/muslim:${muslim[1]}`, day.id);
    for (const text of [day.title, day.text, day.reminderTitle ?? '']) {
      assert.ok(!/[A-Za-z]'[A-Za-z]/.test(text) && !/["“”]/.test(text), day.id);
    }
    if (day.remind) assert.equal(day.when.type, 'date', 'only dated days can be reminded the evening before');
  }
  assert.match(fasting.calendarNotice, /taxminiy/);
  assert.match(fasting.calendarNotice, /musulmonlari idorasi/);
});
