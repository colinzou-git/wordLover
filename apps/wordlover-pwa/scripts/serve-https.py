import argparse
import http.server
import json
import ssl
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse


class WordLoverHandler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".wasm": "application/wasm",
        ".webmanifest": "application/manifest+json",
        ".sqlite": "application/vnd.sqlite3",
    }

    def end_headers(self):
        # "same-origin-allow-popups" (NOT "same-origin") is required for Google sign-in:
        # COOP:same-origin nulls window.opener for the cross-origin accounts.google.com
        # popup, so the OAuth token can never post back and sign-in silently hangs. The
        # allow-popups variant keeps cross-origin isolation for the page while letting the
        # popups it opens communicate back. The shipping sql.js engine does not need full
        # crossOriginIsolated; revisit if/when the threaded wa-sqlite engine lands.
        self.send_header("Cross-Origin-Opener-Policy", "same-origin-allow-popups")
        self.send_header("Cross-Origin-Embedder-Policy", "require-corp")
        super().end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/__test_results":
            self._send_result_index()
            return
        if parsed.path == "/__test_results/latest":
            self._send_latest_result()
            return
        super().do_GET()

    def _results_dir(self):
        return Path(__file__).resolve().parents[1] / "received-results"

    def _send_json(self, payload, status=200):
        response = json.dumps(payload, indent=2, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(response)))
        self.end_headers()
        self.wfile.write(response)

    def _send_result_index(self):
        results_dir = self._results_dir()
        results = []
        if results_dir.exists():
            for path in sorted(results_dir.glob("*.json"), key=lambda item: item.stat().st_mtime, reverse=True):
                results.append({
                    "name": path.name,
                    "bytes": path.stat().st_size,
                    "updatedAt": datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).isoformat(),
                })
        self._send_json({"results": results})

    def _send_latest_result(self):
        results_dir = self._results_dir()
        if not results_dir.exists():
            self._send_json({"error": "No received results yet"}, status=404)
            return
        files = sorted(results_dir.glob("*.json"), key=lambda item: item.stat().st_mtime, reverse=True)
        if not files:
            self._send_json({"error": "No received results yet"}, status=404)
            return
        self._send_json(json.loads(files[0].read_text(encoding="utf-8")))

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path != "/__test_results":
            self.send_error(404, "Not Found")
            return

        content_length = int(self.headers.get("Content-Length", "0"))
        if content_length <= 0 or content_length > 10 * 1024 * 1024:
            self.send_error(400, "Invalid result payload size")
            return

        body = self.rfile.read(content_length)
        try:
            payload = json.loads(body.decode("utf-8"))
        except json.JSONDecodeError:
            self.send_error(400, "Result payload must be JSON")
            return

        timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        user_agent = str(payload.get("diagnostics", {}).get("userAgent", "unknown"))
        device = "iphone" if "iPhone" in user_agent else "ipad" if "iPad" in user_agent else "browser"
        results_dir = self._results_dir()
        results_dir.mkdir(parents=True, exist_ok=True)
        output_path = results_dir / f"{timestamp}-{device}-test-results.json"
        output_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")

        self._send_json({"ok": True, "path": str(output_path)})


def main():
    parser = argparse.ArgumentParser(description="Serve the WordLover PWA product app over HTTPS.")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8443)
    parser.add_argument(
        "--public",
        default=str(Path(__file__).resolve().parents[1] / "public"),
    )
    parser.add_argument("--cert", default=str(Path(__file__).resolve().parents[1] / "certs" / "server-cert.pem"))
    parser.add_argument("--key", default=str(Path(__file__).resolve().parents[1] / "certs" / "server-key.pem"))
    args = parser.parse_args()

    public = Path(args.public).resolve()
    cert = Path(args.cert).resolve()
    key = Path(args.key).resolve()
    if not public.exists():
        raise SystemExit(f"Public directory not found: {public}")
    if not cert.exists() or not key.exists():
        raise SystemExit("HTTPS cert/key not found. Run create-local-ca-and-cert.ps1 first.")

    handler = lambda *handler_args, **handler_kwargs: WordLoverHandler(
        *handler_args,
        directory=str(public),
        **handler_kwargs,
    )
    server = http.server.ThreadingHTTPServer((args.host, args.port), handler)
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(certfile=str(cert), keyfile=str(key))
    server.socket = context.wrap_socket(server.socket, server_side=True)
    print(f"Serving {public} at https://{args.host}:{args.port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
