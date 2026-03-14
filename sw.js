// AI Workspace Studio - Service Worker
const APP_VERSION = "83";
const CACHE_NAME = `aistudio-cache-v${APP_VERSION}`;
const CORE = [
  "./",
  "./index.html",
  `./app.js?v=${APP_VERSION}`,
  "./manifest.webmanifest",
  "./logo.svg",
  "./icons/icon-192.webp",
  "./icons/icon-512.webp"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(CORE);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k !== CACHE_NAME ? caches.delete(k) : null)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

async function swr(request){
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then((res) => {
    if (res && res.status === 200) cache.put(request, res.clone());
    return res;
  }).catch(() => cached);
  return cached || fetchPromise;
}

async function networkFirst(request){
  const cache = await caches.open(CACHE_NAME);
  try {
    const res = await fetch(request);
    if (res && res.status === 200) cache.put(request, res.clone());
    return res;
  } catch (_) {
    const cached = await cache.match(request);
    return cached || new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
}

function isDirectDownloadPath(pathname){
  return pathname.includes("/downloads/") ||
    pathname.endsWith("/downloads") ||
    /\.(apk|aab|zip)$/i.test(pathname);
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (event.request.mode === "navigate") {
    if (isDirectDownloadPath(url.pathname)) {
      event.respondWith(networkFirst(event.request));
      return;
    }
    const appShellRequest = new Request("./index.html", { cache: "no-store" });
    event.respondWith(networkFirst(appShellRequest));
    return;
  }
  if (url.origin === self.location.origin) {
    if (isDirectDownloadPath(url.pathname)) {
      event.respondWith(networkFirst(event.request));
      return;
    }
    if (url.pathname.endsWith("/app.js") || url.pathname.endsWith("/index.html")) {
      event.respondWith(networkFirst(event.request));
      return;
    }
    event.respondWith(swr(event.request));
  }
});
