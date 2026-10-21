import test from 'node:test';
import assert from 'node:assert/strict';
import {
  activityCalendar, addCustomHabit, consistencySummary, createInitialState, createReflection, customHabitsFor,
  dayHasActivity, deleteEvening, eveningHistory, getAdhkarCount, getCounts, getDayTarget, getDayTotal, getEvening,
  getReflectionTotal, getSessionCounts, incrementCount, istighfarSlots, MAX_CUSTOM_HABITS, MAX_EVENING_LENGTH,
  removeCustomHabit, saveEvening, setAdhkarCount, setRoutine, shiftDateKey, StateValidationError, STARTER_ROUTINE,
  toggleHabit, validateState, type AppState,
} from '../src/domain/model';
import { createPinRecord, lockWith, pauseAfterFailures, validPin, verifyPin } from '../src/domain/lock';

const DAY = '2026-10-21'; // A Wednesday.
const NOW = new Date('2026-10-21T15:00:00.000Z');

function withIntention(sessions = 1, target = 33): { state: AppState; id: string } {
  const created = createReflection(createInitialState(), { label: '  Sabr  ', note: '', sessions, target }, NOW);
  assert.ok(created);
  return created;
}

/** A record exactly as version 1 of the app saved it. */
function versionOneState() {
  return {
    version: 1,
    reflections: [{ id: 'old', label: 'Eski niyat', note: 'Shaxsiy', createdAt: '2026-09-27T06:00:00.000Z', archived: false }],
    days: { '2026-10-20': { counts: { old: [100, 40, 0, 0, 0] }, habits: ['meal'] } },
    settings: { enabled: true, dayStart: 7, dayEnd: 21, sunnahPerDay: 2, times: ['08:00', '11:00', '14:00', '17:00', '20:00'] },
  };
}

test('version 1 records upgrade without losing anything and keep the original 5 × 100 routine', () => {
  const upgraded = validateState(versionOneState());
  assert.equal(upgraded.version, 2);
  assert.deepEqual(upgraded.reflections[0], {
    id: 'old', label: 'Eski niyat', note: 'Shaxsiy', createdAt: '2026-09-27T06:00:00.000Z', archived: false, sessions: 5, target: 100,
  });
  assert.deepEqual(upgraded.days['2026-10-20'], { counts: { old: [100, 40, 0, 0, 0] }, habits: ['meal'], adhkar: {} });
  assert.equal(upgraded.settings.eveningTime, null);
  assert.deepEqual(upgraded.habits, []);
  assert.deepEqual(upgraded.lock, { mode: 'off', pin: null, biometrics: false });
  assert.equal(getDayTotal(upgraded, '2026-10-20'), 140);
  assert.equal(getDayTarget(upgraded), 500);
  assert.deepEqual(validateState(upgraded), upgraded, 'an upgraded record round-trips unchanged');
});

test('new intentions start from the chosen small routine and counting stops at its own target', () => {
  let { state, id } = withIntention(1, 33);
  assert.deepEqual(STARTER_ROUTINE, { sessions: 1, target: 33 });
  assert.equal(state.reflections[0]!.label, 'Sabr');
  state = incrementCount(state, id, 0, 50, DAY);
  assert.deepEqual(getSessionCounts(state, state.reflections[0]!, DAY), [33]);
  assert.equal(incrementCount(state, id, 1, 1, DAY), state, 'a session outside the routine cannot be counted');
  assert.equal(getDayTarget(state), 33);
  assert.equal(istighfarSlots(state), 1);
  assert.equal(createReflection(state, { label: '', note: '', sessions: 6, target: 33 }, NOW), null);
  assert.equal(createReflection(state, { label: '', note: '', sessions: 1, target: 101 }, NOW), null);
});

test('changing a routine keeps counts: a lower target caps them, a higher one shows them again', () => {
  let { state, id } = withIntention(5, 100);
  state = incrementCount(state, id, 0, 60, DAY);
  state = incrementCount(state, id, 3, 10, DAY);
  state = setRoutine(state, id, 2, 33);
  const reflection = () => state.reflections[0]!;
  assert.deepEqual(getSessionCounts(state, reflection(), DAY), [33, 0]);
  assert.equal(getReflectionTotal(state, reflection(), DAY), 33);
  assert.deepEqual(getCounts(state, id, DAY), [60, 0, 0, 10, 0], 'stored counts are untouched');
  state = incrementCount(state, id, 0, -1, DAY);
  assert.deepEqual(getSessionCounts(state, reflection(), DAY), [32, 0], 'undo works from the visible, capped value');
  state = setRoutine(state, id, 5, 100);
  assert.deepEqual(getSessionCounts(state, reflection(), DAY), [32, 0, 0, 10, 0]);
  assert.equal(setRoutine(state, id, 0, 33), state);
  assert.equal(setRoutine(state, 'missing', 2, 33), state);
});

test('istighfar reminders follow the largest active routine; archived intentions do not count', () => {
  let { state } = withIntention(2, 33);
  const second = createReflection(state, { label: 'Shukr', note: '', sessions: 4, target: 10 }, NOW)!;
  state = second.state;
  assert.equal(istighfarSlots(state), 4);
  state = { ...state, reflections: state.reflections.map((entry) => entry.id === second.id ? { ...entry, archived: true } : entry) };
  assert.equal(istighfarSlots(state), 2);
  assert.equal(istighfarSlots(createInitialState()), 0);
});

test('personal habits: at most seven, scheduled by weekday, and history survives removal', () => {
  let state = createInitialState();
  state = addCustomHabit(state, { title: '  Qur’ondan bir sahifa  ', weekdays: [] }, NOW);
  state = addCustomHabit(state, { title: 'Ota-onaga qo‘ng‘iroq', weekdays: [5, 5, 9, 0] }, NOW);
  assert.equal(state.habits[0]!.title, 'Qur’ondan bir sahifa');
  assert.deepEqual(state.habits[1]!.weekdays, [0, 5], 'duplicates and invalid days are dropped');
  assert.deepEqual(customHabitsFor(state, DAY).map((habit) => habit.title), ['Qur’ondan bir sahifa']);
  assert.equal(customHabitsFor(state, '2026-10-23').length, 2, 'Friday shows both');
  const id = state.habits[1]!.id;
  state = toggleHabit(state, id, '2026-10-23');
  state = removeCustomHabit(state, id);
  assert.equal(state.habits.length, 1);
  assert.ok(dayHasActivity(state, '2026-10-23'), 'a past check-off remains part of that day');
  assert.equal(addCustomHabit(state, { title: '   ', weekdays: [] }, NOW), state);
  for (let index = 0; index < 10; index += 1) state = addCustomHabit(state, { title: `Odat ${index}`, weekdays: [] }, NOW);
  assert.equal(state.habits.length, MAX_CUSTOM_HABITS);
  assert.throws(() => validateState({ ...state, habits: [...state.habits, { ...state.habits[0]!, id: 'meal' }] }), StateValidationError);
});

test('evening Muhosaba is private text per day; blank saves delete and deletion leaves no empty day', () => {
  let state = createInitialState();
  state = saveEvening(state, { gratitude: ' Sog‘lik ', improve: '', intention: 'Onamga qo‘ng‘iroq qilish' }, DAY, NOW);
  assert.deepEqual(getEvening(state, DAY), {
    gratitude: 'Sog‘lik', improve: '', intention: 'Onamga qo‘ng‘iroq qilish', updatedAt: NOW.toISOString(),
  });
  assert.ok(dayHasActivity(state, DAY));
  state = saveEvening(state, { gratitude: 'a'.repeat(500), improve: '', intention: '' }, shiftDateKey(DAY, -1), NOW);
  assert.equal(getEvening(state, shiftDateKey(DAY, -1))!.gratitude.length, MAX_EVENING_LENGTH);
  assert.deepEqual(eveningHistory(state).map((item) => item.dateKey), [DAY, '2026-10-20']);
  state = saveEvening(state, { gratitude: ' ', improve: '', intention: '' }, DAY, NOW);
  assert.equal(getEvening(state, DAY), undefined);
  assert.equal(Object.prototype.hasOwnProperty.call(state.days, DAY), false);
  state = deleteEvening(state, '2026-10-20');
  assert.deepEqual(state.days, {});
  assert.throws(() => validateState({ ...state, days: { [DAY]: { counts: {}, habits: [], adhkar: {}, evening: { gratitude: '', improve: '', intention: '', updatedAt: NOW.toISOString() } } } }), StateValidationError);
});

test('adhkar completions are bounded per day and count as a good day', () => {
  let state = setAdhkarCount(createInitialState(), 'after-prayer-tasbih', 2, DAY);
  assert.equal(getAdhkarCount(state, 'after-prayer-tasbih', DAY), 2);
  state = setAdhkarCount(state, 'after-prayer-tasbih', 999, DAY);
  assert.equal(getAdhkarCount(state, 'after-prayer-tasbih', DAY), 50);
  assert.ok(dayHasActivity(state, DAY));
  state = setAdhkarCount(state, 'after-prayer-tasbih', 0, DAY);
  assert.equal(dayHasActivity(state, DAY), false);
  assert.throws(() => validateState({ ...state, days: { [DAY]: { counts: {}, habits: [], adhkar: { tasbih: 51 } } } }), StateValidationError);
});

test('the consistency view counts good days in a window without streaks or debt', () => {
  let state = createInitialState();
  for (const offset of [0, -2, -3, -9, -29, -30]) state = toggleHabit(state, 'meal', shiftDateKey(DAY, offset));
  const calendar = activityCalendar(state, DAY);
  assert.equal(calendar.length, 30);
  assert.equal(calendar[0]!.dateKey, shiftDateKey(DAY, -29));
  assert.equal(calendar.at(-1)!.today, true);
  assert.equal(calendar.filter((day) => day.active).length, 5, 'day -30 is outside the window');
  assert.deepEqual(consistencySummary(state, DAY), { active: 3, total: 7 });
  assert.deepEqual(consistencySummary(createInitialState(), DAY), { active: 0, total: 7 });
});

test('date keys move by calendar day across month ends and daylight-saving changes', () => {
  assert.equal(shiftDateKey('2026-03-01', -1), '2026-02-28');
  assert.equal(shiftDateKey('2026-12-31', 1), '2027-01-01');
  const previous = process.env.TZ;
  try {
    process.env.TZ = 'Europe/Berlin';
    assert.equal(shiftDateKey('2026-03-29', -1), '2026-03-28');
    assert.equal(shiftDateKey('2026-10-25', 1), '2026-10-26');
  } finally {
    if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous;
  }
});

test('a PIN is stored only as a salted hash and verified exactly', () => {
  const record = createPinRecord('2580', '00112233445566778899aabbccddeeff');
  assert.equal(record.length, 4);
  assert.match(record.hash, /^[a-f0-9]{64}$/);
  assert.ok(!JSON.stringify(record).includes('2580'));
  assert.ok(verifyPin('2580', record));
  assert.equal(verifyPin('2581', record), false);
  assert.equal(verifyPin('25800', record), false);
  assert.notEqual(createPinRecord('2580').hash, createPinRecord('2580').hash, 'fresh salts differ');
  assert.equal(validPin('123'), false);
  assert.equal(validPin('12a4'), false);
  assert.throws(() => createPinRecord('12'));
});

test('lock settings always keep a PIN while on and forget it when turned off', () => {
  const pin = createPinRecord('135790');
  let state: AppState = { ...createInitialState(), lock: lockWith('muhosaba', pin, true) };
  assert.deepEqual(validateState(state).lock, { mode: 'muhosaba', pin, biometrics: true });
  assert.throws(() => lockWith('app', null, false));
  assert.deepEqual(lockWith('off', pin, true), { mode: 'off', pin: null, biometrics: false });
  state = { ...state, lock: { mode: 'app', pin: null, biometrics: false } };
  assert.throws(() => validateState(state), StateValidationError, 'a lock without a PIN could never be opened');
  assert.equal(pauseAfterFailures(4), 0);
  assert.equal(pauseAfterFailures(5), 30);
  assert.equal(pauseAfterFailures(6), 60);
  assert.equal(pauseAfterFailures(20), 600);
});
