#!/usr/bin/env python3
"""Fill remaining missing English definitions using an OPTED/Webster dataset."""

from __future__ import annotations

import argparse
import csv
import json
import re
import sqlite3
import sys
import time
import urllib.request
from collections import OrderedDict
from pathlib import Path


DEFAULT_DATABASE = Path("data/dictionary.sqlite")
DEFAULT_CACHE = Path("data/sources/opted-dictionary.csv")
DEFAULT_REPORT = Path("data/opted-augmentation-report.json")
OPTED_URL = (
    "https://raw.githubusercontent.com/CloudBytes-Academy/"
    "English-Dictionary-Open-Source/main/csv/dictionary.csv"
)
SOURCE_NAME = "OPTED/Webster 1913"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Augment missing ECDICT English definitions from OPTED/Webster."
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
        help="Local cache path for the OPTED CSV.",
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
        help="Maximum definitions to attach to one word.",
    )
    return parser.parse_args()


def normalize_word(word: str) -> str:
    return word.strip().casefold()


def clean_definition(value: str) -> str:
    value = value.replace("\r", " ").replace("\n", " ")
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def ensure_csv(cache_path: Path) -> None:
    if cache_path.exists() and cache_path.stat().st_size > 0:
        return
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(OPTED_URL, headers={"User-Agent": "Codex"})
    with urllib.request.urlopen(request, timeout=60) as response:
        cache_path.write_bytes(response.read())


def parse_opted(cache_path: Path, max_definitions: int) -> dict[str, list[str]]:
    definitions: dict[str, OrderedDict[str, None]] = {}
    with cache_path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            word = normalize_word(row.get("word") or "")
            definition = clean_definition(row.get("definition") or "")
            if not word or not definition:
                continue
            word_type = clean_definition(row.get("wordtype") or "")
            if word_type:
                definition = f"{word_type}. {definition}"
            bucket = definitions.setdefault(word, OrderedDict())
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

    ensure_csv(args.cache)
    opted = parse_opted(args.cache, args.max_definitions)

    with sqlite3.connect(database) as conn:
        ensure_columns(conn)
        before_missing = count_missing(conn)
        before_single_missing = count_single_missing(conn)

        conn.execute("DROP TABLE IF EXISTS opted_definitions")
        conn.execute(
            """
            CREATE TABLE opted_definitions (
                normalized_word TEXT PRIMARY KEY,
                definition TEXT NOT NULL,
                source TEXT NOT NULL
            )
            """
        )
        conn.executemany(
            """
            INSERT INTO opted_definitions(normalized_word, definition, source)
            VALUES (?, ?, ?)
            """,
            (
                (word, "\n".join(definitions), SOURCE_NAME)
                for word, definitions in sorted(opted.items())
            ),
        )
        conn.execute(
            """
            UPDATE dictionary_entries
            SET
                definition = (
                    SELECT definition
                    FROM opted_definitions
                    WHERE opted_definitions.normalized_word =
                        dictionary_entries.normalized_word
                ),
                definition_source = ?,
                definition_augmented_at = datetime('now')
            WHERE (definition IS NULL OR trim(definition) = '')
              AND normalized_word IN (
                    SELECT normalized_word
                    FROM opted_definitions
              )
            """,
            (SOURCE_NAME,),
        )
        filled = conn.execute("SELECT changes()").fetchone()[0]
        conn.execute(
            "INSERT OR REPLACE INTO metadata(key, value) VALUES (?, ?)",
            ("opted_source_url", OPTED_URL),
        )
        conn.execute(
            "INSERT OR REPLACE INTO metadata(key, value) VALUES (?, ?)",
            ("opted_source_note", "MIT-formatted OPTED/Webster 1913 dataset"),
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
        "opted_url": OPTED_URL,
        "opted_cache": str(args.cache.resolve()),
        "opted_unique_terms": len(opted),
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
