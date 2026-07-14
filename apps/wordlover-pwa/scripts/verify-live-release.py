#!/usr/bin/env python3
"""Poll and validate the production release, always writing a diagnostic JSON report."""
import argparse, json, time, urllib.error, urllib.request
from datetime import datetime, timezone
from pathlib import Path

def now(): return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

parser = argparse.ArgumentParser()
parser.add_argument("--base", default="https://wordfan.app")
parser.add_argument("--commit", required=True)
parser.add_argument("--app-version", required=True)
parser.add_argument("--build-id", required=True)
parser.add_argument("--shell-cache", required=True)
parser.add_argument("--asset-version", required=True)
parser.add_argument("--attempts", type=int, default=36)
parser.add_argument("--delay", type=float, default=10)
parser.add_argument("--report", required=True)
args = parser.parse_args()
report = {"expected": vars(args), "observed": {"release": None, "assets": []}, "attempts": 0, "startedAt": now(), "completedAt": None, "success": False, "failureKind": None}

def fetch(path, retries=1):
    last_error = None
    for attempt in range(1, retries + 1):
        request = urllib.request.Request(args.base.rstrip("/") + path, headers={"Cache-Control": "no-cache", "User-Agent": "WordFan-deploy-verifier"})
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return response.status, response.headers.get("Content-Type", ""), response.read()
        except (urllib.error.URLError, ConnectionError, TimeoutError) as error:
            last_error = error
            if attempt < retries: time.sleep(2 * attempt)
    raise last_error

try:
    release = None
    for attempt in range(1, args.attempts + 1):
        report["attempts"] = attempt
        try:
            status, mime, body = fetch(f"/release.json?deploy={args.commit}-{attempt}")
            release = json.loads(body)
            report["observed"]["release"] = release
            if release.get("commit") == args.commit: break
            report["failureKind"] = "old release still served"
        except json.JSONDecodeError: report["failureKind"] = "invalid JSON"
        except urllib.error.HTTPError as error: report["failureKind"] = f"HTTP status {error.code}"
        except urllib.error.URLError as error: report["failureKind"] = "TLS/connectivity" if "SSL" in str(error) else "DNS resolution or connectivity"
        if attempt < args.attempts: time.sleep(args.delay)
    if not release or release.get("commit") != args.commit: raise RuntimeError("propagation timeout")
    for key, expected in [("appVersion", args.app_version), ("buildId", args.build_id), ("shellCache", args.shell_cache)]:
        if release.get(key) != expected: report["failureKind"] = f"wrong {key}"; raise RuntimeError(report["failureKind"])
    checks = [("/", "text/html"), (f"/app.js?v={args.asset_version}", "javascript"), ("/sw.js", "javascript"), (f"/update-manager.js?v={args.asset_version}", "javascript"), (f"/styles.css?v={args.asset_version}", "text/css"), ("/manifest.webmanifest", "manifest"), ("/vendor/sql-wasm.wasm", "wasm")]
    for path, kind in checks:
        status, mime, body = fetch(path + ("&" if "?" in path else "?") + f"deploy={args.commit}", retries=3)
        html = body[:100].lstrip().lower().startswith((b"<!doctype html", b"<html"))
        item = {"path": path, "status": status, "contentType": mime, "bytes": len(body), "html": html}
        report["observed"]["assets"].append(item)
        if status != 200: report["failureKind"] = "missing asset"; raise RuntimeError(path)
        if kind != "text/html" and html: report["failureKind"] = "HTML returned for executable asset"; raise RuntimeError(path)
        if kind not in mime.lower(): report["failureKind"] = "wrong MIME type"; raise RuntimeError(f"{path}: {mime}")
        text = body.decode("utf-8", errors="ignore")
        if path.startswith("/app.js") and (args.app_version not in text or args.build_id not in text): report["failureKind"] = "wrong app version or build stamp"; raise RuntimeError(path)
        if path == "/sw.js" and (args.shell_cache not in text or args.build_id not in text): report["failureKind"] = "wrong service-worker cache or build stamp"; raise RuntimeError(path)
    report["success"] = True; report["failureKind"] = None
except Exception as error:
    report["failureKind"] = report["failureKind"] or str(error)
    raise
finally:
    report["completedAt"] = now()
    path = Path(args.report); path.parent.mkdir(parents=True, exist_ok=True); path.write_text(json.dumps(report, indent=2), encoding="utf-8")
