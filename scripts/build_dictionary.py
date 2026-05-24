#!/usr/bin/env python3
"""Build an app-ready SQLite dictionary from ECDICT CSV data."""

from __future__ import annotations

import argparse
import csv
import io
import json
import re
import sqlite3
import sys
import time
import zipfile
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator, TextIO


DEFAULT_SOURCE = Path(r"C:\Users\colin\Downloads\ECDICT-master.zip")
DEFAULT_OUTPUT = Path("data/dictionary.sqlite")
DEFAULT_REPORT = Path("data/dictionary-report.json")
DEFAULT_CSV_NAME = "ecdict.csv"
SINGLE_WORD_RE = re.compile(r"^[A-Za-z]+$")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Convert ECDICT CSV into a SQLite database for WordLover."
    )
    parser.add_argument(
        "--source",
        type=Path,
        default=DEFAULT_SOURCE,
        help="Path to ECDICT zip, extracted ECDICT directory, or a CSV file.",
    )
    parser.add_argument(
        "--csv-name",
        default=DEFAULT_CSV_NAME,
        help="CSV file to use inside the zip/directory. Default: ecdict.csv.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help="SQLite database to create.",
    )
    parser.add_argument(
        "--report",
        type=Path,
        default=DEFAULT_REPORT,
        help="JSON audit report path.",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=5000,
        help="Rows inserted per batch.",
    )
    return parser.parse_args()


def normalize_word(word: str) -> str:
    return word.strip().casefold()


def clean_text(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip()
    value = value.replace("\\r", "\r").replace("\\n", "\n").replace("\\t", "\t")
    return value or None


def parse_int(value: str | None, *, null_zero: bool = False) -> int | None:
    value = clean_text(value)
    if value is None:
        return None
    try:
        parsed = int(value)
    except ValueError:
        return None
    if null_zero and parsed == 0:
        return None
    return parsed


def has_tag(tag: str | None, expected: str) -> bool:
    if not tag:
        return False
    return expected.casefold() in {part.casefold() for part in tag.split()}


@contextmanager
def open_source_csv(source: Path, csv_name: str) -> Iterator[TextIO]:
    if not source.exists():
        raise FileNotFoundError(f"Source not found: {source}")

    if source.is_file() and source.suffix.lower() == ".zip":
        with zipfile.ZipFile(source) as archive:
            matches = [
                name
                for name in archive.namelist()
                if name.replace("\\", "/").endswith(f"/{csv_name}")
                or name.replace("\\", "/") == csv_name
            ]
            if not matches:
                raise FileNotFoundError(f"{csv_name} not found in {source}")
            with archive.open(matches[0], "r") as raw:
                wrapper = io.TextIOWrapper(raw, encoding="utf-8-sig", newline="")
                try:
                    yield wrapper
                finally:
                    wrapper.detach()
        return

    if source.is_dir():
        csv_path = source / csv_name
        if not csv_path.exists():
            matches = list(source.rglob(csv_name))
            if not matches:
                raise FileNotFoundError(f"{csv_name} not found in {source}")
            csv_path = matches[0]
        with csv_path.open("r", encoding="utf-8-sig", newline="") as handle:
            yield handle
        return

    with source.open("r", encoding="utf-8-sig", newline="") as handle:
        yield handle


def connect_database(path: Path) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_suffix(path.suffix + ".tmp")
    if tmp_path.exists():
        tmp_path.unlink()
    conn = sqlite3.connect(tmp_path)
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA synchronous = NORMAL;")
    conn.execute("PRAGMA temp_store = MEMORY;")
    return conn


def create_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE metadata (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE dictionary_entries (
            id INTEGER PRIMARY KEY,
            word TEXT NOT NULL,
            normalized_word TEXT NOT NULL,
            phonetic TEXT,
            definition TEXT,
            definition_source TEXT NOT NULL DEFAULT 'ECDICT',
            definition_augmented_at TEXT,
            translation TEXT,
            pos TEXT,
            collins INTEGER DEFAULT 0,
            oxford INTEGER DEFAULT 0,
            tag TEXT,
            is_toefl INTEGER NOT NULL DEFAULT 0,
            bnc INTEGER,
            frq INTEGER,
            exchange TEXT,
            detail TEXT,
            audio TEXT,
            source TEXT NOT NULL DEFAULT 'ECDICT'
        );

        CREATE INDEX idx_dictionary_entries_normalized_word
            ON dictionary_entries(normalized_word);
        CREATE INDEX idx_dictionary_entries_word_nocase
            ON dictionary_entries(word COLLATE NOCASE);
        CREATE INDEX idx_dictionary_entries_toefl_frequency
            ON dictionary_entries(is_toefl, frq, bnc);
        CREATE INDEX idx_dictionary_entries_frequency
            ON dictionary_entries(frq, bnc);

        CREATE VIEW toefl_entries AS
            SELECT *
            FROM dictionary_entries
            WHERE is_toefl = 1;
        """
    )


def row_to_record(row: dict[str, str]) -> tuple:
    word = clean_text(row.get("word")) or ""
    tag = clean_text(row.get("tag"))
    return (
        word,
        normalize_word(word),
        clean_text(row.get("phonetic")),
        clean_text(row.get("definition")),
        "ECDICT",
        None,
        clean_text(row.get("translation")),
        clean_text(row.get("pos")),
        parse_int(row.get("collins")) or 0,
        parse_int(row.get("oxford")) or 0,
        tag,
        1 if has_tag(tag, "toefl") else 0,
        parse_int(row.get("bnc"), null_zero=True),
        parse_int(row.get("frq"), null_zero=True),
        clean_text(row.get("exchange")),
        clean_text(row.get("detail")),
        clean_text(row.get("audio")),
        "ECDICT",
    )


def update_stats(stats: dict, record: tuple) -> None:
    word = record[0]
    phonetic = record[2]
    definition = record[3]
    translation = record[6]
    is_toefl = record[11] == 1
    is_single_word = bool(SINGLE_WORD_RE.match(word))

    stats["total_entries"] += 1
    if is_single_word:
        stats["single_english_word_entries"] += 1
    if is_toefl:
        stats["toefl_entries"] += 1
        if is_single_word:
            stats["toefl_single_english_word_entries"] += 1
        if not phonetic:
            stats["toefl_missing_phonetic"] += 1
        if not definition:
            stats["toefl_missing_english_definition"] += 1
        if not translation:
            stats["toefl_missing_chinese_translation"] += 1


def insert_batch(conn: sqlite3.Connection, batch: list[tuple]) -> None:
    conn.executemany(
        """
        INSERT INTO dictionary_entries (
            word,
            normalized_word,
            phonetic,
            definition,
            definition_source,
            definition_augmented_at,
            translation,
            pos,
            collins,
            oxford,
            tag,
            is_toefl,
            bnc,
            frq,
            exchange,
            detail,
            audio,
            source
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        batch,
    )


def build_database(args: argparse.Namespace) -> dict:
    start = time.time()
    output = args.output.resolve()
    tmp_path = output.with_suffix(output.suffix + ".tmp")
    report_path = args.report.resolve()

    conn = connect_database(output)
    stats = {
        "source": str(args.source),
        "csv_name": args.csv_name,
        "output": str(output),
        "total_entries": 0,
        "single_english_word_entries": 0,
        "toefl_entries": 0,
        "toefl_single_english_word_entries": 0,
        "toefl_missing_phonetic": 0,
        "toefl_missing_english_definition": 0,
        "toefl_missing_chinese_translation": 0,
    }

    try:
        create_schema(conn)
        with open_source_csv(args.source, args.csv_name) as handle:
            reader = csv.DictReader(handle)
            batch: list[tuple] = []
            for row in reader:
                record = row_to_record(row)
                if not record[0]:
                    continue
                batch.append(record)
                update_stats(stats, record)
                if len(batch) >= args.batch_size:
                    insert_batch(conn, batch)
                    conn.commit()
                    batch.clear()
            if batch:
                insert_batch(conn, batch)
                conn.commit()

        metadata = {
            "source_name": "ECDICT",
            "source_url": "https://github.com/skywind3000/ECDICT",
            "source_license": "MIT",
            "source_csv": args.csv_name,
            "created_at_unix": str(int(time.time())),
        }
        conn.executemany(
            "INSERT INTO metadata(key, value) VALUES (?, ?)",
            sorted(metadata.items()),
        )
        conn.execute("PRAGMA optimize;")
        conn.commit()
    except Exception:
        conn.close()
        if tmp_path.exists():
            tmp_path.unlink()
        raise
    else:
        conn.close()
        if output.exists():
            output.unlink()
        tmp_path.replace(output)

    stats["elapsed_seconds"] = round(time.time() - start, 3)
    stats["sqlite_size_bytes"] = output.stat().st_size
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(
        json.dumps(stats, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return stats


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    args = parse_args()
    try:
        stats = build_database(args)
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    print(json.dumps(stats, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
