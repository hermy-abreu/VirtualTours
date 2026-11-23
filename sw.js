const cachePrefix = 'virtualtours-' + self.registration.scope + '-';
const cacheName = cachePrefix + '__CACHE_VERSION__';
const assets = new Set(__PRECACHE__.map(path => new URL(path, self.registration.scope).href));

self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll([...assets])));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith(cachePrefix) && key !== cacheName) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (request.mode === 'navigate' && request.url.startsWith(self.registration.scope)) {
    event.respondWith(fetch(request).catch(async () => {
      const cache = await caches.open(cacheName);
      return cache.match(new URL('index.html', self.registration.scope));
    }));
  } else if (assets.has(request.url)) {
    event.respondWith(caches.open(cacheName).then(async cache => await cache.match(request) ?? fetch(request)));
  }
});
