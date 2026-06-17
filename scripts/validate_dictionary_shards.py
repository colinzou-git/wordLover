#!/usr/bin/env python3
"""Validate an existing sharded WordFan dictionary directory."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from package_dictionary_shards import validate_package  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path)
    args = parser.parse_args()
    manifest_path = args.directory / "manifest.json"
    if not manifest_path.is_file():
        raise SystemExit(f"Manifest not found: {manifest_path}")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    validate_package(args.directory, manifest)
    print(
        f"Validated {manifest['rowCount']:,} entries, {manifest['aliasCount']:,} aliases, "
        f"and {manifest['shardCount']} shards ({manifest['totalCompressedBytes']:,} bytes)."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
