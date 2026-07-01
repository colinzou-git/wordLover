import json
import tempfile
import unittest
from pathlib import Path

from scripts.package_kaikki_dictionary import main, preview_output, validate_preview_output


class PackageKaikkiDictionaryTests(unittest.TestCase):
    def test_rejects_production_root(self):
        with tempfile.TemporaryDirectory() as temp:
            public = Path(temp) / "public"
            with self.assertRaises(ValueError):
                validate_preview_output(public, public)

    def test_builds_only_isolated_preview_package(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "kaikki.jsonl"
            source.write_text(
                json.dumps({
                    "word": "run", "lang_code": "en", "pos": "verb",
                    "senses": [{"glosses": ["move quickly"]}],
                    "forms": [{"form": "running", "tags": ["present", "participle"]}],
                }) + "\n",
                encoding="utf-8",
            )
            public = root / "public"
            production_manifest = public / "dictionary-manifest.json"
            production_manifest.parent.mkdir(parents=True)
            production_manifest.write_text("production", encoding="utf-8")
            result = main([
                "--source", str(source), "--work-dir", str(root / "work"),
                "--public-dir", str(public), "--tag-source", str(root / "missing.sqlite"),
                "--tag-source-shards", str(root / "missing-shards"), "--version", "test.kaikki",
                "--target-rows", "10", "--shard-count", "2", "--allow-missing-full-overlay",
            ])
            self.assertEqual(result, 0)
            output = preview_output(public)
            self.assertTrue((output / "dictionary.sqlite").is_file())
            self.assertTrue((output / "dictionary.sqlite.zst").is_file())
            self.assertTrue((output / "dictionary-full/manifest.json").is_file())
            manifest = json.loads((output / "dictionary-manifest.json").read_text(encoding="utf-8"))
            self.assertEqual(manifest["variant"], "kaikki-slim")
            self.assertIn("Kaikki/Wiktextract", manifest["sources"])
            self.assertEqual(production_manifest.read_text(encoding="utf-8"), "production")


if __name__ == "__main__":
    unittest.main()
