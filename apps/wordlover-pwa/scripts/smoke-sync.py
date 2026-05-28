"""Cross-device Google Drive sync smoke (mocked Drive, mocked GIS).

Simulates two devices signed into the same Google account by sharing one in-memory
"Drive appDataFolder" between two separate browser contexts:

  Device A: add 9 words -> Sync now -> uploads an encrypted snapshot to the mock Drive.
  Device B: fresh/empty -> Sync now -> finds A's file, decrypts (same passphrase),
            merges, and ends up with all 9 words.

This proves the end-to-end sync path (list -> read -> decrypt -> merge -> apply -> upload)
and the cross-device encryption compatibility, without needing real Google/Drive.
"""
from __future__ import annotations

import json
import re
import sys
import time

from playwright.sync_api import sync_playwright

# Windows consoles default to cp1252; make non-ASCII (Chinese test data, dashes) printable.
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

# Shared mock Drive appDataFolder (one file), shared across both contexts in this process.
drive_store: dict = {"envelope": None, "modifiedTime": "2026-05-28T00:00:00.000Z"}
# "normal" serves the store; "api-disabled" makes the list call return a 403 like a Cloud
# project without the Drive API enabled.
drive_mode: dict = {"value": "normal"}

API_DISABLED_BODY = (
    '{"error":{"code":403,'
    '"message":"Google Drive API has not been used in project 123456789012 before or it is disabled.",'
    '"status":"PERMISSION_DENIED","errors":[{"reason":"accessNotConfigured"}]}}'
)

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

MOCK_GIS = """
window.__silentWorks = true;
window.google = {
  accounts: { oauth2: {
    initTokenClient: (cfg) => ({
      requestAccessToken: (opts) => {
        const prompt = (opts && opts.prompt) || '';
        if (prompt === '' && !window.__silentWorks) { (cfg.error_callback||(()=>{}))({type:'x'}); return; }
        window.__seq = (window.__seq||0)+1;
        cfg.callback({ access_token: 'tok-' + window.__seq, expires_in: 3600, scope: cfg.scope });
      },
    }),
    revoke: (t, cb) => { if (cb) cb(); },
  }},
};
"""

USERINFO_JSON = '{"email":"colin.zou@gmail.com","sub":"123","name":"Colin"}'


def handle_google(route):
    req = route.request
    url = req.url
    method = req.method
    try:
        if "oauth2/v3/userinfo" in url:
            route.fulfill(status=200, content_type="application/json", body=USERINFO_JSON)
            return
        # Drive: list files in appDataFolder
        if "/drive/v3/files" in url and method == "GET" and "alt=media" not in url:
            if drive_mode["value"] == "api-disabled":
                route.fulfill(status=403, content_type="application/json", body=API_DISABLED_BODY)
                return
            files = []
            if drive_store["envelope"] is not None:
                files = [{"id": "f1", "name": "wordlover-user-data.json", "modifiedTime": drive_store["modifiedTime"]}]
            route.fulfill(status=200, content_type="application/json", body=json.dumps({"files": files}))
            return
        # Drive: read file media
        if "/drive/v3/files/f1" in url and "alt=media" in url and method == "GET":
            route.fulfill(status=200, content_type="application/json", body=drive_store["envelope"] or "{}")
            return
        # Drive: multipart create
        if "/upload/drive/v3/files" in url and "uploadType=multipart" in url and method == "POST":
            body = req.post_data or ""
            envelope = extract_envelope(body)
            drive_store["envelope"] = envelope
            drive_store["modifiedTime"] = "2026-05-28T01:00:00.000Z"
            route.fulfill(status=200, content_type="application/json",
                          body=json.dumps({"id": "f1", "name": "wordlover-user-data.json",
                                           "modifiedTime": drive_store["modifiedTime"], "size": str(len(envelope))}))
            return
        # Drive: media update (PATCH)
        if "/upload/drive/v3/files/f1" in url and "uploadType=media" in url and method == "PATCH":
            envelope = req.post_data or "{}"
            drive_store["envelope"] = envelope
            drive_store["modifiedTime"] = "2026-05-28T02:00:00.000Z"
            route.fulfill(status=200, content_type="application/json",
                          body=json.dumps({"id": "f1", "name": "wordlover-user-data.json",
                                           "modifiedTime": drive_store["modifiedTime"], "size": str(len(envelope))}))
            return
    except Exception as exc:  # noqa: BLE001
        print(f"route error for {method} {url}: {exc}", flush=True)
    # Default: let anything else fail closed so we notice unexpected calls.
    route.fulfill(status=404, content_type="application/json", body="{}")


def extract_envelope(multipart_body: str) -> str:
    # The encrypted envelope is the single-line JSON part containing the format marker.
    for line in multipart_body.splitlines():
        line = line.strip()
        if line.startswith("{") and "wordlover-user-data-aes-gcm-v1" in line:
            return line
    # Fallback: last {...} blob.
    matches = re.findall(r"\{.*\}", multipart_body)
    return matches[-1] if matches else "{}"


def setup_page(ctx):
    page = ctx.new_page()
    page.on("pageerror", lambda e: print(f"PAGEERROR: {e}", flush=True))
    page.route("**/wordlover-config.js*", lambda r: r.fulfill(status=200, content_type="application/javascript", body=CONFIG_JS))
    page.route("**/gsi/client*", lambda r: r.fulfill(status=200, content_type="application/javascript", body="/* mock gis */"))
    page.add_init_script(MOCK_GIS)
    page.route("https://www.googleapis.com/**", handle_google)
    return page


def boot(page, base, tag):
    page.goto(f"{base}/?fresh=sync-{tag}", wait_until="domcontentloaded")
    page.wait_for_function("window.WordLoverApp != null", timeout=15000)
    time.sleep(1.0)
    for _ in range(20):
        cancel = page.locator(".modal-overlay [data-modal-cancel]")
        if cancel.count() > 0:
            try:
                cancel.first.click()
            except Exception:
                pass
            time.sleep(0.2)
            break
        time.sleep(0.1)


def main() -> int:
    base = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:4173"
    failures: list[str] = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        # --- Device A: add 9 words and sync (uploads to mock Drive) ---
        ctx_a = browser.new_context(service_workers="block")
        page_a = setup_page(ctx_a)
        boot(page_a, base, "a")

        added = page_a.evaluate(
            """async () => {
                const words = ['apple','brave','cloud','drift','ember','frost','glove','honey','ivory'];
                for (const w of words) {
                    await window.WordLoverApp.saveManualVocabularyItem({
                        term: w, normalizedTerm: w, english: ['meaning of ' + w], chinese: ['中文' + w], phonetic: ''
                    });
                }
                // Also seed the spelling track + user dictionary to verify they sync too (SP-9).
                await window.WordLoverApp.spelling.addItemForTest('justice', 'fairness', '公正');
                await window.WordLoverApp.spelling.addItemForTest('kindle', 'to light', '点燃');
                await window.WordLoverApp.addUserDictionaryEntryForTest('zorptastic', 'made-up word', '生造词');
                return {
                    vocab: window.WordLoverApp.getVocabulary().length,
                    spelling: window.WordLoverApp.getSpelling().length,
                    userDict: window.WordLoverApp.getUserDictionary().length,
                };
            }"""
        )
        print(f"device A local: {added}", flush=True)
        if added.get("vocab") != 9:
            failures.append(f"device A should have 9 vocab words, has {added.get('vocab')}")
        if added.get("spelling") != 2:
            failures.append(f"device A should have 2 spelling words, has {added.get('spelling')}")
        if added.get("userDict") != 1:
            failures.append(f"device A should have 1 user-dictionary entry, has {added.get('userDict')}")

        a_sync = page_a.evaluate(
            """async () => {
                try { await window.WordLoverApp.sync.now(); return { ok: true, info: window.WordLoverApp.sync.lastInfo() }; }
                catch (e) { return { ok: false, error: e.message }; }
            }"""
        )
        print(f"device A sync: {a_sync}", flush=True)
        if not a_sync.get("ok"):
            failures.append(f"device A sync failed: {a_sync.get('error')}")
        elif a_sync["info"].get("action") != "create":
            failures.append(f"device A first sync should create, got {a_sync['info'].get('action')}")
        if drive_store["envelope"] is None:
            failures.append("device A did not upload an envelope to the mock Drive")
        ctx_a.close()

        # --- Device B: fresh/empty, sync should pull A's 9 words ---
        ctx_b = browser.new_context(service_workers="block")
        page_b = setup_page(ctx_b)
        boot(page_b, base, "b")

        b_before = page_b.evaluate("() => window.WordLoverApp.getVocabulary().length")
        print(f"device B words before sync: {b_before}", flush=True)
        if b_before != 0:
            failures.append(f"device B should start empty, has {b_before}")

        b_sync = page_b.evaluate(
            """async () => {
                try { await window.WordLoverApp.sync.now(); return { ok: true, info: window.WordLoverApp.sync.lastInfo(), count: window.WordLoverApp.getVocabulary().length }; }
                catch (e) { return { ok: false, error: e.message }; }
            }"""
        )
        print(f"device B sync: {b_sync}", flush=True)
        if not b_sync.get("ok"):
            failures.append(f"device B sync failed: {b_sync.get('error')}")
        else:
            info = b_sync["info"]
            if info.get("action") != "merge":
                failures.append(f"device B should merge, got {info.get('action')}")
            if info.get("filesFound") != 1:
                failures.append(f"device B should find 1 Drive file, got {info.get('filesFound')}")
            if info.get("decrypted") is not True:
                failures.append(f"device B failed to decrypt A's snapshot: decrypted={info.get('decrypted')}")
            if info.get("remoteCount") != 9:
                failures.append(f"device B remote snapshot should have 9 words, got {info.get('remoteCount')}")
            if b_sync.get("count") != 9:
                failures.append(f"device B should have 9 words after sync, has {b_sync.get('count')}")

        # Device B must also receive the spelling list and the user dictionary (SP-9 sync).
        b_tracks = page_b.evaluate(
            """() => ({
                spelling: window.WordLoverApp.getSpelling().length,
                userDict: window.WordLoverApp.getUserDictionary().length,
                hasJustice: window.WordLoverApp.getSpelling().some(i => i.term === 'justice'),
            })"""
        )
        print(f"device B tracks: {b_tracks}", flush=True)
        if b_tracks.get("spelling") != 2:
            failures.append(f"device B should receive 2 spelling words, got {b_tracks.get('spelling')}")
        if b_tracks.get("userDict") != 1:
            failures.append(f"device B should receive 1 user-dictionary entry, got {b_tracks.get('userDict')}")
        if not b_tracks.get("hasJustice"):
            failures.append("device B spelling list missing the synced word 'justice'")

        # Regression: the Sync-now BUTTON result must survive renderAppMenu() (not be overwritten).
        btn = page_b.evaluate(
            """async () => {
                document.querySelector('#googleSyncNow').click();
                await new Promise((r) => setTimeout(r, 1200));
                return {
                    auth: document.querySelector('#googleAuthStatus').textContent,
                    sync: document.querySelector('#syncStatus').textContent,
                };
            }"""
        )
        print(f"device B button result: {btn}", flush=True)
        if "Synced" not in (btn.get("auth") or ""):
            failures.append(f"Sync-now button result was overwritten (auth status='{btn.get('auth')}')")
        if btn.get("sync") != "Synced":
            failures.append(f"sync box should read 'Synced' after a successful sync, got '{btn.get('sync')}'")

        # Sync block reporting: last-sync time, word count, and Drive size.
        report = page_b.evaluate(
            """() => ({
                details: document.querySelector('#syncDetails').textContent,
                summary: window.WordLoverApp.sync.lastSummary(),
            })"""
        )
        print(f"device B sync report: {report}", flush=True)
        summary = report.get("summary") or {}
        if summary.get("words") != 9:
            failures.append(f"sync summary words should be 9, got {summary.get('words')}")
        if not summary.get("sizeBytes"):
            failures.append(f"sync summary should record Drive size, got {summary.get('sizeBytes')}")
        if not summary.get("at"):
            failures.append("sync summary should record a timestamp")
        details = report.get("details") or ""
        for token in ("Last sync", "9 word", "on Drive"):
            if token not in details:
                failures.append(f"sync details missing '{token}': {details!r}")
        ctx_b.close()

        # --- Device C: Drive API disabled -> sync fails on the list call, captured + explained ---
        drive_mode["value"] = "api-disabled"
        ctx_c = browser.new_context(service_workers="block")
        page_c = setup_page(ctx_c)
        boot(page_c, base, "c")
        c_sync = page_c.evaluate(
            """async () => {
                try { await window.WordLoverApp.sync.now(); return { ok: true }; }
                catch (e) { return { ok: false, error: e.message, info: window.WordLoverApp.sync.lastInfo() }; }
            }"""
        )
        print(f"device C (API disabled) sync: {c_sync}", flush=True)
        if c_sync.get("ok"):
            failures.append("device C sync should have failed with Drive API disabled")
        else:
            if "Drive API is not enabled" not in (c_sync.get("error") or ""):
                failures.append(f"403 error not interpreted as 'Drive API not enabled': {c_sync.get('error')}")
            info = c_sync.get("info") or {}
            if info.get("stage") != "list":
                failures.append(f"failed-sync stage should be 'list', got {info.get('stage')}")
            if not info.get("error"):
                failures.append("lastSyncInfo.error was not captured for a failed sync")
        ctx_c.close()

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
