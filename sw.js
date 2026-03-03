const CACHE_NAME = 'book-summarizer-cache-v1';
const ASSETS = [
  './',
  './index.html',
  './index_ocr.html',
  './manifest.webmanifest',
  './app_ocr.js'
];
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.map((key) => (key !== CACHE_NAME ? caches.delete(key) : undefined)))
  ));
});
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(caches.match(event.request).then((response) => response || fetch(event.request)));
});
