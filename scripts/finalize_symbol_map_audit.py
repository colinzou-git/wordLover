#!/usr/bin/env python3
"""Generate the final symbol map while leaving only that map changed for CI to commit."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

FINAL_CI_BLOB = "bf7cf1fe564edc4337699a57fe31f72aa1ead3ad"
TEMPORARY_FILES = (
    "scripts/__init__.py",
    "scripts/generate_code_map_original.py",
    "scripts/finalize_symbol_map_audit.py",
)


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    workflow_path = root / ".github/workflows/ci.yml"
    map_path = root / "docs/ai/AUTO_SYMBOL_MAP.md"

    saved_workflow = workflow_path.read_bytes()
    saved_temporary_files = {
        root / relative: (root / relative).read_bytes()
        for relative in TEMPORARY_FILES
        if (root / relative).is_file()
    }

    try:
        if subprocess.run(
            ["git", "rev-parse", "--is-shallow-repository"],
            cwd=root,
            check=True,
            capture_output=True,
            text=True,
        ).stdout.strip() == "true":
            subprocess.run(["git", "fetch", "--unshallow", "origin"], cwd=root, check=True)
        else:
            subprocess.run(["git", "fetch", "origin"], cwd=root, check=True)

        final_workflow = subprocess.check_output(
            ["git", "cat-file", "-p", FINAL_CI_BLOB],
            cwd=root,
        )
        workflow_path.write_bytes(final_workflow)
        for path in saved_temporary_files:
            path.unlink(missing_ok=True)

        subprocess.run(
            [sys.executable, "scripts/generate_code_map.py"],
            cwd=root,
            check=True,
        )
        generated_map = map_path.read_bytes()
    finally:
        workflow_path.write_bytes(saved_workflow)
        for path, content in saved_temporary_files.items():
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(content)

    map_path.write_bytes(generated_map)

    status = subprocess.check_output(
        ["git", "status", "--short"],
        cwd=root,
        text=True,
    )
    changed_paths = [line[3:] for line in status.splitlines() if len(line) >= 4]
    if changed_paths != ["docs/ai/AUTO_SYMBOL_MAP.md"]:
        raise SystemExit(f"Unexpected audit-finalizer changes: {changed_paths}")

    print("Generated the final cleaned-tree symbol map; only the map is staged for the CI commit.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
