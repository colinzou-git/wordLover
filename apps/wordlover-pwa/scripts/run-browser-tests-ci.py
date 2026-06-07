#!/usr/bin/env python3
"""Local-CI wrapper: create dictionary, start server, run browser tests, stop server.

Replicates the GitHub Actions smoke job locally so a fresh checkout can run the
same PR-safe browser test path with one command:

    cd apps/wordlover-pwa && npm run test:browser:ci

Exit code mirrors run-browser-tests.py.
"""
from __future__ import annotations

import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request
from contextlib import contextmanager
from pathlib import Path

ROOT = Path(__file__).parent.parent
PUBLIC = ROOT / "public"
SCRIPTS = ROOT / "scripts"
PORT = 4173
BASE = f"http://127.0.0.1:{PORT}"

# Files create-ci-dictionary.py overwrites in the served public dir. On a dev
# machine these are the shipped production dictionary, so we snapshot and restore
# them around the fixture-based test run instead of leaving the 17-row fixture in
# place. (In a throwaway CI checkout there is nothing to lose; restore is a no-op
# beyond rewriting identical bytes.)
DICTIONARY_FILES = ("dictionary-manifest.json", "dictionary.sqlite", "dictionary.sqlite.zst")


@contextmanager
def preserved_dictionary():
    """Restore the served dictionary after the run, even on failure/Ctrl-C."""
    backup_dir = Path(tempfile.mkdtemp(prefix="wordfan-dict-backup-"))
    present = []
    for name in DICTIONARY_FILES:
        src = PUBLIC / name
        if src.exists():
            shutil.copy2(src, backup_dir / name)
            present.append(name)
    try:
        yield
    finally:
        for name in DICTIONARY_FILES:
            target = PUBLIC / name
            saved = backup_dir / name
            if name in present:
                shutil.copy2(saved, target)
            elif target.exists():
                # Nothing was here before (e.g. fresh checkout) — drop the fixture.
                target.unlink()
        shutil.rmtree(backup_dir, ignore_errors=True)
        if present:
            print("--- Restored production dictionary in public/ ---", flush=True)


def wait_for_server(timeout: int = 30) -> bool:
    for _ in range(timeout):
        try:
            urllib.request.urlopen(f"{BASE}/", timeout=1)
            return True
        except Exception:
            time.sleep(1)
    return False


def main() -> int:
    with preserved_dictionary():
        print("--- Creating CI dictionary ---", flush=True)
        subprocess.run(
            [sys.executable, str(SCRIPTS / "create-ci-dictionary.py"), "--force"],
            check=True,
        )

        print(f"--- Starting HTTP server on port {PORT} ---", flush=True)
        server = subprocess.Popen(
            [sys.executable, "-m", "http.server", str(PORT), "--directory", str(PUBLIC)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        try:
            if not wait_for_server():
                print("Server did not start in time.", file=sys.stderr)
                return 1

            print("--- Running browser tests ---", flush=True)
            result = subprocess.run(
                [sys.executable, str(SCRIPTS / "run-browser-tests.py"), "--base", BASE],
                check=False,
            )
            return result.returncode
        finally:
            server.terminate()


if __name__ == "__main__":
    raise SystemExit(main())
