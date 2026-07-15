import json
import sqlite3
import tempfile
import threading
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from server import LookupStore, normalize_term, parse_youdao_html


def fixture(term="charge", marker="one"):
    return {
        "schemaVersion": 1,
        "provider": {"id": "youdao", "label": "Youdao"},
        "normalizedTerm": term,
        "headword": term,
        "sourceUrl": f"https://m.youdao.com/dict?le=eng&q={term}",
        "retrievedAt": "2026-07-14T00:00:00Z",
        "parserVersion": f"fixture-{marker}",
        "chineseDefinitions": [{"text": f"定义-{marker}"}],
        "englishDefinitions": [],
    }


class ParserTests(unittest.TestCase):
    def test_basic_entry(self):
        source = '''<div id="ec" class="trans-container ec"><h2><span>charge</span><div><span>英 <span class="phonetic">[UK]</span></span><span>美 <span class="phonetic">[US]</span></span></div></h2><ul><li>v. 充电；收费</li><li>n. 费用</li></ul><div class="sub"><p class="grey">过去式 charged</p></div></div></div>'''
        entry = parse_youdao_html(source, "charge")
        self.assertEqual(entry["provider"]["label"], "Youdao")
        self.assertEqual(entry["phonetics"], {"uk": "[UK]", "us": "[US]"})
        self.assertEqual([item["text"] for item in entry["chineseDefinitions"]], ["v. 充电；收费", "n. 费用"])
        self.assertEqual(entry["wordForms"], [{"name": "过去式", "value": "charged"}])

    def test_normalization(self):
        self.assertEqual(normalize_term("  They’re  "), "they're")


class LookupStoreTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name) / "lookups.sqlite"

    def tearDown(self):
        self.temp.cleanup()

    def test_cache_survives_restart_and_refresh_is_atomic(self):
        calls = 0
        def fetch(term):
            nonlocal calls
            calls += 1
            return fixture(term, str(calls))
        store = LookupStore(self.path)
        first, status, _ = store.resolve("charge", False, fetch)
        self.assertEqual((status, calls), ("MISS", 1))
        restarted = LookupStore(self.path)
        second, status, _ = restarted.resolve(" CHARGE ", False, fetch)
        self.assertEqual((status, calls, second["parserVersion"]), ("HIT", 1, first["parserVersion"]))
        with self.assertRaises(RuntimeError):
            restarted.resolve("charge", True, lambda _term: (_ for _ in ()).throw(RuntimeError("upstream down")))
        retained, status, _ = restarted.resolve("charge", False, fetch)
        self.assertEqual((status, retained["parserVersion"], calls), ("HIT", "fixture-1", 1))
        refreshed, status, _ = restarted.resolve("charge", True, fetch)
        self.assertEqual((status, refreshed["parserVersion"], calls), ("REFRESH", "fixture-2", 2))

    def test_legacy_migration_retains_valid_rows(self):
        connection = sqlite3.connect(self.path)
        connection.execute("CREATE TABLE lookups (term TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at TEXT NOT NULL)")
        connection.execute("INSERT INTO lookups VALUES (?, ?, ?)", ("charge", json.dumps(fixture()), "2026-07-14T00:00:00Z"))
        connection.commit(); connection.close()
        self.assertEqual(LookupStore(self.path).get("charge")["entry"]["headword"], "charge")

    def test_invalid_row_is_repaired(self):
        store = LookupStore(self.path)
        store.put("charge", fixture())
        with sqlite3.connect(self.path) as connection:
            connection.execute("UPDATE lookups SET payload = ?", (json.dumps({"schemaVersion": 99}),))
        calls = 0
        def fetch(term):
            nonlocal calls
            calls += 1
            return fixture(term, "repaired")
        entry, status, _ = store.resolve("charge", False, fetch)
        self.assertEqual((status, calls, entry["parserVersion"]), ("MISS", 1, "fixture-repaired"))

    def test_concurrent_misses_fetch_once(self):
        store = LookupStore(self.path)
        calls = 0
        call_lock = threading.Lock()
        def fetch(term):
            nonlocal calls
            with call_lock: calls += 1
            return fixture(term)
        with ThreadPoolExecutor(max_workers=8) as pool:
            results = list(pool.map(lambda _: store.resolve("they're", False, fetch), range(8)))
        self.assertEqual(calls, 1)
        self.assertEqual({result[1] for result in results}, {"MISS", "HIT"})


if __name__ == "__main__":
    unittest.main()
