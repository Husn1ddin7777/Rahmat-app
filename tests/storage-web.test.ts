import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { createInitialState, getDayTotal, incrementCount, StateValidationError, type AppState } from '../src/domain/model';
import { BrowserStorageError, createBrowserStorage } from '../src/services/storage.web';

const DAY = '2026-09-27';
function populated(): AppState {
  return {
    ...createInitialState(),
    reflections: [{ id: 'one', label: 'Sabr', note: 'Shaxsiy eslatma 🤲', createdAt: '2026-09-27T06:00:00.000Z', archived: false }],
  };
}

function open(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open('rahmat-local', 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function rawState(factory: IDBFactory): Promise<unknown> {
  const database = await open(factory);
  try {
    return await new Promise((resolve, reject) => {
      const tx = database.transaction('app-state', 'readonly');
      const request = tx.objectStore('app-state').get('current');
      tx.oncomplete = () => resolve(request.result);
      tx.onabort = () => reject(tx.error);
    });
  } finally { database.close(); }
}

async function replaceRawState(factory: IDBFactory, value: unknown): Promise<void> {
  const database = await open(factory);
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction('app-state', 'readwrite');
      tx.objectStore('app-state').put(value, 'current');
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error);
    });
  } finally { database.close(); }
}

test('web state persists across storage instances and isolates snapshots from later changes', async () => {
  const factory = new IDBFactory();
  const first = createBrowserStorage({ indexedDB: () => factory });
  assert.deepEqual(await first.loadState(), createInitialState());
  const state = incrementCount(populated(), 'one', 0, 21, DAY);
  const save = first.saveState(state);
  state.reflections[0]!.note = 'Changed after save was queued';
  await save;
  const reopened = createBrowserStorage({ indexedDB: () => factory });
  const loaded = await reopened.loadState();
  assert.equal(getDayTotal(loaded, DAY), 21);
  assert.equal(loaded.reflections[0]!.note, 'Shaxsiy eslatma 🤲');
  loaded.reflections[0]!.note = 'Changed outside storage';
  assert.equal((await reopened.loadState()).reflections[0]!.note, 'Shaxsiy eslatma 🤲');
  await Promise.all([22, 23, 24].map((count) => reopened.saveState(incrementCount(populated(), 'one', 0, count, DAY))));
  assert.equal(getDayTotal(await reopened.loadState(), DAY), 24);
});

test('an IndexedDB transaction abort after request success rejects the save and preserves the committed state', async (context) => {
  const factory = new IDBFactory();
  const storage = createBrowserStorage({ indexedDB: () => factory });
  await storage.saveState(populated());
  const original = IDBObjectStore.prototype.put;
  let requestSucceeded = false;
  const patch = context.mock.method(IDBObjectStore.prototype, 'put', function (this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
    const request = original.call(this, value, key);
    if (key === 'current') {
      request.addEventListener('success', () => { requestSucceeded = true; this.transaction.abort(); });
    }
    return request;
  });
  await assert.rejects(storage.saveState(incrementCount(populated(), 'one', 0, 7, DAY)), (error: unknown) =>
    error instanceof BrowserStorageError && error.code === 'WRITE_FAILED');
  assert.equal(requestSucceeded, true);
  patch.mock.restore();
  assert.deepEqual(await storage.loadState(), populated());
  await storage.saveState(incrementCount(populated(), 'one', 0, 8, DAY));
  assert.equal(getDayTotal(await storage.loadState(), DAY), 8);
});

test('corrupt browser data stays intact until explicit deletion, which writes only fresh defaults', async () => {
  const factory = new IDBFactory();
  const storage = createBrowserStorage({ indexedDB: () => factory });
  await storage.saveState(populated());
  const invalid = { format: 1, revision: 1, state: { ...populated(), days: { [DAY]: { counts: { one: [101, 0, 0, 0, 0] }, habits: [] } } } };
  await replaceRawState(factory, invalid);
  await assert.rejects(storage.loadState(), StateValidationError);
  assert.deepEqual(await rawState(factory), invalid);
  await assert.rejects(storage.saveState(populated()), StateValidationError);
  assert.deepEqual(await rawState(factory), invalid);
  await storage.clearState();
  assert.deepEqual(await storage.loadState(), createInitialState());
  assert.deepEqual(await rawState(factory), { format: 1, revision: 2, state: createInitialState() });
});

test('stale tabs cannot overwrite a newer save and can recover by reloading', async () => {
  const factory = new IDBFactory();
  const first = createBrowserStorage({ indexedDB: () => factory });
  const second = createBrowserStorage({ indexedDB: () => factory });
  await first.loadState();
  await second.loadState();
  await first.saveState(populated());
  await assert.rejects(second.saveState(incrementCount(populated(), 'one', 0, 9, DAY)), (error: unknown) =>
    error instanceof BrowserStorageError && error.code === 'CONFLICT');
  assert.equal(getDayTotal(await first.loadState(), DAY), 0);
  const fresh = await second.loadState();
  await second.saveState(incrementCount(fresh, 'one', 0, 2, DAY));
  assert.equal(getDayTotal(await second.loadState(), DAY), 2);
});

test('deletion keeps a monotonic tombstone, including when an old tab last saw revision zero', async () => {
  for (const withSavedState of [false, true]) {
    const factory = new IDBFactory();
    const oldTab = createBrowserStorage({ indexedDB: () => factory });
    const deletingTab = createBrowserStorage({ indexedDB: () => factory });
    await oldTab.loadState();
    if (withSavedState) { await oldTab.saveState(populated()); await deletingTab.loadState(); }
    await deletingTab.clearState();
    await assert.rejects(oldTab.saveState(populated()), (error: unknown) =>
      error instanceof BrowserStorageError && error.code === 'CONFLICT');
    assert.deepEqual(await deletingTab.loadState(), createInitialState());
    assert.deepEqual(await rawState(factory), { format: 1, revision: withSavedState ? 2 : 1, state: createInitialState() });
  }
});

test('a failed deletion transaction preserves notes and a later explicit retry succeeds', async (context) => {
  const factory = new IDBFactory();
  const storage = createBrowserStorage({ indexedDB: () => factory });
  await storage.saveState(populated());
  const original = IDBObjectStore.prototype.put;
  const patch = context.mock.method(IDBObjectStore.prototype, 'put', function (this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
    const request = original.call(this, value, key);
    if (key === 'current') request.addEventListener('success', () => this.transaction.abort());
    return request;
  });
  await assert.rejects(storage.clearState(), (error: unknown) => error instanceof BrowserStorageError && error.code === 'CLEAR_FAILED');
  patch.mock.restore();
  assert.deepEqual(await storage.loadState(), populated());
  await storage.clearState();
  assert.deepEqual(await storage.loadState(), createInitialState());
});

test('persistent-storage requests occur only once after meaningful data and denial never fails a save', async () => {
  const factory = new IDBFactory();
  let requests = 0;
  const manager = { async persisted() { return false; }, async persist() { requests += 1; return false; } };
  const storage = createBrowserStorage({ indexedDB: () => factory, storageManager: () => manager });
  await storage.loadState();
  await storage.saveState(createInitialState());
  assert.equal(requests, 0);
  await storage.saveState(populated());
  await storage.loadState();
  assert.equal(requests, 1);
  const reopened = createBrowserStorage({ indexedDB: () => factory, storageManager: () => manager });
  await reopened.loadState();
  await reopened.saveState(populated());
  assert.equal(requests, 1);
  assert.deepEqual(await reopened.loadState(), populated());
});

test('persistence API errors are best effort and already persistent storage is not prompted', async () => {
  for (const alreadyPersistent of [false, true]) {
    const factory = new IDBFactory();
    let requests = 0;
    const storage = createBrowserStorage({
      indexedDB: () => factory,
      storageManager: () => ({ async persisted() { return alreadyPersistent; }, async persist() { requests += 1; throw new Error('Denied'); } }),
    });
    await storage.saveState(populated());
    assert.deepEqual(await storage.loadState(), populated());
    assert.equal(requests, alreadyPersistent ? 0 : 1);
  }
});

test('unavailable, denied and blocked IndexedDB never silently fall back to volatile memory', async () => {
  for (const unavailable of [() => undefined, () => { throw new Error('SecurityError'); }]) {
    const storage = createBrowserStorage({ indexedDB: unavailable });
    await assert.rejects(storage.loadState(), (error: unknown) => error instanceof BrowserStorageError && error.code === 'UNAVAILABLE');
    await assert.rejects(storage.saveState(populated()), BrowserStorageError);
  }
  const denied = createBrowserStorage({ indexedDB: () => ({ open() { throw new Error('SecurityError'); } } as unknown as IDBFactory) });
  await assert.rejects(denied.loadState(), (error: unknown) => error instanceof BrowserStorageError && error.code === 'OPEN_FAILED');
  const blocked = createBrowserStorage({ indexedDB: () => ({
    open() {
      const request = { onblocked: null as null | (() => void) };
      queueMicrotask(() => request.onblocked?.());
      return request;
    },
  } as unknown as IDBFactory) });
  await assert.rejects(blocked.loadState(), (error: unknown) => error instanceof BrowserStorageError && error.code === 'BLOCKED');
});
