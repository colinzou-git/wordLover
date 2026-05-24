#!/usr/bin/env python3
"""Exact dictionary lookup prototype for the WordLover PRD."""

from __future__ import annotations

import argparse
import json
import re
import sqlite3
import sys
from pathlib import Path


DEFAULT_DATABASE = Path("data/dictionary.sqlite")
WORD_RE = re.compile(r"^[A-Za-z]+$")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Look up one English word.")
    parser.add_argument("word", help="Single English word to look up.")
    parser.add_argument(
        "--database",
        type=Path,
        default=DEFAULT_DATABASE,
        help="SQLite dictionary path.",
    )
    return parser.parse_args()


def top_lines(value: str | None, limit: int = 3) -> list[str]:
    if not value:
        return []
    value = value.replace("\\r", "\r").replace("\\n", "\n").replace("\\t", "\t")
    return [line.strip() for line in value.splitlines() if line.strip()][:limit]


def lookup_word(database: Path, word: str) -> dict:
    if not WORD_RE.match(word):
        return {
            "status": "invalid_input",
            "message": "Input must be a single English word with letters only.",
        }

    normalized = word.casefold()
    with sqlite3.connect(database) as conn:
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            """
            SELECT
                word,
                phonetic,
                definition,
                definition_source,
                translation,
                pos,
                collins,
                oxford,
                tag,
                is_toefl,
                bnc,
                frq,
                exchange,
                audio
            FROM dictionary_entries
            WHERE normalized_word = ?
            ORDER BY
                CASE WHEN word = ? THEN 0 ELSE 1 END,
                frq IS NULL,
                frq,
                bnc IS NULL,
                bnc
            LIMIT 1
            """,
            (normalized, word),
        ).fetchone()

    if row is None:
        return {"status": "not_found", "word": word}

    return {
        "status": "found",
        "word": row["word"],
        "phonetic": row["phonetic"],
        "english_meanings": top_lines(row["definition"]),
        "english_meaning_source": row["definition_source"],
        "chinese_meanings": top_lines(row["translation"]),
        "pos": row["pos"],
        "tags": row["tag"].split() if row["tag"] else [],
        "is_toefl": bool(row["is_toefl"]),
        "frequency": {
            "bnc": row["bnc"],
            "frq": row["frq"],
            "collins": row["collins"],
            "oxford": row["oxford"],
        },
        "exchange": row["exchange"],
        "audio": row["audio"],
    }


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    args = parse_args()
    if not args.database.exists():
        print(f"ERROR: database not found: {args.database}", file=sys.stderr)
        return 1
    print(json.dumps(lookup_word(args.database, args.word), ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
