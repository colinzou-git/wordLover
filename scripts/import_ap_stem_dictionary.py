#!/usr/bin/env python3
"""Merge the WordFan K-12 / AP STEM CSV into the full ECDICT dictionary.

Full ECDICT remains the metadata source of truth. For words that already exist
in ``data/dictionary.sqlite`` this script changes ONLY three columns:

  * ``definition``  – appends the CSV definition (deduplicated, ``;``-joined)
  * ``translation`` – appends the CSV translation (deduplicated, ``;``-joined)
  * ``tag``         – appends the CSV tags (deduplicated, space-joined)

Every other ECDICT-derived column (phonetic, pos, collins, oxford, bnc, frq,
exchange, detail, audio, source, definition_source, is_toefl, id,
normalized_word) is left untouched for existing rows.

Words that are not present in ECDICT are inserted using the CSV values, with
``source`` and ``definition_source`` set to ``WordFan_AP_STEM``. No frequency
or ranking metadata (bnc, frq, collins, oxford, phonetic) is invented — those
columns are only populated from what the CSV actually provides.

Usage::

    python scripts/import_ap_stem_dictionary.py
"""

from __future__ import annotations

import argparse
import csv
import sqlite3
import sys
from pathlib import Path

# Allow ``from build_dictionary import ...`` regardless of the current working
# directory so the shared normalization logic stays in exactly one place.
sys.path.insert(0, str(Path(__file__).resolve().parent))

from build_dictionary import clean_text, has_tag, normalize_word, parse_int  # noqa: E402


DEFAULT_DB = Path("data/dictionary.sqlite")
DEFAULT_CSV = Path("data/sources/wordfan_k12_ap_stem_ecdict_style.csv")
AP_STEM_SOURCE = "WordFan_AP_STEM"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", type=Path, default=DEFAULT_DB,
                        help="Full dictionary SQLite to update in place.")
    parser.add_argument("--csv", type=Path, default=DEFAULT_CSV,
                        help="WordFan AP STEM CSV (ECDICT-style columns).")
    parser.add_argument("--skip-fts", action="store_true",
                        help="Do not rebuild the FTS5 search index after import.")
    return parser.parse_args()


def merge_values(existing: str | None, addition: str | None) -> str | None:
    """Append ``addition`` to a ``;``-separated ``existing`` value, deduped.

    The existing text is preserved as-is (each ``;``-delimited chunk kept
    whole, including any embedded newlines) so ECDICT content is never
    rewritten — we only add the CSV value when it is not already present.
    """
    parts: list[str] = []
    seen: set[str] = set()
    for chunk in (existing or "").split(";"):
        chunk = chunk.strip()
        if chunk and chunk.casefold() not in seen:
            seen.add(chunk.casefold())
            parts.append(chunk)
    addition = (addition or "").strip()
    if addition and addition.casefold() not in seen:
        parts.append(addition)
    return "; ".join(parts) if parts else None


def merge_tags(existing: str | None, addition: str | None) -> str | None:
    """Union of space-separated tag tokens, order-preserving and deduped."""
    out: list[str] = []
    seen: set[str] = set()
    for token in (existing or "").split() + (addition or "").split():
        if token.casefold() not in seen:
            seen.add(token.casefold())
            out.append(token)
    return " ".join(out) if out else None


def import_csv(conn: sqlite3.Connection, csv_path: Path, *, rebuild_fts: bool = True) -> dict:
    stats = {"csv_rows": 0, "updated": 0, "inserted": 0, "skipped_empty": 0}

    with csv_path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            word = clean_text(row.get("word"))
            if not word:
                stats["skipped_empty"] += 1
                continue
            stats["csv_rows"] += 1
            normalized = normalize_word(word)
            csv_definition = clean_text(row.get("definition"))
            csv_translation = clean_text(row.get("translation"))
            csv_tag = clean_text(row.get("tag"))

            matches = conn.execute(
                "SELECT id, definition, translation, tag "
                "FROM dictionary_entries WHERE normalized_word = ?",
                (normalized,),
            ).fetchall()

            if matches:
                for row_id, definition, translation, tag in matches:
                    conn.execute(
                        "UPDATE dictionary_entries "
                        "SET definition = ?, translation = ?, tag = ? WHERE id = ?",
                        (
                            merge_values(definition, csv_definition),
                            merge_values(translation, csv_translation),
                            merge_tags(tag, csv_tag),
                            row_id,
                        ),
                    )
                stats["updated"] += len(matches)
            else:
                final_tag = merge_tags(None, csv_tag)
                conn.execute(
                    """
                    INSERT INTO dictionary_entries (
                        word, normalized_word, phonetic, definition,
                        definition_source, translation, pos, collins, oxford,
                        tag, is_toefl, bnc, frq, exchange, detail, audio, source
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        word,
                        normalized,
                        clean_text(row.get("phonetic")),
                        csv_definition,
                        AP_STEM_SOURCE,
                        csv_translation,
                        clean_text(row.get("pos")),
                        parse_int(row.get("collins")),
                        parse_int(row.get("oxford")),
                        final_tag,
                        1 if has_tag(final_tag, "toefl") else 0,
                        parse_int(row.get("bnc"), null_zero=True),
                        parse_int(row.get("frq"), null_zero=True),
                        clean_text(row.get("exchange")),
                        clean_text(row.get("detail")),
                        clean_text(row.get("audio")),
                        AP_STEM_SOURCE,
                    ),
                )
                stats["inserted"] += 1

    fts_exists = conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name='dictionary_search_fts'"
    ).fetchone()
    if fts_exists and rebuild_fts:
        # External-content FTS5: direct writes to dictionary_entries do not
        # propagate, so rebuild the index from the content table.
        conn.execute("INSERT INTO dictionary_search_fts(dictionary_search_fts) VALUES('rebuild')")
        stats["fts"] = "rebuilt"
    else:
        stats["fts"] = "skipped"
    return stats


def run_import(db_path: Path, csv_path: Path, *, rebuild_fts: bool = True) -> dict:
    if not db_path.exists():
        raise FileNotFoundError(f"Dictionary not found: {db_path}")
    if not csv_path.exists():
        raise FileNotFoundError(f"CSV not found: {csv_path}")
    conn = sqlite3.connect(db_path)
    try:
        stats = import_csv(conn, csv_path, rebuild_fts=rebuild_fts)
        conn.commit()
    finally:
        conn.close()
    return stats


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    args = parse_args()
    try:
        stats = run_import(args.db, args.csv, rebuild_fts=not args.skip_fts)
    except Exception as exc:  # noqa: BLE001 - surface a clean CLI error
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    print(
        "AP STEM import complete: "
        f"{stats['csv_rows']} CSV rows -> "
        f"{stats['updated']} existing rows updated, "
        f"{stats['inserted']} new rows inserted "
        f"(FTS: {stats['fts']})."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
