"""Smoke for the Google auth "stay logged in" flow.

Mocks google.accounts.oauth2 (no real Google network) to verify:
- A first sign-in uses interactive consent and records a grant.
- A still-valid token is reused without any new prompt (no forced re-login).
- After the short-lived token expires, the session refreshes SILENTLY
  (prompt:"") with no consent UI.
- If the silent refresh fails and interaction is disallowed, it errors instead
  of hanging (error_callback path).
- The "Sign in with Google" button, when already signed in, just confirms
  status and does not trigger another prompt.
"""
from __future__ import annotations

import sys
import time

from playwright.sync_api import sync_playwright

CONFIG_JS = (
    "window.WORDLOVER_CONFIG = {"
    "  googleClientId: '665953045468-test.apps.googleusercontent.com',"
    "  googleDriveFileName: 'wordlover-user-data.json',"
    "  googleScopes: ["
    "    'https://www.googleapis.com/auth/drive.appdata',"
    "    'https://www.googleapis.com/auth/userinfo.email',"
    "    'https://www.googleapis.com/auth/userinfo.profile'"
    "  ],"
    "  geminiApiKey: '',"
    "  geminiModel: 'gemini-2.5-flash',"
    "  localDevelopmentPassphrase: ''"
    "};"
)

# Mock GIS. prompt:"" is silent and only succeeds when window.__silentWorks is true.
MOCK_GIS = """
window.__authLog = { prompts: [] };
window.__silentWorks = false;
window.google = {
  accounts: {
    oauth2: {
      initTokenClient: (cfg) => ({
        requestAccessToken: (opts) => {
          const prompt = (opts && opts.prompt) || '';
          window.__authLog.prompts.push(prompt);
          if (prompt === '' && !window.__silentWorks) {
            if (cfg.error_callback) cfg.error_callback({ type: 'popup_failed', message: 'silent refresh blocked' });
            else cfg.callback({ error: 'interaction_required' });
            return;
          }
          window.__tokenSeq = (window.__tokenSeq || 0) + 1;
          cfg.callback({ access_token: 'tok-' + window.__tokenSeq, expires_in: 3600, scope: cfg.scope });
        },
      }),
      revoke: (token, cb) => { if (cb) cb(); },
    },
  },
};
"""

USERINFO_JSON = '{"email":"colin.zou@gmail.com","sub":"123","name":"Colin"}'


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


def main() -> int:
    base = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:4173"
    failures: list[str] = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(service_workers="block")
        page = ctx.new_page()
        page.on("pageerror", lambda e: print(f"PAGEERROR: {e}", flush=True))

        page.route("**/wordlover-config.js*", lambda r: r.fulfill(status=200, content_type="application/javascript", body=CONFIG_JS))
        page.route("**/gsi/client*", lambda r: r.fulfill(status=200, content_type="application/javascript", body="/* mocked GIS loader */"))
        page.route("**/oauth2/v3/userinfo*", lambda r: r.fulfill(status=200, content_type="application/json", body=USERINFO_JSON))
        page.add_init_script(MOCK_GIS)

        page.goto(f"{base}/?fresh=auth-smoke", wait_until="domcontentloaded")
        page.wait_for_function("window.WordLoverApp != null", timeout=15000)
        time.sleep(1.0)
        dismiss_gate(page)

        # --- 1. Fresh interactive sign-in ---
        page.evaluate("async () => { window.__authLog.prompts = []; await window.WordLoverApp.auth.ensureToken({ interactive: true }); }")
        state1 = page.evaluate("() => window.WordLoverApp.auth.state()")
        prompts1 = page.evaluate("() => window.__authLog.prompts")
        print(f"after sign-in: state={state1} prompts={prompts1}", flush=True)
        if not state1.get("hasToken"):
            failures.append("fresh sign-in did not produce a token")
        if not state1.get("hasGrant"):
            failures.append("fresh sign-in did not record a grant")
        if state1.get("email") != "colin.zou@gmail.com":
            failures.append(f"profile email not loaded: {state1.get('email')}")
        if prompts1 != ["consent"]:
            failures.append(f"fresh sign-in should use one interactive consent, got {prompts1}")

        # --- 2. Valid token reused without a new prompt ---
        page.evaluate("() => { window.__authLog.prompts = []; }")
        page.evaluate("async () => { await window.WordLoverApp.auth.ensureToken({ interactive: true }); }")
        prompts2 = page.evaluate("() => window.__authLog.prompts")
        print(f"reuse valid token prompts={prompts2}", flush=True)
        if prompts2:
            failures.append(f"a valid token triggered a re-prompt: {prompts2}")

        # --- 3. Expired token refreshes silently ---
        page.evaluate("() => { window.__silentWorks = true; window.__authLog.prompts = []; window.WordLoverApp.auth.expireToken(); }")
        page.evaluate("async () => { await window.WordLoverApp.auth.ensureToken({ interactive: false }); }")
        state3 = page.evaluate("() => window.WordLoverApp.auth.state()")
        prompts3 = page.evaluate("() => window.__authLog.prompts")
        print(f"silent refresh: state={state3} prompts={prompts3}", flush=True)
        if not state3.get("tokenValid"):
            failures.append("silent refresh did not restore a valid token")
        if prompts3 != [""]:
            failures.append(f"expired token should refresh silently (prompt ''), got {prompts3}")

        # --- 4. Silent fails + non-interactive -> error, not a hang ---
        errored = page.evaluate(
            """async () => {
                window.__silentWorks = false;
                window.__authLog.prompts = [];
                window.WordLoverApp.auth.expireToken();
                try {
                    await window.WordLoverApp.auth.ensureToken({ interactive: false });
                    return 'no-error';
                } catch (e) {
                    return 'error:' + e.message;
                }
            }"""
        )
        print(f"silent-fail non-interactive -> {errored}", flush=True)
        if not str(errored).startswith("error:"):
            failures.append(f"non-interactive refresh should reject when silent fails, got {errored}")

        # --- 5. Sign-in button when already signed in: status only, no prompt ---
        page.evaluate("async () => { window.__silentWorks = true; window.WordLoverApp.auth.expireToken(); await window.WordLoverApp.auth.ensureToken({ interactive: false }); window.__authLog.prompts = []; }")
        page.evaluate("() => document.querySelector('#googleSignIn').click()")
        time.sleep(0.4)
        prompts5 = page.evaluate("() => window.__authLog.prompts")
        status5 = page.evaluate("() => document.querySelector('#googleAuthStatus').textContent")
        print(f"signed-in button click prompts={prompts5} status={status5!r}", flush=True)
        if prompts5:
            failures.append(f"clicking sign-in while signed in re-prompted: {prompts5}")
        if "Signed in" not in status5:
            failures.append(f"sign-in button did not confirm status when already signed in: {status5!r}")

        # --- 6. Sign-in failure surfaces the origin/authorized-origins diagnostic + Safari hint ---
        hint_standalone = page.evaluate(
            "() => window.WordLoverApp.auth.describeSignInError('Google sign-in was closed before completing.', { standalone: true, hasClientId: true, origin: 'https://192.168.1.50:8443' })"
        )
        hint_browser = page.evaluate(
            "() => window.WordLoverApp.auth.describeSignInError('Google sign-in was closed before completing.', { standalone: false, hasClientId: true, origin: 'https://192.168.1.50:8443' })"
        )
        hint_no_client = page.evaluate(
            "() => window.WordLoverApp.auth.describeSignInError('No client id', { standalone: true, hasClientId: false, origin: 'https://192.168.1.50:8443' })"
        )
        print(f"standalone msg: {hint_standalone}", flush=True)
        # The origin diagnostic must appear whenever a client ID is configured (browser AND standalone).
        for label, msg in (("standalone", hint_standalone), ("browser", hint_browser)):
            if "Authorized JavaScript origins" not in msg:
                failures.append(f"{label}: missing Authorized JavaScript origins guidance")
            if "https://192.168.1.50:8443" not in msg:
                failures.append(f"{label}: did not surface the exact origin (with port)")
        # The Safari home-screen tip is standalone-only.
        if "Safari" not in hint_standalone:
            failures.append("standalone failure did not include the Safari workaround tip")
        if "Safari" in hint_browser:
            failures.append("Safari home-screen tip should NOT appear in a normal browser tab")
        # No client ID -> raw message only, no origin diagnostic.
        if "Authorized JavaScript origins" in hint_no_client:
            failures.append("origin diagnostic should NOT appear when no client ID is configured")

        # --- 7. Sign-in diagnostics capture the flow + environment for on-device triage ---
        diag = page.evaluate("() => window.WordLoverApp.auth.diagnostics()")
        print(f"diagnostics keys={sorted(diag.keys())} events={len(diag.get('events', []))}", flush=True)
        for field in ("appVersion", "origin", "crossOriginIsolated", "secureContext", "standalone", "clientIdConfigured", "events"):
            if field not in diag:
                failures.append(f"diagnostics snapshot missing field: {field}")
        # The earlier sign-in attempts must have recorded events (request-token / callback / etc.).
        event_names = [e.get("event") for e in diag.get("events", [])]
        if not event_names:
            failures.append("diagnostics captured no auth events after sign-in attempts")
        if "ensure-token" not in event_names:
            failures.append(f"diagnostics missing 'ensure-token' event; got {event_names}")
        if "callback" not in event_names:
            failures.append(f"diagnostics missing GIS 'callback' event; got {event_names}")
        # The popup-block fix: the token client is preloaded, so request-token runs preloaded.
        request_events = [e for e in diag.get("events", []) if e.get("event") == "request-token"]
        if not any(e.get("preloaded") for e in request_events):
            failures.append(f"no preloaded request-token event (preload-path regression); got {request_events}")
        if "gis-not-preloaded" in event_names:
            failures.append("token request fell back to the non-preloaded (activation-losing) path")

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
