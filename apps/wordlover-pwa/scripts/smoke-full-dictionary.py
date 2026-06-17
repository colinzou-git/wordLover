"""Browser smoke test for WordFan's sharded full dictionary runtime."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from playwright.sync_api import sync_playwright


def write_report(path: str | None, report: dict) -> None:
    if not path:
        return
    output = Path(path)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default="http://127.0.0.1:4173")
    parser.add_argument("--report", default=None)
    args = parser.parse_args()

    report: dict = {"passed": False, "steps": {}}
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()
        page.goto(f"{args.base}/?fresh=full-dictionary", wait_until="domcontentloaded")
        page.wait_for_function("window.WordLoverApp != null", timeout=20_000)
        page.evaluate("async () => window.WordLoverApp.ensureDictionaryLoaded()")
        page.wait_for_function("window.WordLoverApp.getState().loaded === true", timeout=60_000)

        status = page.evaluate("async () => window.WordLoverApp.fullDictionary.refresh(true)")
        report["steps"]["manifest"] = status
        if status.get("rowCount", 0) < 1:
            raise AssertionError(f"Full dictionary manifest did not load: {status}")

        exact = page.evaluate(
            "async () => window.WordLoverApp.lookupTermWithFullFallback('fullsizeonlyword')"
        )
        report["steps"]["exact"] = exact
        if exact.get("status") != "found" or exact.get("dictionaryCoverage") != "full":
            raise AssertionError(f"Full-only exact lookup failed: {exact}")

        installed = page.evaluate("async () => window.WordLoverApp.fullDictionary.install()")
        report["steps"]["install"] = installed
        if not installed.get("offlineInstalled"):
            raise AssertionError(f"Full dictionary offline install did not complete: {installed}")

        context.set_offline(True)
        alias = page.evaluate(
            "async () => window.WordLoverApp.lookupTermWithFullFallback('fullsizeonlywords')"
        )
        report["steps"]["offlineAlias"] = alias
        if alias.get("status") != "found" or alias.get("baseTerm") != "fullsizeonlyword":
            raise AssertionError(f"Offline inflection lookup failed: {alias}")

        removed = page.evaluate("async () => window.WordLoverApp.fullDictionary.remove()")
        report["steps"]["remove"] = removed
        if removed.get("offlineInstalled"):
            raise AssertionError(f"Full dictionary offline copy was not removed: {removed}")

        report["passed"] = True
        browser.close()

    write_report(args.report, report)
    print(json.dumps(report, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
