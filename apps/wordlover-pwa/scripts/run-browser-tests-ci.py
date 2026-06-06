#!/usr/bin/env python3
"""Local-CI wrapper: create dictionary, start server, run browser tests, stop server.

Replicates the GitHub Actions smoke job locally so a fresh checkout can run the
same PR-safe browser test path with one command:

    cd apps/wordlover-pwa && npm run test:browser:ci

Exit code mirrors run-browser-tests.py.
"""
from __future__ import annotations

import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).parent.parent
PUBLIC = ROOT / "public"
SCRIPTS = ROOT / "scripts"
PORT = 4173
BASE = f"http://127.0.0.1:{PORT}"


def wait_for_server(timeout: int = 30) -> bool:
    for _ in range(timeout):
        try:
            urllib.request.urlopen(f"{BASE}/", timeout=1)
            return True
        except Exception:
            time.sleep(1)
    return False


def main() -> int:
    print("--- Creating CI dictionary ---", flush=True)
    subprocess.run([sys.executable, str(SCRIPTS / "create-ci-dictionary.py")], check=True)

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
