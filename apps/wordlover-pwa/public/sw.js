const CACHE_NAME = "wordlover-shell-v133";
// Staging cache for atomic installs: required assets are written here first and the
// live cache is only updated once every one of them succeeds, so an interrupted or
// partly-failed install can never leave a half-populated shell that the app trusts.
const STAGING_CACHE_NAME = `${CACHE_NAME}-staging`;
const SHELL_CACHE_PREFIX = "wordlover-shell-";

const REQUIRED_SHELL_ASSETS = [
  "/",
  "/app.js?v=20260618-1",
  "/full-dictionary.js?v=20260618-1",
  "/persistence.js?v=20260618-1",
  "/spelling.js?v=20260618-1",
  "/ui-preferences.js?v=20260618-1",
  "/review-state.js?v=20260618-1",
  "/study-one-more.js?v=20260618-1",
  "/sync.js?v=20260618-1",
  "/fsrs-scheduler.js?v=20260618-1",
  "/goal-forecast.js?v=20260618-1",
  "/tracks.js?v=20260618-1",
  "/styles.css?v=20260618-1",
  "/wordlover-config.js?v=20260618-1",
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
  "/automated-tests.js?v=20260618-1",
];

// Bounded timeouts. The root cause of the offline hang is that an unbounded
// fetch() can stay pending forever on iOS Safari / installed PWAs when the
// network is "connected but useless" (no internet, stalled DNS/TLS, captive
// portal), so the cached fallback is never reached. Every startup-critical
// fetch in this worker is bounded so the cache is always reached promptly.
const NAV_TIMEOUT_MS = 2500;      // navigation / document / script / style network-first
const RUNTIME_TIMEOUT_MS = 5000;  // non-critical uncached runtime requests + update checks
const INSTALL_TIMEOUT_MS = 15000; // required asset downloads during install

async function fetchWithTimeout(input, init = {}, timeoutMs = NAV_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function isUsableResponse(response) {
  // A real success we can serve or cache. Opaque/redirect/error responses are not
  // usable as shell content and must fall through to the cache instead.
  return Boolean(response) && response.ok && response.type !== "opaqueredirect" && response.type !== "error";
}

// ---------------------------------------------------------------------------
// Install: cache every required asset explicitly, with per-asset diagnostics.
// ---------------------------------------------------------------------------
self.addEventListener("install", (event) => {
  event.waitUntil(installShell());
});

async function installShell() {
  // Drop any leftovers from a previous interrupted install attempt.
  await caches.delete(STAGING_CACHE_NAME);
  const staging = await caches.open(STAGING_CACHE_NAME);

  // The staging cache is always cleaned up — on success (after promotion) and on
  // failure — so an aborted/failed install never leaves a half-populated cache.
  try {
    const failed = [];
    for (const asset of REQUIRED_SHELL_ASSETS) {
      try {
        const response = await fetchWithTimeout(asset, { cache: "reload" }, INSTALL_TIMEOUT_MS);
        if (!response.ok) {
          failed.push(`${asset} -> HTTP ${response.status}`);
          continue;
        }
        await staging.put(asset, response.clone());
      } catch (error) {
        const reason = error && error.name === "AbortError" ? "timeout" : (error && error.message) || String(error);
        failed.push(`${asset} -> ${reason}`);
      }
    }

    if (failed.length) {
      // Do not activate an incomplete shell. The existing valid shell cache (a
      // different version name) is untouched; the staging cache is dropped below.
      const message = `WordFan shell install failed; required assets unavailable: ${failed.join("; ")}`;
      console.error(`[sw] ${message}`); // logged (and thrown) so the exact assets are diagnosable
      throw new Error(message);
    }

    // Optional assets must not block install, but their failures stay diagnosable.
    for (const asset of OPTIONAL_SHELL_ASSETS) {
      try {
        const response = await fetchWithTimeout(asset, { cache: "reload" }, INSTALL_TIMEOUT_MS);
        if (response.ok) await staging.put(asset, response.clone());
        else console.warn(`[sw] optional asset ${asset} -> HTTP ${response.status}`);
      } catch (error) {
        console.warn(`[sw] optional asset ${asset} failed:`, (error && error.message) || error);
      }
    }

    // Promote staging into the live (versioned) cache. The live cache name only
    // ever holds a complete shell because nothing is served from a brand-new
    // version until activate(), and a same-version reinstall only overwrites
    // entries here after staging has fully succeeded.
    const live = await caches.open(CACHE_NAME);
    for (const request of await staging.keys()) {
      const response = await staging.match(request);
      if (response) await live.put(request, response);
    }
  } finally {
    await caches.delete(STAGING_CACHE_NAME);
  }
}

// ---------------------------------------------------------------------------
// Activate: drop only obsolete WordFan shell caches, then take control.
// ---------------------------------------------------------------------------
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith(SHELL_CACHE_PREFIX) && key !== CACHE_NAME)
        .map((key) => caches.delete(key)),
    );
    await self.clients.claim();
  })());
});

// ---------------------------------------------------------------------------
// Messages: explicit update apply + offline-readiness report.
// ---------------------------------------------------------------------------
self.addEventListener("message", (event) => {
  const data = event.data;
  if (data && data.type === "SKIP_WAITING") {
    // Product requirement: only ever skip waiting on explicit user action.
    self.skipWaiting();
    return;
  }
  if (data && data.type === "CHECK_OFFLINE_READY") {
    event.waitUntil(reportOfflineReady(event));
  }
});

async function reportOfflineReady(event) {
  const live = await caches.open(CACHE_NAME);
  const missing = [];
  for (const asset of REQUIRED_SHELL_ASSETS) {
    const hit = (await live.match(asset)) || (await live.match(asset, { ignoreSearch: true }));
    if (!hit) missing.push(asset);
  }
  const payload = { type: "OFFLINE_READY", ready: missing.length === 0, cacheName: CACHE_NAME, missing };
  const port = event.ports && event.ports[0];
  if (port) port.postMessage(payload);
  else if (event.source) event.source.postMessage(payload);
}

// ---------------------------------------------------------------------------
// Fetch: bounded network-first for the shell, never HTML-for-JS fallbacks.
// ---------------------------------------------------------------------------
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Let the browser handle cross-origin requests (CDNs, Google, Gemini, fonts).
  if (url.origin !== self.location.origin) return;

  // The installed dictionary loads from IndexedDB/OPFS, never Cache Storage.
  if (url.pathname.endsWith("dictionary.sqlite")) return;
  if (url.pathname.endsWith("dictionary.sqlite.zst")) return;
  if (url.pathname.endsWith("dictionary-manifest.json")) return;
  // Full dictionary shards are integrity-checked and versioned by the app.
  if (url.pathname.includes("/dictionary-full/")) return;

  // Update checks stay network-only and bounded; never satisfied by stale cache.
  if (url.searchParams.has("update-check")) {
    event.respondWith(fetchWithTimeout(request, {}, RUNTIME_TIMEOUT_MS));
    return;
  }

  const destination = request.destination;
  if (request.mode === "navigate" || destination === "document") {
    event.respondWith(handleNavigation(request, url));
    return;
  }
  if (destination === "script" || destination === "style") {
    event.respondWith(handleScriptOrStyle(request, url));
    return;
  }
  event.respondWith(handleStaticAsset(request));
});

async function handleNavigation(request, url) {
  try {
    const response = await fetchWithTimeout(request, {}, NAV_TIMEOUT_MS);
    if (isUsableResponse(response)) {
      // Keep the cached document for this path fresh (normalized to the pathname
      // so cache-buster query strings do not bloat the cache).
      const live = await caches.open(CACHE_NAME);
      live.put(url.pathname, response.clone()).catch(() => {});
      return response;
    }
  } catch {
    /* offline / timeout / stalled — fall through to the cached shell */
  }

  const live = await caches.open(CACHE_NAME);
  const exact = await live.match(request);
  if (exact) return exact;
  const byPath = await live.match(url.pathname);
  if (byPath) return byPath;
  const root = await live.match("/");
  if (root) return root;

  // No shell cached yet: the app was never opened online. Say so explicitly
  // instead of hanging or returning a blank page.
  return offlineInstallResponse();
}

async function handleScriptOrStyle(request, url) {
  try {
    const response = await fetchWithTimeout(request, {}, NAV_TIMEOUT_MS);
    if (isUsableResponse(response)) {
      const live = await caches.open(CACHE_NAME);
      live.put(request, response.clone()).catch(() => {});
      return response;
    }
  } catch {
    /* fall through to the cache */
  }

  const live = await caches.open(CACHE_NAME);
  const exact = await live.match(request);
  if (exact) return exact;
  // Safe pathname match (ignores the ?v= cache-buster) — same asset, any version.
  const byPath = await live.match(request, { ignoreSearch: true });
  if (byPath) return byPath;

  // Never return "/" or index.html for a script/style: HTML served as JS causes a
  // MIME/syntax error that breaks the whole app. Fail cleanly instead.
  return Response.error();
}

async function handleStaticAsset(request) {
  const live = await caches.open(CACHE_NAME);
  const cached = (await live.match(request)) || (await live.match(request, { ignoreSearch: true }));
  if (cached) return cached;
  try {
    const response = await fetchWithTimeout(request, {}, RUNTIME_TIMEOUT_MS);
    if (isUsableResponse(response)) {
      live.put(request, response.clone()).catch(() => {});
    }
    // Pass even non-ok responses through unchanged; never fake HTML for an asset.
    return response;
  } catch {
    return Response.error();
  }
}

function offlineInstallResponse() {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>WordFan — offline</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; margin: 0; min-height: 100vh;
         display: flex; align-items: center; justify-content: center; padding: 24px;
         background: #256d85; color: #fff; }
  main { max-width: 28rem; text-align: center; line-height: 1.5; }
  h1 { font-size: 1.35rem; margin: 0 0 .5rem; }
  p { opacity: .92; margin: 0; }
</style>
</head>
<body>
<main>
  <h1>WordFan isn't ready for offline use yet</h1>
  <p>Open WordFan once while connected to the internet so it can finish installing.
     After that it works offline.</p>
</main>
</body>
</html>`;
  return new Response(html, {
    status: 503,
    statusText: "Offline — installation incomplete",
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}
