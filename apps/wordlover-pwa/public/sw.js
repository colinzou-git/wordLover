const CACHE_NAME = "wordlover-shell-v123";
const REQUIRED_SHELL_ASSETS = [
  "/",
  "/app.js?v=20260607-10",
  "/persistence.js?v=20260607-10",
  "/spelling.js?v=20260607-10",
  "/ui-preferences.js?v=20260607-10",
  "/review-state.js?v=20260607-10",
  "/study-one-more.js?v=20260607-10",
  "/sync.js?v=20260607-10",
  "/fsrs-scheduler.js?v=20260607-10",
  "/goal-forecast.js?v=20260607-10",
  "/tracks.js?v=20260607-10",
  "/styles.css?v=20260607-10",
  "/wordlover-config.js?v=20260607-10",
  "/manifest.webmanifest",
  "/icon.svg",
  "/vendor/sql-wasm.js",
  "/vendor/sql-wasm.wasm",
  "/vendor/ts-fsrs/index.mjs",
];

const OPTIONAL_SHELL_ASSETS = [
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
  "/automated-tests.js?v=20260607-10",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      await cache.addAll(REQUIRED_SHELL_ASSETS);
    } catch (error) {
      throw new Error(`Required WordFan shell asset failed to cache: ${error instanceof Error ? error.message : String(error)}`);
    }
    await Promise.all(OPTIONAL_SHELL_ASSETS.map(async (asset) => {
      try {
        const response = await fetch(asset, { cache: "reload" });
        if (response.ok) await cache.put(asset, response);
      } catch {
        /* Optional experimental/test assets must not block install. */
      }
    }));
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ).then(() => self.clients.claim()),
  );
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
