import json
import tempfile
import unittest
from pathlib import Path

from scripts.build_kaikki_preview import PREVIEW_RELATIVE, package_preview, validate_output


class KaikkiPreviewPackagingTests(unittest.TestCase):
    def test_rejects_production_root(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            public = Path(temp) / "public"
            with self.assertRaises(ValueError):
                validate_output(public, public)

    def test_packages_only_under_isolated_preview_path(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            public = root / "public"
            source = root / "prepared"
            source.mkdir()
            (source / "dictionary.sqlite").write_bytes(b"sqlite")
            (source / "dictionary.sqlite.zst").write_bytes(b"zstd")
            (source / "dictionary-manifest.json").write_text(
                json.dumps({"variant": "ci-fixture"}), encoding="utf-8"
            )
            (source / "dictionary-full").mkdir()
            (source / "dictionary-full/manifest.json").write_text("{}", encoding="utf-8")
            production_sentinel = public / "dictionary-manifest.json"
            production_sentinel.parent.mkdir(parents=True)
            production_sentinel.write_text("production", encoding="utf-8")

            output = public / PREVIEW_RELATIVE
            package_preview(source, output, public)

            self.assertEqual((output / "dictionary.sqlite").read_bytes(), b"sqlite")
            self.assertEqual(production_sentinel.read_text(encoding="utf-8"), "production")


if __name__ == "__main__":
    unittest.main()
