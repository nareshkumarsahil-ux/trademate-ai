/* Network-first service worker so the PWA is installable without stale caches. */
const CACHE = 'trademate-shell-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(['/icons/icon-192.png', '/icons/icon-512.png', '/manifest.webmanifest'])));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith((async () => {
    try {
      const fresh = await fetch(req);
      if (fresh.ok && (url.pathname.startsWith('/icons/') || url.pathname.endsWith('manifest.webmanifest'))) {
        const copy = fresh.clone();
        const cache = await caches.open(CACHE);
        cache.put(req, copy);
      }
      return fresh;
    } catch {
      const cached = await caches.match(req);
      if (cached) return cached;
      throw new Error('offline');
    }
  })());
});
