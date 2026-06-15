"""Offline / PWA cold-start regression suite for WordFan.

Guards the offline-startup hang fixed in shell v130. The root cause was an
unbounded service-worker fetch() that could stay pending forever on a
"connected but useless" network, so the cached shell was never reached. These
tests cover the full offline contract, not just an in-place reload:

  A. Offline reload of an already-open page.
  B. True cold offline launch (a brand-new page in the same storage, offline).
  C. Hanging network: shell requests delayed past the SW timeout still boot.
  D. Missing JS/module offline never falls back to HTML (no MIME/syntax break).
  E. Incomplete install (a required asset 404s) is not activated.
  F. A service-worker takeover reloads the page at most once per shell version.
  G. Reconnecting restores the normal online path.

Run against a local server serving public/ (production or CI-fixture dictionary):

    python apps/wordlover-pwa/scripts/smoke-offline-dictionary.py http://127.0.0.1:4173
"""
from __future__ import annotations

import sys
import time
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

SLOW_SENTINEL = "WF_SLOW_NETWORK_SENTINEL"

APP_BOOT_TIMEOUT_MS = 20000
LOAD_COUNTER_INIT = """
  try {
    const n = (Number(sessionStorage.getItem('__wf_loads') || '0') || 0) + 1;
    sessionStorage.setItem('__wf_loads', String(n));
  } catch (e) {}
"""


def dismiss_gate(page):
    for _ in range(25):
        cancel = page.locator(".modal-overlay [data-modal-cancel]")
        if cancel.count() > 0:
            try:
                cancel.first.click()
            except Exception:
                pass
            time.sleep(0.2)
            return
        time.sleep(0.1)


def wait_app(page, timeout=APP_BOOT_TIMEOUT_MS):
    page.wait_for_function("window.WordLoverApp != null", timeout=timeout)


def wait_controlled(page, timeout=20000):
    page.wait_for_function(
        "() => navigator.serviceWorker && navigator.serviceWorker.controller != null",
        timeout=timeout,
    )


def _abort_all(route):
    # Playwright's set_offline does NOT fail service-worker network requests, so we
    # abort at the route layer (which DOES intercept SW fetches) to simulate a truly
    # dead network the way the service worker actually experiences it.
    try:
        route.abort("internetdisconnected")
    except Exception:
        pass


def go_offline(ctx):
    ctx.set_offline(True)          # navigator.onLine === false (page layer)
    ctx.route("**/*", _abort_all)  # kill the network for the page AND the worker


def go_online(ctx):
    try:
        ctx.unroute("**/*", _abort_all)
    except Exception:
        ctx.unroute("**/*")
    ctx.set_offline(False)


def install_online(page, base, failures):
    """Open online, take SW control, and load the dictionary locally."""
    page.goto(base, wait_until="domcontentloaded")
    wait_app(page)
    # The SW reloads the page once via controllerchange on first control; let it settle.
    time.sleep(3.0)
    wait_app(page)
    dismiss_gate(page)
    page.evaluate("async () => await window.WordLoverApp.ensureDictionaryLoaded()")
    page.wait_for_function("() => window.WordLoverApp.getState().loaded === true", timeout=90000)
    if not page.evaluate("() => window.WordLoverApp.getState().loaded"):
        failures.append("install: dictionary did not load online")
    wait_controlled(page)


def main() -> int:
    base = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:4173").rstrip("/")
    failures: list[str] = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        # ===================== Context 1: a healthy install =====================
        ctx = browser.new_context()
        ctx.add_init_script(LOAD_COUNTER_INIT)
        page = ctx.new_page()
        page.on("pageerror", lambda e: print(f"PAGEERROR: {e}", flush=True))

        install_online(page, base, failures)
        print("install: online + controlled OK", flush=True)

        # --- Readiness: the worker confirms every required asset is cached ---
        report = page.evaluate("async () => await window.WordLoverApp.checkOfflineReady()")
        print(f"offline-ready report: {report}", flush=True)
        if not report or not report.get("ready"):
            failures.append(f"readiness: worker not offline-ready: {report}")
        if report and report.get("missing"):
            failures.append(f"readiness: missing required assets: {report.get('missing')}")

        # --- TEST F: controllerchange reloads at most once per shell version ---
        cache_version = page.evaluate("() => window.WordLoverApp.getState().shellCacheVersion")
        guard_key = f"wordfan-controller-reload:{cache_version}"
        guard = page.evaluate(f"() => sessionStorage.getItem({guard_key!r})")
        loads = page.evaluate("() => Number(sessionStorage.getItem('__wf_loads') || '0')")
        print(f"F: guard={guard} loads={loads}", flush=True)
        if guard != "1":
            failures.append("F: controller-reload guard key not set after takeover")
        if loads > 2:
            failures.append(f"F: page loaded {loads} times (reload loop suspected)")

        # --- TEST C: a hanging network still boots the cached shell after timeout ---
        # The navigation document is delayed ~6s (well past the SW's 2.5s network-first
        # timeout) and then answered with a sentinel body. If the SW timeout works it
        # gives up at 2.5s and serves the CACHED index.html (whose script tags boot the
        # app); the slow sentinel is never used. Without the timeout (the original bug)
        # the SW would wait and serve the sentinel, the app would never boot, and
        # wait_app would fail. This is a content assertion, so it is deterministic.
        def hang(route):
            path = urlparse(route.request.url).path
            if path in ("", "/"):
                try:
                    time.sleep(6.0)
                    route.fulfill(status=200, content_type="text/html",
                                  body=f"<!doctype html><title>{SLOW_SENTINEL}</title>{SLOW_SENTINEL}")
                except Exception:
                    pass
            else:
                try:
                    route.continue_()
                except Exception:
                    pass

        ctx.route("**/*", hang)
        t0 = time.time()
        try:
            page.reload(wait_until="domcontentloaded", timeout=20000)
            wait_app(page, timeout=20000)  # app boots => cached shell served, not the slow sentinel
            booted = True
        except Exception as exc:
            booted = False
            failures.append(f"C: app did not boot from cache under slow network (timeout not applied): {exc}")
        elapsed = time.time() - t0
        served_sentinel = SLOW_SENTINEL in page.content()
        ctx.unroute("**/*", hang)
        print(f"C: booted={booted} in {elapsed:.1f}s served_sentinel={served_sentinel}", flush=True)
        if served_sentinel:
            failures.append("C: served the slow network response instead of the cached shell")
        if booted and elapsed > 15:
            failures.append(f"C: boot under slow network took too long ({elapsed:.1f}s)")
        # Re-settle after the hang test reload.
        page.reload(wait_until="domcontentloaded")
        wait_app(page)
        dismiss_gate(page)

        # --- Go offline for A / D / B ---
        go_offline(ctx)

        # TEST A: offline reload boots and the dictionary opens locally.
        t0 = time.time()
        page.reload(wait_until="domcontentloaded")
        wait_app(page)
        time.sleep(0.5)
        dismiss_gate(page)
        if page.evaluate("() => navigator.onLine"):
            failures.append("A: navigator.onLine still true after set_offline(True)")
        try:
            offline_loaded = page.evaluate("async () => await window.WordLoverApp.ensureDictionaryLoaded()")
        except Exception as exc:
            offline_loaded = False
            failures.append(f"A: ensureDictionaryLoaded threw offline: {exc}")
        elapsed = time.time() - t0
        print(f"A: offline reload load={offline_loaded} in {elapsed:.1f}s", flush=True)
        if not offline_loaded:
            failures.append("A: dictionary failed to load offline from the local copy")
        if elapsed > 25:
            failures.append(f"A: offline load took too long ({elapsed:.1f}s) - likely hanging")
        lookup = page.evaluate(
            "() => { try { return window.WordLoverApp.lookupTerm('the').status; } catch (e) { return 'ERR:' + e.message; } }"
        )
        print(f"A: offline lookup('the')={lookup}", flush=True)
        if lookup not in ("found", "not_found"):
            failures.append(f"A: offline lookup did not work: {lookup}")
        # Local UI surfaces remain accessible offline.
        if not page.evaluate("() => !!document.querySelector('.history-panel') && !!document.querySelector('.vocabulary-panel')"):
            failures.append("A: history/vocabulary UI not present offline")

        # TEST D: an uncached JS/module offline must fail cleanly, never HTML.
        fetch_probe = page.evaluate(
            """async () => {
              const url = '/__wf_missing__-' + Date.now() + '.js';
              try {
                const r = await fetch(url);
                const body = await r.text();
                return { threw: false, ok: r.ok, status: r.status, type: r.type,
                         ct: r.headers.get('content-type') || '', html: /<!doctype|<html/i.test(body) };
              } catch (e) { return { threw: true, name: e.name }; }
            }"""
        )
        print(f"D: fetch probe={fetch_probe}", flush=True)
        if not fetch_probe.get("threw"):
            if fetch_probe.get("ok") and fetch_probe.get("html"):
                failures.append("D: worker returned HTML 200 for a missing .js (would break as JS)")
            if fetch_probe.get("html"):
                failures.append("D: worker returned HTML for a missing .js")
        script_result = page.evaluate(
            """() => new Promise((resolve) => {
              const s = document.createElement('script');
              s.type = 'module';
              s.src = '/__wf_missing_module__-' + Date.now() + '.js';
              s.onerror = () => resolve('error');
              s.onload = () => resolve('load');
              document.head.appendChild(s);
              setTimeout(() => resolve('timeout'), 6000);
            })"""
        )
        print(f"D: script load result={script_result}", flush=True)
        if script_result == "load":
            failures.append("D: missing module 'loaded' offline (worker served a substitute, not a clean failure)")

        # TEST B: true cold launch — close the page, open a brand-new one offline.
        page.close()
        cold = ctx.new_page()
        cold.on("pageerror", lambda e: print(f"PAGEERROR(cold): {e}", flush=True))
        t0 = time.time()
        try:
            cold.goto(base, wait_until="domcontentloaded", timeout=APP_BOOT_TIMEOUT_MS)
            wait_app(cold)
            cold_booted = True
        except Exception as exc:
            cold_booted = False
            failures.append(f"B: cold offline launch did not boot: {exc}")
        elapsed = time.time() - t0
        print(f"B: cold launch booted={cold_booted} in {elapsed:.1f}s", flush=True)
        if cold_booted:
            if elapsed > 15:
                failures.append(f"B: cold launch too slow ({elapsed:.1f}s)")
            dismiss_gate(cold)
            try:
                cold_loaded = cold.evaluate("async () => await window.WordLoverApp.ensureDictionaryLoaded()")
            except Exception as exc:
                cold_loaded = False
                failures.append(f"B: ensureDictionaryLoaded threw on cold launch: {exc}")
            if not cold_loaded:
                failures.append("B: dictionary failed to open on cold offline launch")
            body_len = cold.evaluate("() => document.body.innerText.trim().length")
            if body_len < 20:
                failures.append("B: cold launch page is blank")

        # TEST G: reconnect restores the normal online path.
        go_online(ctx)
        cold.reload(wait_until="domcontentloaded")
        wait_app(cold)
        time.sleep(0.5)
        dismiss_gate(cold)
        cold.evaluate("async () => await window.WordLoverApp.ensureDictionaryLoaded()")
        cold.wait_for_function("() => window.WordLoverApp.getState().loaded === true", timeout=60000)
        if not cold.evaluate("() => navigator.onLine"):
            failures.append("G: navigator.onLine false after reconnect")
        print("G: reconnect online path OK", flush=True)

        ctx.close()

        # ============ Context 2: an incomplete install must not activate ============
        ctx2 = browser.new_context()
        sw_logs: list[str] = []
        ctx2.on("console", lambda m: sw_logs.append(m.text))
        broken = ctx2.new_page()
        broken.on("pageerror", lambda e: print(f"PAGEERROR(broken): {e}", flush=True))

        # Force a required shell asset to 404 so installShell() fails.
        def four_oh_four(route):
            route.fulfill(status=404, content_type="text/plain", body="nope")

        ctx2.route("**/styles.css*", four_oh_four)
        broken.goto(base, wait_until="domcontentloaded")
        wait_app(broken)

        # Poll while the install attempt settles: the incomplete shell must never be
        # promoted, must never take control, and the staging cache must be cleaned up.
        controller = True
        cache_names = []
        for _ in range(12):
            time.sleep(1.0)
            controller = broken.evaluate("() => !!(navigator.serviceWorker && navigator.serviceWorker.controller)")
            cache_names = broken.evaluate("async () => (await caches.keys())")
            if not controller and not any(n.endswith("-staging") for n in cache_names):
                break
        print(f"E: controller={controller} caches={cache_names}", flush=True)
        # An incomplete install must not be promoted/activated.
        if any(name == cache_version for name in cache_names):
            failures.append(f"E: incomplete shell cache {cache_version} was promoted despite a failed asset")
        if controller:
            failures.append("E: an incomplete install took control of the page")
        if any(name.endswith("-staging") for name in cache_names):
            failures.append("E: staging cache lingered after a failed install")
        # Best-effort: the SW logs the exact failed asset.
        reported = [line for line in sw_logs if "install failed" in line.lower()]
        if reported:
            print(f"E: SW reported -> {reported[0]}", flush=True)
            if "styles.css" not in reported[0]:
                failures.append("E: install-failure log did not name the failed asset")
        ctx2.unroute("**/styles.css*")
        ctx2.close()

        browser.close()

    if failures:
        print("\nFAILED:", flush=True)
        for f in failures:
            print(f"  - {f}", flush=True)
        return 1
    print("\nPASS", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
