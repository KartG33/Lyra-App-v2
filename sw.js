const CACHE = 'lyra-v1';
const ASSETS = [
  '/LYRA-APP/',
  '/LYRA-APP/index.html',
  '/LYRA-APP/manifest.json',
  '/LYRA-APP/assets/css/main.css',
  '/LYRA-APP/assets/js/app.js',
  '/LYRA-APP/assets/js/parser.js',
  '/LYRA-APP/assets/js/render.js',
  '/LYRA-APP/assets/js/sidebar.js',
  '/LYRA-APP/assets/js/storage.js',
  '/LYRA-APP/assets/icons/favicon-192x192.png',
  '/LYRA-APP/assets/icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
