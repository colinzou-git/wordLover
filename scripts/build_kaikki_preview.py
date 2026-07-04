#!/usr/bin/env python3
"""Copy prepared dictionary assets into the one permitted Kaikki preview path."""

from __future__ import annotations

import argparse
import shutil
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
PUBLIC_ROOT = REPO_ROOT / "apps/wordlover-pwa/public"
PREVIEW_RELATIVE = Path("kaikki-preview/feature-kaikki-dictionary-preview")
REQUIRED_FILES = (
    Path("dictionary.sqlite"),
    Path("dictionary.sqlite.zst"),
    Path("dictionary-manifest.json"),
)


def permitted_output(public_root: Path = PUBLIC_ROOT) -> Path:
    return (public_root / PREVIEW_RELATIVE).resolve()


def validate_output(output_dir: Path, public_root: Path = PUBLIC_ROOT) -> Path:
    resolved = output_dir.resolve()
    expected = permitted_output(public_root)
    if resolved != expected:
        raise ValueError(f"Kaikki preview output must be exactly {expected}, got {resolved}")
    return resolved


def package_preview(source_dir: Path, output_dir: Path, public_root: Path = PUBLIC_ROOT) -> Path:
    source_dir = source_dir.resolve()
    destination = validate_output(output_dir, public_root)
    missing = [str(path) for path in REQUIRED_FILES if not (source_dir / path).is_file()]
    if not (source_dir / "dictionary-full").is_dir():
        missing.append("dictionary-full/")
    if missing:
        raise FileNotFoundError("Prepared dictionary is incomplete: " + ", ".join(missing))

    if destination.exists():
        shutil.rmtree(destination)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.mkdir()
    for relative in REQUIRED_FILES:
        shutil.copy2(source_dir / relative, destination / relative)
    shutil.copytree(source_dir / "dictionary-full", destination / "dictionary-full")
    return destination


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, default=PUBLIC_ROOT / PREVIEW_RELATIVE)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    destination = package_preview(args.source_dir, args.output_dir)
    print(f"Kaikki preview packaged at {destination}")


if __name__ == "__main__":
    main()
