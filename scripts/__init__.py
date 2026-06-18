"""Temporary audit helper for exporting the generated symbol map in CI."""
from __future__ import annotations

import importlib.util
import os
from pathlib import Path


def _export_audit_symbol_map() -> None:
    if os.environ.get("GITHUB_ACTIONS") != "true":
        return
    root = Path(__file__).resolve().parents[1]
    generator_path = root / "scripts/generate_code_map.py"
    spec = importlib.util.spec_from_file_location("wordfan_generate_code_map", generator_path)
    if spec is None or spec.loader is None:
        return
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    files, skipped = module.discover_source_files(root)
    fresh = module.render_map(root, files, skipped)
    output = root / "docs/ai/AUTO_SYMBOL_MAP.md"
    output.write_text(fresh, encoding="utf-8")
    artifact = root / "apps/wordlover-pwa/test-results/AUTO_SYMBOL_MAP.md"
    artifact.parent.mkdir(parents=True, exist_ok=True)
    artifact.write_text(fresh, encoding="utf-8")


try:
    _export_audit_symbol_map()
except Exception as error:
    print(f"Audit symbol-map export skipped: {error}")
