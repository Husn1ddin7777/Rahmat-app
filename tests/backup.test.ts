import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import {
  BackupError, backupFileName, createBackup, fromBase64, MIN_PASSPHRASE_LENGTH, openBackup, passphraseProblem, readBackupEnvelope,
  summarizeBackup, toBase64, utf8Decode, utf8Encode, type BackupEnvelope,
} from '../src/domain/backup';
import { addCustomHabit, createInitialState, createReflection, incrementCount, saveEvening, type AppState } from '../src/domain/model';
import { createPinRecord, lockWith } from '../src/domain/lock';

const random = (length: number) => new Uint8Array(randomBytes(length));
// Small parameters keep the suite fast; the app uses the stronger defaults.
const fast = { N: 1024, r: 8, p: 1 };
const phrase = 'tog‘ va daryo yonida';

function sample(): AppState {
  let state = createReflection(createInitialState(), { label: 'Sabr — ўзбек 🌿', note: 'Ma’no', sessions: 2, target: 33 }, new Date('2026-10-20T08:00:00Z'))!.state;
  const id = state.reflections[0]!.id;
  state = incrementCount(state, id, 0, 12, '2026-10-21');
  state = addCustomHabit(state, { title: 'Kitob o‘qish', weekdays: [1, 3] }, new Date('2026-10-20T08:00:00Z'));
  state = saveEvening(state, { gratitude: 'Oila uchun shukr', improve: '', intention: 'Onamga qo‘ng‘iroq' }, '2026-10-21', new Date('2026-10-21T18:00:00Z'));
  return { ...state, settings: { ...state.settings, script: 'cyrillic', hijriOffset: 1 }, lock: lockWith('muhosaba', createPinRecord('2468', 'a'.repeat(32)), false) };
}

async function rejectsWith(promise: Promise<unknown>, code: string) {
  await assert.rejects(promise, (error: unknown) => error instanceof BackupError && error.code === code);
}

test('a backup restores every intention, count, habit, note, setting and lock exactly', async () => {
  const state = sample();
  const text = await createBackup(state, phrase, { randomBytes: random, kdf: fast, now: new Date('2026-10-22T05:00:00Z') });
  const restored = await openBackup(text, `  ${phrase} `);
  assert.deepEqual(restored, state);
  assert.deepEqual(summarizeBackup(restored, '2026-10-22T05:00:00.000Z'), { createdAt: '2026-10-22T05:00:00.000Z', reflections: 1, days: 1, habits: 1, lock: true });
  const envelope = readBackupEnvelope(text);
  assert.equal(envelope.createdAt, '2026-10-22T05:00:00.000Z');
  assert.equal(backupFileName(new Date(2026, 9, 22, 9)), 'rahmat-zaxira-2026-10-22.json');
});

test('nothing private is readable in the file without the secret phrase', async () => {
  const text = await createBackup(sample(), phrase, { randomBytes: random, kdf: fast });
  for (const secret of ['Sabr', 'Kitob', 'Oila', 'Onamga', 'muhosaba', 'salt":"aaaa', '2468']) assert.ok(!text.includes(secret), secret);
  const envelope = JSON.parse(text) as BackupEnvelope;
  assert.deepEqual(Object.keys(envelope).sort(), ['app', 'cipher', 'createdAt', 'data', 'kdf', 'kind', 'version']);
  const again = await createBackup(sample(), phrase, { randomBytes: random, kdf: fast });
  assert.notEqual(JSON.parse(again).data, envelope.data, 'a fresh salt and nonce every time');
});

test('a wrong phrase, a changed byte or an edited header is refused', async () => {
  const text = await createBackup(sample(), phrase, { randomBytes: random, kdf: fast, now: new Date('2026-10-22T05:00:00Z') });
  await rejectsWith(openBackup(text, 'boshqa maxfiy so‘z'), 'passphrase');
  const envelope = JSON.parse(text) as BackupEnvelope;
  const data = fromBase64(envelope.data);
  data[10] = data[10]! ^ 1;
  await rejectsWith(openBackup(JSON.stringify({ ...envelope, data: toBase64(data) }), phrase), 'passphrase');
  await rejectsWith(openBackup(JSON.stringify({ ...envelope, createdAt: '2020-01-01T00:00:00.000Z' }), phrase), 'passphrase');
});

test('files that are not Rahmat backups, or would cost too much memory, are rejected before any work', async () => {
  const text = await createBackup(sample(), phrase, { randomBytes: random, kdf: fast });
  const envelope = JSON.parse(text) as BackupEnvelope;
  const variants: Array<[unknown, string]> = [
    ['not json', 'format'], [JSON.stringify({ app: 'other' }), 'format'], [JSON.stringify({ ...envelope, version: 2 }), 'version'],
    [JSON.stringify({ ...envelope, kdf: { ...envelope.kdf, N: 1 << 20 } }), 'format'],
    [JSON.stringify({ ...envelope, kdf: { ...envelope.kdf, N: 3000 } }), 'format'],
    [JSON.stringify({ ...envelope, kdf: { ...envelope.kdf, r: 64 } }), 'format'],
    [JSON.stringify({ ...envelope, kdf: { ...envelope.kdf, salt: 'short' } }), 'format'],
    [JSON.stringify({ ...envelope, cipher: { ...envelope.cipher, nonce: toBase64(random(12)) } }), 'format'],
    [JSON.stringify({ ...envelope, data: '!!!' }), 'format'],
    ['x'.repeat(4_000_001), 'size'],
  ];
  for (const [input, code] of variants) assert.throws(() => readBackupEnvelope(input as string), (error: unknown) => error instanceof BackupError && error.code === code, String(input).slice(0, 60));
});

test('a backup whose content is not a valid Rahmat state is not restored', async () => {
  const bad = { ...sample(), version: 9 } as unknown as AppState;
  await assert.rejects(createBackup(bad, phrase, { randomBytes: random, kdf: fast }));
});

test('secret phrases must be at least eight characters', async () => {
  assert.ok(passphraseProblem('qisqa'));
  assert.ok(passphraseProblem('   1234567  '), 'surrounding spaces do not count');
  assert.equal(passphraseProblem('12345678'), null);
  assert.equal(MIN_PASSPHRASE_LENGTH, 8);
  await rejectsWith(createBackup(sample(), 'qisqa', { randomBytes: random, kdf: fast }), 'passphrase');
});

test('the built-in UTF-8 and Base64 codecs agree with the platform', () => {
  for (const text of ['', 'a', 'o‘zbek ўзбек', '🌿 emoji ﷺ أَسْتَغْفِرُ', 'x'.repeat(1000)]) {
    assert.deepEqual(Buffer.from(utf8Encode(text)), Buffer.from(text, 'utf8'));
    assert.equal(utf8Decode(utf8Encode(text)), text);
  }
  for (let length = 0; length < 40; length += 1) {
    const bytes = random(length);
    assert.equal(toBase64(bytes), Buffer.from(bytes).toString('base64'));
    assert.deepEqual(Buffer.from(fromBase64(toBase64(bytes))), Buffer.from(bytes));
  }
  assert.throws(() => utf8Decode(Uint8Array.from([0xc3])));
  assert.throws(() => fromBase64('abc'));
});
