#!/usr/bin/env python3
"""Build a slim WordLover dictionary by picking the most useful ~100k entries.

Source: the full dictionary at data/dictionary.sqlite (built from ECDICT plus
augmentations). The full file remains untouched on disk; this script writes a
separate slimmed copy to data/dictionary-slim.sqlite.

Selection (in this order, deduplicated by row id):
  1. All TOEFL-tagged entries.
  2. All single-word entries that carry any frequency signal (frq, bnc,
     collins, or oxford). These are the entries the in-app ranking already
     ordered first; including them keeps lookup behavior unchanged for the
     common case.
  3. Phrases (multi-word entries) that have both English and Chinese content
     and whose constituent normalized words are all already in the slim set.
     This keeps phrases like "take off", "in terms of" while dropping the long
     tail of obscure compounds.
  4. Top phrases by length (shortest first) and alphabetically, until the slim
     set reaches the target row count.

The slim DB carries the same schema as the full one plus a fresh FTS5 search
table built only over the slim rows.
"""

from __future__ import annotations

import argparse
import re
import sqlite3
import sys
import time
from contextlib import closing
from pathlib import Path
from typing import Iterable


DEFAULT_INPUT = Path("data/dictionary.sqlite")
DEFAULT_OUTPUT = Path("data/dictionary-slim.sqlite")
DEFAULT_TARGET = 100_000

# K-12 / AP STEM coverage tags whose entries must always survive slimming,
# even when they carry no frequency signal (frq/bnc) at all. Matching is done
# per tag token: a token is kept if it equals one of these, or begins with one
# of them followed by "_" (so "ap_physics" also keeps "ap_physics_1", and
# "ap_computer_science" keeps "ap_computer_science_a").
AP_STEM_TAGS = (
    "k12_stem",
    "k12_math",
    "k12_science",
    "ap_biology",
    "ap_chemistry",
    "ap_calculus_ab",
    "ap_calculus_bc",
    "ap_statistics",
    "ap_precalculus",
    "ap_physics",
    "ap_environmental_science",
    "ap_computer_science",
    "linear_algebra_extension",
)


# Schema mirrors scripts/build_dictionary.py so the app sees the same columns.
SCHEMA_SQL = """
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

CREATE INDEX dictionary_entries_normalized_word ON dictionary_entries(normalized_word);
CREATE INDEX dictionary_entries_frq ON dictionary_entries(frq);
CREATE INDEX dictionary_entries_bnc ON dictionary_entries(bnc);
CREATE INDEX dictionary_entries_is_toefl ON dictionary_entries(is_toefl);

CREATE VIEW toefl_entries AS
    SELECT * FROM dictionary_entries WHERE is_toefl = 1;

CREATE TABLE metadata (
    key TEXT PRIMARY KEY,
    value TEXT
);

CREATE VIRTUAL TABLE dictionary_search_fts USING fts5(
    word,
    normalized_word,
    definition,
    translation,
    content='dictionary_entries',
    content_rowid='id',
    tokenize='unicode61 remove_diacritics 2'
);
"""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--target-rows", type=int, default=DEFAULT_TARGET,
                        help="Approximate target row count (default 100000).")
    parser.add_argument("--data-version", default=None,
                        help="Slim dictionary data version string (default: today as YYYY.MM.DD.slim).")
    parser.add_argument("--detail-policy", choices=("full", "none"), default="full",
                        help="Keep structured detail (default) or omit it for a layered shard-backed core.")
    return parser.parse_args()


def select_ranked_singles(src: sqlite3.Connection) -> set[int]:
    rows = src.execute(
        """
        SELECT id FROM dictionary_entries
        WHERE instr(normalized_word, ' ') = 0
          AND (frq IS NOT NULL OR bnc IS NOT NULL OR collins > 0 OR oxford > 0)
        """
    ).fetchall()
    return {row[0] for row in rows}


def select_toefl(src: sqlite3.Connection) -> set[int]:
    rows = src.execute("SELECT id FROM dictionary_entries WHERE is_toefl = 1").fetchall()
    return {row[0] for row in rows}


def tag_matches_ap_stem(tag: str | None) -> bool:
    if not tag:
        return False
    for token in tag.split():
        for needle in AP_STEM_TAGS:
            if token == needle or token.startswith(needle + "_"):
                return True
    return False


def select_ap_stem(src: sqlite3.Connection) -> set[int]:
    """All entries carrying a K-12/AP STEM tag, regardless of frequency signal."""
    rows = src.execute(
        "SELECT id, tag FROM dictionary_entries WHERE tag IS NOT NULL AND tag != ''"
    ).fetchall()
    return {row_id for row_id, tag in rows if tag_matches_ap_stem(tag)}


def select_top_phrases(
    src: sqlite3.Connection,
    word_rank: dict[str, int],
    existing_ids: set[int],
    budget: int,
    fallback_rank: int,
) -> list[int]:
    """Pick phrases by ascending average constituent-word rank (lower = more frequent).

    Only phrases whose constituent words are all in the known/ranked set are
    considered, so phrases stay coherent inside the slim dictionary.
    """
    if budget <= 0:
        return []
    cursor = src.execute(
        """
        SELECT id, normalized_word
        FROM dictionary_entries
        WHERE instr(normalized_word, ' ') > 0
          AND translation IS NOT NULL AND length(translation) > 0
        """
    )
    scored: list[tuple[float, int, int, str]] = []
    for row_id, normalized in cursor:
        if row_id in existing_ids:
            continue
        parts = [p for p in normalized.split(" ") if p]
        if not parts:
            continue
        if not all(p in word_rank for p in parts):
            continue
        ranks = [word_rank.get(p, fallback_rank) for p in parts]
        avg_rank = sum(ranks) / len(ranks)
        scored.append((avg_rank, len(parts), row_id, normalized))
    # Sort by average rank ASC, then prefer shorter phrases, then alphabetical.
    scored.sort(key=lambda item: (item[0], item[1], item[3]))
    return [row_id for (_avg, _len, row_id, _norm) in scored[:budget]]


def select_fallback_phrases(src: sqlite3.Connection, existing_ids: set[int], budget: int) -> list[int]:
    """Fill remaining budget with any phrase that at least has a translation, shortest first."""
    if budget <= 0:
        return []
    cursor = src.execute(
        """
        SELECT id FROM dictionary_entries
        WHERE instr(normalized_word, ' ') > 0
          AND translation IS NOT NULL AND length(translation) > 0
        ORDER BY (length(normalized_word) - length(replace(normalized_word, ' ', ''))) ASC,
                 length(normalized_word) ASC,
                 normalized_word ASC
        """
    )
    chosen: list[int] = []
    for (row_id,) in cursor:
        if row_id in existing_ids:
            continue
        chosen.append(row_id)
        if len(chosen) >= budget:
            break
    return chosen


def chunked(iterable: Iterable[int], size: int) -> Iterable[list[int]]:
    chunk: list[int] = []
    for value in iterable:
        chunk.append(value)
        if len(chunk) >= size:
            yield chunk
            chunk = []
    if chunk:
        yield chunk


def copy_rows(src: sqlite3.Connection, dst: sqlite3.Connection, ids: set[int], detail_policy: str = "full") -> int:
    if not ids:
        return 0
    columns = [
        "id", "word", "normalized_word", "phonetic", "definition", "definition_source",
        "definition_augmented_at", "translation", "pos", "collins", "oxford", "tag",
        "is_toefl", "bnc", "frq", "exchange", "detail", "audio", "source",
    ]
    placeholders = ",".join("?" for _ in columns)
    select_sql = f"SELECT {','.join(columns)} FROM dictionary_entries WHERE id IN ({{}})"
    insert_sql = f"INSERT INTO dictionary_entries ({','.join(columns)}) VALUES ({placeholders})"
    total = 0
    for batch in chunked(sorted(ids), 800):
        rows = src.execute(select_sql.format(",".join(str(i) for i in batch))).fetchall()
        if detail_policy == "none":
            detail_index = columns.index("detail")
            rows = [tuple(None if index == detail_index else value for index, value in enumerate(row)) for row in rows]
        dst.executemany(insert_sql, rows)
        total += len(rows)
    return total


def populate_fts(dst: sqlite3.Connection) -> None:
    dst.execute(
        """
        INSERT INTO dictionary_search_fts(rowid, word, normalized_word, translation, definition)
        SELECT id, word, normalized_word, COALESCE(translation, ''), COALESCE(definition, '')
        FROM dictionary_entries
        """
    )


def main() -> int:
    args = parse_args()
    if not args.input.exists():
        print(f"Input dictionary not found: {args.input}", file=sys.stderr)
        return 1

    args.output.parent.mkdir(parents=True, exist_ok=True)
    if args.output.exists():
        args.output.unlink()

    data_version = args.data_version or f"{time.strftime('%Y.%m.%d')}.slim"

    with closing(sqlite3.connect(args.input)) as src, closing(sqlite3.connect(args.output)) as dst:
        src.row_factory = None
        dst.executescript(SCHEMA_SQL)

        toefl_ids = select_toefl(src)
        ranked_ids = select_ranked_singles(src)
        ap_stem_ids = select_ap_stem(src)
        chosen_ids: set[int] = set(toefl_ids) | set(ranked_ids) | set(ap_stem_ids)

        # Build a frequency-rank map over the slim set's single words so
        # phrase selection can prefer phrases made of common words.
        word_rank: dict[str, int] = {}
        if chosen_ids:
            placeholders = ",".join(str(i) for i in chosen_ids)
            rows = src.execute(
                f"""
                SELECT normalized_word,
                       COALESCE(frq, 0) AS frq,
                       COALESCE(bnc, 0) AS bnc,
                       COALESCE(collins, 0) AS collins,
                       COALESCE(oxford, 0) AS oxford,
                       is_toefl
                FROM dictionary_entries
                WHERE id IN ({placeholders}) AND instr(normalized_word, ' ') = 0
                """
            ).fetchall()
            # Composite rank: lower = more frequent. Use frq if present, else bnc,
            # else a large constant scaled by collins/oxford absence.
            for normalized, frq, bnc, collins, oxford, is_toefl in rows:
                if frq:
                    rank = frq
                elif bnc:
                    rank = 60_000 + bnc
                elif is_toefl:
                    rank = 200_000
                else:
                    # collins/oxford-only words: rank by inverse of collins band.
                    rank = 300_000 - (collins * 1000) - (oxford * 500)
                word_rank[normalized] = rank
        fallback_rank = 1_000_000

        budget = max(0, args.target_rows - len(chosen_ids))
        phrase_ids = select_top_phrases(src, word_rank, chosen_ids, budget, fallback_rank)
        chosen_ids.update(phrase_ids)

        if len(chosen_ids) < args.target_rows:
            remaining = args.target_rows - len(chosen_ids)
            chosen_ids.update(select_fallback_phrases(src, chosen_ids, remaining))

        inserted = copy_rows(src, dst, chosen_ids, args.detail_policy)
        populate_fts(dst)

        dst.execute("INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)", ("data_version", data_version))
        dst.execute("INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)", ("source_full", str(args.input)))
        dst.execute("INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)", ("variant", "slim"))
        dst.execute("INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)", ("generated_at", time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())))
        dst.execute("INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)", ("target_rows", str(args.target_rows)))
        dst.execute("INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)", ("detail_policy", args.detail_policy))
        dst.commit()
        dst.execute("VACUUM")
        dst.execute("ANALYZE")

    size_mb = args.output.stat().st_size / (1024 * 1024)
    print(f"Wrote slim dictionary: {args.output}")
    print(f"  rows inserted: {inserted:,}")
    print(f"    TOEFL-tagged: {len(toefl_ids):,}")
    print(f"    ranked single words: {len(ranked_ids):,}")
    print(f"    K-12/AP STEM-tagged: {len(ap_stem_ids):,}")
    print(f"    phrases (constituent-matched): {len(phrase_ids):,}")
    print(f"    final total: {len(chosen_ids):,}")
    print(f"  size: {size_mb:.1f} MB")
    print(f"  data version: {data_version}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
