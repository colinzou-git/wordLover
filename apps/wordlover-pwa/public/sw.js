const CACHE_NAME = "wordlover-shell-v30";
const SHELL_ASSETS = [
  "/",
  "/app.js?v=20260525-12",
  "/styles.css?v=20260525-12",
  "/wordlover-config.js?v=20260525-12",
  "/manifest.webmanifest",
  "/icon.svg",
  "/vendor/sql-wasm.js",
  "/vendor/sql-wasm.wasm",
  "/automated-tests.html",
  "/automated-tests.js?v=20260525-12",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.pathname.endsWith("dictionary.sqlite")) return;

  const shouldPreferNetwork =
    request.mode === "navigate" ||
    request.destination === "document" ||
    request.destination === "script" ||
    request.destination === "style" ||
    url.searchParams.has("fresh") ||
    url.searchParams.has("update-check");

  if (shouldPreferNetwork) {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(request).then((cached) => cached || caches.match(url.pathname) || caches.match("/")),
      ),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).catch(() => caches.match("/"));
    }),
  );
});
