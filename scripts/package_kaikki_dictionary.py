#!/usr/bin/env python3
"""Build and package Kaikki only under the isolated WordFan preview path."""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
import time
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PUBLIC = REPO_ROOT / "apps/wordlover-pwa/public"
PREVIEW_RELATIVE = Path("kaikki-preview/local")
KAIKKI_SOURCES = ["Kaikki/Wiktextract", "current WordFan tag/translation overlay", "WordFan K-12/AP STEM"]
SLIM_DETAIL_POLICY = "none-with-full-shard-enrichment"
PROTECTED_PRODUCTION_PATHS = (
    Path("dictionary.sqlite"), Path("dictionary.sqlite.zst"),
    Path("dictionary-manifest.json"), Path("dictionary-full"),
)


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--tag-source", type=Path, default=Path("data/dictionary.sqlite"))
    parser.add_argument("--tag-source-shards", type=Path, default=Path("apps/wordlover-pwa/public/dictionary-full"))
    parser.add_argument("--full-translation-source", type=Path,
                        help="Current full WordFan SQLite DB used for Chinese fallback.")
    parser.add_argument("--full-translation-source-shards", type=Path,
                        help="Current manifest-backed full WordFan shards used for Chinese fallback.")
    parser.add_argument("--allow-missing-full-overlay", action="store_true",
                        help="Allow fixture packaging without the current full WordFan Chinese fallback overlay.")
    parser.add_argument("--work-dir", type=Path, default=Path("data/kaikki-build"))
    parser.add_argument("--public-dir", type=Path, default=DEFAULT_PUBLIC)
    parser.add_argument("--version", default=f"{time.strftime('%Y.%m.%d')}.kaikki")
    parser.add_argument("--target-rows", type=int, default=50_000,
                        help="Requested core size; mandatory ranked/STEM rows may make the final count larger.")
    parser.add_argument("--shard-count", type=int, default=128)
    return parser.parse_args(argv)


def run_command(command: list[str]) -> None:
    subprocess.run(command, cwd=REPO_ROOT, check=True)


def preview_output(public_dir: Path) -> Path:
    return (public_dir / PREVIEW_RELATIVE).resolve()


def validate_preview_output(output: Path, public_dir: Path) -> Path:
    expected = preview_output(public_dir)
    if output.resolve() != expected:
        raise ValueError(f"Kaikki output must be exactly {expected}")
    return expected


def build_full_kaikki(args: argparse.Namespace) -> Path:
    full = args.work_dir / "dictionary-kaikki.sqlite"
    report = args.work_dir / "kaikki-dictionary-report.json"
    command = [
        sys.executable, "scripts/build_kaikki_dictionary.py", "--source", str(args.source),
        "--output", str(full), "--report", str(report), "--data-version", f"{args.version}.full",
        "--tag-source", str(args.tag_source), "--tag-source-shards", str(args.tag_source_shards),
    ]
    if args.full_translation_source:
        command.extend(["--full-translation-source", str(args.full_translation_source)])
    if args.full_translation_source_shards:
        command.extend(["--full-translation-source-shards", str(args.full_translation_source_shards)])
    if args.allow_missing_full_overlay:
        command.append("--allow-missing-full-overlay")
    run_command(command)
    return full


def build_slim_kaikki(args: argparse.Namespace, full_db: Path) -> Path:
    slim = args.work_dir / "dictionary-kaikki-slim.sqlite"
    run_command([
        sys.executable, "scripts/build_slim_dictionary.py", "--input", str(full_db),
        "--output", str(slim), "--target-rows", str(args.target_rows),
        "--data-version", f"{args.version}.slim", "--detail-policy", "none",
    ])
    return slim


def package_slim_web(args: argparse.Namespace, slim_db: Path) -> Path:
    output = validate_preview_output(preview_output(args.public_dir), args.public_dir)
    run_command([
        sys.executable, "scripts/package_dictionary_web.py", "--input", str(slim_db),
        "--output-dir", str(output), "--version", f"{args.version}.slim", "--variant", "kaikki-slim",
        "--source-label", KAIKKI_SOURCES[0], "--source-label", KAIKKI_SOURCES[1],
        "--source-label", KAIKKI_SOURCES[2], "--copy-sqlite",
    ])
    manifest_path = output / "dictionary-manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["variant"] = "kaikki-slim"
    manifest["sources"] = KAIKKI_SOURCES
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return output


def package_full_shards(args: argparse.Namespace, full_db: Path) -> Path:
    output = preview_output(args.public_dir) / "dictionary-full"
    run_command([
        sys.executable, "scripts/package_dictionary_shards.py", "--input", str(full_db),
        "--output-dir", str(output), "--version", f"{args.version}.full-sharded",
        "--shard-count", str(args.shard_count), "--gzip-level", "9",
        "--source-label", KAIKKI_SOURCES[0], "--source-label", KAIKKI_SOURCES[1],
        "--source-label", KAIKKI_SOURCES[2],
    ])
    manifest_path = output / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["sources"] = KAIKKI_SOURCES
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return output


def _file_fingerprint(path: Path) -> dict:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return {"size": path.stat().st_size, "sha256": digest.hexdigest()}


def snapshot_production_paths(public_dir: Path) -> dict:
    snapshot: dict = {}
    for relative in PROTECTED_PRODUCTION_PATHS:
        path = public_dir / relative
        if path.is_file():
            snapshot[str(relative)] = {"type": "file", **_file_fingerprint(path)}
        elif path.is_dir():
            snapshot[str(relative)] = {
                "type": "directory",
                "files": {
                    item.relative_to(path).as_posix(): _file_fingerprint(item)
                    for item in sorted(path.rglob("*")) if item.is_file()
                },
            }
        else:
            snapshot[str(relative)] = {"type": "missing"}
    return snapshot


def validate_outputs(args: argparse.Namespace, production_before: dict | None = None) -> dict:
    output = validate_preview_output(preview_output(args.public_dir), args.public_dir)
    run_command([sys.executable, "scripts/validate_dictionary_shards.py", str(output / "dictionary-full")])
    required = [output / "dictionary.sqlite", output / "dictionary.sqlite.zst", output / "dictionary-manifest.json", output / "dictionary-full/manifest.json"]
    missing = [str(path) for path in required if not path.is_file()]
    if missing:
        raise FileNotFoundError("Missing Kaikki preview outputs: " + ", ".join(missing))
    overlay_source = (
        {"type": "sqlite", "path": str(args.full_translation_source)}
        if args.full_translation_source
        else {"type": "shards", "path": str(args.full_translation_source_shards)}
        if args.full_translation_source_shards
        else {"type": "tag-source-shards-default", "path": str(args.tag_source_shards)}
    )
    production_after = snapshot_production_paths(args.public_dir)
    changed = production_before is not None and production_before != production_after
    return {
        "output": str(output),
        "files": len(list(output.rglob("*"))),
        "productionPathsChanged": changed,
        "slimDetailPolicy": SLIM_DETAIL_POLICY,
        "fullTranslationOverlaySource": overlay_source,
    }


def write_summary(args: argparse.Namespace, summary: dict) -> None:
    path = args.work_dir / "kaikki-package-summary.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    production_before = snapshot_production_paths(args.public_dir)
    args.work_dir.mkdir(parents=True, exist_ok=True)
    full = build_full_kaikki(args)
    slim = build_slim_kaikki(args, full)
    package_slim_web(args, slim)
    package_full_shards(args, full)
    summary = validate_outputs(args, production_before)
    write_summary(args, summary)
    if summary["productionPathsChanged"]:
        raise RuntimeError("Kaikki preview packaging changed protected production dictionary paths")
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
