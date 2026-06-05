"""
Zip the WordFan project, skipping large dictionary files and the git history.

Usage:
    python scripts/zip-project.py [output.zip]

Output defaults to wordfan-<YYYYMMDD>.zip in the project root.
"""

import sys
import zipfile
import os
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

SKIP_DIRS = {".git", "__pycache__", "received-results"}
SKIP_EXTENSIONS = {".sqlite", ".zst"}
# Keep dictionary-report.json even though it lives in data/
SKIP_NAMES = set()

def should_skip(path: Path) -> bool:
    for part in path.parts:
        if part in SKIP_DIRS:
            return True
    if path.suffix.lower() in SKIP_EXTENSIONS:
        return True
    return False

def main():
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / f"wordfan-{date.today().strftime('%Y%m%d')}.zip"
    out = out.resolve()

    skipped = []
    added = 0

    with zipfile.ZipFile(out, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        for path in sorted(ROOT.rglob("*")):
            if path == out or not path.is_file():
                continue
            rel = path.relative_to(ROOT)
            if should_skip(rel):
                skipped.append(str(rel))
                continue
            zf.write(path, rel)
            added += 1

    size_mb = out.stat().st_size / 1_048_576
    print(f"Created: {out}  ({size_mb:.1f} MB, {added} files)")
    if skipped:
        print(f"Skipped {len(skipped)} file(s):")
        for s in skipped:
            print(f"  {s}")

if __name__ == "__main__":
    main()
