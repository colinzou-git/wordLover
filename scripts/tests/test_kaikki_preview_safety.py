import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


class KaikkiPreviewSafetyTests(unittest.TestCase):
    def test_workflow_is_manual_artifact_only(self) -> None:
        workflow = (ROOT / ".github/workflows/kaikki-preview.yml").read_text(encoding="utf-8")
        trigger = workflow.split("permissions:", 1)[0]
        self.assertIn("workflow_dispatch:", trigger)
        self.assertNotIn("push:", trigger)
        self.assertNotIn("pull_request:", trigger)
        self.assertIn("ref: feature/kaikki-dictionary-preview", workflow)
        self.assertIn("actions/upload-artifact@", workflow)
        self.assertNotIn("git push", workflow)
        self.assertNotIn("git checkout gh-pages", workflow)

    def test_generated_preview_directory_is_ignored(self) -> None:
        ignore = (ROOT / ".gitignore").read_text(encoding="utf-8")
        self.assertIn("apps/wordlover-pwa/public/kaikki-preview/", ignore)


if __name__ == "__main__":
    unittest.main()
