"""Heavier headless smoke that also loads the dictionary and exercises lookup/save flows.

Slower than smoke-headless.py because it downloads the ~200 MB dictionary into the
Chromium IndexedDB on every run (no persistent profile). Use this for end-to-end
regression checks; use smoke-headless.py for fast PR-time validation.

Run with the Windows HTTP server already on port 4173.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default="http://127.0.0.1:4173")
    parser.add_argument("--report", default=None)
    parser.add_argument("--dictionary-timeout-ms", type=int, default=180000)
    args = parser.parse_args()

    errors: list[str] = []
    console_messages: list[dict] = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()
        page.on("console", lambda msg: console_messages.append({"type": msg.type, "text": msg.text}))
        page.on("pageerror", lambda err: errors.append(f"pageerror: {err}"))

        page.goto(f"{args.base}/?fresh=v35", wait_until="domcontentloaded")
        page.wait_for_function("window.WordLoverApp != null", timeout=15000)

        page.evaluate("() => window.WordLoverApp.ensureDictionaryLoaded()")
        page.wait_for_function("window.WordLoverApp.getState().loaded === true", timeout=args.dictionary_timeout_ms)

        manual_save = page.evaluate(
            """async () => {
                const item = await window.WordLoverApp.saveManualVocabularyItem({
                    term: 'zzfaketestword',
                    normalizedTerm: 'zzfaketestword',
                    english: ['fake english meaning'],
                    chinese: ['假中文意思'],
                    phonetic: '/zee/',
                });
                return {
                    saved: Boolean(item),
                    term: item?.term,
                    lastSaveReason: item?.lastSaveReason,
                    english: item?.user?.englishMeanings,
                    chinese: item?.user?.chineseMeanings,
                };
            }"""
        )

        abandon_lookup = page.evaluate(
            "() => { const r = window.WordLoverApp.lookupTerm('abandon'); return { status: r.status, term: r.term, queryMs: r.queryMs }; }"
        )

        vocab_search = page.evaluate(
            """() => {
                const items = window.WordLoverApp.getVocabulary();
                return {
                    count: items.length,
                    hasZz: items.some(it => it.term === 'zzfaketestword'),
                    zzReason: items.find(it => it.term === 'zzfaketestword')?.lastSaveReason,
                };
            }"""
        )

        browser.close()

    report = {
        "errors": errors,
        "console_warnings_and_errors": [m for m in console_messages if m["type"] in ("error", "warning")][:50],
        "manual_save": manual_save,
        "abandon_lookup": abandon_lookup,
        "vocab_search": vocab_search,
    }
    print(json.dumps(report, indent=2, ensure_ascii=False))
    if args.report:
        Path(args.report).write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")

    failures = []
    if errors:
        failures.append(f"{len(errors)} runtime errors")
    if not manual_save.get("saved") or manual_save.get("english") != ["fake english meaning"]:
        failures.append("manual save did not return expected item")
    if abandon_lookup.get("status") != "found":
        failures.append(f"abandon lookup status: {abandon_lookup.get('status')}")
    if not vocab_search.get("hasZz") or vocab_search.get("zzReason") != "manual-unknown":
        failures.append("manual-saved unknown term not present with correct reason")

    if failures:
        print("\nFAILED:")
        for f in failures:
            print(f"  - {f}")
        return 1
    print("\nPASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
