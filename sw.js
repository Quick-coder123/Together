const CACHE = 'hamelyky-v49';
const SHELL = [
  '/', '/index.html', '/styles.css', '/manifest.webmanifest',
  '/js/app.js', '/js/games.js', '/js/osm.js', '/js/push.js', '/js/store.js', '/js/ui.js', '/js/derive.js', '/js/whisper.js', '/js/petlive.js', '/js/pet3d.js', '/js/pet3d-acc.js', '/js/gestures.js', '/js/live.js', '/js/know.js', '/js/draw.js', '/js/voice-ui.js', '/img/hami3d.bin',
  '/js/views/me.js', '/js/views/places.js', '/js/views/home.js', '/js/views/wish.js', '/js/views/more.js',
  '/lib/core.js', '/icons/icon.svg', '/icons/icon-192.png', '/icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// Network first so updates arrive at once; cache is the offline fallback. API is never cached.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return res; })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('/index.html')))
  );
});

// Push notifications
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data?.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Хамелеончики', {
    body: d.body || '',
    tag: d.tag || undefined,
    renotify: !!d.tag,
    icon: '/icons/icon-192.png?v=2',
    badge: '/icons/icon-192.png?v=2',
    data: { url: d.url || '/' },
  }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || '/', self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) if (c.url.startsWith(self.location.origin)) { c.focus(); c.postMessage({ type: 'refresh' }); return; }
    return self.clients.openWindow(url);
  }));
});
