#!/usr/bin/env python3
"""Tests for the AP STEM dictionary import and slim-dictionary retention.

Run from the repo root::

    python -m unittest scripts.tests.test_import_ap_stem
    # or
    python scripts/tests/test_import_ap_stem.py
"""

from __future__ import annotations

import csv
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = SCRIPTS_DIR.parent
sys.path.insert(0, str(SCRIPTS_DIR))

import build_dictionary  # noqa: E402
import build_slim_dictionary  # noqa: E402
from import_ap_stem_dictionary import merge_tags, merge_values, run_import  # noqa: E402


CSV_COLUMNS = [
    "word", "phonetic", "definition", "translation", "pos", "collins",
    "oxford", "tag", "bnc", "frq", "exchange", "detail", "audio",
    "source", "source_url", "license",
]


def write_csv(path: Path, rows: list[dict]) -> None:
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=CSV_COLUMNS)
        writer.writeheader()
        for row in rows:
            writer.writerow({col: row.get(col, "") for col in CSV_COLUMNS})


def make_full_dictionary(path: Path, entries: list[tuple]) -> None:
    """Create a minimal full-dictionary fixture matching build_dictionary's schema."""
    conn = sqlite3.connect(path)
    try:
        build_dictionary.create_schema(conn)
        if entries:
            build_dictionary.insert_batch(conn, entries)
        build_dictionary.build_fts_index(conn)
        conn.commit()
    finally:
        conn.close()


def ecdict_row(word, **overrides) -> tuple:
    """An ECDICT-style row tuple in build_dictionary.insert_batch column order."""
    base = {
        "phonetic": "x", "definition": None, "definition_source": "ECDICT",
        "definition_augmented_at": None, "translation": None, "pos": None,
        "collins": 0, "oxford": 0, "tag": None, "is_toefl": 0, "bnc": None,
        "frq": None, "exchange": None, "detail": None, "audio": None,
        "source": "ECDICT",
    }
    base.update(overrides)
    return (
        word,
        build_dictionary.normalize_word(word),
        base["phonetic"], base["definition"], base["definition_source"],
        base["definition_augmented_at"], base["translation"], base["pos"],
        base["collins"], base["oxford"], base["tag"], base["is_toefl"],
        base["bnc"], base["frq"], base["exchange"], base["detail"],
        base["audio"], base["source"],
    )


def fetch_one(db: Path, word: str) -> sqlite3.Row:
    conn = sqlite3.connect(db)
    conn.row_factory = sqlite3.Row
    try:
        return conn.execute(
            "SELECT * FROM dictionary_entries WHERE normalized_word = ?",
            (build_dictionary.normalize_word(word),),
        ).fetchone()
    finally:
        conn.close()


class ImportApStemTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = Path(tempfile.mkdtemp())
        self.db = self.tmp / "dictionary.sqlite"
        self.csv = self.tmp / "ap_stem.csv"

        make_full_dictionary(self.db, [
            ecdict_row(
                "acceleration",
                phonetic="əkˌsɛləˈreɪʃən",
                definition="the rate at which velocity changes",
                translation="n. 加速度",
                pos="n.",
                collins=2,
                oxford=1,
                tag="cet4 toefl",
                is_toefl=1,
                bnc=100,
                frq=200,
                exchange="s:accelerations",
                detail="ecdict-detail",
                audio="accel.mp3",
            ),
        ])

        write_csv(self.csv, [
            {
                # Existing ECDICT word: must only touch definition/translation/tag.
                # The other CSV columns here are deliberately "wrong" to prove
                # they are NOT applied to the existing row.
                "word": "acceleration",
                "phonetic": "WRONG",
                "definition": "the rate at which velocity changes",  # dup -> no change
                "translation": "增速",
                "pos": "verb",
                "collins": "9",
                "oxford": "9",
                "tag": "toefl k12_stem k12_science ap_physics_1",  # 'toefl' dup
                "bnc": "5",
                "frq": "5",
                "exchange": "WRONG",
                "detail": "WRONG",
                "audio": "WRONG",
                "source": "WordFan_K12_STEM",
            },
            {
                # Novel word: must be inserted from CSV with AP STEM provenance.
                "word": "photosynthesis xyz",
                "phonetic": "ˌfoʊtoʊˈsɪnθəsɪs",
                "definition": "making food from light",
                "translation": "光合作用",
                "pos": "n.",
                "collins": "",  # no fake frequency/ranking metadata
                "oxford": "",
                "tag": "k12_science ap_biology",
                "bnc": "",
                "frq": "",
                "source": "WordFan_K12_STEM",
            },
        ])

        self.stats = run_import(self.db, self.csv)

    def test_existing_row_only_appends_def_translation_tag(self) -> None:
        row = fetch_one(self.db, "acceleration")
        # definition: CSV value was a duplicate, so it stays unchanged.
        self.assertEqual(row["definition"], "the rate at which velocity changes")
        # translation: CSV value appended.
        self.assertEqual(row["translation"], "n. 加速度; 增速")
        # tag: appended, 'toefl' not duplicated.
        self.assertEqual(row["tag"], "cet4 toefl k12_stem k12_science ap_physics_1")

    def test_existing_row_metadata_untouched(self) -> None:
        row = fetch_one(self.db, "acceleration")
        self.assertEqual(row["phonetic"], "əkˌsɛləˈreɪʃən")
        self.assertEqual(row["pos"], "n.")
        self.assertEqual(row["collins"], 2)
        self.assertEqual(row["oxford"], 1)
        self.assertEqual(row["bnc"], 100)
        self.assertEqual(row["frq"], 200)
        self.assertEqual(row["exchange"], "s:accelerations")
        self.assertEqual(row["detail"], "ecdict-detail")
        self.assertEqual(row["audio"], "accel.mp3")
        self.assertEqual(row["source"], "ECDICT")
        self.assertEqual(row["definition_source"], "ECDICT")
        self.assertEqual(row["is_toefl"], 1)

    def test_missing_row_inserted_from_csv(self) -> None:
        row = fetch_one(self.db, "photosynthesis xyz")
        self.assertIsNotNone(row)
        self.assertEqual(row["definition"], "making food from light")
        self.assertEqual(row["translation"], "光合作用")
        self.assertEqual(row["tag"], "k12_science ap_biology")
        self.assertEqual(row["source"], "WordFan_AP_STEM")
        self.assertEqual(row["definition_source"], "WordFan_AP_STEM")

    def test_missing_row_has_no_fake_frequency(self) -> None:
        row = fetch_one(self.db, "photosynthesis xyz")
        self.assertIsNone(row["frq"])
        self.assertIsNone(row["bnc"])
        self.assertIsNone(row["collins"])
        self.assertIsNone(row["oxford"])
        self.assertEqual(row["is_toefl"], 0)

    def test_tag_merge_dedup(self) -> None:
        self.assertEqual(
            merge_tags("cet4 toefl", "toefl k12_stem"),
            "cet4 toefl k12_stem",
        )
        self.assertEqual(merge_tags(None, "k12_science ap_biology"),
                         "k12_science ap_biology")
        self.assertIsNone(merge_tags(None, None))

    def test_value_merge_dedup(self) -> None:
        self.assertEqual(merge_values("a", "b"), "a; b")
        self.assertEqual(merge_values("a; b", "a"), "a; b")  # dup dropped
        self.assertEqual(merge_values(None, "only"), "only")
        self.assertIsNone(merge_values(None, None))

    def test_fts_finds_inserted_terms(self) -> None:
        conn = sqlite3.connect(self.db)
        try:
            by_word = conn.execute(
                "SELECT word FROM dictionary_search_fts WHERE dictionary_search_fts MATCH ?",
                ("photosynthesis",),
            ).fetchall()
            self.assertIn(("photosynthesis xyz",), by_word)

            by_translation = conn.execute(
                "SELECT word FROM dictionary_search_fts WHERE dictionary_search_fts MATCH ?",
                ("光合作用",),
            ).fetchall()
            self.assertIn(("photosynthesis xyz",), by_translation)
        finally:
            conn.close()


class SlimRetentionTest(unittest.TestCase):
    def test_ap_stem_rows_always_retained(self) -> None:
        tmp = Path(tempfile.mkdtemp())
        full = tmp / "dictionary.sqlite"
        slim = tmp / "slim.sqlite"

        make_full_dictionary(full, [
            # AP STEM term with NO frequency signal at all -> would normally be
            # dropped by the slim selection, but must be force-included.
            ecdict_row(
                "mitosis",
                definition="a type of cell division",
                translation="有丝分裂",
                tag="k12_science ap_biology",
                source="WordFan_AP_STEM",
                definition_source="WordFan_AP_STEM",
            ),
            # A normal high-frequency single word (eligible via frequency).
            ecdict_row("the", translation="art. 这", frq=1, bnc=1, collins=5),
        ])

        result = subprocess.run(
            [
                sys.executable, str(SCRIPTS_DIR / "build_slim_dictionary.py"),
                "--input", str(full),
                "--output", str(slim),
                "--target-rows", "1",  # tiny target: only forced rows survive
                "--data-version", "test.ap-stem",
            ],
            cwd=str(REPO_ROOT),
            capture_output=True,
            text=True,
        )
        self.assertEqual(result.returncode, 0, result.stderr)

        conn = sqlite3.connect(slim)
        try:
            row = conn.execute(
                "SELECT tag, frq, bnc FROM dictionary_entries WHERE normalized_word = ?",
                ("mitosis",),
            ).fetchone()
        finally:
            conn.close()
        self.assertIsNotNone(row, "AP STEM row was dropped from slim dictionary")
        self.assertEqual(row[0], "k12_science ap_biology")
        self.assertIsNone(row[1])  # no fake frequency added
        self.assertIsNone(row[2])

    def test_tag_matcher_prefix_and_exact(self) -> None:
        self.assertTrue(build_slim_dictionary.tag_matches_ap_stem("foo k12_math bar"))
        self.assertTrue(build_slim_dictionary.tag_matches_ap_stem("ap_physics_1"))
        self.assertTrue(build_slim_dictionary.tag_matches_ap_stem("ap_computer_science_a"))
        self.assertTrue(build_slim_dictionary.tag_matches_ap_stem("linear_algebra_extension"))
        self.assertFalse(build_slim_dictionary.tag_matches_ap_stem("cet4 toefl gre"))
        self.assertFalse(build_slim_dictionary.tag_matches_ap_stem(None))


if __name__ == "__main__":
    unittest.main(verbosity=2)
