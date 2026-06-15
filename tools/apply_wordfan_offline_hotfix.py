#!/usr/bin/env python3
from __future__ import annotations

import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PWA = ROOT / "apps" / "wordlover-pwa"
PUBLIC = PWA / "public"
OLD_ASSET_VERSION = "20260610-3"
NEW_ASSET_VERSION = "20260614-1"
OLD_CACHE = "wordlover-shell-v129"
NEW_CACHE = "wordlover-shell-v130"
OLD_APP_VERSION = "0.6.2-product.20260610-3-v129"
NEW_APP_VERSION = "0.6.3-product.20260614-1-v130"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write(path: Path, content: str) -> None:
    path.write_text(content, encoding="utf-8", newline="\n")


def replace_exact(path: Path, old: str, new: str, expected: int = 1) -> None:
    content = read(path)
    count = content.count(old)
    if count != expected:
        raise RuntimeError(f"{path}: expected {expected} occurrence(s), found {count} for marker {old[:80]!r}")
    write(path, content.replace(old, new))


def replace_all(path: Path, old: str, new: str) -> None:
    content = read(path)
    count = content.count(old)
    if not count:
        raise RuntimeError(f"{path}: marker not found: {old!r}")
    write(path, content.replace(old, new))


write(PUBLIC / "sw.js", 'const CACHE_NAME = "wordlover-shell-v130";\nconst SHELL_CACHE_PREFIX = "wordlover-shell-";\nconst NETWORK_TIMEOUT_MS = 2500;\nconst INSTALL_FETCH_TIMEOUT_MS = 15000;\n\nconst REQUIRED_SHELL_ASSETS = [\n  "/",\n  "/app.js?v=20260614-1",\n  "/persistence.js?v=20260614-1",\n  "/spelling.js?v=20260614-1",\n  "/ui-preferences.js?v=20260614-1",\n  "/review-state.js?v=20260614-1",\n  "/study-one-more.js?v=20260614-1",\n  "/sync.js?v=20260614-1",\n  "/fsrs-scheduler.js?v=20260614-1",\n  "/goal-forecast.js?v=20260614-1",\n  "/tracks.js?v=20260614-1",\n  "/styles.css?v=20260614-1",\n  "/wordlover-config.js?v=20260614-1",\n  "/manifest.webmanifest",\n  "/icon.svg",\n  "/vendor/sql-wasm.js",\n  "/vendor/sql-wasm.wasm",\n  "/vendor/ts-fsrs/index.mjs",\n];\n\nconst OPTIONAL_SHELL_ASSETS = [\n  "/wa-sqlite-opfs-worker.js",\n  "/vendor/wa-sqlite/LICENSE",\n  "/vendor/wa-sqlite/dist/wa-sqlite-async.mjs",\n  "/vendor/wa-sqlite/dist/wa-sqlite-async.wasm",\n  "/vendor/wa-sqlite/src/sqlite-api.js",\n  "/vendor/wa-sqlite/src/sqlite-constants.js",\n  "/vendor/wa-sqlite/src/VFS.js",\n  "/vendor/wa-sqlite/src/examples/OriginPrivateFileSystemVFS.js",\n  "/vendor/wa-sqlite/src/examples/WebLocks.js",\n  "/automated-tests.html",\n  "/automated-tests.js?v=20260614-1",\n];\n\nfunction errorMessage(error) {\n  return error instanceof Error ? error.message : String(error);\n}\n\nasync function fetchWithTimeout(input, options = {}, timeoutMs = NETWORK_TIMEOUT_MS) {\n  const controller = new AbortController();\n  const timer = setTimeout(() => controller.abort(), timeoutMs);\n  try {\n    return await fetch(input, { ...options, signal: controller.signal });\n  } finally {\n    clearTimeout(timer);\n  }\n}\n\nasync function cacheRequiredShell() {\n  const cache = await caches.open(CACHE_NAME);\n  const failures = [];\n  await Promise.all(REQUIRED_SHELL_ASSETS.map(async (asset) => {\n    try {\n      const response = await fetchWithTimeout(asset, { cache: "reload" }, INSTALL_FETCH_TIMEOUT_MS);\n      if (!response.ok) throw new Error(`HTTP ${response.status}`);\n      await cache.put(asset, response);\n    } catch (error) {\n      failures.push(`${asset}: ${errorMessage(error)}`);\n    }\n  }));\n  if (failures.length) {\n    await caches.delete(CACHE_NAME);\n    throw new Error(`Required WordFan shell assets failed to cache: ${failures.join("; ")}`);\n  }\n\n  await Promise.all(OPTIONAL_SHELL_ASSETS.map(async (asset) => {\n    try {\n      const response = await fetchWithTimeout(asset, { cache: "reload" }, INSTALL_FETCH_TIMEOUT_MS);\n      if (response.ok) await cache.put(asset, response);\n    } catch {\n      /* Optional experimental/test assets must not block install. */\n    }\n  }));\n}\n\nasync function shellReadiness() {\n  const cache = await caches.open(CACHE_NAME);\n  const missing = [];\n  for (const asset of REQUIRED_SHELL_ASSETS) {\n    if (!(await cache.match(asset))) missing.push(asset);\n  }\n  return { ready: missing.length === 0, cacheName: CACHE_NAME, missing };\n}\n\nasync function cachedShellAsset(request, url) {\n  const cache = await caches.open(CACHE_NAME);\n  return (await cache.match(request)) ?? (await cache.match(url.pathname, { ignoreSearch: true }));\n}\n\nasync function networkFirstNavigation(request, url) {\n  try {\n    const response = await fetchWithTimeout(request);\n    if (response.ok) return response;\n  } catch {\n    /* Fall through to the cached document immediately. */\n  }\n  const cache = await caches.open(CACHE_NAME);\n  return (await cache.match(request))\n    ?? (await cache.match(url.pathname, { ignoreSearch: true }))\n    ?? (await cache.match("/"))\n    ?? new Response(\n      "<!doctype html><meta charset=utf-8><title>WordFan offline</title><p>WordFan has not finished its offline installation. Connect once, reopen the app, and try again.</p>",\n      { status: 503, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },\n    );\n}\n\nasync function networkFirstShellAsset(request, url) {\n  try {\n    const response = await fetchWithTimeout(request);\n    if (response.ok) {\n      const cache = await caches.open(CACHE_NAME);\n      await cache.put(request, response.clone());\n      return response;\n    }\n  } catch {\n    /* Use the installed copy below. */\n  }\n  return (await cachedShellAsset(request, url)) ?? Response.error();\n}\n\nasync function cacheFirstAsset(request, url) {\n  const cached = await cachedShellAsset(request, url);\n  if (cached) return cached;\n  try {\n    return await fetchWithTimeout(request, {}, 5000);\n  } catch {\n    return Response.error();\n  }\n}\n\nself.addEventListener("install", (event) => {\n  event.waitUntil(cacheRequiredShell());\n});\n\nself.addEventListener("activate", (event) => {\n  event.waitUntil((async () => {\n    const keys = await caches.keys();\n    await Promise.all(\n      keys\n        .filter((key) => key.startsWith(SHELL_CACHE_PREFIX) && key !== CACHE_NAME)\n        .map((key) => caches.delete(key)),\n    );\n    await self.clients.claim();\n  })());\n});\n\nself.addEventListener("message", (event) => {\n  if (event.data?.type === "SKIP_WAITING") {\n    self.skipWaiting();\n    return;\n  }\n  if (event.data?.type === "CHECK_OFFLINE_READY") {\n    event.waitUntil((async () => {\n      const status = await shellReadiness();\n      event.ports[0]?.postMessage({ type: "OFFLINE_READY", ...status });\n    })());\n  }\n});\n\nself.addEventListener("fetch", (event) => {\n  const request = event.request;\n  if (request.method !== "GET") return;\n  const url = new URL(request.url);\n  if (url.origin !== self.location.origin) return;\n  if (url.pathname.endsWith("dictionary.sqlite")) return;\n  if (url.pathname.endsWith("dictionary.sqlite.zst")) return;\n  if (url.pathname.endsWith("dictionary-manifest.json")) return;\n\n  if (url.searchParams.has("update-check")) {\n    event.respondWith(fetchWithTimeout(request));\n    return;\n  }\n\n  if (request.mode === "navigate" || request.destination === "document" || url.searchParams.has("fresh")) {\n    event.respondWith(networkFirstNavigation(request, url));\n    return;\n  }\n\n  if (request.destination === "script" || request.destination === "style") {\n    event.respondWith(networkFirstShellAsset(request, url));\n    return;\n  }\n\n  event.respondWith(cacheFirstAsset(request, url));\n});\n')

for relative in (
    "public/app.js",
    "public/index.html",
    "public/automated-tests.html",
    "public/automated-tests.js",
):
    replace_all(PWA / relative, OLD_ASSET_VERSION, NEW_ASSET_VERSION)
replace_exact(PUBLIC / "app.js", OLD_APP_VERSION, NEW_APP_VERSION)
replace_exact(PUBLIC / "app.js", OLD_CACHE, NEW_CACHE)
replace_exact(PUBLIC / "automated-tests.js", OLD_CACHE, NEW_CACHE)

app_registration = 'let offlineShellReloadScheduled = false;\n\nfunction queryOfflineShellStatus(worker, timeoutMs = 3000) {\n  return new Promise((resolve) => {\n    if (!worker) {\n      resolve(null);\n      return;\n    }\n    const channel = new MessageChannel();\n    const timer = window.setTimeout(() => resolve(null), timeoutMs);\n    channel.port1.onmessage = (event) => {\n      window.clearTimeout(timer);\n      resolve(event.data ?? null);\n    };\n    try {\n      worker.postMessage({ type: "CHECK_OFFLINE_READY" }, [channel.port2]);\n    } catch {\n      window.clearTimeout(timer);\n      resolve(null);\n    }\n  });\n}\n\nasync function registerOfflineShell() {\n  if (!("serviceWorker" in navigator)) {\n    pwaStatus.textContent = "Service worker unavailable";\n    return null;\n  }\n\n  navigator.serviceWorker.addEventListener("controllerchange", () => {\n    if (offlineShellReloadScheduled) return;\n    const reloadKey = `wordfan-controller-reload:${SHELL_CACHE_VERSION}`;\n    if (sessionStorage.getItem(reloadKey) === "1") {\n      pwaStatus.textContent = "Offline ready";\n      return;\n    }\n    sessionStorage.setItem(reloadKey, "1");\n    offlineShellReloadScheduled = true;\n    window.location.reload();\n  });\n\n  pwaStatus.textContent = "Installing offline shell...";\n  try {\n    const registration = await navigator.serviceWorker.register("/sw.js");\n    const readyRegistration = await Promise.race([\n      navigator.serviceWorker.ready,\n      new Promise((resolve) => window.setTimeout(() => resolve(registration), 8000)),\n    ]);\n    const worker = readyRegistration?.active ?? registration.active ?? registration.waiting ?? registration.installing;\n    const readiness = worker?.state === "activated" ? await queryOfflineShellStatus(worker) : null;\n    if (readiness?.ready && navigator.serviceWorker.controller) {\n      pwaStatus.textContent = "Offline ready";\n    } else if (readiness?.ready) {\n      pwaStatus.textContent = "Offline shell installed; taking control";\n    } else if (readiness?.missing?.length) {\n      pwaStatus.textContent = `Offline shell incomplete (${readiness.missing[0]})`;\n    } else if (worker?.state) {\n      pwaStatus.textContent = `Offline shell ${worker.state}`;\n    } else {\n      pwaStatus.textContent = "Offline shell registered; installation pending";\n    }\n    return registration;\n  } catch (error) {\n    pwaStatus.textContent = `Service worker failed: ${error instanceof Error ? error.message : String(error)}`;\n    return null;\n  }\n}\n\nconst offlineShellRegistrationPromise = registerOfflineShell();\n'
replace_exact(PUBLIC / "app.js", "async function init() {", app_registration + "\nasync function init() {")
old_registration_block = '''  if ("serviceWorker" in navigator) {
    try {
      await navigator.serviceWorker.register("/sw.js");
      pwaStatus.textContent = "Offline shell registered";
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        window.location.reload();
      });
    } catch (error) {
      pwaStatus.textContent = `Service worker failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  } else {
    pwaStatus.textContent = "Service worker unavailable";
  }

'''
replace_exact(PUBLIC / "app.js", old_registration_block, "")

offline_check = r'''#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(here, "..", "public");
const sw = fs.readFileSync(path.join(publicDir, "sw.js"), "utf8");
const app = fs.readFileSync(path.join(publicDir, "app.js"), "utf8");

const swRequirements = [
  ["bounded service-worker fetches", /function fetchWithTimeout[\s\S]*AbortController/],
  ["bounded navigation strategy", /networkFirstNavigation[\s\S]*fetchWithTimeout/],
  ["typed asset failure", /networkFirstShellAsset[\s\S]*Response\.error\(\)/],
  ["offline readiness probe", /CHECK_OFFLINE_READY/],
  ["failed install cache cleanup", /failures\.length[\s\S]*caches\.delete\(CACHE_NAME\)/],
];
const appRequirements = [
  ["early app registration", /const offlineShellRegistrationPromise = registerOfflineShell\(\)/],
  ["one-reload guard", /wordfan-controller-reload:/],
];
const failures = [];
for (const [label, pattern] of swRequirements) if (!pattern.test(sw)) failures.push(label);
for (const [label, pattern] of appRequirements) if (!pattern.test(app)) failures.push(label);
if (/fetch\(request\)\.catch\([\s\S]*caches\.match\("\/"\)/.test(sw)) failures.push("unbounded fetch with HTML fallback is forbidden");
if (/cacheFirstAsset[\s\S]*caches\.match\("\/"\)/.test(sw)) failures.push("generic assets must not fall back to index HTML");

if (failures.length) {
  console.error("Offline service-worker guard FAILED:");
  for (const label of failures) console.error(`  - ${label}`);
  process.exit(1);
}
console.log("Offline service-worker guard PASSED");
'''
write(PWA / "scripts" / "check-offline-sw.mjs", offline_check)

replace_exact(
    PWA / "package.json",
    '"build": "node scripts/check-js-syntax.mjs && npm run validate:shell-assets && python scripts/check_versions.py"',
    '"build": "node scripts/check-js-syntax.mjs && npm run validate:shell-assets && node scripts/check-offline-sw.mjs && python scripts/check_versions.py"',
)

smoke = PWA / "scripts" / "smoke-offline-dictionary.py"
replace_exact(
    smoke,
    "4. Reconnect and reload once more to confirm the online path still works.\n\nThis guards the local-first loadDictionary path + fetch timeouts.",
    "4. Close the page and cold-launch a new page while still offline.\n"
    "5. Reconnect and reload once more to confirm the online path still works.\n\n"
    "This guards both the local-first dictionary path and the service-worker shell timeout/fallback path.",
)
cold_launch = '''        # --- 4. Cold launch a brand-new page while the whole context is offline ---
        page.close()
        page = ctx.new_page()
        page.on("pageerror", lambda e: print(f"PAGEERROR: {e}", flush=True))
        cold_started = time.time()
        try:
            page.goto(base, wait_until="domcontentloaded", timeout=15000)
            wait_app(page)
            dismiss_gate(page)
            cold_loaded = page.evaluate("async () => await window.WordLoverApp.ensureDictionaryLoaded()")
        except Exception as exc:
            cold_loaded = False
            failures.append(f"cold offline launch failed: {exc}")
        cold_elapsed = time.time() - cold_started
        print(f"cold offline launch loaded={cold_loaded} in {cold_elapsed:.1f}s", flush=True)
        if not cold_loaded:
            failures.append("cold offline launch did not load the installed dictionary")
        if cold_elapsed > 18:
            failures.append(f"cold offline launch took too long ({cold_elapsed:.1f}s)")
        if page.locator("#app").count() != 1:
            failures.append("cold offline launch did not render the app shell")
        cold_lookup = page.evaluate("() => { try { return window.WordLoverApp.lookupTerm('the').status; } catch (e) { return 'ERR:' + e.message; } }")
        if cold_lookup not in ("found", "not_found"):
            failures.append(f"cold offline lookup did not work: {cold_lookup}")

        # --- 5. Reconnect and reload ---
'''
replace_exact(smoke, "        # --- 4. Reconnect and reload ---\n", cold_launch)

readme = PWA / "README.md"
replace_exact(
    readme,
    "Windows fallback automation verified this by stopping the local server, reloading the app from the service worker cache, loading the dictionary from IndexedDB, and searching `take off` successfully.",
    "Offline automation now verifies both a reload and a cold launch with the network disabled. Shell requests use a bounded network-first strategy, then fall back to the verified shell cache; the installed dictionary opens from IndexedDB/OPFS and local study features remain available.",
)

(ROOT / ".github" / "workflows" / "apply-offline-hotfix.yml").unlink(missing_ok=True)
Path(__file__).unlink(missing_ok=True)
subprocess.run(["python", "scripts/generate_code_map.py"], cwd=ROOT, check=True)
print("Offline hotfix applied; temporary automation removed.")
