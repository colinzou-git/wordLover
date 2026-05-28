"""Targeted smoke: verify the passphrase modal does not reopen for repeated
encrypt/decrypt calls. This is the regression that hung the automated test
suite at step #6 (checkpoint rollback).

On a fresh browser context the service worker's `controllerchange` handler
reloads the page, so the first navigation always triggers a second module
load. The cache is checked AFTER that initial reload settles."""
from __future__ import annotations

import sys
import time

from playwright.sync_api import sync_playwright


def overlay_count(page):
    return page.evaluate("() => document.querySelectorAll('.modal-overlay').length")


def passphrase_input_count(page):
    return page.evaluate("() => document.querySelectorAll('#passphrase').length")


def dismiss_passphrase_if_present(page):
    return page.evaluate("""() => {
        const input = document.querySelector('#passphrase');
        if (!input) return 0;
        input.value = 'wordlover-localhost-development-passphrase';
        const submit = input.closest('.modal-overlay')?.querySelector('[data-modal-submit]');
        if (submit) submit.click();
        return 1;
    }""")


def main() -> int:
    base = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:4173"
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context()
        page = ctx.new_page()
        page.on("pageerror", lambda e: print(f"PAGEERROR: {e}", flush=True))
        page.goto(f"{base}/?fresh=v53", wait_until="domcontentloaded")
        page.wait_for_function("window.WordLoverApp != null", timeout=15000)

        # Drain any startup passphrase modals (legacy path). On v43+ there should be none.
        # The service worker's controllerchange handler reloads the page on first load,
        # which can destroy the execution context mid-evaluate — tolerate that and retry.
        started = time.time()
        dismissed_total = 0
        while time.time() - started < 4:
            try:
                if dismiss_passphrase_if_present(page) > 0:
                    dismissed_total += 1
            except Exception:
                page.wait_for_function("window.WordLoverApp != null", timeout=15000)
            time.sleep(0.1)
        print(f"startup passphrase modals dismissed: {dismissed_total}", flush=True)

        # Dismiss the v43 first-run Google sign-in gate via Skip.
        for _ in range(20):
            cancel_btn = page.locator(".modal-overlay [data-modal-cancel]")
            if cancel_btn.count() > 0:
                cancel_btn.first.click()
                time.sleep(0.3)
                break
            time.sleep(0.1)

        # The cache is checked from this point onward — there should be no
        # further passphrase modals during checkpoint create/rollback.
        page.evaluate("() => { window.__cp1p = window.WordLoverApp.createCheckpoint('smoke-1').then(r => r && r.id, e => 'ERR:' + e.message); }")
        time.sleep(0.5)
        pp_after_cp1 = passphrase_input_count(page)
        print(f"after createCheckpoint(smoke-1): pp_modal={pp_after_cp1}", flush=True)
        cp1 = page.evaluate("async () => window.__cp1p")
        print(f"cp1 result: {cp1}", flush=True)

        page.evaluate("() => { window.__cp2p = window.WordLoverApp.createCheckpoint('smoke-2').then(r => r && r.id, e => 'ERR:' + e.message); }")
        time.sleep(0.5)
        pp_after_cp2 = passphrase_input_count(page)
        print(f"after createCheckpoint(smoke-2): pp_modal={pp_after_cp2}", flush=True)
        cp2 = page.evaluate("async () => window.__cp2p")
        print(f"cp2 result: {cp2}", flush=True)

        page.evaluate("() => { window.__rbp = window.WordLoverApp.rollbackLatestCheckpoint().then(r => r && r.id, e => 'ERR:' + e.message); }")
        time.sleep(0.8)
        pp_before_confirm = passphrase_input_count(page)
        submit_visible = page.evaluate("() => document.querySelectorAll('[data-modal-submit]').length")
        print(f"during rollback (before confirm): pp_modal={pp_before_confirm} submit_btn={submit_visible}", flush=True)
        if submit_visible > 0:
            page.click("[data-modal-submit]")
        time.sleep(2.0)
        pp_after_rb = passphrase_input_count(page)
        print(f"after rollback: pp_modal={pp_after_rb}", flush=True)
        rb = page.evaluate("async () => window.__rbp")
        print(f"rollback result: {rb}", flush=True)

        passed = (
            pp_after_cp1 == 0
            and pp_after_cp2 == 0
            and pp_before_confirm == 0
            and pp_after_rb == 0
            and isinstance(cp1, str) and cp1.startswith("checkpoint-")
            and isinstance(cp2, str) and cp2.startswith("checkpoint-")
            and isinstance(rb, str) and rb.startswith("checkpoint-")
        )
        print(f"\n{'PASS' if passed else 'FAIL'}", flush=True)
        browser.close()
        return 0 if passed else 1


if __name__ == "__main__":
    sys.exit(main())
