"""Regression smoke for the iPhone Google-sign-in headers.

The HTTPS dev server (serve-https.py) must send
  Cross-Origin-Opener-Policy: same-origin-allow-popups
NOT "same-origin". COOP:same-origin nulls window.opener for the cross-origin
Google sign-in popup, so the OAuth token can never post back and login hangs
silently on iPhone. This test boots the real HTTPS server and checks the header.

Skips gracefully (exit 0) if the local cert/key are not present.
"""
from __future__ import annotations

import http.client
import socket
import ssl
import subprocess
import sys
import time
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent
SERVE = SCRIPTS / "serve-https.py"
CERTS = SCRIPTS.parent / "certs"
CERT = CERTS / "server-cert.pem"
KEY = CERTS / "server-key.pem"


def free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def main() -> int:
    if not CERT.exists() or not KEY.exists():
        print("SKIP: local HTTPS cert/key not present (run create-local-ca-and-cert.ps1).", flush=True)
        return 0

    port = free_port()
    proc = subprocess.Popen(
        [sys.executable, str(SERVE), "--host", "127.0.0.1", "--port", str(port),
         "--cert", str(CERT), "--key", str(KEY)],
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
    )
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    failures: list[str] = []
    try:
        # Wait for the server to accept TLS connections.
        coop = None
        coep = None
        deadline = time.time() + 15
        last_error = None
        while time.time() < deadline:
            try:
                conn = http.client.HTTPSConnection("127.0.0.1", port, context=ctx, timeout=3)
                conn.request("GET", "/index.html")
                resp = conn.getresponse()
                resp.read()
                coop = resp.getheader("Cross-Origin-Opener-Policy")
                coep = resp.getheader("Cross-Origin-Embedder-Policy")
                conn.close()
                break
            except Exception as exc:  # noqa: BLE001
                last_error = exc
                time.sleep(0.4)

        print(f"COOP={coop!r} COEP={coep!r}", flush=True)
        if coop is None:
            failures.append(f"could not read headers from HTTPS server (last error: {last_error})")
        else:
            if coop != "same-origin-allow-popups":
                failures.append(f"COOP must be 'same-origin-allow-popups' for Google sign-in, got {coop!r}")
            if coop == "same-origin":
                failures.append("COOP:same-origin will break the Google sign-in popup on iPhone")
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()

    if failures:
        print("\nFAILED:", flush=True)
        for f in failures:
            print(f"  - {f}", flush=True)
        return 1
    print("\nPASS", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
