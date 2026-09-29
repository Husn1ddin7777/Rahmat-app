import { createInitialState, pruneHistory, validateState, type AppState } from '../domain/model';

const PREFIX = 'rahmat.state.v1';
const MANIFEST_KEY = `${PREFIX}.manifest`;
const CLEAR_KEY = `${PREFIX}.clearing`;
const CHUNK_SIZE = 400;
const MAX_CHUNKS = 512;
type Generation = 'a' | 'b';
type Manifest = { version: 1; active: Generation; chunks: number; checksum: string };

export class StorageError extends Error {
  constructor(
    public readonly code: 'CORRUPT' | 'READ_FAILED' | 'WRITE_FAILED' | 'CLEANUP_FAILED' | 'CLEAR_FAILED',
    message: string,
    /** A cleanup failure can occur after the new manifest has already committed. */
    public readonly stateSaved = false,
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

/** Adapter injection makes interruption and corruption behavior testable without a phone. */
export type SecureStoreAdapter = {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
};

function inventoryKey(generation: Generation): string { return `${PREFIX}.${generation}.inventory`; }
function chunkKey(generation: Generation, index: number): string { return `${PREFIX}.${generation}.${index}`; }

function corrupt(): StorageError {
  return new StorageError('CORRUPT', 'Saqlangan ma’lumotlarni o‘qib bo‘lmadi. Ular avtomatik o‘chirilmagan.');
}

function parseManifest(raw: string): Manifest {
  try {
    const item: unknown = JSON.parse(raw);
    if (!item || typeof item !== 'object') throw corrupt();
    const value = item as Partial<Manifest>;
    if (value.version !== 1 || !['a', 'b'].includes(value.active ?? '')
      || !Number.isInteger(value.chunks) || value.chunks! < 1 || value.chunks! > MAX_CHUNKS
      || typeof value.checksum !== 'string' || !/^[a-f0-9]{8}$/.test(value.checksum)) throw corrupt();
    return value as Manifest;
  } catch { throw corrupt(); }
}

function parseInventory(raw: string | null): number {
  if (raw === null) return 0;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') throw corrupt();
    const item = value as { version?: unknown; count?: unknown };
    if (item.version !== 1 || !Number.isInteger(item.count) || typeof item.count !== 'number'
      || item.count < 0 || item.count > MAX_CHUNKS) throw corrupt();
    return item.count;
  } catch { throw corrupt(); }
}

// Integrity check only; encryption is provided by the OS-backed SecureStore.
function checksum(text: string): string {
  let value = 2166136261;
  for (let index = 0; index < text.length; index += 1) value = Math.imul(value ^ text.charCodeAt(index), 16777619);
  return (value >>> 0).toString(16).padStart(8, '0');
}

function chunksOf(text: string): string[] {
  const chunks: string[] = [];
  let chunk = '';
  // Iterating code points prevents splitting a surrogate pair across encrypted values.
  for (const character of text) {
    if (chunk.length + character.length > CHUNK_SIZE) { chunks.push(chunk); chunk = ''; }
    chunk += character;
  }
  if (chunk) chunks.push(chunk);
  return chunks;
}

export function createStateStorage(store: SecureStoreAdapter): {
  loadState(): Promise<AppState>;
  saveState(state: AppState): Promise<void>;
  clearState(): Promise<void>;
} {
  let queue: Promise<void> = Promise.resolve();
  const enqueue = <T>(operation: () => Promise<T>): Promise<T> => {
    const task = queue.then(operation);
    queue = task.then(() => undefined, () => undefined);
    return task;
  };

  const setInventory = (generation: Generation, count: number) =>
    store.setItemAsync(inventoryKey(generation), JSON.stringify({ version: 1, count }));

  async function clearInternal(): Promise<void> {
    try {
      // Persist deletion intent first, so an interrupted explicit deletion resumes on load.
      await store.setItemAsync(CLEAR_KEY, '1');
      let manifest: Manifest | undefined;
      let unknownManifest = false;
      const manifestRaw = await store.getItemAsync(MANIFEST_KEY);
      if (manifestRaw !== null) {
        try { manifest = parseManifest(manifestRaw); } catch { unknownManifest = true; }
      }
      for (const generation of ['a', 'b'] as const) {
        let count: number;
        try { count = parseInventory(await store.getItemAsync(inventoryKey(generation))); }
        catch { count = MAX_CHUNKS; }
        if (unknownManifest) count = MAX_CHUNKS;
        if (manifest?.active === generation) count = Math.max(count, manifest.chunks);
        for (let index = 0; index < count; index += 1) await store.deleteItemAsync(chunkKey(generation, index));
        await store.deleteItemAsync(inventoryKey(generation));
      }
      await store.deleteItemAsync(MANIFEST_KEY);
      await store.deleteItemAsync(CLEAR_KEY);
    } catch {
      throw new StorageError('CLEAR_FAILED', 'Ma’lumotlarni to‘liq o‘chirib bo‘lmadi. Qayta urinib ko‘ring.');
    }
  }

  async function resumeDeletion(): Promise<boolean> {
    const marker = await store.getItemAsync(CLEAR_KEY);
    if (marker === null) return false;
    if (marker !== '1') throw corrupt();
    await clearInternal();
    return true;
  }

  async function loadInternal(): Promise<AppState> {
    try {
      if (await resumeDeletion()) return createInitialState();
      const raw = await store.getItemAsync(MANIFEST_KEY);
      if (raw === null) {
        const a = parseInventory(await store.getItemAsync(inventoryKey('a')));
        const b = parseInventory(await store.getItemAsync(inventoryKey('b')));
        if (a > 0 || b > 0) throw corrupt();
        return createInitialState();
      }
      const manifest = parseManifest(raw);
      const inventory = parseInventory(await store.getItemAsync(inventoryKey(manifest.active)));
      if (inventory !== manifest.chunks) throw corrupt();
      let json = '';
      for (let index = 0; index < manifest.chunks; index += 1) {
        const chunk = await store.getItemAsync(chunkKey(manifest.active, index));
        if (chunk === null || chunk.length === 0 || chunk.length > CHUNK_SIZE) throw corrupt();
        json += chunk;
      }
      if (checksum(json) !== manifest.checksum) throw corrupt();
      let value: unknown;
      try { value = JSON.parse(json); } catch { throw corrupt(); }
      return validateState(value);
    } catch (error) {
      if (error instanceof StorageError || (error instanceof Error && error.name === 'StateValidationError')) throw error;
      throw new StorageError('READ_FAILED', 'Himoyalangan xotirani o‘qib bo‘lmadi. Telefonni qulfdan chiqarib, qayta urinib ko‘ring.');
    }
  }

  async function saveInternal(state: AppState): Promise<void> {
    // Validation is deliberately outside the storage catch so schema errors stay identifiable.
    const json = JSON.stringify(validateState(pruneHistory(state)));
    const chunks = chunksOf(json);
    if (chunks.length > MAX_CHUNKS) throw new StorageError('WRITE_FAILED', 'Ma’lumotlar hajmi xotira chegarasidan oshdi.');
    let committed = false;
    try {
      await resumeDeletion();
      const rawManifest = await store.getItemAsync(MANIFEST_KEY);
      const old = rawManifest === null ? undefined : parseManifest(rawManifest);
      const target: Generation = old?.active === 'a' ? 'b' : 'a';
      const oldTargetCount = parseInventory(await store.getItemAsync(inventoryKey(target)));
      let oldActiveCount = 0;
      if (old) {
        oldActiveCount = parseInventory(await store.getItemAsync(inventoryKey(old.active)));
        if (oldActiveCount !== old.chunks) throw corrupt();
      }
      // Inventory is written before any chunk so even an interrupted write can be deleted.
      await setInventory(target, Math.max(oldTargetCount, chunks.length));
      for (let index = 0; index < chunks.length; index += 1) await store.setItemAsync(chunkKey(target, index), chunks[index]!);
      for (let index = chunks.length; index < oldTargetCount; index += 1) await store.deleteItemAsync(chunkKey(target, index));
      await setInventory(target, chunks.length);
      const next: Manifest = { version: 1, active: target, chunks: chunks.length, checksum: checksum(json) };
      // Only this single-key update switches readers to the new complete generation.
      await store.setItemAsync(MANIFEST_KEY, JSON.stringify(next));
      committed = true;
      if (old) {
        for (let index = 0; index < oldActiveCount; index += 1) await store.deleteItemAsync(chunkKey(old.active, index));
        await store.deleteItemAsync(inventoryKey(old.active));
      }
    } catch (error) {
      if (error instanceof StorageError && !committed) throw error;
      if (committed) throw new StorageError('CLEANUP_FAILED', 'Yangi ma’lumotlar saqlandi, ammo eski nusxani tozalab bo‘lmadi. Qayta urinib ko‘ring.', true);
      throw new StorageError('WRITE_FAILED', 'Ma’lumotlarni himoyalangan xotiraga saqlab bo‘lmadi. Qayta urinib ko‘ring.');
    }
  }

  return {
    loadState: () => enqueue(loadInternal),
    saveState: async (state) => {
      // Snapshot before queuing: later UI changes cannot change an in-flight write.
      const snapshot = validateState(pruneHistory(state));
      return enqueue(() => saveInternal(snapshot));
    },
    clearState: () => enqueue(clearInternal),
  };
}

// The production adapter always uses OS-backed encrypted on-device storage.
// Lazy import keeps the domain/failure tests independent of the React Native runtime.
let nativeModule: Promise<typeof import('expo-secure-store')> | undefined;
function secureStore() { return nativeModule ??= import('expo-secure-store'); }
const native = createStateStorage({
  async getItemAsync(key) {
    const store = await secureStore();
    return store.getItemAsync(key, { keychainService: PREFIX, keychainAccessible: store.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  },
  async setItemAsync(key, value) {
    const store = await secureStore();
    await store.setItemAsync(key, value, { keychainService: PREFIX, keychainAccessible: store.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  },
  async deleteItemAsync(key) {
    const store = await secureStore();
    await store.deleteItemAsync(key, { keychainService: PREFIX, keychainAccessible: store.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  },
});

export const loadState = native.loadState;
export const saveState = native.saveState;
export const clearState = native.clearState;
