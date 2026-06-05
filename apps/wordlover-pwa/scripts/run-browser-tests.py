#!/usr/bin/env python3
"""Run the in-browser WordFan automated suite against a local server."""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
import time

from playwright.async_api import async_playwright


async def run(base: str, timeout_s: int) -> int:
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
        await browser.close()
    if not raw.strip().startswith("{"):
        print(raw or "Browser suite did not produce JSON results.", file=sys.stderr)
        return 1
    result = json.loads(raw)
    verdict = result.get("verdict", {})
    failed = {key: value for key, value in verdict.items() if value not in ("pass", "deferred-until-end", "investigate")}
    print(json.dumps({"verdict": verdict, "failed": failed}, indent=2))
    return 1 if failed else 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default="http://127.0.0.1:4173")
    parser.add_argument("--timeout", type=int, default=420)
    args = parser.parse_args()
    return asyncio.run(run(args.base, args.timeout))


if __name__ == "__main__":
    raise SystemExit(main())
