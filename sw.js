// AI Workspace Studio - Service Worker
const APP_VERSION = "910";
const CACHE_NAME = `aistudio-cache-v${APP_VERSION}`;
const CORE = [
  "./",
  "./index.html",
  "./auth-bridge.html",
  `./app.js?v=${APP_VERSION}`,
  "./manifest.webmanifest",
  "./logo.svg",
  "./icons/icon-192.webp",
  "./icons/icon-512.webp"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Use no-cache on pre-cache fetches so stale CDNs never poison the shell.
    // One asset failing must not block SW install.
    await Promise.all(CORE.map(async (url) => {
      try {
        const res = await fetch(url, { cache: "no-cache" });
        if (res && res.status === 200) await cache.put(url, res.clone());
      } catch (_) {}
    }));
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
  if (event.data && event.data.type === "CLEAR_CACHE") {
    event.waitUntil((async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    })());
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
    const res = await fetch(request, { cache: 'no-store' });
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

function isDirectHtmlAsset(pathname){
  return /\.(html?|txt|xml|json|webmanifest)$/i.test(pathname);
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (event.request.mode === "navigate") {
    if (isDirectDownloadPath(url.pathname) || isDirectHtmlAsset(url.pathname)) {
      event.respondWith(networkFirst(event.request));
      return;
    }
    const appShellRequest = new Request("./index.html", { cache: "no-store" });
    event.respondWith(networkFirst(appShellRequest));
    return;
  }
  if (isDirectDownloadPath(url.pathname)) {
    event.respondWith(networkFirst(event.request));
    return;
  }
  // App shell + primary code always network-first so users never get stuck on an old release.
  if (
    url.pathname.endsWith("/app.js") ||
    url.pathname.endsWith("/index.html") ||
    url.pathname.endsWith("/auth-bridge.html") ||
    url.pathname.endsWith("/manifest.webmanifest") ||
    url.pathname.endsWith("/sw.js") ||
    url.pathname === "/" ||
    url.pathname === ""
  ) {
    event.respondWith(networkFirst(event.request));
    return;
  }
  event.respondWith(swr(event.request));
});
