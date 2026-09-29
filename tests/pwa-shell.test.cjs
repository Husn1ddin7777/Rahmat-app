'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const origin = 'https://rahmat.example';
const template = fs.readFileSync(path.join(root, 'public/sw.js'), 'utf8')
  .replace('__RAHMAT_BUILD_VERSION__', 'test-build')
  .replace('__RAHMAT_PRECACHE__', JSON.stringify(['/index.html', '/_expo/static/js/web/app.js', '/manifest.webmanifest']))
  .replace('__RAHMAT_QUOTE_IDS__', JSON.stringify(['small-and-steady']));

function runtime(options = {}) {
  const handlers = {};
  const effects = { deleted: [], shown: [], fetched: [], messages: [], focused: 0, opened: [], claimed: 0, cached: [], activated: 0 };
  const cache = {
    addAll: async (requests) => { effects.cached = requests; if (options.installFails) throw new Error('Bundle missing'); },
    match: async (url) => options.cachedResponse && url === '/index.html' ? options.cachedResponse : undefined,
    put: async () => {},
  };
  const self = {
    location: { origin },
    addEventListener: (name, handler) => { handlers[name] = handler; },
    skipWaiting: async () => { effects.activated++; },
    registration: { showNotification: async (title, data) => { effects.shown.push({ title, ...data }); } },
    clients: {
      claim: async () => { effects.claimed++; },
      matchAll: async () => options.openClient ? [{
        url: origin + '/',
        postMessage: (message) => effects.messages.push(message),
        focus: async () => { effects.focused++; },
      }] : [],
      openWindow: async (url) => { effects.opened.push(url); },
    },
  };
  class WorkerRequest extends Request {
    constructor(input, init) { super(typeof input === 'string' ? new URL(input, origin) : input, init); }
  }
  vm.runInNewContext(template, {
    self, URL, Request: WorkerRequest, Response,
    caches: {
      open: async () => cache,
      keys: async () => ['rahmat-shell-older', 'rahmat-shell-test-build', 'other-app-cache'],
      delete: async (name) => { effects.deleted.push(name); },
    },
    fetch: async (request) => { effects.fetched.push(request); return options.networkResponse ?? new Response('network'); },
  });
  async function dispatch(name, event = {}) {
    let promise;
    let response;
    handlers[name]({ ...event, waitUntil(value) { promise = value; }, respondWith(value) { response = value; } });
    if (promise) await promise;
    return response ? { intercepted: true, response: await response } : { intercepted: false };
  }
  return { effects, dispatch };
}

test('PWA install preloads the complete shell without credentials; a failed install removes only its new cache', async () => {
  const good = runtime();
  await good.dispatch('install');
  assert.equal(good.effects.cached.length, 3);
  assert.ok(good.effects.cached.every((request) => request.credentials === 'omit'));
  assert.deepEqual(good.effects.deleted, []);
  const failed = runtime({ installFails: true });
  await assert.rejects(failed.dispatch('install'), /Bundle missing/);
  assert.deepEqual(failed.effects.deleted, ['rahmat-shell-test-build']);
});

test('activation retires only obsolete Rahmat caches', async () => {
  const worker = runtime();
  await worker.dispatch('activate');
  assert.deepEqual(worker.effects.deleted, ['rahmat-shell-older']);
  assert.equal(worker.effects.claimed, 1);
});

test('API, auth, remote, write and query-bearing asset requests never enter the offline cache', async () => {
  const worker = runtime();
  for (const request of [
    new Request(origin + '/api/push/config'),
    new Request(origin + '/oauth/callback'),
    new Request('https://other.example/index.html'),
    new Request(origin + '/index.html', { method: 'POST', body: 'private' }),
    new Request(origin + '/index.html', { headers: { authorization: 'Bearer private' } }),
    new Request(origin + '/_expo/static/js/web/app.js?private=1'),
  ]) assert.equal((await worker.dispatch('fetch', { request })).intercepted, false);
  assert.equal(worker.effects.fetched.length, 0);
});

test('root navigation with a notification route receives the cached coherent app shell', async () => {
  const worker = runtime({ cachedResponse: new Response('offline-app') });
  const result = await worker.dispatch('fetch', {
    request: { method: 'GET', url: origin + '/?screen=istighfar', mode: 'navigate', headers: new Headers() },
  });
  assert.equal(result.intercepted, true);
  assert.equal(await result.response.text(), 'offline-app');
  assert.equal(worker.effects.fetched.length, 0);
});

test('Safari navigation receives no redirect metadata from either cached or network HTML', async () => {
  for (const source of ['cachedResponse', 'networkResponse']) {
    const redirected = new Response('app after redirect', { headers: { 'Content-Type': 'text/html', 'X-Test': 'preserved' } });
    Object.defineProperty(redirected, 'redirected', { value: true });
    const worker = runtime({ [source]: redirected });
    const result = await worker.dispatch('fetch', {
      request: { method: 'GET', url: origin + '/?source=homescreen', mode: 'navigate', headers: new Headers() },
    });
    assert.equal(result.response.redirected, false);
    assert.equal(result.response.status, 200);
    assert.equal(result.response.headers.get('Content-Type'), 'text/html');
    assert.equal(result.response.headers.get('X-Test'), 'preserved');
    assert.equal(await result.response.text(), 'app after redirect');
  }
});

test('recovery page bypasses the app shell and only that page can activate a waiting update', async () => {
  const worker = runtime();
  assert.equal((await worker.dispatch('fetch', { request: { method: 'GET', url: origin + '/repair.html', mode: 'navigate', headers: new Headers() } })).intercepted, false);
  for (const url of ['https://other.example/repair.html', origin + '/']) {
    await worker.dispatch('message', { data: { type: 'RAHMAT_RECOVER_UPDATE' }, source: { url } });
  }
  assert.equal(worker.effects.activated, 0);
  await worker.dispatch('message', { data: { type: 'RAHMAT_RECOVER_UPDATE' }, source: { url: origin + '/repair.html' } });
  assert.equal(worker.effects.activated, 1);
});

test('push displays a visible fallback for malformed data and discards untrusted routes', async () => {
  const worker = runtime();
  await worker.dispatch('push', { data: { json() { throw new Error('not JSON'); } } });
  assert.equal(worker.effects.shown[0].title, 'Rahmat');
  await worker.dispatch('push', { data: { json: () => ({ title: 'Eslatma', body: 'Kichik qadam.', screen: 'https://evil.example', quoteId: 'unknown', url: 'https://evil.example' }) } });
  const second = worker.effects.shown[1];
  assert.equal(second.data.screen, 'today');
  assert.equal(second.data.quoteId, undefined);
  assert.equal(second.data.url, undefined);
});

test('notification click focuses and messages an existing app without navigating or reloading it', async () => {
  const worker = runtime({ openClient: true });
  let closed = false;
  await worker.dispatch('notificationclick', { notification: { data: { screen: 'istighfar' }, close: () => { closed = true; } } });
  assert.equal(closed, true);
  assert.equal(worker.effects.focused, 1);
  assert.equal(worker.effects.messages[0].type, 'RAHMAT_NOTIFICATION_OPEN');
  assert.equal(worker.effects.messages[0].screen, 'istighfar');
  assert.deepEqual(worker.effects.opened, []);
});

test('notification click opens only the same-origin app with a vetted quote ID', async () => {
  const worker = runtime();
  await worker.dispatch('notificationclick', { notification: { data: { screen: 'today', quoteId: 'small-and-steady', url: 'https://evil.example' }, close() {} } });
  assert.equal(worker.effects.opened[0], origin + '/?screen=today&quoteId=small-and-steady');
});

test('subscription rotation asks open clients to reconcile their subscription', async () => {
  const worker = runtime({ openClient: true });
  await worker.dispatch('pushsubscriptionchange');
  assert.equal(worker.effects.messages[0].type, 'RAHMAT_PUSH_SUBSCRIPTION_CHANGED');
});
