const CACHE_NAME = 'the-hunt-shell-v1';
const APP_SHELL = [
  './',
  './index.html',
  './design.css',
  './creatures.css',
  './app.js',
  './manifest.webmanifest',
  './icons/hunt-mark.svg',
  './assets/domovoy/stage-1.png',
  './assets/domovoy/stage-2.png',
  './assets/domovoy/stage-3.png',
  './assets/domovoy/stage-1-hearth-wisp.png',
  './assets/domovoy/stage-2-hearth-sentinel.png',
  './assets/domovoy/stage-3-ancestral-guardian.png',
  './assets/leprechaun/stage-1.png',
  './assets/leprechaun/stage-2.png',
  './assets/leprechaun/stage-3.png',
  './assets/blue-men-of-the-minch/stage-1.png',
  './assets/blue-men-of-the-minch/stage-2.png',
  './assets/blue-men-of-the-minch/stage-3.png',
  './assets/wulver/stage-1.png',
  './assets/wulver/stage-2.png',
  './assets/wulver/stage-3.png',
  './assets/naga/stage-1.png',
  './assets/naga/stage-2.png',
  './assets/naga/stage-3.png',
  './assets/rusalka/stage-1.png',
  './assets/rusalka/stage-2.png',
  './assets/rusalka/stage-3.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((name) => name.startsWith('the-hunt-') && name !== CACHE_NAME).map((name) => caches.delete(name))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', copy));
          return response;
        })
        .catch(async () => (await caches.match(request)) || (await caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
