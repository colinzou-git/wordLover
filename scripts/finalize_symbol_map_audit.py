#!/usr/bin/env python3
"""Clean temporary audit files and regenerate the final symbol map."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    workflow_path = root / ".github/workflows/ci.yml"
    workflow = workflow_path.read_text(encoding="utf-8")
    temporary_permissions = "\npermissions:\n  contents: write\n\njobs:\n"
    if temporary_permissions not in workflow:
        raise SystemExit("Temporary CI write-permission block is missing")
    workflow_path.write_text(workflow.replace(temporary_permissions, "\njobs:\n", 1), encoding="utf-8")

    for relative in (
        "scripts/__init__.py",
        "scripts/generate_code_map_original.py",
        "scripts/finalize_symbol_map_audit.py",
    ):
        (root / relative).unlink(missing_ok=True)

    subprocess.run(
        [sys.executable, "scripts/generate_code_map.py"],
        cwd=root,
        check=True,
    )
    subprocess.run(
        [sys.executable, "scripts/generate_code_map.py", "--check"],
        cwd=root,
        check=True,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
