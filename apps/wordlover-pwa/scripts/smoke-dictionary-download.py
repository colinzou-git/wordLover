"""Regression smoke for the "database disk image is malformed" bug.

GitHub Pages honors HTTP Range (206) requests; the old chunked Range download
corrupted the saved dictionary there (the local test server only returns 200,
so it was never caught). This test simulates a Range-capable server:

- a normal GET (no Range) returns the real, full dictionary;
- a GET WITH a Range header returns 206 garbage.

So if the app ever fetches the dictionary via Range again, the DB is corrupt and
this test fails. With the single-GET + checksum loader, no Range is sent, the
file verifies, opens cleanly, and lookups work.
"""
from __future__ import annotations

import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

DICT = Path(__file__).resolve().parents[1] / "public" / "dictionary.sqlite"


def main() -> int:
    base = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:4173"
    if not DICT.exists():
        print(f"SKIP: {DICT} not present (build the dictionary first).", flush=True)
        return 0
    full = DICT.read_bytes()
    failures: list[str] = []

    def handle_dict(route):
        req = route.request
        rng = req.headers.get("range")
        if rng:
            # Any Range-based download must be treated as a corruption trap.
            print(f"  !! app sent Range header: {rng} (should not happen)", flush=True)
            route.fulfill(status=206, headers={"Content-Range": f"bytes 0-1023/{len(full)}", "Accept-Ranges": "bytes"}, body=b"\x00" * 1024)
        else:
            route.fulfill(status=200, headers={"Content-Type": "application/octet-stream", "Accept-Ranges": "bytes"}, body=full)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(service_workers="block")
        page = ctx.new_page()
        page.on("pageerror", lambda e: print(f"PAGEERROR: {e}", flush=True))
        page.route("**/dictionary.sqlite*", handle_dict)

        page.goto(f"{base}/?fresh=dict-dl", wait_until="domcontentloaded")
        page.wait_for_function("window.WordLoverApp != null", timeout=15000)
        time.sleep(1.0)
        # Dismiss the first-run gate if present.
        for _ in range(15):
            cancel = page.locator(".modal-overlay [data-modal-cancel]")
            if cancel.count() > 0:
                try:
                    cancel.first.click()
                except Exception:
                    pass
                time.sleep(0.2)
                break
            time.sleep(0.1)

        # Trigger the (auto)load and wait for it to finish.
        page.evaluate("async () => { try { await window.WordLoverApp.ensureDictionaryLoaded(); } catch (e) {} }")
        loaded = False
        deadline = time.time() + 90
        last_err = ""
        while time.time() < deadline:
            st = page.evaluate("() => { const s = window.WordLoverApp.getState(); return { loaded: s.loaded, entries: s.lastMetrics && s.lastMetrics.entries, src: s.lastMetrics && s.lastMetrics.source }; }")
            if st.get("loaded"):
                loaded = True
                print(f"loaded: entries={st.get('entries')} source={st.get('src')}", flush=True)
                break
            last_err = page.evaluate("() => (document.querySelector('#result')?.textContent || '').slice(0,160)")
            time.sleep(1.0)

        if not loaded:
            failures.append(f"dictionary did not load from a Range-capable server (result said: {last_err!r})")
        else:
            entries = page.evaluate("() => window.WordLoverApp.getState().lastMetrics.entries")
            if not entries or entries < 1000:
                failures.append(f"dictionary opened but entry count looks wrong: {entries}")
            lookup = page.evaluate("() => { try { return window.WordLoverApp.lookupTerm('the').status; } catch (e) { return 'ERR:' + e.message; } }")
            print(f"lookup('the') = {lookup}", flush=True)
            if lookup not in ("found", "not_found"):
                failures.append(f"lookup failed after load (malformed DB?): {lookup}")

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
