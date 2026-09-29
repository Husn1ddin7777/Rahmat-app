import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialState, getCounts, getDayTotal, incrementCount, localDateKey,
  MAX_REFLECTIONS, pruneHistory, StateValidationError, toggleHabit, validateState,
  type AppState, type Reflection,
} from '../src/domain/model';
import { createStateStorage, StorageError, type SecureStoreAdapter } from '../src/services/storage';

const DAY = '2026-09-27';
function reflection(id: string, archived = false): Reflection {
  return { id, label: `Shaxsiy qayd ${id}`, note: '', archived, createdAt: '2026-09-27T06:00:00.000Z' };
}
function populated(): AppState {
  return { ...createInitialState(), reflections: [reflection('one'), reflection('two')] };
}

test('each reflection has five independent counters capped at 100', () => {
  const initial = populated();
  let state = initial;
  for (let slot = 0; slot < 5; slot += 1) state = incrementCount(state, 'one', slot, 100, DAY);
  assert.deepEqual(getCounts(state, 'one', DAY), [100, 100, 100, 100, 100]);
  assert.deepEqual(getCounts(state, 'two', DAY), [0, 0, 0, 0, 0]);
  assert.equal(getDayTotal(state, DAY), 500);
  assert.deepEqual(initial.days, {}, 'updates must not mutate React state');
  state = incrementCount(state, 'two', 2, 17, DAY);
  assert.equal(getDayTotal(state, DAY), 517);
  assert.deepEqual(getCounts(state, 'one', DAY), [100, 100, 100, 100, 100]);
  const detached = getCounts(state, 'one', DAY);
  detached[0] = 0;
  assert.equal(getCounts(state, 'one', DAY)[0], 100, 'selectors return detached arrays');
});

test('count overflow, undo and invalid inputs cannot change other slots', () => {
  let state = incrementCount(populated(), 'one', 1, 500, DAY);
  assert.deepEqual(getCounts(state, 'one', DAY), [0, 100, 0, 0, 0]);
  state = incrementCount(state, 'one', 1, -1, DAY);
  assert.equal(getCounts(state, 'one', DAY)[1], 99);
  state = incrementCount(state, 'one', 1, -500, DAY);
  assert.equal(getCounts(state, 'one', DAY)[1], 0);
  assert.equal(incrementCount(state, 'one', -1, 1, DAY), state);
  assert.equal(incrementCount(state, 'one', 5, 1, DAY), state);
  assert.equal(incrementCount(state, 'missing', 0, 1, DAY), state);
  assert.equal(incrementCount(state, 'one', 0, Number.NaN, DAY), state);
});

test('midnight resets progress by local calendar day, including UTC+5', () => {
  const previousTimezone = process.env.TZ;
  try {
    process.env.TZ = 'Asia/Tashkent';
    const before = new Date('2026-09-27T23:59:59+05:00');
    const after = new Date('2026-09-28T00:00:00+05:00');
    assert.equal(localDateKey(before), '2026-09-27');
    assert.equal(localDateKey(after), '2026-09-28');
    const state = incrementCount(populated(), 'one', 0, 10, localDateKey(before));
    assert.equal(getDayTotal(state, localDateKey(before)), 10);
    assert.equal(getDayTotal(state, localDateKey(after)), 0);
  } finally {
    if (previousTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = previousTimezone;
  }
});

test('archived reflections retain history while leaving active totals and counting', () => {
  let state = incrementCount(populated(), 'one', 0, 80, DAY);
  state = incrementCount(state, 'two', 0, 20, DAY);
  state = { ...state, reflections: state.reflections.map((entry) => entry.id === 'one' ? { ...entry, archived: true } : entry) };
  assert.equal(getDayTotal(state, DAY), 20);
  assert.deepEqual(getCounts(state, 'one', DAY), [80, 0, 0, 0, 0]);
  assert.equal(incrementCount(state, 'one', 0, 1, DAY), state);
});

test('history retains only the newest 30 local-day records', () => {
  let state = populated();
  for (let day = 1; day <= 35; day += 1) {
    state = incrementCount(state, 'one', 0, 1, localDateKey(new Date(2026, 7, day, 12)));
  }
  assert.equal(Object.keys(state.days).length, 30);
  assert.equal(state.days['2026-08-05'], undefined);
  assert.equal(state.days['2026-08-06']?.counts.one?.[0], 1);
  assert.equal(state.days['2026-09-04']?.counts.one?.[0], 1);
  assert.equal(pruneHistory(state), state);
});

test('habit completion toggles once and stays isolated by local day', () => {
  const initial = populated();
  const completed = toggleHabit(initial, 'kindness', DAY);
  assert.deepEqual(completed.days[DAY]?.habits, ['kindness']);
  const nextDay = toggleHabit(completed, 'kindness', '2026-09-28');
  assert.deepEqual(nextDay.days[DAY]?.habits, ['kindness']);
  const undone = toggleHabit(nextDay, 'kindness', DAY);
  assert.deepEqual(undone.days[DAY]?.habits, []);
  assert.deepEqual(undone.days['2026-09-28']?.habits, ['kindness']);
  assert.deepEqual(initial.days, {});
});

test('schema rejects malformed private records, counts, dates and schedules', () => {
  const state = incrementCount(populated(), 'one', 0, 3, DAY);
  assert.deepEqual(validateState(state), state);
  const invalid: unknown[] = [
    null,
    { ...state, version: 2 },
    { ...state, reflections: [reflection('one'), reflection('one')] },
    { ...state, reflections: Array.from({ length: MAX_REFLECTIONS + 1 }, (_, index) => reflection(`${index}`)) },
    { ...state, reflections: [{ ...reflection('one'), label: 'a'.repeat(49) }] },
    { ...state, reflections: [{ ...reflection('one'), note: 'a'.repeat(121) }] },
    { ...state, days: { [DAY]: { counts: { one: [101, 0, 0, 0, 0] }, habits: [] } } },
    { ...state, days: { [DAY]: { counts: { one: [1, 0, 0, 0] }, habits: [] } } },
    { ...state, days: { [DAY]: { counts: { unknown: [1, 0, 0, 0, 0] }, habits: [] } } },
    { ...state, days: { '2026-02-30': { counts: {}, habits: [] } } },
    { ...state, settings: { ...state.settings, enabled: 'yes' } },
    { ...state, settings: { ...state.settings, times: ['08:00', '08:00', '14:00', '17:00', '20:00'] } },
    { ...state, settings: { ...state.settings, times: ['06:00', '11:00', '14:00', '17:00', '20:00'] } },
    { ...state, settings: { ...state.settings, sunnahPerDay: 0 } },
  ];
  for (const value of invalid) assert.throws(() => validateState(value), StateValidationError);
  const copy = validateState(state);
  copy.reflections[0]!.note = 'Changed outside storage';
  copy.days[DAY]!.counts.one![0] = 99;
  assert.equal(state.reflections[0]!.note, '');
  assert.equal(getCounts(state, 'one', DAY)[0], 3);
});

function fakeStore() {
  const values = new Map<string, string>();
  let fault: ((operation: 'get' | 'set' | 'delete', key: string) => boolean) | undefined;
  const adapter: SecureStoreAdapter = {
    async getItemAsync(key) {
      await Promise.resolve();
      if (fault?.('get', key)) throw new Error('Simulated read failure');
      return values.get(key) ?? null;
    },
    async setItemAsync(key, value) {
      await Promise.resolve();
      if (fault?.('set', key)) throw new Error('Simulated write failure');
      values.set(key, value);
    },
    async deleteItemAsync(key) {
      await Promise.resolve();
      if (fault?.('delete', key)) throw new Error('Simulated deletion failure');
      values.delete(key);
    },
  };
  return { adapter, values, setFault: (next?: typeof fault) => { fault = next; } };
}

test('native adapter stores small Unicode-safe chunks and removes the old generation after commit', async () => {
  const fake = fakeStore();
  const storage = createStateStorage(fake.adapter);
  let state = populated();
  state.reflections[0]!.note = '🤲'.repeat(60);
  await storage.saveState(state);
  assert.deepEqual(await storage.loadState(), state);
  for (const [key, value] of fake.values) {
    if (/\.[ab]\.\d+$/.test(key)) {
      assert.ok(value.length <= 400);
      assert.ok(!/[\uD800-\uDBFF]$/.test(value), 'no trailing half of a surrogate pair');
      assert.ok(!/^[\uDC00-\uDFFF]/.test(value), 'no leading half of a surrogate pair');
    }
  }
  state = incrementCount(state, 'one', 0, 9, DAY);
  await storage.saveState(state);
  assert.deepEqual(await storage.loadState(), state);
  assert.equal([...fake.values.keys()].some((key) => /\.a\./.test(key)), false);
});

test('failed chunk or manifest writes preserve the last committed generation', async () => {
  for (const failedKey of ['rahmat.state.v1.b.0', 'rahmat.state.v1.manifest']) {
    const fake = fakeStore();
    const storage = createStateStorage(fake.adapter);
    const initial = populated();
    await storage.saveState(initial);
    fake.setFault((operation, key) => operation === 'set' && key === failedKey);
    await assert.rejects(storage.saveState(incrementCount(initial, 'one', 0, 5, DAY)), StorageError);
    fake.setFault();
    assert.deepEqual(await createStateStorage(fake.adapter).loadState(), initial);
    await storage.saveState(incrementCount(initial, 'one', 0, 8, DAY));
    assert.equal(getDayTotal(await storage.loadState(), DAY), 8);
  }
});

test('cleanup failures report committed data accurately and do not break reading', async () => {
  const fake = fakeStore();
  const storage = createStateStorage(fake.adapter);
  const initial = populated();
  await storage.saveState(initial);
  fake.setFault((operation, key) => operation === 'delete' && key === 'rahmat.state.v1.a.0');
  await assert.rejects(storage.saveState(incrementCount(initial, 'one', 0, 7, DAY)), (error: unknown) =>
    error instanceof StorageError && error.code === 'CLEANUP_FAILED' && error.stateSaved);
  fake.setFault();
  assert.equal(getDayTotal(await storage.loadState(), DAY), 7);
  await storage.clearState();
  assert.equal(fake.values.size, 0);
});

test('missing or corrupt chunks raise an error instead of silently resetting private data', async () => {
  const fake = fakeStore();
  const storage = createStateStorage(fake.adapter);
  await storage.saveState(populated());
  fake.values.delete('rahmat.state.v1.a.0');
  await assert.rejects(storage.loadState(), (error: unknown) => error instanceof StorageError && error.code === 'CORRUPT');
  assert.ok(fake.values.has('rahmat.state.v1.manifest'));
  await storage.clearState();
  assert.deepEqual(await storage.loadState(), createInitialState());
});

test('interrupted first save is surfaced rather than returned as an empty account', async () => {
  const fake = fakeStore();
  fake.setFault((operation, key) => operation === 'set' && key === 'rahmat.state.v1.a.0');
  const storage = createStateStorage(fake.adapter);
  await assert.rejects(storage.saveState(populated()), StorageError);
  fake.setFault();
  await assert.rejects(storage.loadState(), (error: unknown) => error instanceof StorageError && error.code === 'CORRUPT');
  await storage.clearState();
  assert.equal(fake.values.size, 0);
});

test('writes serialize, preserve their input snapshot and recover after a rejected write', async () => {
  const fake = fakeStore();
  const storage = createStateStorage(fake.adapter);
  const first = incrementCount(populated(), 'one', 0, 1, DAY);
  const pending = storage.saveState(first);
  first.days[DAY]!.counts.one![0] = 99;
  await pending;
  assert.equal(getDayTotal(await storage.loadState(), DAY), 1);
  await Promise.all([2, 3, 4].map((count) => storage.saveState(incrementCount(populated(), 'one', 0, count, DAY))));
  assert.equal(getDayTotal(await storage.loadState(), DAY), 4);
  await assert.rejects(storage.saveState({ ...populated(), version: 99 } as unknown as AppState), StateValidationError);
  await storage.saveState(populated());
  assert.equal(getDayTotal(await storage.loadState(), DAY), 0);
});

test('explicit deletion resumes after interruption and removes all app storage keys', async () => {
  const fake = fakeStore();
  const storage = createStateStorage(fake.adapter);
  await storage.saveState(populated());
  fake.setFault((operation, key) => operation === 'delete' && key === 'rahmat.state.v1.a.0');
  await assert.rejects(storage.clearState(), (error: unknown) => error instanceof StorageError && error.code === 'CLEAR_FAILED');
  assert.equal(fake.values.get('rahmat.state.v1.clearing'), '1');
  fake.setFault();
  assert.deepEqual(await createStateStorage(fake.adapter).loadState(), createInitialState());
  assert.equal(fake.values.size, 0);
});
