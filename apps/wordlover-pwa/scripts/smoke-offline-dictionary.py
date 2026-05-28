"""Regression smoke for the offline dictionary-load hang (iPhone Wi-Fi off):

1. Install the dictionary while online.
2. Go offline (Playwright network offline -> navigator.onLine === false).
3. Reload the app offline and assert the dictionary loads from the local copy
   QUICKLY (does not hang forever on a never-settling network fetch).
4. Reconnect and reload once more to confirm the online path still works.

This guards the local-first loadDictionary path + fetch timeouts.
"""
from __future__ import annotations

import sys
import time

from playwright.sync_api import sync_playwright


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


def wait_app(page):
    page.wait_for_function("window.WordLoverApp != null", timeout=20000)


def main() -> int:
    base = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:4173"
    failures: list[str] = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context()
        page = ctx.new_page()
        page.on("pageerror", lambda e: print(f"PAGEERROR: {e}", flush=True))

        # --- 1. Online install ---
        page.goto(base, wait_until="domcontentloaded")
        wait_app(page)
        # The service worker reloads the page once via controllerchange; let it settle.
        time.sleep(3.0)
        wait_app(page)
        dismiss_gate(page)

        installed = page.evaluate("async () => await window.WordLoverApp.ensureDictionaryLoaded()")
        page.wait_for_function("() => window.WordLoverApp.getState().loaded === true", timeout=90000)
        print(f"online install loaded={installed}", flush=True)
        if not page.evaluate("() => window.WordLoverApp.getState().loaded"):
            failures.append("dictionary did not load online during install step")

        # Make sure the service worker controls the page so the offline reload is served from cache.
        page.wait_for_function(
            "() => navigator.serviceWorker && navigator.serviceWorker.controller != null",
            timeout=20000,
        )

        # --- 2. Go offline ---
        ctx.set_offline(True)
        page.reload(wait_until="domcontentloaded")
        wait_app(page)
        time.sleep(1.0)
        dismiss_gate(page)

        online_flag = page.evaluate("() => navigator.onLine")
        print(f"navigator.onLine after offline reload: {online_flag}", flush=True)
        if online_flag:
            failures.append("navigator.onLine is still true after set_offline(True)")

        # --- 3. The core assertion: dictionary loads offline without hanging ---
        t0 = time.time()
        try:
            offline_loaded = page.evaluate("async () => await window.WordLoverApp.ensureDictionaryLoaded()")
        except Exception as exc:
            offline_loaded = False
            failures.append(f"ensureDictionaryLoaded threw offline: {exc}")
        elapsed = time.time() - t0
        print(f"offline load result={offline_loaded} in {elapsed:.1f}s", flush=True)
        if not offline_loaded:
            failures.append("dictionary failed to load offline from the local copy")
        if elapsed > 25:
            failures.append(f"offline dictionary load took too long ({elapsed:.1f}s) - likely hanging")

        state = page.evaluate("() => window.WordLoverApp.getState()")
        if not state.get("loaded"):
            failures.append("getState().loaded is false after offline load")
        src = (state.get("lastMetrics") or {}).get("source", "")
        print(f"offline source={src}", flush=True)
        if "offline" not in str(src):
            failures.append(f"offline load did not report an offline-copy source: {src}")

        # A real lookup must work fully offline.
        lookup = page.evaluate("() => { try { return window.WordLoverApp.lookupTerm('the').status; } catch (e) { return 'ERR:' + e.message; } }")
        print(f"offline lookup('the') status={lookup}", flush=True)
        if lookup not in ("found", "not_found"):
            failures.append(f"offline lookup did not work: {lookup}")

        # --- 4. Reconnect and reload ---
        ctx.set_offline(False)
        page.reload(wait_until="domcontentloaded")
        wait_app(page)
        time.sleep(1.0)
        dismiss_gate(page)
        page.evaluate("async () => await window.WordLoverApp.ensureDictionaryLoaded()")
        page.wait_for_function("() => window.WordLoverApp.getState().loaded === true", timeout=60000)
        print("reconnect load ok", flush=True)

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
