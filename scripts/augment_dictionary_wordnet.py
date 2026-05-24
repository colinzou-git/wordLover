#!/usr/bin/env python3
"""Fill missing English definitions in the local dictionary using WordNet."""

from __future__ import annotations

import argparse
import json
import re
import sqlite3
import sys
import tarfile
import time
import urllib.request
from collections import OrderedDict
from pathlib import Path


DEFAULT_DATABASE = Path("data/dictionary.sqlite")
DEFAULT_CACHE = Path("data/sources/WNdb-3.0.tar.gz")
DEFAULT_REPORT = Path("data/wordnet-augmentation-report.json")
WORDNET_URL = "https://wordnetcode.princeton.edu/3.0/WNdb-3.0.tar.gz"
WORDNET_VERSION = "WordNet 3.0"
DATA_FILES = ("data.noun", "data.verb", "data.adj", "data.adv")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Augment missing ECDICT English definitions from WordNet."
    )
    parser.add_argument(
        "--database",
        type=Path,
        default=DEFAULT_DATABASE,
        help="SQLite dictionary to augment.",
    )
    parser.add_argument(
        "--cache",
        type=Path,
        default=DEFAULT_CACHE,
        help="Local cache path for the WordNet archive.",
    )
    parser.add_argument(
        "--report",
        type=Path,
        default=DEFAULT_REPORT,
        help="JSON report path.",
    )
    parser.add_argument(
        "--max-definitions",
        type=int,
        default=3,
        help="Maximum WordNet glosses to attach to one word.",
    )
    return parser.parse_args()


def normalize_word(word: str) -> str:
    return word.strip().replace("_", " ").casefold()


def clean_gloss(raw: str) -> str:
    definition = raw.split(";", 1)[0].strip()
    definition = definition.replace("``", '"').replace("''", '"')
    return re.sub(r"\s+", " ", definition)


def ensure_archive(cache_path: Path) -> None:
    if cache_path.exists() and cache_path.stat().st_size > 0:
        return
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(WORDNET_URL, timeout=60) as response:
        cache_path.write_bytes(response.read())


def parse_wordnet(cache_path: Path, max_definitions: int) -> dict[str, list[str]]:
    definitions: dict[str, OrderedDict[str, None]] = {}
    with tarfile.open(cache_path, "r:gz") as archive:
        members = {
            Path(member.name).name: member
            for member in archive.getmembers()
            if Path(member.name).name in DATA_FILES
        }
        missing = sorted(set(DATA_FILES) - set(members))
        if missing:
            raise FileNotFoundError(f"Missing WordNet data files: {', '.join(missing)}")

        for filename in DATA_FILES:
            handle = archive.extractfile(members[filename])
            if handle is None:
                continue
            for raw_line in handle:
                line = raw_line.decode("utf-8", errors="replace").strip()
                if not line or line.startswith(" "):
                    continue
                before_gloss, _, gloss = line.partition(" | ")
                if not gloss:
                    continue
                parts = before_gloss.split()
                if len(parts) < 5:
                    continue
                try:
                    word_count = int(parts[3], 16)
                except ValueError:
                    continue
                words: list[str] = []
                index = 4
                for _ in range(word_count):
                    if index + 1 >= len(parts):
                        break
                    words.append(parts[index])
                    index += 2

                definition = clean_gloss(gloss)
                if not definition:
                    continue
                for word in words:
                    normalized = normalize_word(word)
                    if not normalized:
                        continue
                    bucket = definitions.setdefault(normalized, OrderedDict())
                    if len(bucket) < max_definitions:
                        bucket.setdefault(definition, None)

    return {word: list(items.keys()) for word, items in definitions.items()}


def ensure_columns(conn: sqlite3.Connection) -> None:
    columns = {row[1] for row in conn.execute("PRAGMA table_info(dictionary_entries)")}
    if "definition_source" not in columns:
        conn.execute(
            "ALTER TABLE dictionary_entries "
            "ADD COLUMN definition_source TEXT NOT NULL DEFAULT 'ECDICT'"
        )
    if "definition_augmented_at" not in columns:
        conn.execute(
            "ALTER TABLE dictionary_entries ADD COLUMN definition_augmented_at TEXT"
        )


def count_missing(conn: sqlite3.Connection) -> int:
    return conn.execute(
        """
        SELECT count(*)
        FROM dictionary_entries
        WHERE definition IS NULL OR trim(definition) = ''
        """
    ).fetchone()[0]


def count_single_missing(conn: sqlite3.Connection) -> int:
    return conn.execute(
        """
        SELECT count(*)
        FROM dictionary_entries
        WHERE word GLOB '[A-Za-z]*'
          AND word NOT GLOB '*[^A-Za-z]*'
          AND (definition IS NULL OR trim(definition) = '')
        """
    ).fetchone()[0]


def augment_database(args: argparse.Namespace) -> dict:
    start = time.time()
    database = args.database.resolve()
    if not database.exists():
        raise FileNotFoundError(f"Database not found: {database}")

    ensure_archive(args.cache)
    wordnet = parse_wordnet(args.cache, args.max_definitions)

    with sqlite3.connect(database) as conn:
        ensure_columns(conn)
        before_missing = count_missing(conn)
        before_single_missing = count_single_missing(conn)

        conn.execute("DROP TABLE IF EXISTS wordnet_definitions")
        conn.execute(
            """
            CREATE TABLE wordnet_definitions (
                normalized_word TEXT PRIMARY KEY,
                definition TEXT NOT NULL,
                source TEXT NOT NULL
            )
            """
        )
        conn.executemany(
            """
            INSERT INTO wordnet_definitions(normalized_word, definition, source)
            VALUES (?, ?, ?)
            """,
            (
                (word, "\n".join(definitions), WORDNET_VERSION)
                for word, definitions in sorted(wordnet.items())
            ),
        )
        conn.execute(
            """
            UPDATE dictionary_entries
            SET
                definition = (
                    SELECT definition
                    FROM wordnet_definitions
                    WHERE wordnet_definitions.normalized_word =
                        dictionary_entries.normalized_word
                ),
                definition_source = ?,
                definition_augmented_at = datetime('now')
            WHERE (definition IS NULL OR trim(definition) = '')
              AND normalized_word IN (
                    SELECT normalized_word
                    FROM wordnet_definitions
              )
            """,
            (WORDNET_VERSION,),
        )
        filled = conn.execute("SELECT changes()").fetchone()[0]

        conn.execute(
            "INSERT OR REPLACE INTO metadata(key, value) VALUES (?, ?)",
            ("wordnet_source_url", WORDNET_URL),
        )
        conn.execute(
            "INSERT OR REPLACE INTO metadata(key, value) VALUES (?, ?)",
            ("wordnet_license", "WordNet 3.0 license"),
        )
        conn.commit()

        after_missing = count_missing(conn)
        after_single_missing = count_single_missing(conn)
        toefl_missing = conn.execute(
            """
            SELECT count(*)
            FROM toefl_entries
            WHERE definition IS NULL OR trim(definition) = ''
            """
        ).fetchone()[0]

    report = {
        "database": str(database),
        "wordnet_url": WORDNET_URL,
        "wordnet_cache": str(args.cache.resolve()),
        "wordnet_unique_terms": len(wordnet),
        "missing_definitions_before": before_missing,
        "single_word_missing_definitions_before": before_single_missing,
        "definitions_filled": filled,
        "missing_definitions_after": after_missing,
        "single_word_missing_definitions_after": after_single_missing,
        "toefl_missing_definitions_after": toefl_missing,
        "elapsed_seconds": round(time.time() - start, 3),
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return report


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    args = parse_args()
    try:
        report = augment_database(args)
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
