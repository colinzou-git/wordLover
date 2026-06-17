#!/usr/bin/env python3
"""Validate an existing sharded WordFan dictionary directory."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from scripts.package_dictionary_shards import validate_package


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
