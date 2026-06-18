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
        shard_requests: list[str] = []
        delayed_first_shard = {"pending": True}

        def observe_request(request) -> None:
            if "/dictionary-full/shard-" in request.url:
                shard_requests.append(request.url)

        def delay_first_shard(route) -> None:
            if delayed_first_shard["pending"]:
                delayed_first_shard["pending"] = False
                page.wait_for_timeout(300)
            route.continue_()

        page.on("request", observe_request)
        page.route("**/dictionary-full/shard-*.json.gz", delay_first_shard)
        page.goto(f"{args.base}/?fresh=full-dictionary", wait_until="domcontentloaded")
        page.wait_for_function("window.WordLoverApp != null", timeout=20_000)
        page.evaluate("async () => window.WordLoverApp.ensureDictionaryLoaded()")
        page.wait_for_function("window.WordLoverApp.getState().loaded === true", timeout=60_000)

        status = page.evaluate("async () => window.WordLoverApp.fullDictionary.refresh(true)")
        report["steps"]["manifest"] = status
        if status.get("rowCount", 0) < 1:
            raise AssertionError(f"Full dictionary manifest did not load: {status}")


        page.locator("#termInput").fill("they’re")
        normalized_input = page.locator("#termInput").input_value()
        report["steps"]["smartApostrophe"] = normalized_input
        if normalized_input != "they're":
            raise AssertionError(f"Smart apostrophe was not normalized in the input: {normalized_input!r}")

        page.locator("#termInput").fill("fullsizeonlyword")
        page.wait_for_timeout(350)
        report["steps"]["lazyShardRequests"] = len(shard_requests)
        if shard_requests:
            raise AssertionError(f"Typing triggered full dictionary downloads before Enter: {shard_requests}")

        page.locator("#termInput").press("Enter")
        page.wait_for_timeout(50)
        page.locator("#termInput").fill("abandon")
        page.locator("#termInput").press("Enter")
        page.wait_for_timeout(500)
        current_result = page.locator("#result").inner_text()
        report["steps"]["staleLookupProtection"] = current_result
        if "abandon" not in current_result.lower() or "fullsizeonlyword" in current_result.lower():
            raise AssertionError(f"A stale full-dictionary response replaced the newer lookup: {current_result}")

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
