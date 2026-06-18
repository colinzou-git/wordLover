#!/usr/bin/env python3
"""Bump every versioned PWA shell reference in one lockstep operation.

The runtime uses native ES modules, so cache-busted imports can appear in any
public JavaScript module, not only app.js and automated-tests.js. This script
updates every top-level public .js/.html source containing a ?v=YYYYMMDD-N
reference, plus the shell cache and user-visible app release.

Usage (from repo root):
    python apps/wordlover-pwa/scripts/bump_version.py

Rules:
  - ?v= build tag: YYYYMMDD-N  — N resets to 1 on a new calendar day,
    increments on the same day.
  - Shell cache / APP_VERSION release: -vNNN — always increments by 1.
"""
from __future__ import annotations

import re
import subprocess
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "public"

APP_JS = ROOT / "app.js"
SW_JS = ROOT / "sw.js"
TESTS_JS = ROOT / "automated-tests.js"
INDEX_HTML = ROOT / "index.html"
TESTS_HTML = ROOT / "automated-tests.html"
CORE_FILES = [APP_JS, SW_JS, TESTS_JS, INDEX_HTML, TESTS_HTML]

VERSIONED_SUFFIXES = {".js", ".html"}
ASSET_VERSION_RE = re.compile(r"\?v=([0-9]{8})-([0-9]+)")


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8-sig")


def write(path: Path, text: str) -> None:
    path.write_text(text, encoding="utf-8")


def versioned_source_files() -> list[Path]:
    return sorted(
        path
        for path in ROOT.iterdir()
        if path.is_file()
        and path.suffix in VERSIONED_SUFFIXES
        and ASSET_VERSION_RE.search(read(path))
    )


def main() -> int:
    app_text = read(APP_JS)

    asset_match = ASSET_VERSION_RE.search(app_text)
    if not asset_match:
        print("ERROR: could not find ?v=YYYYMMDD-N in app.js")
        return 1
    current_date, current_increment = asset_match.groups()
    today = date.today().strftime("%Y%m%d")
    new_asset_version = (
        f"{today}-{int(current_increment) + 1}"
        if current_date == today
        else f"{today}-1"
    )
    old_asset_version = f"{current_date}-{current_increment}"

    cache_match = re.search(r"wordlover-shell-v([0-9]+)", app_text)
    if not cache_match:
        print("ERROR: could not find wordlover-shell-vNNN in app.js")
        return 1
    new_release = int(cache_match.group(1)) + 1
    old_cache = f"wordlover-shell-v{cache_match.group(1)}"
    new_cache = f"wordlover-shell-v{new_release}"

    app_version_match = re.search(r'const APP_VERSION = "([^"]+)"', app_text)
    if not app_version_match:
        print("ERROR: could not find APP_VERSION in app.js")
        return 1
    old_app_version = app_version_match.group(1)
    new_app_version = re.sub(
        r"([0-9]{8}-[0-9]+)-v[0-9]+",
        lambda _match: f"{new_asset_version}-v{new_release}",
        old_app_version,
    )
    if new_app_version == old_app_version:
        print(f"ERROR: could not rewrite APP_VERSION: {old_app_version}")
        return 1

    files = versioned_source_files()
    missing_core = [path.name for path in CORE_FILES if path not in files]
    if missing_core:
        print("ERROR: expected versioned shell files were not discovered: " + ", ".join(missing_core))
        return 1

    print(f"  asset ?v=  : {old_asset_version}  ->  {new_asset_version}")
    print(f"  cache name : {old_cache}  ->  {new_cache}")
    print(f"  APP_VERSION: {old_app_version}  ->  {new_app_version}")
    print(f"  source files: {len(files)}")

    for path in files:
        text = read(path)
        if path == APP_JS:
            text = text.replace(
                f'const APP_VERSION = "{old_app_version}"',
                f'const APP_VERSION = "{new_app_version}"',
            )
        text = ASSET_VERSION_RE.sub(f"?v={new_asset_version}", text)
        text = text.replace(old_cache, new_cache)
        write(path, text)

    check = Path(__file__).parent / "check_versions.py"
    result = subprocess.run([sys.executable, str(check)], capture_output=True, text=True)
    print(result.stdout.strip())
    if result.returncode != 0:
        print(result.stderr.strip())
        print("ERROR: version lockstep check failed after bump — investigate above.")
        return 1

    print(f"\nReload the app at:  http://127.0.0.1:4173/?fresh=v{new_release}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
