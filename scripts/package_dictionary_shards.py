#!/usr/bin/env python3
"""Package the full WordFan SQLite dictionary into small gzip JSON lookup shards.

The production app keeps the 100k SQLite dictionary for ranked suggestions,
Chinese reverse lookup, and Study One More. These shards provide complete exact
English lookup without loading the ~270 MB full SQLite database into iPhone RAM.
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import io
import json
import sqlite3
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

DEFAULT_INPUT = Path("data/dictionary.sqlite")
DEFAULT_OUTPUT_DIR = Path("apps/wordlover-pwa/public/dictionary-full")
DEFAULT_SHARD_COUNT = 128
DEFAULT_VERSION = f"{time.strftime('%Y.%m.%d')}.full-shards"
APOSTROPHE_TRANSLATION = str.maketrans({"‘": "'", "’": "'", "ʼ": "'", "`": "'", "＇": "'"})

ENTRY_FIELDS = ["word", "phonetic", "definition", "definitionSource", "translation", "tag", "detail"]
ALIAS_FIELDS = [
    "phonetic",
    "definition",
    "definitionSource",
    "translation",
    "tag",
    "baseWord",
    "inflectionLabel",
    "baseNormalizedWord",
    "detail",
]
INFLECTION_LABEL_PRIORITY = {
    "plural": 0,
    "third-person singular": 1,
    "past tense": 2,
    "past participle": 3,
    "present participle": 4,
    "inflected form": 9,
}


@dataclass
class AliasCandidate:
    alias: str
    phonetic: str | None
    definition: str | None
    definition_source: str | None
    translation: str | None
    tag: str | None
    base_word: str
    base_normalized: str
    detail: str | None
    labels: set[str]
    sort_key: tuple


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--version", default=DEFAULT_VERSION)
    parser.add_argument("--shard-count", type=int, default=DEFAULT_SHARD_COUNT)
    parser.add_argument("--gzip-level", type=int, default=9)
    parser.add_argument("--skip-validation", action="store_true")
    parser.add_argument("--source-label", action="append", dest="sources")
    return parser.parse_args()


def normalize_word(value: str) -> str:
    return " ".join(value.strip().translate(APOSTROPHE_TRANSLATION).split()).casefold()


def fnv1a32(value: str) -> int:
    result = 0x811C9DC5
    for byte in value.encode("utf-8"):
        result ^= byte
        result = (result * 0x01000193) & 0xFFFFFFFF
    return result


def shard_index(value: str, shard_count: int) -> int:
    return fnv1a32(normalize_word(value)) % shard_count


def exchange_code_label(code: str) -> str:
    if "s" in code:
        return "plural"
    if "3" in code:
        return "third-person singular"
    if "p" in code:
        return "past tense"
    if "d" in code:
        return "past participle"
    if "i" in code:
        return "present participle"
    return "inflected form"


def merge_inflection_labels(labels: Iterable[str]) -> str:
    ordered = sorted(
        {label for label in labels if label},
        key=lambda label: (INFLECTION_LABEL_PRIORITY.get(label, 9), label),
    )
    return ordered[0] if ordered else "inflected form"


def parse_exchange_forms(exchange: str | None) -> list[tuple[str, str]]:
    output: list[tuple[str, str]] = []
    for raw_part in str(exchange or "").split("/"):
        part = raw_part.strip()
        if ":" not in part:
            continue
        code, raw_forms = part.split(":", 1)
        label = exchange_code_label(code)
        for raw_form in raw_forms.split(","):
            form = normalize_word(raw_form)
            if form:
                output.append((form, label))
    return output


def json_compact(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


class DeterministicGzipTextWriter:
    def __init__(self, path: Path, level: int):
        self.raw = path.open("wb")
        self.gzip = gzip.GzipFile(filename="", mode="wb", compresslevel=level, fileobj=self.raw, mtime=0)
        self.text = io.TextIOWrapper(self.gzip, encoding="utf-8", newline="")

    def write(self, value: str) -> None:
        self.text.write(value)

    def close(self) -> None:
        self.text.flush()
        self.text.detach()
        self.gzip.close()
        self.raw.close()


def remove_old_outputs(output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    for path in output_dir.glob("shard-*.json.gz"):
        path.unlink()
    manifest = output_dir / "manifest.json"
    if manifest.exists():
        manifest.unlink()


def package(args: argparse.Namespace) -> dict:
    if not args.input.exists():
        raise FileNotFoundError(f"Dictionary not found: {args.input}")
    if args.shard_count < 1 or args.shard_count > 1024:
        raise ValueError("--shard-count must be between 1 and 1024")
    if not 1 <= args.gzip_level <= 9:
        raise ValueError("--gzip-level must be between 1 and 9")

    remove_old_outputs(args.output_dir)
    width = max(2, len(f"{args.shard_count - 1:x}"))
    shard_paths = [args.output_dir / f"shard-{index:0{width}x}.json.gz" for index in range(args.shard_count)]
    writers = [DeterministicGzipTextWriter(path, args.gzip_level) for path in shard_paths]
    entry_first = [True] * args.shard_count
    alias_first = [True] * args.shard_count
    entry_counts = [0] * args.shard_count
    alias_counts = [0] * args.shard_count
    started = time.time()

    try:
        with sqlite3.connect(f"file:{args.input.resolve()}?mode=ro&immutable=1", uri=True) as conn:
            quick_check = conn.execute("PRAGMA quick_check").fetchone()[0]
            if quick_check != "ok":
                raise RuntimeError(f"SQLite quick_check failed: {quick_check}")

            existing = {row[0] for row in conn.execute("SELECT normalized_word FROM dictionary_entries")}
            for writer in writers:
                writer.write('{"v":1,"e":{')

            columns = {row[1] for row in conn.execute("PRAGMA table_info(dictionary_entries)")}
            detail_select = "detail" if "detail" in columns else "NULL AS detail"
            entry_sql = f"""
                SELECT normalized_word, word, phonetic, definition,
                       definition_source, translation, tag, {detail_select}
                FROM dictionary_entries
                ORDER BY id
            """
            for normalized, word, phonetic, definition, definition_source, translation, tag, detail in conn.execute(entry_sql):
                index = shard_index(normalized, args.shard_count)
                if not entry_first[index]:
                    writers[index].write(",")
                entry_first[index] = False
                writers[index].write(json_compact(normalized))
                writers[index].write(":")
                writers[index].write(json_compact([
                    word,
                    phonetic,
                    definition,
                    definition_source,
                    translation,
                    tag,
                    detail,
                ]))
                entry_counts[index] += 1

            for writer in writers:
                writer.write('},"a":{')

            alias_candidates: dict[str, AliasCandidate] = {}
            alias_sql = f"""
                SELECT id, normalized_word, word, phonetic, definition,
                       definition_source, translation, tag, exchange, frq, bnc, {detail_select}
                FROM dictionary_entries
                WHERE exchange IS NOT NULL AND trim(exchange) <> ''
                ORDER BY frq IS NULL, frq, bnc IS NULL, bnc, length(word), word, id
            """
            for (row_id, base_normalized, base_word, phonetic, definition, definition_source,
                 translation, tag, exchange, frq, bnc, detail) in conn.execute(alias_sql):
                sort_key = (
                    frq is None, frq if frq is not None else 2**63 - 1,
                    bnc is None, bnc if bnc is not None else 2**63 - 1,
                    len(base_word), base_word.casefold(), row_id,
                )
                for alias, label in parse_exchange_forms(exchange):
                    if alias in existing:
                        continue
                    candidate = AliasCandidate(
                        alias=alias, phonetic=phonetic, definition=definition,
                        definition_source=definition_source, translation=translation, tag=tag,
                        base_word=base_word, base_normalized=base_normalized, detail=detail,
                        labels={label}, sort_key=sort_key,
                    )
                    current = alias_candidates.get(alias)
                    if current is None:
                        alias_candidates[alias] = candidate
                    elif current.base_normalized == base_normalized:
                        labels = current.labels | candidate.labels
                        if candidate.sort_key < current.sort_key:
                            candidate.labels = labels
                            alias_candidates[alias] = candidate
                        else:
                            current.labels = labels
                    elif candidate.sort_key < current.sort_key:
                        alias_candidates[alias] = candidate

            for alias in sorted(alias_candidates):
                candidate = alias_candidates[alias]
                label = merge_inflection_labels(candidate.labels)
                index = shard_index(alias, args.shard_count)
                if not alias_first[index]:
                    writers[index].write(",")
                alias_first[index] = False
                writers[index].write(json_compact(alias))
                writers[index].write(":")
                writers[index].write(json_compact([
                    candidate.phonetic,
                    candidate.definition,
                    candidate.definition_source,
                    candidate.translation,
                    candidate.tag,
                    candidate.base_word,
                    label,
                    candidate.base_normalized,
                    candidate.detail,
                ]))
                alias_counts[index] += 1
    finally:
        for writer in writers:
            writer.write("}}")
            writer.close()

    shards = []
    for index, path in enumerate(shard_paths):
        shards.append({
            "id": f"{index:0{width}x}",
            "path": path.name,
            "bytes": path.stat().st_size,
            "sha256": sha256_file(path),
            "entries": entry_counts[index],
            "aliases": alias_counts[index],
        })

    manifest = {
        "app": "wordlover",
        "formatVersion": 1,
        "dictionaryDataVersion": args.version,
        "variant": "full-sharded",
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "rowCount": sum(entry_counts),
        "aliasCount": sum(alias_counts),
        "shardCount": args.shard_count,
        "hash": "fnv1a32-utf8-mod",
        "compression": "gzip",
        "entryFields": ENTRY_FIELDS,
        "aliasFields": ALIAS_FIELDS,
        "totalCompressedBytes": sum(item["bytes"] for item in shards),
        "sources": getattr(args, "sources", None) or ["ECDICT", "WordNet 3.0", "OPTED/Webster 1913", "WordFan K-12/AP STEM"],
        "shards": shards,
        "elapsedSeconds": round(time.time() - started, 3),
    }

    if not args.skip_validation:
        validate_package(args.output_dir, manifest)

    (args.output_dir / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return manifest


def validate_package(output_dir: Path, manifest: dict) -> None:
    entries = 0
    aliases = 0
    for shard in manifest["shards"]:
        path = output_dir / shard["path"]
        if not path.is_file():
            raise RuntimeError(f"Missing shard file: {path}")
        if path.stat().st_size != shard["bytes"]:
            raise RuntimeError(f"Shard size mismatch: {path}")
        if sha256_file(path) != shard["sha256"]:
            raise RuntimeError(f"Shard checksum mismatch: {path}")
        with gzip.open(path, "rt", encoding="utf-8") as handle:
            payload = json.load(handle)
        if payload.get("v") != 1 or not isinstance(payload.get("e"), dict) or not isinstance(payload.get("a"), dict):
            raise RuntimeError(f"Invalid shard payload: {path}")
        if len(payload["e"]) != shard["entries"] or len(payload["a"]) != shard["aliases"]:
            raise RuntimeError(f"Shard count mismatch: {path}")
        for key in payload["e"]:
            if shard_index(key, manifest["shardCount"]) != int(shard["id"], 16):
                raise RuntimeError(f"Entry routed to wrong shard: {key}")
        for key in payload["a"]:
            if shard_index(key, manifest["shardCount"]) != int(shard["id"], 16):
                raise RuntimeError(f"Alias routed to wrong shard: {key}")
        entries += len(payload["e"])
        aliases += len(payload["a"])
    if entries != manifest["rowCount"] or aliases != manifest["aliasCount"]:
        raise RuntimeError(
            f"Package total mismatch: entries={entries}/{manifest['rowCount']}, "
            f"aliases={aliases}/{manifest['aliasCount']}"
        )


def main() -> int:
    args = parse_args()
    try:
        manifest = package(args)
    except Exception as exc:
        print(f"ERROR: {exc}")
        return 1
    print(json.dumps(manifest, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
