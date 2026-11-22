// Offline support. Network first, so a new version shows up as soon as the device is online;
// the cached copy is only used when the network is unavailable.
const CACHE = 'math-fasters-v2';
const sameOrigin = req => new URL(req.url).origin === self.location.origin;
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    // 'no-cache' makes the browser check each file with the server, so the page and its scripts
    // always come from the same version (a stale script with a fresh page once left the pilot screen blank).
    fetch(e.request, sameOrigin(e.request) ? { cache: 'no-cache' } : undefined).then(res => {
      if (res.ok || res.type === 'opaque') {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
