from __future__ import annotations

import argparse
import gzip
import json
import sqlite3
import tempfile
import unittest
from pathlib import Path

from scripts.package_dictionary_shards import (
    exchange_code_label,
    fnv1a32,
    merge_inflection_labels,
    normalize_word,
    package,
    shard_index,
)


SCHEMA = """
CREATE TABLE dictionary_entries (
    id INTEGER PRIMARY KEY,
    word TEXT NOT NULL,
    normalized_word TEXT NOT NULL,
    phonetic TEXT,
    definition TEXT,
    definition_source TEXT,
    translation TEXT,
    tag TEXT,
    frq INTEGER,
    bnc INTEGER,
    exchange TEXT,
    detail TEXT
);
"""


class PackageDictionaryShardsTests(unittest.TestCase):
    def package_rows(self, root: Path, rows: list[tuple]) -> tuple[dict, Path]:
        database = root / "dictionary.sqlite"
        output = root / "shards"
        with sqlite3.connect(database) as conn:
            conn.executescript(SCHEMA)
            conn.executemany(
                """
                INSERT INTO dictionary_entries(
                    word, normalized_word, phonetic, definition,
                    definition_source, translation, tag, frq, bnc, exchange, detail
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                rows,
            )
        manifest = package(argparse.Namespace(
            input=database, output_dir=output, version="test.aliases",
            shard_count=4, gzip_level=9, skip_validation=False,
        ))
        return manifest, output

    def alias_payload(self, manifest: dict, output: Path, alias: str):
        shard = manifest["shards"][shard_index(alias, manifest["shardCount"])]
        with gzip.open(output / shard["path"], "rt", encoding="utf-8") as handle:
            return json.load(handle)["a"].get(alias)

    def build_database(self, path: Path) -> None:
        with sqlite3.connect(path) as conn:
            conn.executescript(SCHEMA)
            conn.executemany(
                """
                INSERT INTO dictionary_entries(
                    word, normalized_word, phonetic, definition,
                    definition_source, translation, tag, frq, bnc, exchange, detail
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    ("abandon", "abandon", "/a/", "leave permanently", "ECDICT", "放弃", "cet4", 100, 100, None, None),
                    ("take", "take", "/t/", "carry something", "ECDICT", "拿", "cet4", 10, 10, "p:took/d:taken/i:taking/3:takes", '{"displayMeanings":[{"en":"carry"}]}'),
                    ("taken", "taken", "/t/", "past participle entry", "ECDICT", "拿走的", None, 20, 20, None, None),
                ],
            )
            conn.commit()

    def test_hash_matches_browser_contract(self) -> None:
        self.assertEqual(fnv1a32("abandon"), 3402497766)
        self.assertEqual(shard_index("abandon", 128), 102)
        self.assertEqual(shard_index("they're", 128), 113)

    def test_plural_label_priority(self) -> None:
        self.assertEqual(exchange_code_label("3s"), "plural")
        self.assertEqual(
            merge_inflection_labels(["third-person singular", "plural"]),
            "plural",
        )

    def test_same_base_ambiguous_s_alias_prefers_plural(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            manifest, output = self.package_rows(Path(tmp), [
                ("apple", "apple", None, "a fruit or bear fruit", "Kaikki", "苹果", None, 1, 5,
                 "3:apples/s:apples", None),
            ])
            alias = self.alias_payload(manifest, output, "apples")
            self.assertIsNotNone(alias)
            self.assertEqual(alias[5], "apple")
            self.assertEqual(alias[6], "plural")

    def test_exact_entry_still_wins_over_alias(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            manifest, output = self.package_rows(Path(tmp), [
                ("apple", "apple", None, "a fruit", "Kaikki", "苹果", None, 10, 20, "s:apples", None),
                ("apples", "apples", None, "plural fruit entry", "Kaikki", "苹果", None, 20, 30, None, None),
            ])
            self.assertIsNone(self.alias_payload(manifest, output, "apples"))

    def test_different_base_alias_conflict_uses_best_rank_deterministically(self) -> None:
        rows = [
            ("axe", "axe", None, "cutting tool", "Kaikki", "斧", None, 50, 20, "s:axes", None),
            ("axis", "axis", None, "reference line", "Kaikki", "轴", None, 10, 40, "s:axes", None),
        ]
        selected = []
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            for index, ordered in enumerate((rows, list(reversed(rows)))):
                case = root / str(index)
                case.mkdir()
                manifest, output = self.package_rows(case, ordered)
                selected.append(self.alias_payload(manifest, output, "axes")[5])
        self.assertEqual(selected, ["axis", "axis"])

    def test_packages_entries_and_only_missing_inflection_aliases(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            database = root / "dictionary.sqlite"
            output = root / "shards"
            self.build_database(database)
            args = argparse.Namespace(
                input=database,
                output_dir=output,
                version="test.full.1",
                shard_count=4,
                gzip_level=9,
                skip_validation=False,
            )
            manifest = package(args)

            self.assertEqual(manifest["rowCount"], 3)
            self.assertEqual(manifest["aliasCount"], 3)  # took, taking, takes; "taken" is a real entry.
            self.assertEqual(manifest["shardCount"], 4)
            self.assertGreater(manifest["totalCompressedBytes"], 0)

            took_index = shard_index("took", 4)
            took_shard = manifest["shards"][took_index]
            with gzip.open(output / took_shard["path"], "rt", encoding="utf-8") as handle:
                payload = json.load(handle)
            self.assertIn("took", payload["a"])
            self.assertEqual(payload["a"]["took"][5], "take")
            self.assertEqual(payload["a"]["took"][6], "past tense")
            self.assertIn("displayMeanings", payload["a"]["took"][8])

            taken_index = shard_index("taken", 4)
            taken_shard = manifest["shards"][taken_index]
            with gzip.open(output / taken_shard["path"], "rt", encoding="utf-8") as handle:
                payload = json.load(handle)
            self.assertIn("taken", payload["e"])
            self.assertNotIn("taken", payload["a"])

            take_index = shard_index("take", 4)
            with gzip.open(output / manifest["shards"][take_index]["path"], "rt", encoding="utf-8") as handle:
                payload = json.load(handle)
            self.assertIn("displayMeanings", payload["e"]["take"][6])

    def test_shards_are_deterministic_for_same_input(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            database = root / "dictionary.sqlite"
            self.build_database(database)
            hashes = []
            for name in ("first", "second"):
                output = root / name
                manifest = package(argparse.Namespace(
                    input=database,
                    output_dir=output,
                    version="test.full.1",
                    shard_count=4,
                    gzip_level=9,
                    skip_validation=False,
                ))
                hashes.append([item["sha256"] for item in manifest["shards"]])
            self.assertEqual(hashes[0], hashes[1])


    def test_all_apostrophe_variants_share_one_normalized_key(self) -> None:
        variants = ["they‘re", "they’re", "theyʼre", "they`re", "they＇re"]
        self.assertEqual({normalize_word(value) for value in variants}, {"they're"})
        self.assertEqual({shard_index(value, 128) for value in variants}, {shard_index("they're", 128)})

    def test_validation_detects_changed_shard_bytes(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            database = root / "dictionary.sqlite"
            output = root / "shards"
            self.build_database(database)
            manifest = package(argparse.Namespace(
                input=database,
                output_dir=output,
                version="test.full.1",
                shard_count=4,
                gzip_level=9,
                skip_validation=False,
            ))
            shard_path = output / manifest["shards"][0]["path"]
            shard_path.write_bytes(shard_path.read_bytes() + b"corrupt")
            from scripts.package_dictionary_shards import validate_package
            with self.assertRaisesRegex(RuntimeError, "size mismatch"):
                validate_package(output, manifest)


if __name__ == "__main__":
    unittest.main()
