"""Targeted smoke for the v44 dynamic Gemini model list:
- On boot (with a key), the app fetches the live model list and auto-migrates off
  a deprecated saved model to the best available one.
- Only free-tier flash models survive the filter (pro / embedding excluded).
- Clicking "Set Gemini key" rebuilds the picker from the freshly fetched list.

The Gemini ListModels endpoint is mocked via page.route. The service worker is
blocked so the route reliably intercepts (an SW would otherwise serve the fetch).
A routed wordlover-config.js injects a key + a deprecated default model so the
reconcile path runs.
"""
from __future__ import annotations

import json
import sys
import time

from playwright.sync_api import sync_playwright

MOCK_MODELS = {
    "models": [
        {"name": "models/gemini-2.5-flash", "supportedGenerationMethods": ["generateContent"]},
        {"name": "models/gemini-9.9-flash", "supportedGenerationMethods": ["generateContent"]},
        {"name": "models/gemini-2.5-flash-lite", "supportedGenerationMethods": ["generateContent"]},
        {"name": "models/gemini-2.5-pro", "supportedGenerationMethods": ["generateContent"]},
        {"name": "models/text-embedding-004", "supportedGenerationMethods": ["embedContent"]},
    ]
}

CONFIG_JS = (
    "window.WORDLOVER_CONFIG = {"
    "  googleClientId: '',"
    "  googleDriveFileName: 'wordlover-user-data.json',"
    "  googleScopes: [],"
    "  geminiApiKey: 'AIza-test-key',"
    "  geminiModel: 'gemini-1.0-deprecated',"
    "  localDevelopmentPassphrase: ''"
    "};"
)


def main() -> int:
    base = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:4173"
    failures: list[str] = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(service_workers="block")
        page = ctx.new_page()
        page.on("pageerror", lambda e: print(f"PAGEERROR: {e}", flush=True))

        # Inject a key + a deprecated saved model so the reconcile path runs.
        page.route(
            "**/wordlover-config.js*",
            lambda route: route.fulfill(status=200, content_type="application/javascript", body=CONFIG_JS),
        )
        # Mock the live ListModels response.
        page.route(
            "**/v1beta/models*",
            lambda route: route.fulfill(status=200, content_type="application/json", body=json.dumps(MOCK_MODELS)),
        )

        page.goto(f"{base}/?fresh=gemini-models-smoke", wait_until="domcontentloaded")
        page.wait_for_function("window.WordLoverApp != null", timeout=15000)

        # Wait for the background reconcile to migrate off the deprecated model.
        page.wait_for_function(
            "() => window.WordLoverApp.getGeminiModel() !== 'gemini-1.0-deprecated'",
            timeout=10000,
        )

        # Clear any first-run login gate so only the picker modal is on screen later.
        page.evaluate("() => document.querySelectorAll('.modal-overlay').forEach(o => o.remove())")

        model = page.evaluate("() => window.WordLoverApp.getGeminiModel()")
        choices = page.evaluate("() => window.WordLoverApp.getGeminiModelChoices().map(c => c.id)")
        print(f"reconciled model={model} choices={choices}", flush=True)

        if model == "gemini-1.0-deprecated":
            failures.append("deprecated model was not reconciled away")
        if model != "gemini-2.5-flash":
            failures.append(f"reconcile did not pick the recommended default: {model}")
        if "gemini-9.9-flash" not in choices:
            failures.append("newly-listed model gemini-9.9-flash did not appear in the picker list")
        if "gemini-2.5-pro" in choices:
            failures.append("non-free-tier model gemini-2.5-pro was not filtered out")
        if any("embedding" in c for c in choices):
            failures.append("embedding model leaked into the flash-only picker list")

        # Clicking "Set Gemini key" should rebuild the picker from the fetched list.
        page.evaluate("() => document.querySelector('#geminiApiKeyConfig').click()")
        page.wait_for_selector(".modal-overlay #model", timeout=8000)
        time.sleep(0.2)
        picker_options = page.evaluate(
            "() => Array.from(document.querySelectorAll('.modal-overlay #model option')).map(o => o.value)"
        )
        print(f"picker options={picker_options}", flush=True)
        if "gemini-9.9-flash" not in picker_options:
            failures.append("Set Gemini key picker did not include the freshly fetched model")
        if "gemini-2.5-pro" in picker_options:
            failures.append("Set Gemini key picker included a non-free-tier model")
        # Close any open modals (cleanup only).
        page.evaluate("() => document.querySelectorAll('.modal-overlay').forEach(o => o.remove())")

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
