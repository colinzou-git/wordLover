"""One-off diagnostic: load the app through a given base URL (e.g. the ngrok HTTPS
URL the iPhone uses) in a fresh context and report console errors, page errors,
and whether the app booted. Helps triage a blank screen that only happens on the
HTTPS/ngrok path (the Windows HTTP smokes don't exercise that)."""
from __future__ import annotations

import sys
import time

from playwright.sync_api import sync_playwright

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass


def main() -> int:
    base = sys.argv[1] if len(sys.argv) > 1 else "https://engraver-railroad-spoilage.ngrok-free.dev"
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(
            ignore_https_errors=True,
            extra_http_headers={"ngrok-skip-browser-warning": "true"},
        )
        page = ctx.new_page()
        page.on("console", lambda m: print(f"CONSOLE[{m.type}]: {m.text}", flush=True))
        page.on("pageerror", lambda e: print(f"PAGEERROR: {e}", flush=True))
        page.on("requestfailed", lambda r: print(f"REQ-FAILED: {r.url} :: {r.failure}", flush=True))
        page.on("response", lambda r: (print(f"HTTP {r.status}: {r.url}", flush=True) if r.status >= 400 else None))

        print(f"== loading {base} ==", flush=True)
        try:
            page.goto(base, wait_until="domcontentloaded", timeout=30000)
        except Exception as exc:
            print(f"GOTO ERROR: {exc}", flush=True)

        time.sleep(5.0)
        info = page.evaluate(
            """() => ({
                title: document.title,
                bodyChildren: document.body ? document.body.childElementCount : -1,
                hasTermInput: Boolean(document.querySelector('#termInput')),
                hasApp: Boolean(window.WordLoverApp),
                appVersion: window.WordLoverApp ? window.WordLoverApp.getState().appVersion : null,
                resultText: (document.querySelector('#result')?.textContent || '').slice(0, 120),
                bodyDataset: document.body ? JSON.stringify({...document.body.dataset}) : null,
                pwaStatus: document.querySelector('#pwaStatus')?.textContent || null,
            })"""
        )
        print(f"== page state ==\n{info}", flush=True)
        browser.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
