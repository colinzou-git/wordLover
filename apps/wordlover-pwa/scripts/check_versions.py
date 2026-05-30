#!/usr/bin/env python3
"""Enforce the cache-version lockstep that the PWA shell depends on.

Per CLAUDE.md, three things must move together or users get a stale/broken shell:
  1. The shell cache name (CACHE_NAME / SHELL_CACHE_VERSION / SHELL_CACHE_NAME).
  2. The ?v=YYYYMMDD-N query string on every shell asset reference.
  3. APP_VERSION in app.js (must exist).

This script fails (exit 1) if any of those are inconsistent. It is run in CI and
can be run locally with any Python 3.

Usage:  python apps/wordlover-pwa/scripts/check_versions.py
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "public"

APP_JS = ROOT / "app.js"
SW_JS = ROOT / "sw.js"
TESTS_JS = ROOT / "automated-tests.js"
INDEX_HTML = ROOT / "index.html"
TESTS_HTML = ROOT / "automated-tests.html"

ASSET_FILES = [APP_JS, SW_JS, TESTS_JS, INDEX_HTML, TESTS_HTML]

CACHE_NAME_RE = re.compile(r'(?:CACHE_NAME|SHELL_CACHE_VERSION|SHELL_CACHE_NAME)\s*=\s*"([^"]+)"')
ASSET_VERSION_RE = re.compile(r'\?v=([0-9]{8}-[0-9]+)')
APP_VERSION_RE = re.compile(r'APP_VERSION\s*=\s*"([^"]+)"')


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8-sig")


def main() -> int:
    failures: list[str] = []

    # 1. Shell cache name must be identical wherever it is declared.
    cache_names: dict[str, set[str]] = {}
    for path in (APP_JS, SW_JS, TESTS_JS):
        names = set(CACHE_NAME_RE.findall(read(path)))
        if not names:
            failures.append(f"{path.name}: no shell cache name constant found")
        cache_names[path.name] = names
    all_cache_names = {n for names in cache_names.values() for n in names}
    if len(all_cache_names) > 1:
        failures.append(
            "shell cache names disagree across files: "
            + ", ".join(f"{f}={sorted(v)}" for f, v in cache_names.items())
        )

    # 2. Every ?v= asset query string must use the same version.
    asset_versions: dict[str, set[str]] = {}
    for path in ASSET_FILES:
        versions = set(ASSET_VERSION_RE.findall(read(path)))
        if versions:
            asset_versions[path.name] = versions
    all_asset_versions = {v for vs in asset_versions.values() for v in vs}
    if not all_asset_versions:
        failures.append("no ?v= asset version query strings found in any shell file")
    elif len(all_asset_versions) > 1:
        failures.append(
            "asset ?v= versions disagree: "
            + ", ".join(f"{f}={sorted(v)}" for f, v in asset_versions.items())
        )

    # 3. APP_VERSION must exist in app.js.
    app_versions = APP_VERSION_RE.findall(read(APP_JS))
    if not app_versions:
        failures.append("app.js: APP_VERSION constant not found")

    if failures:
        print("Version lockstep check FAILED:")
        for f in failures:
            print(f"  - {f}")
        return 1

    print("Version lockstep check PASSED")
    print(f"  shell cache name : {sorted(all_cache_names)[0]}")
    print(f"  asset ?v= version: {sorted(all_asset_versions)[0]}")
    print(f"  APP_VERSION      : {app_versions[0]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
