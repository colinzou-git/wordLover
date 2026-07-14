#!/usr/bin/env python3
"""Enforce cache-version lockstep across the complete native-module graph.

The PWA loads JavaScript directly as ES modules. A stale nested import can work
online while failing after an offline shell update, so every top-level public
.js/.html source containing a cache-busted reference must use one version.

Usage:  python apps/wordlover-pwa/scripts/check_versions.py
"""
from __future__ import annotations

import re
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "public"

APP_JS = ROOT / "app.js"
SW_JS = ROOT / "sw.js"
TESTS_JS = ROOT / "automated-tests.js"
INDEX_HTML = ROOT / "index.html"
TESTS_HTML = ROOT / "automated-tests.html"
CORE_FILES = [APP_JS, SW_JS, TESTS_JS, INDEX_HTML, TESTS_HTML]
RELEASE_JSON = ROOT / "release.json"

VERSIONED_SUFFIXES = {".js", ".html"}
CACHE_NAME_RE = re.compile(r'(?:CACHE_NAME|SHELL_CACHE_VERSION|SHELL_CACHE_NAME)\s*=\s*"([^"]+)"')
ASSET_VERSION_RE = re.compile(r"\?v=([0-9]{8}-[0-9]+)")
APP_VERSION_RE = re.compile(r'^\s*const\s+APP_VERSION\s*=\s*"([^"]+)"', re.MULTILINE)
APP_RELEASE_RE = re.compile(r"-v([0-9]+)$")
CACHE_RELEASE_RE = re.compile(r"-v([0-9]+)$")
FSRS_IMPORT_RE = re.compile(r"fsrs-scheduler\.js\?v=([0-9]{8}-[0-9]+)")


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8-sig")


def versioned_source_files() -> list[Path]:
    return sorted(
        path
        for path in ROOT.iterdir()
        if path.is_file()
        and path.suffix in VERSIONED_SUFFIXES
        and ASSET_VERSION_RE.search(read(path))
    )


def main() -> int:
    failures: list[str] = []

    cache_names: dict[str, set[str]] = {}
    for path in (APP_JS, SW_JS, TESTS_JS):
        names = set(CACHE_NAME_RE.findall(read(path)))
        if not names:
            failures.append(f"{path.name}: no shell cache name constant found")
        cache_names[path.name] = names
    all_cache_names = {name for names in cache_names.values() for name in names}
    if len(all_cache_names) > 1:
        failures.append(
            "shell cache names disagree across files: "
            + ", ".join(f"{name}={sorted(values)}" for name, values in cache_names.items())
        )

    asset_files = versioned_source_files()
    missing_core = [path.name for path in CORE_FILES if path not in asset_files]
    if missing_core:
        failures.append("expected versioned shell files were not discovered: " + ", ".join(missing_core))

    asset_versions: dict[str, set[str]] = {}
    for path in asset_files:
        versions = set(ASSET_VERSION_RE.findall(read(path)))
        if versions:
            asset_versions[path.name] = versions
    all_asset_versions = {version for versions in asset_versions.values() for version in versions}
    if not all_asset_versions:
        failures.append("no ?v= asset version query strings found in public JS/HTML sources")
    elif len(all_asset_versions) > 1:
        failures.append(
            "asset ?v= versions disagree across the module graph: "
            + ", ".join(f"{name}={sorted(values)}" for name, values in asset_versions.items())
        )

    app_versions = APP_VERSION_RE.findall(read(APP_JS))
    if not app_versions:
        failures.append("app.js: APP_VERSION constant not found")
    elif len(set(app_versions)) > 1:
        failures.append(f"app.js: multiple APP_VERSION constants found: {sorted(set(app_versions))}")

    if len(all_cache_names) == 1 and app_versions:
        cache_name = next(iter(all_cache_names))
        app_release = APP_RELEASE_RE.search(app_versions[0])
        cache_release = CACHE_RELEASE_RE.search(cache_name)
        if not app_release:
            failures.append(f"APP_VERSION should end with -vNNN: {app_versions[0]}")
        if not cache_release:
            failures.append(f"shell cache name should end with -vNNN: {cache_name}")
        if app_release and cache_release and app_release.group(1) != cache_release.group(1):
            failures.append(
                f"APP_VERSION release v{app_release.group(1)} does not match shell cache release v{cache_release.group(1)}"
            )

    sw_versions = APP_VERSION_RE.findall(read(SW_JS))
    if len(sw_versions) != 1 or (app_versions and sw_versions[0] != app_versions[0]):
        failures.append(f"sw.js APP_VERSION does not match app.js: {sw_versions}")
    try:
        release = json.loads(read(RELEASE_JSON))
        if app_versions and release.get("appVersion") != app_versions[0]:
            failures.append("release.json appVersion does not match app.js")
        if len(all_cache_names) == 1 and release.get("shellCache") != next(iter(all_cache_names)):
            failures.append("release.json shellCache does not match shell constants")
        if release.get("schemaVersion") != 1:
            failures.append("release.json schemaVersion must be 1")
    except (OSError, json.JSONDecodeError) as error:
        failures.append(f"release.json is invalid: {error}")

    fsrs_import_versions: dict[str, set[str]] = {}
    for path in asset_files:
        matches = set(FSRS_IMPORT_RE.findall(read(path)))
        if matches:
            fsrs_import_versions[path.name] = matches
    all_fsrs_import_versions = {
        version for versions in fsrs_import_versions.values() for version in versions
    }
    if not all_fsrs_import_versions:
        failures.append("no fsrs-scheduler.js import with ?v= found")
    elif len(all_fsrs_import_versions) > 1:
        failures.append(
            "fsrs-scheduler.js import ?v= disagrees across modules: "
            + ", ".join(f"{name}={sorted(values)}" for name, values in fsrs_import_versions.items())
        )
    elif len(all_asset_versions) == 1:
        fsrs_version = next(iter(all_fsrs_import_versions))
        asset_version = next(iter(all_asset_versions))
        if fsrs_version != asset_version:
            failures.append(
                f"fsrs-scheduler.js import ?v={fsrs_version} does not match shell asset ?v={asset_version}"
            )

    if failures:
        print("Version lockstep check FAILED:")
        for failure in failures:
            print(f"  - {failure}")
        return 1

    print("Version lockstep check PASSED")
    print(f"  shell cache name        : {sorted(all_cache_names)[0]}")
    print(f"  asset ?v= version       : {sorted(all_asset_versions)[0]}")
    print(f"  versioned source files  : {len(asset_files)}")
    print(f"  fsrs-scheduler ?v=      : {sorted(all_fsrs_import_versions)[0]}")
    print(f"  APP_VERSION             : {app_versions[0]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
