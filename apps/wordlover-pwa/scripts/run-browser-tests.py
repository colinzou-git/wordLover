#!/usr/bin/env python3
"""Run the in-browser WordFan automated suite against a local server."""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
import time
from pathlib import Path

from playwright.async_api import async_playwright


async def run(base: str, timeout_s: int, report: str | None) -> int:
    screenshot_path: str | None = None
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1280, "height": 900})
        await page.goto(f"{base.rstrip('/')}/automated-tests.html?autorun=1&fresh=ci-{int(time.time())}", wait_until="domcontentloaded")
        deadline = time.time() + timeout_s
        raw = ""
        while time.time() < deadline:
            text = await page.evaluate("document.body.innerText")
            raw = await page.evaluate('document.querySelector("#rawResults")?.textContent ?? ""')
            if "Complete" in text or "Failed" in text:
                break
            await page.wait_for_timeout(1000)

        if report:
            screenshot_path = str(Path(report).with_suffix(".png"))
            await page.screenshot(path=screenshot_path, full_page=True)

        await browser.close()

    if not raw.strip().startswith("{"):
        msg = raw or "Browser suite did not produce JSON results."
        print(msg, file=sys.stderr)
        if report:
            Path(report).parent.mkdir(parents=True, exist_ok=True)
            Path(report).write_text(json.dumps({"error": msg, "screenshot": screenshot_path}), encoding="utf-8")
        return 1

    result = json.loads(raw)
    verdict = result.get("verdict", {})
    failed = {key: value for key, value in verdict.items() if value not in ("pass", "deferred-until-end", "investigate")}
    output = {"verdict": verdict, "failed": failed, "screenshot": screenshot_path if failed else None}
    print(json.dumps(output, indent=2))

    if report:
        Path(report).parent.mkdir(parents=True, exist_ok=True)
        Path(report).write_text(json.dumps(output, indent=2, ensure_ascii=False), encoding="utf-8")

    return 1 if failed else 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default="http://127.0.0.1:4173")
    parser.add_argument("--timeout", type=int, default=420)
    parser.add_argument("--report", default=None, help="Write JSON report to this path")
    args = parser.parse_args()
    return asyncio.run(run(args.base, args.timeout, args.report))


if __name__ == "__main__":
    raise SystemExit(main())
