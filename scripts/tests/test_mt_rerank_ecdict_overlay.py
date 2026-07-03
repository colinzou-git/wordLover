import json
import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from scripts.rerank_ecdict_overlay_with_mt import (
    CharacterRateLimiter,
    MockMTProvider,
    GoogleTranslateProvider,
    choose_mt_source_text,
    match_mt_to_candidates,
    parse_args,
    rerank_candidates_by_mt,
    run,
    split_zh_candidates,
    _batches,
)


class CountingMockProvider(MockMTProvider):
    pass


class FailingSecondBatchProvider(MockMTProvider):
    def translate_batch(self, texts, source_lang, target_lang):
        if self.request_count == 1:
            raise RuntimeError("deterministic second-batch failure")
        return super().translate_batch(texts, source_lang, target_lang)


class MtRerankTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.db = self.root / "dictionary.sqlite"
        self.cache = self.root / "cache.sqlite"
        self.report = self.root / "report.json"
        with sqlite3.connect(self.db) as conn:
            conn.execute("""
              CREATE TABLE dictionary_entries(
                id INTEGER PRIMARY KEY, word TEXT, normalized_word TEXT, pos TEXT,
                definition TEXT, translation TEXT, detail TEXT, frq INTEGER, bnc INTEGER
              )
            """)

    def tearDown(self):
        self.temp.cleanup()

    def add_row(self, word="free", translation="自由的, 免费的, 空闲的", *,
                source="wordfan-full-overlay", definition="adj. without needing to pay",
                detail=None, frq=10):
        if detail is None:
            detail = {
                "detailedDefinitions": [{"pos": "Adjective", "senses": [{"definition": "without needing to pay"}]}],
                "translationFallback": {"zh": translation, "zhSource": source},
            }
        with sqlite3.connect(self.db) as conn:
            conn.execute(
                "INSERT INTO dictionary_entries(word,normalized_word,pos,definition,translation,detail,frq,bnc) VALUES(?,?,?,?,?,?,?,?)",
                (word, word, "adj.", definition, translation,
                 detail if isinstance(detail, str) else json.dumps(detail, ensure_ascii=False), frq, None),
            )

    def args(self, *extra):
        return parse_args([
            "--db", str(self.db), "--cache", str(self.cache), "--provider", "mock",
            "--report", str(self.report), "--limit", "100", *extra,
        ])

    def test_split_candidates_preserves_order_and_dedupes(self):
        self.assertEqual(
            split_zh_candidates("负责, 收费，控告; 充电、收费/供电|负载\n责任"),
            ["负责", "收费", "控告", "充电", "供电", "负载", "责任"],
        )

    def test_matching_and_reranking_rules(self):
        candidates = ["自由的", "免费的", "空闲的", "收费"]
        exact = match_mt_to_candidates("收费", candidates)
        self.assertEqual(exact.matched_candidates, ["收费"])
        self.assertEqual(exact.confidence, 1.0)
        suffix = match_mt_to_candidates("免费", candidates)
        self.assertEqual(suffix.matched_candidates, ["免费的"])
        self.assertEqual(suffix.confidence, 0.95)
        changed = rerank_candidates_by_mt(candidates, "免费", 0.85)
        self.assertEqual(changed.reordered_candidates, ["免费的", "自由的", "空闲的", "收费"])
        self.assertTrue(changed.changed)
        already = rerank_candidates_by_mt(candidates, "自由", 0.85)
        self.assertFalse(already.changed)
        no_match = rerank_candidates_by_mt(candidates, "费用", 0.90)
        self.assertEqual(no_match.reordered_candidates, candidates)
        multiple = rerank_candidates_by_mt(candidates, "收费；免费", 0.85)
        self.assertEqual(multiple.reordered_candidates, ["收费", "免费的", "自由的", "空闲的"])

    def test_character_overlap_is_disabled_by_default_and_opt_in(self):
        self.assertIsNone(match_mt_to_candidates("费用", ["自由的"], min_confidence=0.75))
        self.assertIsNone(match_mt_to_candidates("科学", ["学科"], min_confidence=0.85))
        self.assertIsNone(match_mt_to_candidates("甲", ["乙"], min_confidence=0))
        opted_in = match_mt_to_candidates(
            "科学研究", ["研究科学"], min_confidence=0.85, allow_character_overlap=True,
        )
        self.assertEqual(opted_in.matched_candidates, ["研究科学"])

    def test_rate_limit_and_batch_size_validation(self):
        with self.assertRaisesRegex(ValueError, "above chars-per-minute"):
            CharacterRateLimiter(10).wait_for(11)
        with self.assertRaisesRegex(ValueError, "above request-chars-max"):
            list(_batches([{"source_text": "eleven chars"}], 10, 5))
        with self.assertRaises(SystemExit):
            self.args("--request-chars-max", "101", "--chars-per-minute", "100")

    def test_source_text_priority_and_cleanup(self):
        self.add_row(detail={
            "displayMeanings": [{"en": "v. concise sense"}],
            "detailedDefinitions": [{"senses": [{"definition": "long definition"}]}],
            "translationFallback": {"zh": "甲,乙", "zhSource": "wordfan-full-overlay"},
        })
        with sqlite3.connect(self.db) as conn:
            conn.row_factory = sqlite3.Row
            source, context = choose_mt_source_text(conn.execute("SELECT * FROM dictionary_entries").fetchone())
        self.assertEqual(source, "concise sense")
        self.assertEqual(context["source"], "displayMeaning")

    def test_dry_run_cache_and_apply_metadata(self):
        self.add_row()
        provider = CountingMockProvider({"without needing to pay": "免费"})
        report, passed = run(self.args("--dry-run"), provider)
        self.assertTrue(passed)
        self.assertEqual(report["rowsChanged"], 1)
        self.assertEqual(provider.request_count, 1)
        with sqlite3.connect(self.db) as conn:
            row = conn.execute("SELECT translation,detail FROM dictionary_entries").fetchone()
        self.assertEqual(row[0], "自由的, 免费的, 空闲的")
        self.assertNotIn("zhOriginal", json.loads(row[1])["translationFallback"])

        cached_provider = CountingMockProvider({})
        cached_report, passed = run(self.args("--apply", "--resume"), cached_provider)
        self.assertTrue(passed)
        self.assertEqual(cached_report["cacheHits"], 1)
        self.assertEqual(cached_provider.request_count, 0)
        with sqlite3.connect(self.db) as conn:
            translation, detail_raw = conn.execute("SELECT translation,detail FROM dictionary_entries").fetchone()
        fallback = json.loads(detail_raw)["translationFallback"]
        self.assertEqual(translation, "免费的, 自由的, 空闲的")
        self.assertEqual(fallback["zh"], translation)
        self.assertEqual(fallback["zhOriginal"], "自由的, 免费的, 空闲的")
        self.assertEqual(fallback["zhDisplayOrderSource"], "mt-reranked-ecdict")
        self.assertEqual(fallback["mtRerank"]["matchedCandidate"], "免费的")
        self.assertEqual(fallback["mtRerank"]["confidence"], 0.95)
        self.assertTrue(fallback["mtRerank"]["changed"])
        self.assertTrue(cached_report["resumeRequested"])
        self.assertTrue(cached_report["cacheReuseEnabled"])
        self.assertEqual(cached_report["rowsApplied"], 1)

    def test_apply_is_atomic_on_provider_failure_and_partial_is_explicit(self):
        self.add_row(word="free", definition="without needing to pay")
        self.add_row(word="charge", translation="负责, 收费", definition="to ask someone to pay money")
        original = {}
        with sqlite3.connect(self.db) as conn:
            original = dict(conn.execute("SELECT word,translation FROM dictionary_entries"))
        report, passed = run(
            self.args("--apply", "--batch-size", "1"),
            FailingSecondBatchProvider({"without needing to pay": "免费"}),
        )
        self.assertFalse(passed)
        self.assertTrue(report["providerFailed"])
        self.assertTrue(report["applyRolledBack"])
        self.assertEqual(report["rowsApplied"], 0)
        with sqlite3.connect(self.db) as conn:
            self.assertEqual(dict(conn.execute("SELECT word,translation FROM dictionary_entries")), original)

        partial, passed = run(
            self.args("--apply", "--batch-size", "1", "--force-refresh", "--continue-on-errors"),
            FailingSecondBatchProvider({"without needing to pay": "免费"}),
        )
        self.assertTrue(passed)
        self.assertEqual(partial["status"], "partial")
        self.assertTrue(partial["providerFailed"])
        self.assertGreaterEqual(partial["rowsApplied"], 1)

    def test_resume_reporting_cache_reuse_and_force_refresh(self):
        self.add_row()
        first, _ = run(self.args(), CountingMockProvider({"without needing to pay": "免费"}))
        self.assertFalse(first["resumeRequested"])
        self.assertTrue(first["cacheReuseEnabled"])
        cached_provider = CountingMockProvider({})
        cached, _ = run(self.args(), cached_provider)
        self.assertEqual(cached["cacheHits"], 1)
        self.assertEqual(cached_provider.request_count, 0)
        refreshed_provider = CountingMockProvider({"without needing to pay": "免费"})
        refreshed, _ = run(self.args("--force-refresh"), refreshed_provider)
        self.assertFalse(refreshed["cacheReuseEnabled"])
        self.assertEqual(refreshed_provider.request_count, 1)

    def test_decision_audit_key_includes_source_text(self):
        self.add_row()
        run(self.args(), CountingMockProvider({"without needing to pay": "免费"}))
        with sqlite3.connect(self.db) as conn:
            detail = json.loads(conn.execute("SELECT detail FROM dictionary_entries").fetchone()[0])
            detail["detailedDefinitions"][0]["senses"][0]["definition"] = "available without payment"
            conn.execute("UPDATE dictionary_entries SET definition=?, detail=?", (
                "available without payment", json.dumps(detail, ensure_ascii=False),
            ))
        run(self.args("--force-refresh"), CountingMockProvider({"available without payment": "免费"}))
        with sqlite3.connect(self.cache) as conn:
            self.assertEqual(conn.execute("SELECT count(*) FROM mt_rerank_decisions").fetchone()[0], 2)
        run(self.args("--force-refresh"), CountingMockProvider({"available without payment": "免费"}))
        with sqlite3.connect(self.cache) as conn:
            self.assertEqual(conn.execute("SELECT count(*) FROM mt_rerank_decisions").fetchone()[0], 2)

    def test_native_malformed_single_and_no_gloss_are_counted(self):
        self.add_row(word="native", source="kaikki-entry")
        self.add_row(word="broken", detail="{bad")
        self.add_row(word="single", translation="唯一")
        self.add_row(word="nogloss", definition="", detail={
            "translationFallback": {"zh": "甲, 乙", "zhSource": "wordfan-full-overlay"},
        })
        report, passed = run(self.args(), CountingMockProvider())
        self.assertTrue(passed)
        self.assertEqual(report["rowsSkippedNonOverlaySource"], 1)
        self.assertEqual(report["rowsSkippedMalformedDetail"], 1)
        self.assertEqual(report["rowsSkippedSingleCandidate"], 1)
        self.assertEqual(report["rowsSkippedNoGloss"], 1)
        with sqlite3.connect(self.db) as conn:
            native = conn.execute("SELECT translation FROM dictionary_entries WHERE word='native'").fetchone()[0]
        self.assertEqual(native, "自由的, 免费的, 空闲的")

    def test_mock_provider_is_offline_and_deterministic(self):
        provider = MockMTProvider({"hello": "你好"})
        self.assertEqual(provider.translate_batch(["hello", "unknown"], "en", "zh-CN"), ["你好", "unknown"])

    def test_google_provider_batches_and_preserves_result_order(self):
        class Response:
            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return False

            def read(self):
                return json.dumps({
                    "data": {"translations": [{"translatedText": "免费"}, {"translatedText": "收费"}]},
                }).encode()

        provider = GoogleTranslateProvider(api_key="test-key", chars_per_minute=100_000)
        with patch("urllib.request.urlopen", return_value=Response()) as request:
            values = provider.translate_batch(["free", "charge"], "en", "zh-CN")
        self.assertEqual(values, ["免费", "收费"])
        self.assertEqual(provider.request_count, 1)
        body = json.loads(request.call_args.args[0].data)
        self.assertEqual(body["q"], ["free", "charge"])
        self.assertEqual(body["source"], "en")
        self.assertEqual(body["target"], "zh-CN")


if __name__ == "__main__":
    unittest.main()
