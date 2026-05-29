const CACHE_NAME = "wordlover-shell-v61";
const SHELL_ASSETS = [
  "/",
  "/app.js?v=20260528-50",
  "/styles.css?v=20260528-50",
  "/wordlover-config.js?v=20260528-50",
  "/manifest.webmanifest",
  "/icon.svg",
  "/vendor/sql-wasm.js",
  "/vendor/sql-wasm.wasm",
  "/wa-sqlite-opfs-worker.js",
  "/vendor/wa-sqlite/LICENSE",
  "/vendor/wa-sqlite/dist/wa-sqlite-async.mjs",
  "/vendor/wa-sqlite/dist/wa-sqlite-async.wasm",
  "/vendor/wa-sqlite/src/sqlite-api.js",
  "/vendor/wa-sqlite/src/sqlite-constants.js",
  "/vendor/wa-sqlite/src/VFS.js",
  "/vendor/wa-sqlite/src/examples/OriginPrivateFileSystemVFS.js",
  "/vendor/wa-sqlite/src/examples/WebLocks.js",
  "/automated-tests.html",
  "/automated-tests.js?v=20260528-50",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)));
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
  if (url.pathname.endsWith("dictionary.sqlite.zst")) return;
  if (url.pathname.endsWith("dictionary-manifest.json")) return;

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
