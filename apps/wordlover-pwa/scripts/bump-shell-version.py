#!/usr/bin/env python3
"""Single-writer shell version stamper — the ONE place every cache-busting marker is set.

WordFan ships as plain ES modules with no build step, so each shell asset reference
carries a literal ``?v=YYYYMMDD-N`` query string, three cache-name constants
(``CACHE_NAME`` / ``SHELL_CACHE_VERSION`` / ``SHELL_CACHE_NAME``) and ``APP_VERSION``
must all agree, and ``check_versions.py`` fails CI (which skips the deploy) if any of
them drift. Hand-editing those markers across ~16 files is the single most common
cause of a red build / frozen deploy.

This script rewrites all of them from one computed value, so they can never disagree.

Modes:
  (default)  bump : increment the release ``-vNNN`` and roll the ``?v=`` date stamp,
                    then rewrite every marker. Use this for any shell change.
  --sync          : rewrite every marker to match the version already in ``app.js``
                    (repairs a partial hand-edit without advancing the version).
  --print         : print the current canonical version and exit (no writes).

Usage:
  python apps/wordlover-pwa/scripts/bump-shell-version.py
  python apps/wordlover-pwa/scripts/bump-shell-version.py --sync
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "public"

APP_JS = ROOT / "app.js"
CACHE_NAME_FILES = [APP_JS, ROOT / "sw.js", ROOT / "automated-tests.js"]
RELEASE_JSON = ROOT / "release.json"

# A versioned shell source is any top-level public .js/.html that carries a ?v= ref.
VERSIONED_SUFFIXES = {".js", ".html"}

ASSET_VERSION_RE = re.compile(r"\?v=(\d{8})-(\d+)")
CACHE_NAME_RE = re.compile(r"(wordlover-shell-v)(\d+)")
# Trailing "<YYYYMMDD>-<n>-v<release>" inside the APP_VERSION string literal only.
APP_VERSION_RE = re.compile(r'(const APP_VERSION = "[^"]*?)(\d{8})-(\d+)-v(\d+)(")')


def read(path: Path) -> str:
    # utf-8-sig tolerates a BOM if one slipped in; we re-emit without one.
    return path.read_text(encoding="utf-8-sig")


def write(path: Path, text: str) -> None:
    # newline="" preserves the file's existing line endings instead of translating them.
    with open(path, "w", encoding="utf-8", newline="") as handle:
        handle.write(text)


def parse_current() -> tuple[str, int, int]:
    """Return (date_stamp 'YYYYMMDD', sub_counter, release) from APP_VERSION."""
    match = APP_VERSION_RE.search(read(APP_JS))
    if not match:
        raise SystemExit("bump-shell-version: APP_VERSION not found or malformed in app.js")
    return match.group(2), int(match.group(3)), int(match.group(4))


def next_version(date: str, sub: int, release: int) -> tuple[str, int, int]:
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    new_sub = sub + 1 if date == today else 1
    return today, new_sub, release + 1


def apply(date: str, sub: int, release: int) -> list[str]:
    stamp = f"{date}-{sub}"
    changed: list[str] = []

    asset_files = sorted(
        path
        for path in ROOT.iterdir()
        if path.is_file() and path.suffix in VERSIONED_SUFFIXES and ASSET_VERSION_RE.search(read(path))
    )
    for path in asset_files:
        original = read(path)
        updated = ASSET_VERSION_RE.sub(f"?v={stamp}", original)
        if updated != original:
            write(path, updated)
            changed.append(path.name)

    for path in CACHE_NAME_FILES:
        original = read(path)
        updated = CACHE_NAME_RE.sub(rf"\g<1>{release}", original)
        if path in (APP_JS, ROOT / "sw.js"):
            updated = APP_VERSION_RE.sub(rf"\g<1>{stamp}-v{release}\g<5>", updated)
        if updated != original and path.name not in changed:
            changed.append(path.name)
        if updated != original:
            write(path, updated)

    manifest = json.loads(read(RELEASE_JSON))
    app_version = APP_VERSION_RE.search(read(APP_JS)).group(0).split('"')[1]
    manifest.update({"appVersion": app_version, "shellCache": f"wordlover-shell-v{release}"})
    rendered = json.dumps(manifest, indent=2) + "\n"
    if rendered != read(RELEASE_JSON):
        write(RELEASE_JSON, rendered)
        changed.append(RELEASE_JSON.name)

    return sorted(set(changed))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sync", action="store_true", help="re-stamp to app.js's current version without bumping")
    parser.add_argument("--print", dest="show", action="store_true", help="print current version and exit")
    args = parser.parse_args()

    date, sub, release = parse_current()
    if args.show:
        print(f"{date}-{sub}-v{release}")
        return 0

    if args.sync:
        target = (date, sub, release)
    else:
        target = next_version(date, sub, release)

    changed = apply(*target)
    print(f"shell version: {date}-{sub}-v{release} -> {target[0]}-{target[1]}-v{target[2]}")
    print(f"  rewrote {len(changed)} file(s): {', '.join(changed) if changed else '(none)'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
