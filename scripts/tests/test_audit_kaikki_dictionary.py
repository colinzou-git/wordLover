import argparse
import json
import sqlite3
import tempfile
import unittest
from pathlib import Path

from scripts.audit_kaikki_dictionary import audit_database, main
from scripts.build_kaikki_dictionary import build_database


class AuditKaikkiDictionaryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.source = self.root / "source.jsonl"
        self.database = self.root / "kaikki.sqlite"
        self.build_report = self.root / "build.json"
        rows = [
            {
                "word": "charge", "lang_code": "en", "pos": "noun",
                "senses": [{"glosses": ["an amount paid"], "translations": [{"lang_code": "zh", "word": "费用"}]}],
            },
            {
                "word": "run", "lang_code": "en", "pos": "verb",
                "senses": [{"glosses": ["move quickly"]}],
                "forms": [{"form": "running", "tags": ["present", "participle"]}, {"form": "ran", "tags": ["past"]}],
            },
        ]
        self.source.write_text("\n".join(json.dumps(row) for row in rows) + "\n", encoding="utf-8")
        build_database(argparse.Namespace(
            source=self.source, output=self.database, report=self.build_report,
            data_version="test.kaikki", batch_size=10, skip_fts=False,
            tag_source=self.root / "missing.sqlite", tag_source_shards=self.root / "missing-shards",
            full_translation_source_shards=None, slim_translation_source=None,
            max_compact_senses=12, max_detailed_senses_per_pos=20,
            max_examples_per_sense=3, max_example_chars=240,
        ))

    def tearDown(self):
        self.temp.cleanup()

    def args(self, **overrides):
        values = dict(
            kaikki_db=self.database, current_slim_db=None, current_full_shards=None,
            preview_package=None, report=self.root / "audit.json",
        )
        values.update(overrides)
        return argparse.Namespace(**values)

    def test_healthy_database_passes_and_counts_coverage(self):
        report, passed = audit_database(self.args())
        self.assertTrue(passed)
        self.assertEqual(report["health"]["quick_check"], "ok")
        self.assertTrue(report["health"]["fts_matches_dictionary_rows"])
        self.assertEqual(report["chinese_coverage"]["rows_with_translation"], 1)
        self.assertEqual(report["chinese_coverage"]["rows_with_kaikki_sense_chinese"], 1)
        self.assertTrue(report["inflections"]["running_alias"])
        self.assertTrue(report["inflections"]["ran_alias"])
        self.assertEqual(report["tag_rank_preservation"]["status"], "skipped")
        self.assertEqual(report["full_shard_comparison"]["status"], "skipped")

    def test_fts_mismatch_fails_and_writes_report(self):
        with sqlite3.connect(self.database) as conn:
            conn.execute("DROP TABLE dictionary_search_fts")
            conn.execute("CREATE TABLE dictionary_search_fts(word TEXT)")
            conn.execute("INSERT INTO dictionary_search_fts VALUES ('only-one')")
            conn.commit()
        report_path = self.root / "failed-audit.json"
        code = main(["--kaikki-db", str(self.database), "--report", str(report_path)])
        self.assertEqual(code, 1)
        self.assertTrue(report_path.is_file())
        self.assertFalse(json.loads(report_path.read_text(encoding="utf-8"))["health"]["fts_matches_dictionary_rows"])

    def test_malformed_detail_fails(self):
        with sqlite3.connect(self.database) as conn:
            conn.execute("UPDATE dictionary_entries SET detail='{bad' WHERE normalized_word='charge'")
            conn.commit()
        report, passed = audit_database(self.args())
        self.assertFalse(passed)
        self.assertEqual(report["structured_detail"]["malformed_detail_rows"], 1)

    def test_stem_samples_detected(self):
        with sqlite3.connect(self.database) as conn:
            for term, tag in (("isosceles", "k12_math"), ("scalene", "k12_math"), ("rhombus", "k12_math"),
                              ("derivative", "ap_calculus_ab"), ("momentum", "ap_physics"),
                              ("eigenvalue", "linear_algebra_extension")):
                conn.execute(
                    "INSERT INTO dictionary_entries(word,normalized_word,definition_source,tag,is_toefl,source) VALUES (?,?,?,?,0,?)",
                    (term, term, "WordFan_STEM_Supplement", tag, "WordFan_STEM_Supplement"),
                )
                rowid = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
                conn.execute("INSERT INTO dictionary_search_fts(rowid,word,normalized_word,definition,translation) VALUES (?,?,?,?,?)", (rowid, term, term, "", ""))
            conn.commit()
        report, passed = audit_database(self.args())
        self.assertTrue(passed)
        self.assertTrue(report["stem_preservation"]["sample_stem_terms_present"])
        self.assertEqual(report["stem_preservation"]["final_stem_rows"], 6)

    def test_missing_required_input_returns_two_and_writes_report(self):
        report = self.root / "missing.json"
        code = main(["--kaikki-db", str(self.root / "missing.sqlite"), "--report", str(report)])
        self.assertEqual(code, 2)
        self.assertEqual(json.loads(report.read_text(encoding="utf-8"))["status"], "invalid-input")

    def test_preview_package_over_memory_target_fails(self):
        preview = self.root / "preview"
        (preview / "dictionary-full").mkdir(parents=True)
        (preview / "dictionary-manifest.json").write_text(
            json.dumps({"sqlite": {"bytes": 51 * 1024 * 1024}}), encoding="utf-8"
        )
        (preview / "dictionary-full/manifest.json").write_text("{}", encoding="utf-8")
        report, passed = audit_database(self.args(preview_package=preview))
        self.assertFalse(passed)
        self.assertFalse(report["packaging_compatibility"]["core_within_memory_target"])


if __name__ == "__main__":
    unittest.main()
