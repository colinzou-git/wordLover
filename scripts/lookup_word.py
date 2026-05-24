#!/usr/bin/env python3
"""Exact dictionary lookup prototype for WordLover terms."""

from __future__ import annotations

import argparse
import json
import re
import sqlite3
import sys
from pathlib import Path


DEFAULT_DATABASE = Path("data/dictionary.sqlite")
TERM_RE = re.compile(r"^[A-Za-z]+(?:[ '-][A-Za-z]+){0,5}$")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Look up one English term.")
    parser.add_argument("term", help="Single word or short English phrase to look up.")
    parser.add_argument(
        "--database",
        type=Path,
        default=DEFAULT_DATABASE,
        help="SQLite dictionary path.",
    )
    return parser.parse_args()


def normalize_term(term: str) -> str:
    term = term.strip().replace("’", "'").replace("`", "'")
    term = re.sub(r"\s+", " ", term)
    return term.casefold()


def top_lines(value: str | None, limit: int = 3) -> list[str]:
    if not value:
        return []
    value = value.replace("\\r", "\r").replace("\\n", "\n").replace("\\t", "\t")
    return [line.strip() for line in value.splitlines() if line.strip()][:limit]


def lookup_word(database: Path, word: str) -> dict:
    normalized = normalize_term(word)
    if not TERM_RE.match(normalized):
        return {
            "status": "invalid_input",
            "message": (
                "Input must be one English word or a short phrase, up to 6 words, "
                "using letters, spaces, hyphens, or apostrophes."
            ),
        }

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
            (normalized, word.strip()),
        ).fetchone()

    if row is None:
        return {"status": "not_found", "term": word}

    return {
        "status": "found",
        "term": row["word"],
        "entry_type": "phrase" if " " in row["word"].strip() else "word",
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
    print(json.dumps(lookup_word(args.database, args.term), ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
