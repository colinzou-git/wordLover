#!/usr/bin/env python3
"""Bump the PWA shell version so the service worker picks up new changes.

Updates all five files that must stay in lockstep (app.js, sw.js,
automated-tests.js, index.html, automated-tests.html) and prints the
?fresh= URL to use in Chrome to force the new SW to install.

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

APP_JS   = ROOT / "app.js"
SW_JS    = ROOT / "sw.js"
TESTS_JS = ROOT / "automated-tests.js"
INDEX_HTML  = ROOT / "index.html"
TESTS_HTML  = ROOT / "automated-tests.html"

ALL_FILES = [APP_JS, SW_JS, TESTS_JS, INDEX_HTML, TESTS_HTML]


def read(p: Path) -> str:
    return p.read_text(encoding="utf-8-sig")


def write(p: Path, text: str) -> None:
    p.write_text(text, encoding="utf-8")


def main() -> int:
    app_text = read(APP_JS)

    # --- Parse current asset ?v= tag ---
    asset_m = re.search(r'\?v=([0-9]{8})-([0-9]+)', app_text)
    if not asset_m:
        print("ERROR: could not find ?v=YYYYMMDD-N in app.js")
        return 1
    cur_date_str, cur_n_str = asset_m.group(1), asset_m.group(2)
    today_str = date.today().strftime("%Y%m%d")
    if cur_date_str == today_str:
        new_asset_v = f"{today_str}-{int(cur_n_str) + 1}"
    else:
        new_asset_v = f"{today_str}-1"
    old_asset_v = f"{cur_date_str}-{cur_n_str}"

    # --- Parse current shell cache release number ---
    cache_m = re.search(r'wordlover-shell-v([0-9]+)', app_text)
    if not cache_m:
        print("ERROR: could not find wordlover-shell-vNNN in app.js")
        return 1
    new_release = int(cache_m.group(1)) + 1
    old_cache = f"wordlover-shell-v{cache_m.group(1)}"
    new_cache = f"wordlover-shell-v{new_release}"

    # --- Parse APP_VERSION ---
    app_ver_m = re.search(r'const APP_VERSION = "([^"]+)"', app_text)
    if not app_ver_m:
        print("ERROR: could not find APP_VERSION in app.js")
        return 1
    old_app_ver = app_ver_m.group(1)
    # e.g. "0.6.2-product.20260606-3-v111" -> "0.6.2-product.20260606-4-v112"
    new_app_ver = re.sub(
        r'([0-9]{8}-[0-9]+)-v[0-9]+',
        lambda m: f"{new_asset_v}-v{new_release}",
        old_app_ver,
    )
    if new_app_ver == old_app_ver:
        print(f"ERROR: could not rewrite APP_VERSION: {old_app_ver}")
        return 1

    print(f"  asset ?v=  : {old_asset_v}  ->  {new_asset_v}")
    print(f"  cache name : {old_cache}  ->  {new_cache}")
    print(f"  APP_VERSION: {old_app_ver}  ->  {new_app_ver}")

    # --- Apply to all five files ---
    for path in ALL_FILES:
        text = read(path)
        # APP_VERSION first — its string contains old_asset_v, so the generic
        # replace below would corrupt it if we ran that first.
        if path == APP_JS:
            text = text.replace(f'const APP_VERSION = "{old_app_ver}"',
                                f'const APP_VERSION = "{new_app_ver}"')
        text = text.replace(old_asset_v, new_asset_v)
        text = text.replace(old_cache, new_cache)
        write(path, text)

    # --- Verify with check_versions.py ---
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
