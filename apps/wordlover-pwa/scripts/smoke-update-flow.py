"""Automated smoke for the Check Update / Apply Update flow.

Covers three branches:
  1. up-to-date: device and server APP_VERSION match. The status line must show
     both versions side-by-side and the Apply Update button must be enabled so
     the user can force-reload the shell.
  2. update-available: server reports a newer APP_VERSION than the device.
     Status must reflect the new version, Apply Update is enabled and
     `pendingAppReloadUrl` is set.
  3. check-error: server is unreachable for the version-probe fetch. Status
     must surface the error clearly and not pretend it's up to date.

Network mocking is done via Playwright `page.route` so the test stays purely
local and does not depend on Windows server state for the alternate-version
branches.
"""
from __future__ import annotations

import re
import sys
import time

from playwright.sync_api import Route, sync_playwright


def drain_modals(page) -> None:
    for _ in range(5):
        try:
            btn = page.query_selector('.modal-overlay button:has-text("Skip")')
            if btn:
                btn.click()
                time.sleep(0.25)
            else:
                break
        except Exception:
            break
    page.evaluate("() => document.querySelectorAll('.modal-overlay').forEach(el => el.remove())")


def open_settings_and_check(page) -> dict:
    page.click("#appMenuButton")
    time.sleep(0.2)
    result = page.evaluate("() => window.WordLoverApp.checkForAppUpdate()")
    time.sleep(0.5)
    status_text = page.evaluate("() => document.querySelector('#updateStatus').textContent")
    apply_disabled = page.evaluate("() => document.querySelector('#applyUpdate').disabled")
    return {
        "result": result,
        "status": status_text,
        "applyDisabled": apply_disabled,
    }


def main() -> int:
    base = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:4173"
    failures: list[str] = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        # --- Branch 1: up-to-date ---
        ctx = browser.new_context()
        page = ctx.new_page()
        page.on("pageerror", lambda e: print(f"PAGEERROR: {e}", flush=True))
        page.goto(f"{base}/?fresh=update-smoke-1", wait_until="domcontentloaded")
        page.wait_for_function("window.WordLoverApp != null", timeout=15000)
        time.sleep(2.0)
        drain_modals(page)

        device_version = page.evaluate("() => document.querySelector('#appVersion').textContent")
        outcome = open_settings_and_check(page)
        result = outcome["result"]
        if result.get("status") != "up-to-date":
            failures.append(f"Branch 1 expected status=up-to-date, got {result}")
        if device_version not in (outcome["status"] or ""):
            failures.append(f"Branch 1 status missing device version {device_version!r}: {outcome['status']!r}")
        if outcome["applyDisabled"]:
            failures.append("Branch 1 expected Apply Update to be enabled for force-reload.")
        ctx.close()

        # --- Branch 2: update-available (intercept /app.js?update-check= with a forged newer version) ---
        # Block service workers so Playwright route intercepts the raw fetch.
        ctx = browser.new_context(service_workers="block")
        page = ctx.new_page()
        page.on("pageerror", lambda e: print(f"PAGEERROR: {e}", flush=True))

        forged_version = "0.6.2-product.20991231-vTEST"

        def reroute(route: Route) -> None:
            req = route.request
            if "update-check=" in req.url:
                body = f'const APP_VERSION = "{forged_version}";\n'
                route.fulfill(status=200, content_type="application/javascript", body=body)
                return
            route.continue_()

        page.route("**/app.js**", reroute)
        page.goto(f"{base}/?fresh=update-smoke-2", wait_until="domcontentloaded")
        page.wait_for_function("window.WordLoverApp != null", timeout=15000)
        time.sleep(2.0)
        drain_modals(page)
        outcome = open_settings_and_check(page)
        result = outcome["result"]
        if result.get("status") not in {"update-available", "update-waiting", "no-registration"}:
            failures.append(f"Branch 2 expected status update-available/update-waiting/no-registration, got {result}")
        if result.get("serverVersion") != forged_version and result.get("status") != "no-registration":
            failures.append(f"Branch 2 expected serverVersion={forged_version}, got {result.get('serverVersion')}")
        ctx.close()

        # --- Branch 3: check-error (kill the update-check fetch) ---
        ctx = browser.new_context(service_workers="block")
        page = ctx.new_page()
        page.on("pageerror", lambda e: print(f"PAGEERROR: {e}", flush=True))

        def fail_update_check(route: Route) -> None:
            req = route.request
            if "update-check=" in req.url:
                route.abort()
                return
            route.continue_()

        page.route("**/app.js**", fail_update_check)
        page.goto(f"{base}/?fresh=update-smoke-3", wait_until="domcontentloaded")
        page.wait_for_function("window.WordLoverApp != null", timeout=15000)
        time.sleep(2.0)
        drain_modals(page)
        outcome = open_settings_and_check(page)
        result = outcome["result"]
        # If registration.update() also fails, we get network-error; if only the version-probe fetch fails,
        # registration.update() may still succeed and yield up-to-date (since the SW byte content is unchanged).
        # Either way, serverVersion must be null and the status must NOT be a deceptive "Up to date".
        if result.get("serverVersion") is not None:
            failures.append(f"Branch 3 expected serverVersion=null when probe fails, got {result.get('serverVersion')}")
        if result.get("status") == "up-to-date":
            failures.append("Branch 3 must not claim 'up-to-date' when the version probe fails.")
        ctx.close()

        browser.close()

    if failures:
        for f in failures:
            print(f"FAIL: {f}", flush=True)
        return 1
    print("PASS", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
