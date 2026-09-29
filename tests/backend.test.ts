import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { buildPushPayload } from '@block65/webcrypto-web-push';
import * as calendar from '../server/calendar';
import * as validation from '../server/validation';
import worker from '../server/index';
import type { BrowserSubscription, Delivery, DeviceRecord, DeviceStorage, Env, Registration } from '../server/types';

const now = Date.parse('2026-09-27T02:00:00Z'); // 07:00 in Tashkent.
const secret = 'a'.repeat(64);
const settings = {
  enabled: true, dayStart: 7, dayEnd: 21, sunnahPerDay: 3 as const,
  times: ['08:00', '11:00', '14:00', '17:00', '20:00'],
};
const base64 = (bytes: ArrayBuffer | Uint8Array): string => Buffer.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)).toString('base64url');
const bytes = (value: string): Uint8Array<ArrayBuffer> => Uint8Array.from(Buffer.from(value, 'base64url'));

const fixtures = (async () => {
  const receiver = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const vapid = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const vapidJwk = await crypto.subtle.exportKey('jwk', vapid.privateKey);
  const subscription: BrowserSubscription = {
    endpoint: 'https://web.push.apple.com/Qexample', expirationTime: null,
    keys: { p256dh: base64(await crypto.subtle.exportKey('raw', receiver.publicKey)), auth: base64(crypto.getRandomValues(new Uint8Array(16))) },
  };
  return {
    receiver, vapid, subscription,
    env: {
      VAPID_PUBLIC_KEY: base64(await crypto.subtle.exportKey('raw', vapid.publicKey)),
      VAPID_PRIVATE_KEY: vapidJwk.d!, VAPID_SUBJECT: 'mailto:maintainer@example.com',
    },
  };
})();

async function registration(overrides: Partial<Registration> = {}): Promise<Registration> {
  return { subscription: (await fixtures).subscription, settings: { ...settings, times: [...settings.times] }, timeZone: 'Asia/Tashkent', hasActiveReflections: true, ...overrides };
}

function compileModule<T>(file: string, dependencies: Record<string, unknown>, extras: Record<string, unknown> = {}): T {
  const fileName = resolve(__dirname, file);
  const output = ts.transpileModule(readFileSync(fileName, 'utf8'), {
    fileName, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  runInNewContext(`(function(require,module,exports){${output}\n})`, {
    Request, Response, URL, crypto, TextEncoder, TextDecoder, Uint8Array, btoa, atob, AbortSignal, Date,
    ...extras,
  })((name: string) => {
    if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
    return dependencies[name];
  }, module, module.exports);
  return module.exports as T;
}

function harness(start = now) {
  const state = {
    now: start, data: undefined as DeviceRecord | undefined, alarm: null as number | null,
    sent: [] as Delivery[], outcomes: [] as Array<'sent' | 'gone' | 'retry' | 'rejected'>,
  };
  const storage = {
    async get() { return state.data ? structuredClone(state.data) : undefined; },
    async put(_key: string, data: DeviceRecord) { state.data = structuredClone(data); },
    async delete() { state.data = undefined; return true; },
    async setAlarm(time: number) { state.alarm = time; },
    async deleteAlarm() { state.alarm = null; },
    async transaction<T>(operation: (transaction: DeviceStorage) => Promise<T>) { return operation(storage as DeviceStorage); },
  } as DeviceStorage;
  const module = compileModule<typeof import('../server/device')>('../server/device.ts', {
    './calendar': calendar, './validation': validation,
    './push': { async sendPush(_subscription: BrowserSubscription, delivery: Delivery) {
      state.sent.push(structuredClone(delivery));
      return state.outcomes.shift() ?? 'sent';
    } },
  }, { Date: class extends Date { static now() { return state.now; } } });
  let device = new module.ReminderDevice({ storage }, {} as Env);
  return {
    state,
    restart() { device = new module.ReminderDevice({ storage }, {} as Env); },
    alarm() { return device.alarm(); },
    request(method: string, path = '/api/push/subscription', body?: unknown) {
      return device.fetch(new Request(`https://rahmat.example${path}`, {
        method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
      }));
    },
  };
}

test('backend: Tashkent and fractional-offset wall times resolve exactly; DST gaps skip and folds occur once', () => {
  assert.equal(calendar.wallTimeToEpoch('2026-09-27', 8 * 60, 'Asia/Tashkent'), Date.parse('2026-09-27T03:00:00Z'));
  assert.equal(calendar.wallTimeToEpoch('2026-09-27', 8 * 60, 'Asia/Kathmandu'), Date.parse('2026-09-27T02:15:00Z'));
  assert.equal(calendar.wallTimeToEpoch('2026-03-08', 2 * 60 + 30, 'America/New_York'), null);
  assert.equal(calendar.wallTimeToEpoch('2026-11-01', 90, 'America/New_York'), Date.parse('2026-11-01T05:30:00Z'));
  assert.equal(calendar.wallTimeToEpoch('2026-09-27', 24 * 60, 'Asia/Tashkent'), Date.parse('2026-09-27T19:00:00Z'));
});

test('backend: five generic prompts plus three unique public Sunnah reminders stay inside daylight', async () => {
  const input = await registration();
  const day = calendar.deliveriesForDay(input, '2026-09-27');
  assert.equal(day.length, 8);
  assert.equal(day.filter((item) => item.notice.screen === 'istighfar').length, 5);
  assert.equal(new Set(day.map((item) => item.dueAt)).size, 8);
  assert.equal(new Set(day.map((item) => item.notice.id)).size, 8);
  for (const item of day) {
    assert.ok(item.dueAt >= now && item.expiresAt <= Date.parse('2026-09-27T16:00:00Z'));
    assert.ok(item.expiresAt > item.dueAt && item.expiresAt - item.dueAt <= 300_000);
    assert.ok(item.notice.url.startsWith(`/?screen=${item.notice.screen}`));
    assert.match(item.notice.tag, /^[a-zA-Z0-9_-]{1,100}$/);
    if (item.notice.screen === 'today') {
      assert.ok(item.notice.quoteId);
      assert.ok(item.notice.url.endsWith(`&quoteId=${item.notice.quoteId}`));
    }
    assert.ok(!JSON.stringify(item.notice).includes(input.subscription.keys.auth));
  }
  assert.deepEqual(day, calendar.deliveriesForDay(input, '2026-09-27'));
});

test('backend: inactive reflections remove only the five generic slots; disabled settings remove everything', async () => {
  const input = await registration({ hasActiveReflections: false });
  assert.equal(calendar.deliveriesForDay(input, '2026-09-27').length, 3);
  assert.equal(calendar.nextDelivery({ ...input, settings: { ...settings, enabled: false } }, now), null);
});

test('backend: next reminder advances across midnight, excludes handled IDs and never catches up past times', async () => {
  const input = await registration();
  const all = calendar.deliveriesForDay(input, '2026-09-27');
  const first = all[0]!;
  assert.ok(calendar.nextDelivery(input, first.dueAt)!.dueAt > first.dueAt);
  assert.notEqual(calendar.nextDelivery(input, now - 1, [first.notice.id])!.notice.id, first.notice.id);
  assert.match(calendar.nextDelivery(input, Date.parse('2026-09-27T18:00:00Z'))!.notice.id, /^2026-09-28-/);
});

test('backend: only Apple, Google and Mozilla push-service HTTPS endpoints are accepted', () => {
  for (const endpoint of ['https://web.push.apple.com/a', 'https://fcm.googleapis.com/fcm/send/a', 'https://updates.push.services.mozilla.com/wpush/v2/a']) {
    assert.equal(validation.validateEndpoint(endpoint), endpoint);
  }
  for (const endpoint of ['http://web.push.apple.com/a', 'https://localhost/a', 'https://127.0.0.1/a', 'https://web.push.apple.com.evil.example/a', 'https://web.push.apple.com:444/a', 'https://name:secret@web.push.apple.com/a', 'https://web.push.apple.com/a#fragment']) {
    assert.throws(() => validation.validateEndpoint(endpoint), validation.ApiError);
  }
});

test('backend: registration rejects private fields, malformed keys, timezone and non-boolean settings', async () => {
  const input = await registration();
  assert.deepEqual(await validation.validateRegistration(input, now), input);
  for (const change of [
    { reflection: 'private text' }, { timeZone: 'Invalid/City' }, { hasActiveReflections: 1 },
    { settings: { ...settings, enabled: 'true' } },
    { subscription: { ...input.subscription, keys: { ...input.subscription.keys, auth: 'abc' } } },
    { subscription: { ...input.subscription, expirationTime: now - 1 } },
  ]) await assert.rejects(validation.validateRegistration({ ...input, ...change }, now), validation.ApiError);
});

test('backend: streaming JSON has an 8 KiB limit even without a Content-Length header', async () => {
  const request = new Request('https://rahmat.example/api', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: 'a'.repeat(9000) }) });
  await assert.rejects(validation.readJson(request), (error: unknown) => error instanceof validation.ApiError && error.status === 413);
});

test('backend: bearer hash isolates devices and Worker strips raw credentials before forwarding', async () => {
  const request = new Request('https://rahmat.example/api/push/subscription', { method: 'DELETE', headers: { Authorization: `Bearer ${secret}` } });
  const name = await validation.deviceName(request);
  assert.match(name, /^[0-9a-f]{64}$/);
  assert.notEqual(name, secret);
  assert.notEqual(name, await validation.deviceName(new Request(request, { headers: { Authorization: `Bearer ${'b'.repeat(64)}` } })));
  let forwarded = false;
  const env = { DEVICES: {
    idFromName(value: string) { assert.equal(value, name); return value; },
    get() { return { async fetch(inner: Request) { forwarded = true; assert.equal(inner.headers.get('Authorization'), null); return new Response(null, { status: 204 }); } }; },
  } } as unknown as Env;
  assert.equal((await worker.fetch(request, env)).status, 204);
  assert.ok(forwarded);
  assert.equal((await worker.fetch(new Request(request, { headers: {} }), env)).status, 401);
});

test('backend: config exposes only public VAPID key; cross-origin mutation and unknown API paths fail closed', async () => {
  const env = (await fixtures).env as Env;
  const result = await worker.fetch(new Request('https://rahmat.example/api/push/config'), env);
  assert.deepEqual(await result.json(), { publicKey: env.VAPID_PUBLIC_KEY });
  assert.equal(result.headers.get('Cache-Control'), 'no-store');
  assert.equal((await worker.fetch(new Request('https://rahmat.example/api/push/config'), {} as Env)).status, 503);
  assert.equal((await worker.fetch(new Request('https://rahmat.example/api/push/subscription', { method: 'DELETE', headers: { Origin: 'https://evil.example', Authorization: `Bearer ${secret}` } }), env)).status, 403);
  assert.equal((await worker.fetch(new Request('https://rahmat.example/api/unknown'), env)).status, 404);
});

test('backend: repeated PUT preserves due jobs; successful alarm and object restart never replay a completed ID', async () => {
  const h = harness();
  const input = await registration();
  assert.equal((await h.request('PUT', undefined, input)).status, 200);
  const first = h.state.data!.next!;
  h.state.now += 1000;
  assert.equal((await h.request('PUT', undefined, input)).status, 200);
  assert.deepEqual(h.state.data!.next, first);
  h.state.now = first.dueAt;
  await h.alarm();
  assert.equal(h.state.sent.length, 1);
  assert.ok(h.state.data!.next!.dueAt > first.dueAt);
  assert.ok(h.state.data!.handled.includes(first.notice.id));
  h.restart();
  await h.alarm();
  assert.equal(h.state.sent.length, 1);
});

test('backend: retry keeps the same reminder ID and a persisted alarm; exhausted retries advance the schedule', async () => {
  const h = harness();
  await h.request('PUT', undefined, await registration());
  const first = h.state.data!.next!;
  h.state.now = first.dueAt;
  h.state.outcomes.push('retry', 'retry', 'retry');
  for (let index = 0; index < 3; index += 1) {
    await h.alarm();
    h.restart();
    if (index < 2) h.state.now = h.state.alarm!;
  }
  assert.equal(h.state.sent.length, 3);
  assert.equal(new Set(h.state.sent.map((item) => item.notice.id)).size, 1);
  assert.ok(h.state.data!.next!.dueAt > first.dueAt);
  assert.ok(h.state.alarm! > h.state.now);
});

test('backend: delayed jobs are discarded, not delivered at night or burst as catch-up notifications', async () => {
  const h = harness();
  await h.request('PUT', undefined, await registration());
  h.state.now = Date.parse('2026-09-27T17:00:00Z');
  await h.alarm();
  assert.equal(h.state.sent.length, 0);
  assert.match(h.state.data!.next!.notice.id, /^2026-09-28-/);
});

test('backend: expired push endpoint, stale registration and DELETE clear both record and alarm', async () => {
  for (const mode of ['gone', 'stale', 'delete'] as const) {
    const h = harness();
    await h.request('PUT', undefined, await registration());
    if (mode === 'delete') await h.request('DELETE');
    else {
      h.state.now = mode === 'stale' ? now + 91 * 86_400_000 : h.state.data!.next!.dueAt;
      h.state.outcomes.push('gone');
      await h.alarm();
    }
    assert.equal(h.state.data, undefined);
    assert.equal(h.state.alarm, null);
    h.restart();
    await h.alarm();
    assert.equal(h.state.data, undefined);
  }
});

test('backend: test push waits five seconds, retries request idempotently, and limits later requests', async () => {
  const h = harness();
  await h.request('PUT', undefined, await registration({ settings: { ...settings, enabled: false } }));
  assert.equal((await h.request('POST', '/api/push/test')).status, 202);
  const id = h.state.data!.test!.notice.id;
  assert.equal(h.state.alarm, now + 5000);
  assert.equal((await h.request('POST', '/api/push/test')).status, 202);
  assert.equal(h.state.data!.testCount, 1);
  await h.alarm();
  assert.equal(h.state.sent.length, 0);
  h.state.now += 5000;
  await h.alarm();
  assert.equal(h.state.sent[0]!.notice.id, id);
  assert.equal(h.state.data!.test, null);
  assert.equal((await h.request('POST', '/api/push/test')).status, 429);
  assert.equal(h.state.data!.next, null);
});

test('backend: only the permitted registration fields and public reminder data reach durable storage', async () => {
  const h = harness();
  const input = await registration();
  assert.equal((await h.request('PUT', undefined, { ...input, reflections: [{ text: 'secret', count: 42 }] })).status, 400);
  assert.equal(h.state.data, undefined);
  await h.request('PUT', undefined, input);
  const serialized = JSON.stringify(h.state.data);
  assert.ok(!serialized.includes(secret));
  assert.ok(!serialized.includes('reflections'));
  assert.ok(!serialized.includes('"count":'));
});

test('backend: test diagnostics require a device credential and never expose its subscription', async () => {
  const env = (await fixtures).env as Env;
  assert.equal((await worker.fetch(new Request('https://rahmat.example/api/push/status'), env)).status, 401);
  for (const outcome of ['sent', 'rejected', 'retry'] as const) {
    const h = harness();
    await h.request('PUT', undefined, await registration({ settings: { ...settings, enabled: false } }));
    await h.request('POST', '/api/push/test');
    assert.equal((await (await h.request('GET', '/api/push/status')).json() as any).pending, true);
    h.state.now += 5000;
    h.state.outcomes.push(outcome, outcome, outcome);
    await h.alarm();
    if (outcome === 'retry') { h.state.now += 15000; await h.alarm(); }
    const result = await (await h.request('GET', '/api/push/status')).json() as any;
    assert.equal(result.pending, false);
    assert.equal(result.result.outcome, outcome);
    assert.deepEqual(Object.keys(result).sort(), ['pending', 'registered', 'result']);
    assert.ok(!JSON.stringify(result).includes('push.apple.com'));
    await h.request('PUT', undefined, await registration({ settings: { ...settings, enabled: false } }));
    assert.equal((await (await h.request('GET', '/api/push/status')).json() as any).result.outcome, outcome);
    await h.request('DELETE');
    assert.equal((await (await h.request('GET', '/api/push/status')).json() as any).registered, false);
  }
});

test('backend: Web Push uses aes128gcm and valid VAPID; encrypted body decrypts to the exact generic notice', async () => {
  const f = await fixtures;
  const delivery = calendar.deliveriesForDay(await registration(), '2026-09-27')[0]!;
  let captured: RequestInit | undefined;
  const push = compileModule<typeof import('../server/push')>('../server/push.ts', {
    '@block65/webcrypto-web-push': { buildPushPayload }, './validation': validation,
  }, { async fetch(endpoint: string, init: RequestInit) {
    assert.equal(endpoint, f.subscription.endpoint);
    captured = init;
    return new Response(null, { status: 201 });
  } });
  assert.equal(await push.sendPush(f.subscription, delivery, f.env as Env, delivery.dueAt), 'sent');
  assert.equal(captured!.redirect, 'manual');
  const headers = new Headers(captured!.headers);
  assert.equal(headers.get('content-encoding'), 'aes128gcm');
  assert.equal(headers.get('ttl'), '300');
  assert.equal(headers.get('urgency'), 'high');
  assert.match(headers.get('topic')!, /^[A-Za-z0-9_-]{32}$/);
  const jwt = /^vapid t=([^,]+), k=/.exec(headers.get('authorization')!)![1]!;
  const jwtParts = jwt.split('.');
  const claims = JSON.parse(Buffer.from(jwtParts[1]!, 'base64url').toString());
  assert.equal(claims.aud, 'https://web.push.apple.com');
  assert.equal(claims.sub, f.env.VAPID_SUBJECT);
  assert.ok(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, f.vapid.publicKey,
    bytes(jwtParts[2]!), new TextEncoder().encode(`${jwtParts[0]}.${jwtParts[1]}`)));

  // Independent RFC 8291 receiver, using native HKDF rather than the sender library.
  const wire = Uint8Array.from(captured!.body as Uint8Array);
  assert.equal(wire.length, 4096);
  assert.equal(new DataView(wire.buffer).getUint32(16), 4096);
  assert.equal(wire[20], 65);
  const serverKey = wire.slice(21, 86);
  const senderPublic = await crypto.subtle.importKey('raw', serverKey, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = await crypto.subtle.deriveBits({ name: 'ECDH', public: senderPublic }, f.receiver.privateKey, 256);
  async function hkdf(ikm: ArrayBuffer | Uint8Array<ArrayBuffer>, salt: Uint8Array<ArrayBuffer>, info: Uint8Array<ArrayBuffer>, length: number) {
    const material = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
    return crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, material, length * 8);
  }
  const info = new Uint8Array([...new TextEncoder().encode('WebPush: info\0'), ...bytes(f.subscription.keys.p256dh), ...serverKey]);
  const ikm = await hkdf(shared, bytes(f.subscription.keys.auth), info, 32);
  const cek = await hkdf(ikm, wire.slice(0, 16), new TextEncoder().encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(ikm, wire.slice(0, 16), new TextEncoder().encode('Content-Encoding: nonce\0'), 12);
  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
  const plaintext = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, aes, wire.slice(86)));
  let end = plaintext.length - 1;
  while (plaintext[end] === 0) end -= 1;
  assert.equal(plaintext[end], 2);
  assert.deepEqual(JSON.parse(new TextDecoder().decode(plaintext.slice(0, end))), delivery.notice);
});
