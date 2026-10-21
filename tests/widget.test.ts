import test from 'node:test';
import assert from 'node:assert/strict';
import { addCustomHabit, createInitialState, createReflection, incrementCount, toggleHabit } from '../src/domain/model';
import { createPinRecord, lockWith } from '../src/domain/lock';
import { parseWidgetSnapshot, widgetSnapshot, widgetView } from '../src/domain/widget';

const thursday = '2026-10-22';

function sample() {
  let state = createReflection(createInitialState(), { label: 'Juda shaxsiy niyat', note: 'maxfiy izoh', sessions: 2, target: 33 })!.state;
  state = incrementCount(state, state.reflections[0]!.id, 0, 20, thursday);
  state = addCustomHabit(state, { title: 'Shaxsiy odat nomi', weekdays: [4] });
  state = toggleHabit(state, 'meal', thursday);
  state = toggleHabit(state, state.habits[0]!.id, thursday);
  return state;
}

test('the widget gets numbers only: never intention names, notes or habit titles', () => {
  const snapshot = widgetSnapshot(sample(), thursday);
  assert.deepEqual(snapshot.istighfar, { done: 20, target: 66 });
  assert.equal(snapshot.habits.done, 2);
  assert.equal(snapshot.habits.totals[4], 4, 'Thursday has the custom habit');
  assert.equal(snapshot.habits.totals[1], 3);
  const raw = JSON.stringify(snapshot);
  for (const secret of ['Juda', 'maxfiy', 'Shaxsiy', 'meal', 'kindness']) assert.ok(!raw.includes(secret), secret);
  assert.deepEqual(parseWidgetSnapshot(raw), snapshot);
});

test('with the whole-app lock on, the widget shows no numbers at all', () => {
  const locked = { ...sample(), lock: lockWith('app', createPinRecord('1357', 'b'.repeat(32)), false) };
  const view = widgetView(widgetSnapshot(locked, thursday), thursday);
  assert.equal(view.hidden, true);
  assert.ok(!JSON.stringify(view).match(/\d/), 'no counts in the hidden view');
  const muhosabaOnly = { ...sample(), lock: lockWith('muhosaba', createPinRecord('1357', 'b'.repeat(32)), false) };
  assert.equal(widgetView(widgetSnapshot(muhosabaOnly, thursday), thursday).hidden, false, 'counts are not private Muhosaba content');
});

test('a new day starts from zero before the app is opened, with that weekday\'s habit count', () => {
  const view = widgetView(widgetSnapshot(sample(), thursday), '2026-10-23');
  assert.equal(view.hidden, false);
  if (view.hidden) return;
  assert.deepEqual(view.istighfar, { done: 0, target: 66 });
  assert.deepEqual(view.habits, { done: 0, total: 3 });
});

test('the widget speaks the chosen script, and anything unreadable shows the plain entry', () => {
  const state = { ...sample(), settings: { ...sample().settings, script: 'cyrillic' as const } };
  const view = widgetView(widgetSnapshot(state, thursday), thursday);
  assert.equal(view.title, 'РАҲМАТ · БУГУН');
  assert.equal(!view.hidden && view.istighfarLabel, 'Истиғфор');
  for (const raw of [null, '', 'nope', '{"version":2}', JSON.stringify({ ...widgetSnapshot(sample(), thursday), habits: { done: 1, totals: [1] } })]) {
    assert.equal(parseWidgetSnapshot(raw), null);
    assert.equal(widgetView(parseWidgetSnapshot(raw), thursday).hidden, true);
  }
});
