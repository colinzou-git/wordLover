import argparse
import gzip
import json
import sqlite3
import tempfile
import unittest
from pathlib import Path

from scripts.build_kaikki_dictionary import (
    OverlayRecord,
    TranslationOverlayRecord,
    add_exchange_form,
    build_database,
    choose_chinese_translation,
    clean_text,
    contains_tag,
    extract_chinese_translations,
    has_han_text,
    is_chinese_translation_item,
    load_overlay_from_sqlite,
    load_translation_overlay_from_shards,
    map_kaikki_form_tags_to_exchange_code,
    merge_tag_tokens,
    normalize_word,
    parse_args,
    serialize_exchange,
)
from scripts.build_slim_dictionary import main as build_slim_main


SCHEMA = """
CREATE TABLE dictionary_entries (
 id INTEGER PRIMARY KEY, word TEXT NOT NULL, normalized_word TEXT NOT NULL,
 phonetic TEXT, definition TEXT, definition_source TEXT, definition_augmented_at TEXT,
 translation TEXT, pos TEXT, collins INTEGER, oxford INTEGER, tag TEXT,
 is_toefl INTEGER, bnc INTEGER, frq INTEGER, exchange TEXT, detail TEXT,
 audio TEXT, source TEXT
);
"""


def entry(word, pos="noun", gloss="definition", **extra):
    value = {"word": word, "lang_code": "en", "pos": pos, "senses": [{"glosses": [gloss]}]}
    value.update(extra)
    return value


class KaikkiBuilderTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.source = self.root / "source.jsonl"
        self.output = self.root / "dictionary.sqlite"
        self.report = self.root / "report.json"

    def tearDown(self):
        self.temp.cleanup()

    def args(self, source=None, **overrides):
        values = dict(
            source=source or self.source, output=self.output, report=self.report,
            data_version="test.kaikki", batch_size=2, skip_fts=False,
            tag_source=self.root / "missing.sqlite", tag_source_shards=self.root / "missing-shards",
            full_translation_source_shards=None, slim_translation_source=None,
            allow_missing_full_overlay=True,
            max_compact_senses=12, max_detailed_senses_per_pos=20,
            max_examples_per_sense=3, max_example_chars=240,
        )
        values.update(overrides)
        return argparse.Namespace(**values)

    def write_jsonl(self, values, path=None):
        path = path or self.source
        text = "\n".join(json.dumps(value, ensure_ascii=False) if isinstance(value, dict) else value for value in values) + "\n"
        if path.name.endswith(".gz"):
            with gzip.open(path, "wt", encoding="utf-8") as handle:
                handle.write(text)
        else:
            path.write_text(text, encoding="utf-8")

    def query(self, sql, params=()):
        with sqlite3.connect(self.output) as conn:
            return conn.execute(sql, params).fetchall()

    def build(self, values, **overrides):
        self.write_jsonl(values)
        return build_database(self.args(**overrides))

    def make_overlay(self, rows, columns=SCHEMA):
        path = self.root / "overlay.sqlite"
        with sqlite3.connect(path) as conn:
            conn.executescript(columns)
            full = ["word", "normalized_word", "phonetic", "definition", "definition_source", "definition_augmented_at",
                    "translation", "pos", "collins", "oxford", "tag", "is_toefl", "bnc", "frq", "exchange", "detail", "audio", "source"]
            for values in rows:
                data = {name: None for name in full}
                data.update(values)
                data["word"] = data["word"] or data["normalized_word"]
                data["normalized_word"] = data["normalized_word"] or normalize_word(data["word"])
                data["definition_source"] = data["definition_source"] or "WordFan_AP_STEM"
                data["source"] = data["source"] or "WordFan_AP_STEM"
                conn.execute(f"INSERT INTO dictionary_entries ({','.join(full)}) VALUES ({','.join('?' for _ in full)})", tuple(data[x] for x in full))
        return path

    def make_full_shards(self, entries, *, stale_entries=None, omit_manifest=False, omit_listed_shard=False):
        shard_dir = self.root / f"shards-{len(list(self.root.glob('shards-*')))}"
        shard_dir.mkdir()
        shard_path = shard_dir / "shard-00.json.gz"
        if not omit_listed_shard:
            with gzip.open(shard_path, "wt", encoding="utf-8") as handle:
                json.dump({"v": 1, "e": entries, "a": {}}, handle, ensure_ascii=False)
        if stale_entries is not None:
            with gzip.open(shard_dir / "shard-ff.json.gz", "wt", encoding="utf-8") as handle:
                json.dump({"v": 1, "e": stale_entries, "a": {}}, handle, ensure_ascii=False)
        if not omit_manifest:
            (shard_dir / "manifest.json").write_text(json.dumps({
                "app": "wordlover",
                "formatVersion": 1,
                "dictionaryDataVersion": "test.full-shards",
                "variant": "full-sharded",
                "shardCount": 1,
                "hash": "fnv1a32-utf8-mod",
                "compression": "gzip",
                "shards": [{"id": "00", "path": "shard-00.json.gz", "bytes": 1, "sha256": "x"}],
            }), encoding="utf-8")
        return shard_dir

    def test_parse_args_and_normalization_helpers(self):
        args = parse_args(["--source", "x.jsonl", "--skip-fts"])
        self.assertTrue(args.skip_fts)
        self.assertEqual(normalize_word("  They’re   Here "), "they're here")
        self.assertIsNone(clean_text("  \n "))
        self.assertEqual(merge_tag_tokens(["toefl k12_math", "k12_math ap_physics"]), "toefl k12_math ap_physics")
        self.assertTrue(contains_tag("toefl k12_math", "toefl"))

    def test_stream_build_filters_aggregates_and_reports_errors(self):
        values = [
            entry("Charge", "noun", "a cost", sounds=[{"ipa": "/tʃɑːdʒ/"}]),
            "{malformed",
            entry("charge", "verb", "ask for payment"),
            {"word": "bonjour", "lang_code": "fr", "pos": "noun", "senses": [{"glosses": ["hello"]}]},
            entry("bad1", gloss="invalid"),
            {"word": "redirected", "lang_code": "en", "redirect": "target", "senses": []},
            {"word": "ran", "lang_code": "en", "pos": "verb", "senses": [{"form_of": [{"word": "run"}], "tags": ["past"], "glosses": ["past of run"]}]},
        ]
        report = self.build(values)
        self.assertEqual(report["json_errors"], 1)
        self.assertEqual(report["skipped_non_english"], 1)
        self.assertEqual(report["skipped_invalid_terms"], 1)
        self.assertEqual(report["skipped_redirects"], 1)
        self.assertEqual(report["skipped_form_of_only"], 1)
        rows = self.query("SELECT normalized_word, definition, phonetic FROM dictionary_entries")
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0][0], "charge")
        self.assertIn("a cost", rows[0][1])
        self.assertIn("ask for payment", rows[0][1])
        self.assertEqual(rows[0][2], "/tʃɑːdʒ/")
        self.assertEqual(self.query("PRAGMA quick_check")[0][0], "ok")
        self.assertEqual(self.query("SELECT count(*) FROM dictionary_search_fts")[0][0], 1)
        metadata = dict(self.query("SELECT key,value FROM metadata"))
        self.assertEqual(metadata["data_version"], "test.kaikki")
        self.assertEqual(metadata["source_name"], "Kaikki/Wiktextract")
        self.assertEqual(metadata["variant"], "kaikki-full")

    def test_gzip_and_skip_fts(self):
        source = self.root / "source.jsonl.gz"
        self.write_jsonl([entry("Apple")], source)
        report = build_database(self.args(source=source, skip_fts=True))
        self.assertEqual(report["fts5_search_index"], "skipped")
        with sqlite3.connect(self.output) as conn:
            self.assertFalse(conn.execute("SELECT 1 FROM sqlite_master WHERE name='dictionary_search_fts'").fetchone())

    def test_atomic_output_preserves_existing_file_on_failure(self):
        self.output.write_bytes(b"existing-output")
        self.write_jsonl([entry("Apple")])
        with self.assertRaises(ZeroDivisionError):
            build_database(self.args(batch_size=0))
        self.assertEqual(self.output.read_bytes(), b"existing-output")

    def test_overlay_merges_optional_columns_and_apostrophes(self):
        path = self.make_overlay([
            {"word": "They’re", "tag": "toefl", "frq": 500, "bnc": 700, "collins": 2, "translation": "他们是"},
            {"word": "they're", "tag": "k12_stem", "frq": 100, "bnc": 300, "collins": 5, "phonetic": ""},
        ])
        overlay = load_overlay_from_sqlite(path)["they're"]
        self.assertEqual(overlay.tag, "toefl k12_stem")
        self.assertEqual(overlay.frq, 100)
        self.assertEqual(overlay.bnc, 300)
        self.assertEqual(overlay.collins, 5)
        self.assertIsNone(overlay.phonetic)

        minimal = self.root / "minimal.sqlite"
        with sqlite3.connect(minimal) as conn:
            conn.execute("CREATE TABLE dictionary_entries(word TEXT, normalized_word TEXT, tag TEXT)")
            conn.execute("INSERT INTO dictionary_entries VALUES ('Apple','apple','k12_science')")
        self.assertEqual(load_overlay_from_sqlite(minimal)["apple"].tag, "k12_science")

    def test_chinese_priority_and_structured_detail(self):
        full = TranslationOverlayRecord("charge", "全字典收费", source="wordfan-full-overlay")
        slim = TranslationOverlayRecord("charge", "核心收费", source="wordfan-slim-overlay")
        self.assertEqual(choose_chinese_translation("感官收费", "词条收费", full, slim), ("感官收费", "kaikki-sense"))
        self.assertEqual(choose_chinese_translation(None, "词条收费", full, slim), ("词条收费", "kaikki-entry"))
        self.assertEqual(choose_chinese_translation(None, None, full, slim), ("全字典收费", "wordfan-full-overlay"))
        self.assertEqual(choose_chinese_translation(None, None, None, slim), ("核心收费", "wordfan-slim-overlay"))
        self.assertEqual(choose_chinese_translation(None, None, None, None), (None, "none"))

        charge = {
            "word": "charge", "lang_code": "en", "pos": "noun", "categories": ["English lemmas"],
            "senses": [{
                "glosses": ["an amount of money paid"], "topics": ["finance"],
                "translations": [{"lang_code": "zh", "word": "费用"}],
                "examples": [{"text": "He said \"pay the charge\"."}, "A second example", "A third", "A fourth"],
                "tags": ["countable"],
            }],
        }
        report = self.build([charge])
        detail = json.loads(self.query("SELECT detail FROM dictionary_entries")[0][0])
        self.assertEqual(detail["displayMeanings"][0]["zh"], "费用")
        self.assertEqual(detail["displayMeanings"][0]["zhSource"], "kaikki-sense")
        self.assertEqual(detail["displayMeanings"][0]["domain"], "Finance")
        self.assertEqual(detail["detailedDefinitions"][0]["pos"], "Noun")
        self.assertEqual(len(detail["detailedDefinitions"][0]["senses"][0]["examples"]), 3)
        self.assertEqual(report["rows_with_kaikki_sense_chinese"], 1)
        self.assertEqual(report["selected_rows_with_kaikki_sense_chinese"], 1)
        self.assertEqual(report["available_rows_with_kaikki_sense_chinese"], 1)

    def test_compact_meanings_interleave_translated_senses_across_pos(self):
        noun = {
            "word": "charge", "lang_code": "en", "pos": "noun",
            "senses": [
                {"glosses": ["amount of money paid"], "translations": [{"lang_code": "zh", "word": "费用"}]},
                {"glosses": ["electric property"], "translations": [{"lang_code": "zh", "word": "电荷"}]},
                {"glosses": ["an accusation"], "translations": [{"lang_code": "zh", "word": "指控"}]},
            ],
        }
        verb = {
            "word": "charge", "lang_code": "en", "pos": "verb",
            "senses": [
                {"glosses": ["ask someone to pay"], "translations": [{"lang_code": "zh", "word": "收费"}]},
                {"glosses": ["supply electricity"], "translations": [{"lang_code": "zh", "word": "充电"}]},
            ],
        }
        self.build([noun, verb], max_compact_senses=5)
        detail = json.loads(self.query("SELECT detail FROM dictionary_entries")[0][0])
        compact = [(item["pos"], item["zh"], item["en"]) for item in detail["displayMeanings"]]
        self.assertEqual(compact, [
            ("n.", "费用", "amount of money paid"),
            ("v.", "收费", "ask someone to pay"),
            ("n.", "电荷", "electric property"),
            ("v.", "充电", "supply electricity"),
            ("n.", "指控", "an accusation"),
        ])

    def test_broad_chinese_detection_rejects_non_han_and_non_chinese(self):
        self.assertTrue(has_han_text("费用"))
        self.assertTrue(has_han_text("\uf900"))
        self.assertTrue(is_chinese_translation_item({"lang_code": "zh-Hant", "word": "費用"}))
        self.assertTrue(is_chinese_translation_item({"lang": "Mandarin Chinese", "word": "收费"}))
        self.assertTrue(is_chinese_translation_item({"language": "Simplified Chinese", "text": "收费"}))
        self.assertTrue(is_chinese_translation_item({"lang_code": "cmn-Hans", "translation": "收费"}))
        self.assertFalse(is_chinese_translation_item({"lang_code": "cmn", "word": "shōufèi"}))
        self.assertFalse(is_chinese_translation_item({"lang_code": "ja", "word": "料金"}))
        self.assertEqual(
            extract_chinese_translations({
                "translations": [
                    {"lang_code": "zh-Hant", "word": "費用"},
                    {"lang": "Mandarin Chinese", "word": "收费"},
                    {"lang_code": "cmn", "word": "shōufèi"},
                    {"lang_code": "fr", "word": "charge"},
                ],
            }),
            ["費用", "收费"],
        )
        report = self.build([entry("fee", translations=[{"lang_code": "zh-Hans", "word": "费用"}])])
        self.assertEqual(report["selected_rows_with_kaikki_entry_chinese"], 1)
        self.assertEqual(self.query("SELECT translation FROM dictionary_entries")[0][0], "费用")

    def test_chinese_family_variants_require_han_text(self):
        for code in ("cdo", "gan", "hsn"):
            self.assertTrue(is_chinese_translation_item({"lang_code": code, "word": "費用"}), code)
        for language in ("Hokkien", "Wu", "Gan", "Xiang"):
            self.assertTrue(is_chinese_translation_item({"lang": language, "word": "費用"}), language)
        self.assertFalse(is_chinese_translation_item({"lang": "Hokkien", "word": "hui-iong"}))
        self.assertFalse(is_chinese_translation_item({"lang": "Mandarin", "word": "fèiyòng"}))
        self.assertFalse(is_chinese_translation_item({"lang": "Japanese", "word": "料金"}))

        report = self.build([entry("fee", translations=[{"lang_code": "cdo", "word": "費用"}])])
        self.assertEqual(self.query("SELECT translation FROM dictionary_entries")[0][0], "費用")
        self.assertEqual(report["selected_rows_with_kaikki_entry_chinese"], 1)

    def test_unaligned_entry_chinese_is_general_fallback(self):
        value = {
            "word": "charge", "lang_code": "en", "pos": "noun",
            "senses": [
                {"glosses": ["an amount of money paid"]},
                {"glosses": ["an impetuous rush"]},
            ],
            "translations": [{"lang_code": "zh", "word": "费用；冲锋"}],
        }
        report = self.build([value])
        translation, detail_raw = self.query("SELECT translation,detail FROM dictionary_entries")[0]
        detail = json.loads(detail_raw)
        self.assertEqual(translation, "费用；冲锋")
        self.assertTrue(all(item["zh"] is None for item in detail["displayMeanings"]))
        self.assertEqual(detail["translationFallback"], {"zh": "费用；冲锋", "zhSource": "kaikki-entry"})
        self.assertEqual(report["selected_rows_with_kaikki_entry_chinese"], 1)

    def test_strongly_aligned_entry_chinese_attaches_to_matching_meaning(self):
        value = {
            "word": "charge", "lang_code": "en", "pos": "noun",
            "senses": [
                {"glosses": ["an amount of money paid"]},
                {"glosses": ["an impetuous rush"]},
            ],
            "translations": [{
                "lang_code": "zh", "word": "费用",
                "sense": "amount of money paid",
            }],
        }
        self.build([value])
        detail = json.loads(self.query("SELECT detail FROM dictionary_entries")[0][0])
        self.assertEqual(detail["displayMeanings"][0]["zh"], "费用")
        self.assertEqual(detail["displayMeanings"][0]["zhSource"], "kaikki-entry")
        self.assertNotIn("translationFallback", detail)
        self.assertEqual(self.query("SELECT translation FROM dictionary_entries")[0][0], "费用")

        report = json.loads(self.report.read_text(encoding="utf-8"))
        self.assertEqual(report["selected_rows_with_kaikki_entry_chinese"], 1)
        self.assertEqual(report["selected_rows_with_kaikki_sense_chinese"], 0)

    def test_missing_full_overlay_requires_explicit_allowance(self):
        self.write_jsonl([entry("apple")])
        args = self.args(allow_missing_full_overlay=False, full_translation_source_shards=self.root / "missing-shards")
        with self.assertRaises(ValueError) as caught:
            build_database(args)
        self.assertIn("Full WordFan Chinese overlay is required", str(caught.exception))
        failed_report = json.loads(self.report.read_text(encoding="utf-8"))
        self.assertTrue(failed_report["failed"])
        self.assertIn("not found", failed_report["full_translation_overlay_missing_reason"])

        report = build_database(self.args(allow_missing_full_overlay=True, full_translation_source_shards=self.root / "missing-shards"))
        self.assertFalse(report["full_translation_overlay_available"])
        self.assertIn("not found", report["full_translation_overlay_missing_reason"])

    def test_full_shards_are_manifest_driven(self):
        shards = self.make_full_shards(
            {"apple": ["apple", None, "fruit", "ECDICT", "苹果", "k12_science"]},
            stale_entries={"banana": ["banana", None, "fruit", "ECDICT", "香蕉", "stale"]},
        )
        overlay = load_translation_overlay_from_shards(shards)
        self.assertEqual(set(overlay), {"apple"})
        self.assertEqual(overlay["apple"].translation, "苹果")

        report = self.build([entry("apple")], full_translation_source_shards=shards)
        self.assertTrue(report["full_translation_overlay_available"])
        self.assertEqual(report["full_translation_overlay_shard_manifest_version"], "test.full-shards")
        self.assertEqual(report["selected_rows_with_full_dictionary_chinese_overlay"], 1)
        self.assertEqual(self.query("SELECT translation FROM dictionary_entries")[0][0], "苹果")

    def test_full_shards_fail_on_missing_manifest_or_listed_file(self):
        with self.assertRaises(FileNotFoundError):
            load_translation_overlay_from_shards(self.make_full_shards({}, omit_manifest=True))
        with self.assertRaises(FileNotFoundError):
            load_translation_overlay_from_shards(self.make_full_shards({}, omit_listed_shard=True))

    def test_word_level_overlay_is_translation_fallback_and_fts_searchable(self):
        overlay = self.make_overlay([{"word": "apple", "translation": "苹果", "tag": "k12_science", "frq": 10}])
        report = self.build([entry("apple", gloss="a fruit")], tag_source=overlay, slim_translation_source=overlay)
        translation, detail = self.query("SELECT translation,detail FROM dictionary_entries")[0]
        self.assertEqual(translation, "苹果")
        self.assertEqual(json.loads(detail)["translationFallback"]["zhSource"], "wordfan-slim-overlay")
        self.assertEqual(report["rows_with_slim_dictionary_chinese_overlay"], 1)
        self.assertEqual(self.query("SELECT count(*) FROM dictionary_search_fts WHERE dictionary_search_fts MATCH '苹果'")[0][0], 1)

    def test_inflections_from_forms_and_form_of_aliases(self):
        run = entry("run", "verb", "move quickly", forms=[
            {"form": "runs", "tags": ["third-person", "singular"]},
            {"form": "running", "tags": ["present", "participle"]},
            {"form": "run1", "tags": ["past"]},
        ])
        ran = {"word": "ran", "lang_code": "en", "pos": "verb", "senses": [{"form_of": [{"word": "run"}], "tags": ["past"], "glosses": ["past of run"]}]}
        excite = entry("excite", "verb", "cause enthusiasm", forms=[{"form": "excited", "tags": ["past", "participle"]}])
        excited = entry("excited", "adjective", "enthusiastic")
        report = self.build([run, ran, excite, excited])
        rows = dict(self.query("SELECT normalized_word,exchange FROM dictionary_entries"))
        self.assertIn("p:ran", rows["run"])
        self.assertIn("i:running", rows["run"])
        self.assertIn("3:runs", rows["run"])
        self.assertIn("d:excited", rows["excite"])
        self.assertIn("excited", rows)
        self.assertNotIn("ran", rows)
        self.assertGreaterEqual(report["forms_rejected_invalid"], 1)
        self.assertEqual(map_kaikki_form_tags_to_exchange_code(["past", "participle"]), "d")
        exchange_map = {}
        add_exchange_form(exchange_map, "p", "ran", "run")
        self.assertEqual(serialize_exchange(exchange_map), "p:ran")

    def test_real_kaikki_cmn_and_gloss_only_form_of_shapes(self):
        charge = {
            "word": "charge", "lang": "English", "lang_code": "en", "pos": "noun",
            "senses": [{"glosses": ["The amount of money levied for a service."]}],
            "translations": [{"lang": "Chinese Mandarin", "lang_code": "cmn", "sense": "amount of money levied for a service", "word": "费用, 收费"}],
        }
        run = entry("run", "verb", "move quickly")
        ran = {
            "word": "ran", "lang": "English", "lang_code": "en", "pos": "verb",
            "senses": [{"glosses": ["simple past of run"], "tags": ["form-of", "past"]}],
        }
        report = self.build([charge, run, ran])
        rows = {row[0]: row for row in self.query("SELECT normalized_word,translation,detail,exchange FROM dictionary_entries")}
        self.assertEqual(rows["charge"][1], "费用, 收费")
        self.assertEqual(json.loads(rows["charge"][2])["displayMeanings"][0]["zhSource"], "kaikki-entry")
        self.assertIn("p:ran", rows["run"][3])
        self.assertNotIn("ran", rows)
        self.assertEqual(report["form_of_aliases_attached"], 1)

    def test_stem_overlay_and_supplements(self):
        overlay = self.make_overlay([
            {"word": "isosceles", "definition": "having two equal sides", "translation": "等腰的", "tag": "k12_math"},
            {"word": "momentum", "definition": "quantity of motion", "translation": "动量", "tag": "ap_physics"},
            {"word": "derivative", "definition": "rate of change", "translation": "导数", "tag": "ap_calculus_ab"},
            {"word": "rhombus", "definition": "quadrilateral", "translation": "菱形", "tag": "k12_math"},
            {"word": "eigenvalue", "definition": "linear algebra value", "translation": "特征值", "tag": "linear_algebra_extension"},
        ])
        report = self.build([entry("isosceles"), entry("momentum")], tag_source=overlay, slim_translation_source=overlay)
        rows = {row[0]: row for row in self.query("SELECT normalized_word,tag,translation,source,detail FROM dictionary_entries")}
        self.assertEqual(rows["isosceles"][2], "等腰的")
        self.assertIn("ap_physics", rows["momentum"][1])
        self.assertIn("derivative", rows)
        self.assertEqual(json.loads(rows["derivative"][4])["supplement"]["reason"], "missing-from-kaikki")
        self.assertEqual(report["missing_stem_rows_appended"], 3)
        self.assertEqual(self.query("SELECT count(*) FROM dictionary_search_fts")[0][0], report["final_rows"])

    def test_slim_builder_keeps_stem_rows_with_tiny_target(self):
        overlay = self.make_overlay([
            {"word": "isosceles", "definition": "x", "tag": "k12_math"},
            {"word": "derivative", "definition": "x", "tag": "ap_calculus_ab"},
            {"word": "eigenvalue", "definition": "x", "tag": "linear_algebra_extension"},
        ])
        self.build([entry("plain")], tag_source=overlay, slim_translation_source=overlay)
        slim = self.root / "slim.sqlite"
        import sys
        original = sys.argv
        try:
            sys.argv = ["build_slim_dictionary.py", "--input", str(self.output), "--output", str(slim), "--target-rows", "1"]
            self.assertEqual(build_slim_main(), 0)
        finally:
            sys.argv = original
        with sqlite3.connect(slim) as conn:
            terms = {row[0] for row in conn.execute("SELECT normalized_word FROM dictionary_entries")}
        self.assertTrue({"isosceles", "derivative", "eigenvalue"} <= terms)


if __name__ == "__main__":
    unittest.main()
