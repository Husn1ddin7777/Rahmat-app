import { createInitialState, pruneHistory, StateValidationError, validateState, type AppState } from '../domain/model';

const DATABASE_NAME = 'rahmat-local';
const DATABASE_VERSION = 1;
const STORE_NAME = 'app-state';
const STATE_KEY = 'current';
const PERSISTENCE_KEY = 'persistence-requested';

type ErrorCode = 'UNAVAILABLE' | 'OPEN_FAILED' | 'BLOCKED' | 'READ_FAILED' | 'WRITE_FAILED' | 'CLEAR_FAILED' | 'CORRUPT' | 'CONFLICT';
type StoredState = { format: 1; revision: number; state: AppState };
type PersistenceManager = { persisted?(): Promise<boolean>; persist?(): Promise<boolean> };

export class BrowserStorageError extends Error {
  constructor(public readonly code: ErrorCode, message: string) {
    super(message);
    this.name = 'BrowserStorageError';
  }
}

function failure(code: ErrorCode): BrowserStorageError {
  const messages: Record<ErrorCode, string> = {
    UNAVAILABLE: 'Bu brauzerda mahalliy xotira mavjud emas. Oddiy brauzer oynasida qayta urinib ko‘ring.',
    OPEN_FAILED: 'Brauzer xotirasini ochib bo‘lmadi. Qaydlar avtomatik o‘chirilmagan.',
    BLOCKED: 'Boshqa Rahmat oynasini yoping va qayta urinib ko‘ring.',
    READ_FAILED: 'Brauzerdagi qaydlarni o‘qib bo‘lmadi. Ular avtomatik o‘chirilmagan.',
    WRITE_FAILED: 'Qaydlarni brauzerga saqlab bo‘lmadi. Bo‘sh joyni tekshirib, qayta urinib ko‘ring.',
    CLEAR_FAILED: 'Brauzerdagi qaydlarni o‘chirib bo‘lmadi. Qayta urinib ko‘ring.',
    CORRUPT: 'Saqlangan qaydlar formati yaroqsiz. Ular avtomatik o‘chirilmagan.',
    CONFLICT: 'Qaydlar boshqa oynada o‘zgargan. Saqlangan nusxani ko‘rish uchun ilovani qayta oching.',
  };
  return new BrowserStorageError(code, messages[code]);
}

function decode(value: unknown): StoredState | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object') throw failure('CORRUPT');
  const record = value as Partial<StoredState>;
  if (record.format !== 1 || !Number.isSafeInteger(record.revision) || record.revision! < 1) throw failure('CORRUPT');
  return { format: 1, revision: record.revision!, state: validateState(record.state) };
}

/** IndexedDB is local browser storage; this service does not encrypt its values or sync them. */
export function createBrowserStorage(environment: {
  indexedDB: () => IDBFactory | undefined;
  storageManager?: () => PersistenceManager | undefined;
}): { loadState(): Promise<AppState>; saveState(state: AppState): Promise<void>; clearState(): Promise<void> } {
  let database: IDBDatabase | undefined;
  let observedRevision: number | undefined;
  let queue: Promise<void> = Promise.resolve();
  const enqueue = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = queue.then(operation);
    queue = result.then(() => undefined, () => undefined);
    return result;
  };

  async function openDatabase(): Promise<IDBDatabase> {
    if (database) return database;
    let factory: IDBFactory | undefined;
    try { factory = environment.indexedDB(); } catch { throw failure('UNAVAILABLE'); }
    if (!factory) throw failure('UNAVAILABLE');
    return new Promise((resolve, reject) => {
      let request: IDBOpenDBRequest;
      let settled = false;
      const rejectOpen = (error: BrowserStorageError) => { settled = true; reject(error); };
      try { request = factory.open(DATABASE_NAME, DATABASE_VERSION); }
      catch { rejectOpen(failure('OPEN_FAILED')); return; }
      request.onupgradeneeded = () => {
        try {
          if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
        } catch {
          request.transaction?.abort();
          rejectOpen(failure('OPEN_FAILED'));
        }
      };
      request.onerror = () => rejectOpen(failure('OPEN_FAILED'));
      request.onblocked = () => rejectOpen(failure('BLOCKED'));
      request.onsuccess = () => {
        const opened = request.result;
        // A blocked request may succeed later: close it after the caller has received its error.
        if (settled) { opened.close(); return; }
        if (!opened.objectStoreNames.contains(STORE_NAME)) {
          opened.close(); rejectOpen(failure('CORRUPT')); return;
        }
        const forget = () => { if (database === opened) database = undefined; };
        opened.onversionchange = () => { forget(); opened.close(); };
        opened.onclose = forget;
        database = opened;
        settled = true;
        resolve(opened);
      };
    });
  }

  function transaction<T>(
    db: IDBDatabase,
    mode: IDBTransactionMode,
    errorCode: 'READ_FAILED' | 'WRITE_FAILED' | 'CLEAR_FAILED',
    operation: (store: IDBObjectStore, finish: (result: T) => void, fail: (error: unknown) => void) => void,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      let tx: IDBTransaction;
      try { tx = db.transaction(STORE_NAME, mode); }
      catch { database = undefined; reject(failure(errorCode)); return; }
      let result: T;
      let ready = false;
      let cause: unknown;
      const fail = (error: unknown) => {
        cause = error;
        try { tx.abort(); } catch { reject(error); }
      };
      // A request's success is not enough: only transaction completion confirms a save.
      tx.oncomplete = () => ready ? resolve(result!) : reject(failure(errorCode));
      tx.onabort = () => reject(cause instanceof BrowserStorageError || cause instanceof StateValidationError ? cause : failure(errorCode));
      tx.onerror = () => { cause ??= failure(errorCode); };
      try { operation(tx.objectStore(STORE_NAME), (value) => { result = value; ready = true; }, fail); }
      catch (error) { fail(error); }
    });
  }

  async function requestPersistence(): Promise<void> {
    // Called only after the first meaningful user save, never on initial page load.
    // Browser denial is valid: IndexedDB still works under the browser's eviction policy.
    try {
      const manager = environment.storageManager?.();
      if (!manager?.persist) return;
      if (manager.persisted && await manager.persisted()) return;
      await manager.persist();
    } catch { /* Persistence is a best-effort browser preference, not a save requirement. */ }
  }

  return {
    loadState: () => enqueue(async () => {
      const db = await openDatabase();
      const stored = await transaction<StoredState | undefined>(db, 'readonly', 'READ_FAILED', (store, finish, fail) => {
        const request = store.get(STATE_KEY);
        request.onsuccess = () => {
          try { finish(decode(request.result)); } catch (error) { fail(error); }
        };
      });
      observedRevision = stored?.revision ?? 0;
      return stored?.state ?? createInitialState();
    }),
    saveState: async (state) => {
      const snapshot = validateState(pruneHistory(state));
      return enqueue(async () => {
        const db = await openDatabase();
        const saved = await transaction<{ revision: number; requestPersistence: boolean }>(db, 'readwrite', 'WRITE_FAILED', (store, finish, fail) => {
          const current = store.get(STATE_KEY);
          current.onsuccess = () => {
            try {
              const previous = decode(current.result);
              const revision = previous?.revision ?? 0;
              // An old browser tab cannot silently replace newer edits or resurrect deleted notes.
              if ((observedRevision === undefined && previous) || (observedRevision !== undefined && observedRevision !== revision)) throw failure('CONFLICT');
              if (revision >= Number.MAX_SAFE_INTEGER) throw failure('WRITE_FAILED');
              store.put({ format: 1, revision: revision + 1, state: snapshot } satisfies StoredState, STATE_KEY);
              const persistence = store.get(PERSISTENCE_KEY);
              persistence.onsuccess = () => {
                try {
                  const meaningful = snapshot.reflections.length > 0 || Object.keys(snapshot.days).length > 0;
                  const requestPersistence = meaningful && persistence.result !== true;
                  if (requestPersistence) store.put(true, PERSISTENCE_KEY);
                  finish({ revision: revision + 1, requestPersistence });
                } catch (error) { fail(error); }
              };
            } catch (error) { fail(error); }
          };
        });
        observedRevision = saved.revision;
        if (saved.requestPersistence) void requestPersistence();
      });
    },
    clearState: () => enqueue(async () => {
      const db = await openDatabase();
      const nextRevision = await transaction<number>(db, 'readwrite', 'CLEAR_FAILED', (store, finish, fail) => {
        const current = store.get(STATE_KEY);
        current.onsuccess = () => {
          try {
            // Deletion must also work when the stored state fails schema validation.
            const value: unknown = current.result;
            const rawRevision = value && typeof value === 'object' ? (value as { revision?: unknown }).revision : undefined;
            const previousRevision = typeof rawRevision === 'number' && Number.isSafeInteger(rawRevision) && rawRevision >= 0
              ? rawRevision : (observedRevision ?? 0);
            if (previousRevision >= Number.MAX_SAFE_INTEGER) throw failure('CLEAR_FAILED');
            const revision = previousRevision + 1;
            store.clear();
            // Keep only fresh defaults and a monotonic revision: an older tab cannot restore deleted notes.
            store.put({ format: 1, revision, state: createInitialState() } satisfies StoredState, STATE_KEY);
            finish(revision);
          } catch (error) { fail(error); }
        };
      });
      observedRevision = nextRevision;
    }),
  };
}

const local = createBrowserStorage({
  indexedDB: () => typeof indexedDB === 'undefined' ? undefined : indexedDB,
  storageManager: () => typeof navigator === 'undefined' ? undefined : navigator.storage,
});

export const loadState = local.loadState;
export const saveState = local.saveState;
export const clearState = local.clearState;
