'use strict';

// Replaced by scripts/build-pwa.cjs after Expo exports the web bundle.
const VERSION = '__RAHMAT_BUILD_VERSION__';
const PRECACHE = __RAHMAT_PRECACHE__;
const QUOTE_IDS = new Set(__RAHMAT_QUOTE_IDS__);
const CACHE_PREFIX = 'rahmat-shell-';
const CACHE_NAME = CACHE_PREFIX + VERSION;
const PUBLIC_PATHS = new Set(PRECACHE);

function navigationResponse(response) {
  // Safari rejects a followed-redirect Response in respondWith for navigation.
  // Copy only the body/status/headers, dropping the original response URL list.
  return response.redirected ? new Response(response.body, {
    status: response.status, statusText: response.statusText, headers: response.headers,
  }) : response;
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      // A failed/missing asset rejects installation; the existing app stays intact.
      await cache.addAll(PRECACHE.map((path) => new Request(path, { cache: 'reload', credentials: 'omit' })));
    } catch (error) {
      await caches.delete(CACHE_NAME);
      throw error;
    }
    // Deliberately no skipWaiting: do not interrupt unsaved taps in an open app.
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || request.headers.has('authorization')) return;

  // Only the public app entry and exact build assets belong to this cache.
  // API, auth, remote requests and user data never enter it.
  const shellNavigation = request.mode === 'navigate' && (url.pathname === '/' || url.pathname === '/index.html');
  const path = shellNavigation ? '/index.html' : url.pathname;
  if (!shellNavigation && (url.search || !PUBLIC_PATHS.has(path))) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(path);
    if (cached) return shellNavigation ? navigationResponse(cached) : cached;
    // The cached HTML and hashed bundle always come from the same installation.
    // A new build becomes active after every old app window has closed.
    const response = await fetch(new Request(path, { credentials: 'omit', cache: 'no-cache' }));
    if (response.ok && response.type === 'basic' && PUBLIC_PATHS.has(path)) await cache.put(path, response.clone());
    return shellNavigation ? navigationResponse(response) : response;
  })());
});

self.addEventListener('message', (event) => {
  // The recovery page is outside the old broken shell's fetch paths. Only its
  // explicit button may activate an update while an old error window is open.
  if (event.data?.type !== 'RAHMAT_RECOVER_UPDATE' || !event.source?.url) return;
  const source = new URL(event.source.url);
  if (source.origin === self.location.origin && source.pathname === '/repair.html') {
    event.waitUntil(self.skipWaiting());
  }
});

function notificationData(payload) {
  const screen = payload && payload.screen === 'istighfar' ? 'istighfar' : 'today';
  const quoteId = payload && typeof payload.quoteId === 'string' && QUOTE_IDS.has(payload.quoteId) ? payload.quoteId : undefined;
  return { screen, ...(quoteId ? { quoteId } : {}) };
}

self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch (_) {}
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) payload = {};
  const title = typeof payload.title === 'string' && payload.title.trim() ? payload.title.slice(0, 80) : 'Rahmat';
  const body = typeof payload.body === 'string' && payload.body.trim() ? payload.body.slice(0, 500) : 'Yaxshi odatlar uchun kichik bir qadam.';
  const tag = typeof payload.tag === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(payload.tag) ? payload.tag : 'rahmat-reminder';
  event.waitUntil(self.registration.showNotification(title, {
    body,
    tag,
    lang: 'uz',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-96.png',
    data: notificationData(payload),
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = notificationData(event.notification.data);
  const target = new URL('/', self.location.origin);
  target.searchParams.set('screen', data.screen);
  if (data.quoteId) target.searchParams.set('quoteId', data.quoteId);
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find((client) => {
      const url = new URL(client.url);
      return url.origin === self.location.origin && (url.pathname === '/' || url.pathname === '/index.html');
    });
    if (existing) {
      // Route in memory instead of navigating/reloading a counter with pending saves.
      existing.postMessage({ type: 'RAHMAT_NOTIFICATION_OPEN', ...data });
      await existing.focus();
      return;
    }
    await self.clients.openWindow(target.href);
  })());
});

self.addEventListener('pushsubscriptionchange', (event) => {
  // Some browsers rotate subscriptions while no page is open. The next foreground
  // sync reconciles it with the server; this message makes an open page do it now.
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    windows.forEach((client) => client.postMessage({ type: 'RAHMAT_PUSH_SUBSCRIPTION_CHANGED' }));
  })());
});
