#!/usr/bin/env python3
"""Hermetic real-service-worker N-1 -> N upgrade regression suite.

The fixture uses one origin and one persistent Chromium context. It intentionally
contains representative WordFan store names while keeping the shell tiny enough
for deterministic CI failures and offline transitions.
"""
from __future__ import annotations

import argparse
import json
import threading
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from tempfile import TemporaryDirectory

from playwright.sync_api import sync_playwright

APP_JS = r'''const RELEASE = __RELEASE__;
const status = document.querySelector("#status");
const setStatus = value => { status.textContent = value; return value; };
async function registration() { return navigator.serviceWorker.getRegistration() ?? navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }); }
async function waitForWaiting(reg, timeout = 5000) {
  if (reg.waiting) return reg.waiting;
  return new Promise(resolve => { const end = setTimeout(() => resolve(reg.waiting), timeout); reg.addEventListener("updatefound", () => reg.installing?.addEventListener("statechange", () => { if (["installed", "redundant"].includes(reg.installing?.state)) { clearTimeout(end); resolve(reg.waiting); } })); });
}
async function check() {
  let live;
  try { const response = await fetch(`/release.json?check=${Date.now()}`, { cache: "no-store" }); if (!response.ok) throw new Error(`HTTP ${response.status}`); live = await response.json(); }
  catch (error) { return setStatus(`server-unreachable: ${error.message}`); }
  const reg = await registration();
  if (live.appVersion === RELEASE.appVersion && !reg.waiting) return setStatus("up-to-date");
  setStatus("downloading");
  try { await reg.update(); } catch (error) { return setStatus(`worker-update-failed: ${error.message}`); }
  const waiting = await waitForWaiting(reg);
  return setStatus(waiting ? "update-ready" : "worker-install-failed");
}
async function apply() {
  const reg = await registration(); if (!reg.waiting) return setStatus("no-update");
  const changed = new Promise(resolve => navigator.serviceWorker.addEventListener("controllerchange", resolve, { once: true }));
  reg.waiting.postMessage({ type: "SKIP_WAITING", explicit: true }); await changed; location.reload();
}
async function seed() {
  const stores = ["vocabularyRecords", "studyEventRecords", "spellingRecords", "spellingEventRecords", "knownRecords", "userDictionaryRecords", "kv", "files"];
  await new Promise((resolve, reject) => { const request = indexedDB.open("wordlover-user", 1); request.onupgradeneeded = () => stores.forEach(name => request.result.createObjectStore(name)); request.onerror = () => reject(request.error); request.onsuccess = () => { const db = request.result; const tx = db.transaction(stores, "readwrite"); const values = { vocabularyRecords: ["abandon", { term: "abandon" }], studyEventRecords: ["event-1", { rating: "good" }], spellingRecords: ["spell-1", { term: "abandon" }], spellingEventRecords: ["spell-event-1", { correct: true }], knownRecords: ["known-1", { term: "ability" }], userDictionaryRecords: ["custom-1", { term: "codex" }], kv: ["uiPreferences", { theme: "sunrise", activeTrackId: "track-test", updateState: "seeded" }], files: ["dictionary-installed", { version: "fixture" }] }; for (const name of stores) tx.objectStore(name).put(values[name][1], values[name][0]); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); }; });
  localStorage.setItem("fixture-preference", "preserved"); return true;
}
async function snapshot() { return new Promise((resolve, reject) => { const request = indexedDB.open("wordlover-user"); request.onerror = () => reject(request.error); request.onsuccess = async () => { const db = request.result; const result = {}; for (const name of db.objectStoreNames) result[name] = await new Promise((ok, bad) => { const tx = db.transaction(name); const count = tx.objectStore(name).count(); count.onsuccess = () => ok(count.result); count.onerror = () => bad(count.error); }); result.localPreference = localStorage.getItem("fixture-preference"); resolve(result); }; }); }
async function repair() { const live = await (await fetch(`/release.json?repair=${Date.now()}`, { cache: "no-store" })).json(); for (const reg of await navigator.serviceWorker.getRegistrations()) await reg.unregister(); for (const name of await caches.keys()) if (name.startsWith("wordlover-shell-")) await caches.delete(name); return { live, data: await snapshot(), caches: await caches.keys() }; }
window.fixture = { RELEASE, check, apply, seed, snapshot, repair, registration };
registration().then(() => navigator.serviceWorker.ready).then(() => setStatus(`ready-${RELEASE.appVersion}`));'''

SW_JS = r'''const VERSION = "__VERSION__"; const CACHE = `wordlover-shell-${VERSION}`; const ASSETS = ["/", `/app.js?v=${VERSION}`, `/module.js?v=${VERSION}`];
self.addEventListener("install", event => event.waitUntil((async () => { const staging = `${CACHE}-staging`; await caches.delete(staging); const cache = await caches.open(staging); try { for (const asset of ASSETS) { const response = await fetch(asset, { cache: "reload" }); if (!response.ok) throw new Error(`${asset}: HTTP ${response.status}`); await cache.put(asset, response); } const live = await caches.open(CACHE); for (const key of await cache.keys()) await live.put(key, await cache.match(key)); } finally { await caches.delete(staging); } })()));
self.addEventListener("activate", event => event.waitUntil((async () => { for (const name of await caches.keys()) if (name.startsWith("wordlover-shell-") && name !== CACHE) await caches.delete(name); await clients.claim(); })()));
self.addEventListener("message", event => { if (event.data?.type === "SKIP_WAITING" && (event.data.explicit || event.data.nextLaunch)) self.skipWaiting(); if (event.data?.type === "GET_RELEASE_INFO") event.ports[0]?.postMessage({ appVersion: VERSION, buildId: `build-${VERSION}`, cacheName: CACHE }); });
self.addEventListener("fetch", event => { const request = event.request, url = new URL(request.url); if (url.pathname === "/release.json") { event.respondWith(fetch(request)); return; } if (request.mode === "navigate") { if (url.searchParams.has("fresh")) { event.respondWith(fetch(request)); return; } event.respondWith(fetch(request).then(response => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response; }).catch(async () => (await caches.open(CACHE)).match("/"))); return; } if (["script", "style"].includes(request.destination)) event.respondWith(fetch(request).then(response => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response; }).catch(async () => (await caches.open(CACHE)).match(request) || Response.error())); });'''

INDEX = '''<!doctype html><meta charset="utf-8"><title>upgrade fixture</title><p id="release">__VERSION__</p><p id="status">loading</p><script type="module" src="/app.js?v=__VERSION__"></script>'''

class Fixture:
    def __init__(self): self.mode = "n1"; self.fail_asset = False; self.unavailable = False
    @property
    def version(self): return "n1" if self.mode == "n1" else "n"

class Handler(BaseHTTPRequestHandler):
    fixture: Fixture
    def log_message(self, *_): pass
    def do_GET(self):
        url = urllib.parse.urlparse(self.path)
        if url.path == "/__control":
            values = urllib.parse.parse_qs(url.query); self.fixture.mode = values.get("mode", [self.fixture.mode])[0]; self.fixture.fail_asset = values.get("fail", ["0"])[0] == "1"; self.fixture.unavailable = values.get("offline", ["0"])[0] == "1"; return self.send(b"ok", "text/plain")
        if self.fixture.unavailable: self.send_error(503); return
        version = self.fixture.version
        if self.fixture.fail_asset and version == "n" and url.path == "/module.js": self.send_error(503); return
        if url.path in ("/", "/index.html"): body, mime = INDEX.replace("__VERSION__", version).encode(), "text/html"
        elif url.path == "/app.js": body, mime = APP_JS.replace("__RELEASE__", json.dumps({"appVersion": version, "buildId": f"build-{version}", "shellCache": f"wordlover-shell-{version}"})).encode(), "text/javascript"
        elif url.path == "/module.js": body, mime = f'export const marker = "{version}";'.encode(), "text/javascript"
        elif url.path == "/sw.js": body, mime = SW_JS.replace("__VERSION__", version).encode(), "text/javascript"
        elif url.path == "/release.json": body, mime = json.dumps({"schemaVersion": 1, "appVersion": version, "buildId": f"build-{version}", "commit": version * 40, "shellCache": f"wordlover-shell-{version}", "userDataFormatVersion": "0.3", "publishedAt": "2026-07-14T00:00:00Z"}).encode(), "application/json"
        else: self.send_error(404); return
        self.send(body, mime)
    def send(self, body, mime):
        self.send_response(200); self.send_header("Content-Type", mime); self.send_header("Cache-Control", "no-store"); self.end_headers(); self.wfile.write(body)

def wait_controlled(page):
    page.wait_for_function("window.fixture !== undefined", timeout=10000)
    page.wait_for_function("navigator.serviceWorker.getRegistration().then(r => Boolean(r?.active))", timeout=10000)
    if not page.evaluate("navigator.serviceWorker.controller !== null"):
        page.wait_for_timeout(500)
        page.goto(page.url)
        page.wait_for_function("window.fixture !== undefined", timeout=10000)
        page.evaluate("navigator.serviceWorker.register('/sw.js', {updateViaCache:'none'})")
        page.wait_for_function("navigator.serviceWorker.getRegistration().then(r => Boolean(r?.active))", timeout=10000)
        if not page.evaluate("navigator.serviceWorker.controller !== null"):
            page.reload()
            page.wait_for_function("window.fixture !== undefined", timeout=10000)
    page.wait_for_function("navigator.serviceWorker.controller !== null", timeout=10000)

def assert_seed(snapshot):
    expected = {"vocabularyRecords", "studyEventRecords", "spellingRecords", "spellingEventRecords", "knownRecords", "userDictionaryRecords", "kv", "files"}
    assert expected.issubset(snapshot) and all(snapshot[name] == 1 for name in expected), snapshot
    assert snapshot["localPreference"] == "preserved", snapshot

def run(base, profile):
    results = []
    print("upgrade: explicit scenario", flush=True)
    with sync_playwright() as pw:
        context = pw.chromium.launch_persistent_context(str(profile), headless=True)
        page = context.pages[0] if context.pages else context.new_page()
        page.on("console", lambda message: print(f"fixture console: {message.type}: {message.text}"))
        page.on("pageerror", lambda error: print(f"fixture page error: {error}"))
        page.goto(base); wait_controlled(page); page.evaluate("fixture.seed()"); assert_seed(page.evaluate("fixture.snapshot()"))
        # A: explicit N-1 -> N update in the same context.
        page.request.get(base + "/__control?mode=n")
        assert page.evaluate("fixture.check()") == "update-ready"
        page.evaluate("fixture.apply()")
        page.wait_for_function("window.fixture?.RELEASE.appVersion === 'n'", timeout=10000); wait_controlled(page); assert_seed(page.evaluate("fixture.snapshot()"))
        caches = page.evaluate("caches.keys()"); assert "wordlover-shell-n" in caches and "wordlover-shell-n1" not in caches, caches; results.append("explicit-update")
        print("upgrade: explicit passed", flush=True)
        # E: an exact N URL cannot receive an N-1 cached response.
        exact = page.evaluate("async () => { const c = await caches.open('wordlover-shell-n'); await c.put('/module.js?v=n1', new Response('old')); return (await c.match('/module.js?v=n'))?.text() ?? null; }")
        assert exact == 'export const marker = "n";', exact; results.append("exact-asset-version")
        # G: repair removes only shell caches and preserves IndexedDB/local state.
        page.evaluate("caches.open('unrelated-test-cache').then(c => c.put('/x', new Response('x')))")
        repaired = page.evaluate("fixture.repair()"); assert_seed(repaired["data"]); assert repaired["caches"] == ["unrelated-test-cache"], repaired; results.append("safe-repair")
        context.close()
    return results

def run_failure_scenarios(base, root):
    results = []
    print("upgrade: failure scenarios", flush=True)
    with sync_playwright() as pw:
        # C/D/F use a clean persistent context with N-1 active.
        context = pw.chromium.launch_persistent_context(str(root / "failure-profile"), headless=True)
        page = context.pages[0] if context.pages else context.new_page(); page.request.get(base + "/__control?mode=n1"); page.goto(base); wait_controlled(page)
        page.request.get(base + "/__control?mode=n&fail=1"); assert page.evaluate("fixture.check()") == "worker-install-failed"; caches = page.evaluate("caches.keys()"); assert "wordlover-shell-n1" in caches and "wordlover-shell-n" not in caches and not any(name.endswith("-staging") for name in caches), caches; results.append("partial-install")
        print("upgrade: partial install passed", flush=True)
        page.request.get(base + "/__control?mode=n1&offline=1"); assert page.evaluate("fixture.check()").startswith("server-unreachable"); assert "wordlover-shell-n1" in page.evaluate("caches.keys()"); page.request.get(base + "/__control?mode=n&offline=0"); assert page.evaluate("fixture.check()") == "update-ready"; results.append("server-unavailable-retry")
        # Fresh is network-only: normal navigation survives outage, fresh does not silently render N-1.
        page.request.get(base + "/__control?mode=n1&offline=1"); normal = context.new_page(); normal.goto(base, wait_until="domcontentloaded"); assert normal.locator("#release").text_content() == "n1"; fresh = context.new_page(); response = fresh.goto(base + "/?fresh=n", wait_until="commit"); assert response is None or response.status >= 500; results.append("fresh-network-only")
        context.close()
        # B: waiting N activates on next cold launch using the defined nextLaunch message.
        print("upgrade: cold launch", flush=True)
        page_request_mode(base, "n1")
        context = pw.chromium.launch_persistent_context(str(root / "cold-profile"), headless=True); page = context.pages[0] if context.pages else context.new_page(); page.goto(base); wait_controlled(page); page.evaluate("fixture.seed()"); page_request_mode(base, "n"); assert page.evaluate("fixture.check()") == "update-ready"; context.close()
        context = pw.chromium.launch_persistent_context(str(root / "cold-profile"), headless=True); page = context.pages[0] if context.pages else context.new_page(); page.goto(base); page.wait_for_function("window.fixture !== undefined"); waiting = page.evaluate("navigator.serviceWorker.getRegistration().then(r => Boolean(r?.waiting))");
        if waiting: page.evaluate("navigator.serviceWorker.getRegistration().then(r => r.waiting?.postMessage({type:'SKIP_WAITING', nextLaunch:true}))")
        page.wait_for_timeout(500); page.reload(); page.wait_for_function("window.fixture?.RELEASE.appVersion === 'n'"); wait_controlled(page); assert_seed(page.evaluate("fixture.snapshot()")); results.append("cold-launch-activation"); context.close()
    return results

def page_request_mode(base, mode):
    import urllib.request
    urllib.request.urlopen(base + f"/__control?mode={mode}&offline=0&fail=0", timeout=3).read()

def main():
    parser = argparse.ArgumentParser(); parser.add_argument("--report", default="test-results/pwa-upgrade-report.json"); args = parser.parse_args()
    fixture = Fixture(); Handler.fixture = fixture; server = ThreadingHTTPServer(("127.0.0.1", 0), Handler); thread = threading.Thread(target=server.serve_forever, daemon=True); thread.start(); base = f"http://127.0.0.1:{server.server_port}"
    try:
        with TemporaryDirectory() as temp: results = run(base, Path(temp) / "main-profile") + run_failure_scenarios(base, Path(temp))
        report = {"success": True, "scenarios": results}; path = Path(args.report); path.parent.mkdir(parents=True, exist_ok=True); path.write_text(json.dumps(report, indent=2), encoding="utf-8"); print(json.dumps(report, indent=2))
    finally: server.shutdown(); server.server_close()

if __name__ == "__main__": main()
