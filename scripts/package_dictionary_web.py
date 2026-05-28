#!/usr/bin/env python3
"""Package the WordLover SQLite dictionary for PWA delivery."""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import sqlite3
import time
from pathlib import Path


DEFAULT_INPUT = Path("data/dictionary-slim.sqlite")
DEFAULT_OUTPUT_DIR = Path("apps/wordlover-pwa/public")
DEFAULT_VERSION = f"{time.strftime('%Y.%m.%d')}.slim"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create web dictionary package files.")
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT,
                        help="SQLite dictionary to package (default: data/dictionary-slim.sqlite).")
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--version", default=DEFAULT_VERSION)
    parser.add_argument("--zstd-level", type=int, default=3)
    parser.add_argument("--copy-sqlite", action="store_true", help="Also copy the SQLite file for the current sql.js fallback.")
    return parser.parse_args()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
      for chunk in iter(lambda: handle.read(1024 * 1024), b""):
          digest.update(chunk)
    return digest.hexdigest()


def count_rows(path: Path) -> int:
    with sqlite3.connect(path) as conn:
        return int(conn.execute("SELECT count(*) FROM dictionary_entries").fetchone()[0])


def compress_zstd(source: Path, target: Path, level: int) -> int:
    try:
        import zstandard as zstd
    except ImportError as exc:
        raise SystemExit(
            "Python module 'zstandard' is required for .zst packaging. "
            "Install it with: python -m pip install zstandard"
        ) from exc

    compressor = zstd.ZstdCompressor(level=level, threads=-1)
    with source.open("rb") as src, target.open("wb") as dst:
        compressor.copy_stream(src, dst)
    return target.stat().st_size


def main() -> None:
    args = parse_args()
    if not args.input.exists():
        raise SystemExit(f"Dictionary not found: {args.input}")

    args.output_dir.mkdir(parents=True, exist_ok=True)
    sqlite_size = args.input.stat().st_size
    sqlite_sha256 = sha256_file(args.input)
    row_count = count_rows(args.input)

    zst_path = args.output_dir / "dictionary.sqlite.zst"
    zst_size = compress_zstd(args.input, zst_path, args.zstd_level)
    zst_sha256 = sha256_file(zst_path)

    if args.copy_sqlite:
        shutil.copy2(args.input, args.output_dir / "dictionary.sqlite")

    variant = "slim" if "slim" in args.input.name.lower() else "full"
    manifest = {
        "app": "wordlover",
        "dictionaryDataVersion": args.version,
        "variant": variant,
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "rowCount": row_count,
        "sqlite": {
            "path": "dictionary.sqlite",
            "bytes": sqlite_size,
            "sha256": sqlite_sha256,
        },
        "zstd": {
            "path": "dictionary.sqlite.zst",
            "bytes": zst_size,
            "sha256": zst_sha256,
            "level": args.zstd_level,
        },
        "sources": ["ECDICT", "WordNet 3.0", "OPTED/Webster 1913"],
    }
    manifest_path = args.output_dir / "dictionary-manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
