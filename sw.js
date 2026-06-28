/* OpenRC28 service worker: offline app shell + push handling. */
const CACHE = 'openrc28-v2';
const ASSETS = ['./', './index.html', './styles.css', './config.js', './sessions.js', './app.js', './icon.png', './manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
// Network-first: online visitors always get the latest content; the cache is a
// fallback for offline. This way, updating the site (same URL/QR) reaches users.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok && new URL(e.request.url).origin === self.location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
// Fires when a backend sends a push to a subscribed (home-screen-installed) device.
self.addEventListener('push', (e) => {
  let d = { title: 'OpenRC28', body: '' };
  try { d = e.data.json(); } catch (err) { if (e.data) d.body = e.data.text(); }
  e.waitUntil(self.registration.showNotification(d.title || 'OpenRC28', { body: d.body || '', icon: './icon.png' }));
});
self.addEventListener('notificationclick', (e) => { e.notification.close(); e.waitUntil(clients.openWindow('./')); });
