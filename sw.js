const CACHE_NAME = 'book-summarizer-cache-v1';
const ASSETS = [
  './',
  './index.html',
  './index_ocr.html',  // دعم للصفحة التي تحوي OCR
  './manifest.webmanifest',
  './app_ocr.js'       // ملف الجافاسكريبت الجديد
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
