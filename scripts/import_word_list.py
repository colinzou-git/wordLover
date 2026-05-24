#!/usr/bin/env python3
"""Import an extra study term list into the local dictionary."""

from __future__ import annotations

import argparse
import csv
import json
import re
import sqlite3
import sys
from pathlib import Path


DEFAULT_DATABASE = Path("data/dictionary.sqlite")
TERM_RE = re.compile(r"^[A-Za-z]+(?:[ '-][A-Za-z]+){0,5}$")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Tag or insert words/short phrases from an external study list."
    )
    parser.add_argument("word_list", type=Path, help="CSV or plain-text term list.")
    parser.add_argument(
        "--database",
        type=Path,
        default=DEFAULT_DATABASE,
        help="SQLite dictionary to update.",
    )
    parser.add_argument(
        "--tag",
        default="toefl_custom",
        help="Tag to add to imported words.",
    )
    parser.add_argument(
        "--source",
        default="custom_word_list",
        help="Source label for newly inserted words.",
    )
    parser.add_argument(
        "--word-column",
        default="word",
        help="CSV column containing terms. Ignored for plain-text files.",
    )
    return parser.parse_args()


def normalize_word(word: str) -> str:
    word = word.strip().replace("’", "'").replace("`", "'")
    word = re.sub(r"\s+", " ", word)
    return word.casefold()


def is_csv(path: Path) -> bool:
    return path.suffix.lower() == ".csv"


def read_words(path: Path, word_column: str) -> tuple[list[str], list[str]]:
    words: list[str] = []
    invalid: list[str] = []
    if is_csv(path):
        with path.open("r", encoding="utf-8-sig", newline="") as handle:
            sample = handle.read(4096)
            handle.seek(0)
            has_header = csv.Sniffer().has_header(sample)
            if has_header:
                reader = csv.DictReader(handle)
                for row in reader:
                    candidate = (row.get(word_column) or "").strip()
                    normalized = normalize_word(candidate)
                    if TERM_RE.match(normalized):
                        words.append(normalized)
                    elif candidate:
                        invalid.append(candidate)
            else:
                reader = csv.reader(handle)
                for row in reader:
                    candidate = (row[0] if row else "").strip()
                    normalized = normalize_word(candidate)
                    if TERM_RE.match(normalized):
                        words.append(normalized)
                    elif candidate:
                        invalid.append(candidate)
    else:
        with path.open("r", encoding="utf-8-sig") as handle:
            for line in handle:
                candidate = line.strip()
                normalized = normalize_word(candidate)
                if TERM_RE.match(normalized):
                    words.append(normalized)
                elif candidate:
                    invalid.append(candidate)
    return sorted(set(words)), invalid


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


def append_tag(existing: str | None, tag: str) -> str:
    tags = []
    seen = set()
    for item in ((existing or "").split() + [tag]):
        item = item.strip()
        if item and item not in seen:
            tags.append(item)
            seen.add(item)
    return " ".join(tags)


def import_words(args: argparse.Namespace) -> dict:
    if not args.database.exists():
        raise FileNotFoundError(f"Database not found: {args.database}")
    if not args.word_list.exists():
        raise FileNotFoundError(f"Word list not found: {args.word_list}")

    words, invalid = read_words(args.word_list, args.word_column)
    inserted = 0
    updated = 0
    unchanged = 0
    is_toefl = 1 if "toefl" in args.tag.casefold() else 0

    with sqlite3.connect(args.database) as conn:
        conn.row_factory = sqlite3.Row
        ensure_columns(conn)
        for word in words:
            row = conn.execute(
                """
                SELECT id, tag
                FROM dictionary_entries
                WHERE normalized_word = ?
                LIMIT 1
                """,
                (word,),
            ).fetchone()
            if row:
                new_tag = append_tag(row["tag"], args.tag)
                if new_tag == (row["tag"] or ""):
                    unchanged += 1
                    continue
                conn.execute(
                    """
                    UPDATE dictionary_entries
                    SET tag = ?, is_toefl = CASE WHEN ? = 1 THEN 1 ELSE is_toefl END
                    WHERE id = ?
                    """,
                    (new_tag, is_toefl, row["id"]),
                )
                updated += 1
            else:
                conn.execute(
                    """
                    INSERT INTO dictionary_entries (
                        word,
                        normalized_word,
                        definition_source,
                        tag,
                        is_toefl,
                        source
                    ) VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (word, word, args.source, args.tag, is_toefl, args.source),
                )
                inserted += 1
        conn.commit()

    return {
        "word_list": str(args.word_list.resolve()),
        "database": str(args.database.resolve()),
        "tag": args.tag,
        "valid_unique_words": len(words),
        "updated_existing_entries": updated,
        "inserted_new_entries": inserted,
        "unchanged_entries": unchanged,
        "invalid_items": invalid[:50],
        "invalid_count": len(invalid),
    }


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    args = parse_args()
    try:
        report = import_words(args)
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
