import json
import tempfile
import unittest
from argparse import Namespace
from pathlib import Path
from unittest.mock import patch

from scripts.package_kaikki_dictionary import (
    MAX_PUBLIC_SQLITE_BYTES,
    SLIM_DETAIL_POLICY,
    build_slim_kaikki,
    build_full_kaikki,
    main,
    parse_args,
    preview_output,
    snapshot_production_paths,
    validate_preview_output,
    validate_public_sqlite_assets,
)
import scripts.package_kaikki_dictionary as package_module


class PackageKaikkiDictionaryTests(unittest.TestCase):
    def test_parse_args_exposes_both_full_overlay_sources(self):
        args = parse_args([
            "--source", "kaikki.jsonl",
            "--full-translation-source", "full.sqlite",
            "--full-translation-source-shards", "dictionary-full",
        ])
        self.assertEqual(args.full_translation_source, Path("full.sqlite"))
        self.assertEqual(args.full_translation_source_shards, Path("dictionary-full"))
        self.assertEqual(args.slim_detail_policy, "full")

    def test_slim_builder_passes_selected_detail_policy(self):
        args = Namespace(work_dir=Path("work"), version="test", target_rows=10, slim_detail_policy="none")
        with patch("scripts.package_kaikki_dictionary.run_command") as run:
            build_slim_kaikki(args, Path("full.sqlite"))
        command = run.call_args.args[0]
        self.assertEqual(command[command.index("--detail-policy") + 1], "none")

    def test_build_wrapper_passes_full_overlay_arguments(self):
        args = Namespace(
            source=Path("kaikki.jsonl"), work_dir=Path("work"), version="test",
            tag_source=Path("slim.sqlite"), tag_source_shards=Path("tag-shards"),
            full_translation_source=Path("full.sqlite"),
            full_translation_source_shards=Path("full-shards"),
            allow_missing_full_overlay=True,
        )
        with patch("scripts.package_kaikki_dictionary.run_command") as run:
            build_full_kaikki(args)
        command = run.call_args.args[0]
        self.assertIn("--full-translation-source", command)
        self.assertIn("full.sqlite", command)
        self.assertIn("--full-translation-source-shards", command)
        self.assertIn("full-shards", command)
        self.assertIn("--allow-missing-full-overlay", command)

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
            summary = json.loads((root / "work/kaikki-package-summary.json").read_text(encoding="utf-8"))
            self.assertEqual(summary["slimDetailPolicy"], SLIM_DETAIL_POLICY)
            self.assertEqual(summary["outputSubdir"], "kaikki-preview/local")
            self.assertEqual(summary["fullTranslationOverlaySource"]["type"], "tag-source-shards-default")

    def test_release_builds_under_kaikki_and_preserves_root_assets(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "kaikki.jsonl"
            source.write_text(json.dumps({
                "word": "free", "lang_code": "en", "pos": "adj",
                "senses": [{"glosses": ["without needing to pay"]}],
            }) + "\n", encoding="utf-8")
            public = root / "public"
            production_manifest = public / "dictionary-manifest.json"
            production_manifest.parent.mkdir(parents=True)
            production_manifest.write_text("production-root", encoding="utf-8")
            result = main([
                "--source", str(source), "--work-dir", str(root / "work"),
                "--public-dir", str(public), "--output-subdir", "kaikki",
                "--tag-source", str(root / "missing.sqlite"),
                "--tag-source-shards", str(root / "missing-shards"),
                "--version", "release.test", "--target-rows", "10", "--shard-count", "2",
                "--allow-missing-full-overlay",
            ])
            self.assertEqual(result, 0)
            output = public / "kaikki"
            self.assertTrue((output / "dictionary.sqlite").is_file())
            self.assertTrue((output / "dictionary.sqlite.zst").is_file())
            self.assertTrue((output / "dictionary-full/manifest.json").is_file())
            manifest = json.loads((output / "dictionary-manifest.json").read_text(encoding="utf-8"))
            self.assertEqual(manifest["dictionaryId"], "kaikki")
            self.assertEqual(manifest["dictionaryLabel"], "Kaikki / Wiktextract")
            self.assertEqual(production_manifest.read_text(encoding="utf-8"), "production-root")
            summary = json.loads((root / "work/kaikki-package-summary.json").read_text(encoding="utf-8"))
            self.assertEqual(summary["outputSubdir"], "kaikki")
            self.assertFalse(summary["productionPathsChanged"])
            self.assertEqual(summary["publicSqliteSafety"]["runtimeSqlite"], "dictionary.sqlite")
            self.assertGreater(summary["publicSqliteSafety"]["runtimeSqliteBytes"], 0)
            self.assertEqual(summary["slimRowCount"], manifest["rowCount"])
            self.assertEqual(summary["fullShardCount"], 2)
            self.assertGreater(summary["fullShardRowCount"], 0)

    def test_public_sqlite_guard_allows_only_slim_dictionary(self):
        with tempfile.TemporaryDirectory() as temp:
            output = Path(temp) / "kaikki"
            output.mkdir()
            (output / "dictionary.sqlite").write_bytes(b"slim")
            result = validate_public_sqlite_assets(output)
            self.assertEqual(result["sqliteFiles"], ["dictionary.sqlite"])

            (output / "dictionary-kaikki.sqlite").write_bytes(b"full")
            with self.assertRaisesRegex(RuntimeError, "Unexpected SQLite"):
                validate_public_sqlite_assets(output)

    def test_public_sqlite_guard_rejects_large_runtime_sqlite(self):
        with tempfile.TemporaryDirectory() as temp:
            output = Path(temp) / "kaikki"
            output.mkdir()
            (output / "dictionary.sqlite").write_bytes(b"12345")
            original_limit = package_module.MAX_PUBLIC_SQLITE_BYTES
            try:
                package_module.MAX_PUBLIC_SQLITE_BYTES = 4
                with self.assertRaisesRegex(RuntimeError, "too large"):
                    validate_public_sqlite_assets(output)
            finally:
                package_module.MAX_PUBLIC_SQLITE_BYTES = original_limit

    def test_unsafe_output_subdir_is_rejected(self):
        with self.assertRaises(SystemExit):
            parse_args(["--source", "kaikki.jsonl", "--output-subdir", "../dictionary-full"])
        with tempfile.TemporaryDirectory() as temp:
            with self.assertRaisesRegex(ValueError, "Unsafe Kaikki output"):
                preview_output(Path(temp), "../unsafe")

    def test_production_snapshot_detects_manifest_and_full_shard_changes(self):
        with tempfile.TemporaryDirectory() as temp:
            public = Path(temp)
            manifest = public / "dictionary-manifest.json"
            shard = public / "dictionary-full/shard-00.json.gz"
            shard.parent.mkdir(parents=True)
            manifest.write_text("before", encoding="utf-8")
            shard.write_bytes(b"before")
            before = snapshot_production_paths(public)
            manifest.write_text("after", encoding="utf-8")
            self.assertNotEqual(before, snapshot_production_paths(public))
            manifest.write_text("before", encoding="utf-8")
            self.assertEqual(before, snapshot_production_paths(public))
            shard.write_bytes(b"after")
            self.assertNotEqual(before, snapshot_production_paths(public))

    def test_missing_production_paths_are_stable(self):
        with tempfile.TemporaryDirectory() as temp:
            public = Path(temp)
            self.assertEqual(snapshot_production_paths(public), snapshot_production_paths(public))

    def test_packaging_fails_if_production_manifest_changes_during_run(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "kaikki.jsonl"
            source.write_text(json.dumps({
                "word": "run", "lang_code": "en", "pos": "verb",
                "senses": [{"glosses": ["move quickly"]}],
            }) + "\n", encoding="utf-8")
            public = root / "public"
            production = public / "dictionary-manifest.json"
            production.parent.mkdir(parents=True)
            production.write_text("before", encoding="utf-8")
            original = package_module.package_slim_web

            def mutate_after_packaging(args, slim_db):
                output = original(args, slim_db)
                production.write_text("changed", encoding="utf-8")
                return output

            argv = [
                "--source", str(source), "--work-dir", str(root / "work"),
                "--public-dir", str(public), "--tag-source", str(root / "missing.sqlite"),
                "--tag-source-shards", str(root / "missing-shards"), "--version", "test.kaikki",
                "--target-rows", "10", "--shard-count", "2", "--allow-missing-full-overlay",
            ]
            with patch("scripts.package_kaikki_dictionary.package_slim_web", side_effect=mutate_after_packaging):
                with self.assertRaisesRegex(RuntimeError, "protected production dictionary paths"):
                    main(argv)
            summary = json.loads((root / "work/kaikki-package-summary.json").read_text(encoding="utf-8"))
            self.assertTrue(summary["productionPathsChanged"])


if __name__ == "__main__":
    unittest.main()
