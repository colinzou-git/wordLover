import argparse
import http.server
import json
import ssl
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse


class PocHandler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".wasm": "application/wasm",
        ".webmanifest": "application/manifest+json",
        ".sqlite": "application/vnd.sqlite3",
    }

    def end_headers(self):
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Embedder-Policy", "require-corp")
        super().end_headers()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path != "/__poc_results":
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
        results_dir = Path(__file__).resolve().parent / "received-results"
        results_dir.mkdir(parents=True, exist_ok=True)
        output_path = results_dir / f"{timestamp}-{device}-poc-results.json"
        output_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")

        response = json.dumps({"ok": True, "path": str(output_path)}, ensure_ascii=False).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(response)))
        self.end_headers()
        self.wfile.write(response)


def main():
    parser = argparse.ArgumentParser(description="Serve the WordLover PWA POC over HTTPS.")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8443)
    parser.add_argument(
        "--public",
        default=str(Path(__file__).resolve().parents[1] / "windows-pwa" / "public"),
    )
    parser.add_argument("--cert", default=str(Path(__file__).resolve().parent / "certs" / "server-cert.pem"))
    parser.add_argument("--key", default=str(Path(__file__).resolve().parent / "certs" / "server-key.pem"))
    args = parser.parse_args()

    public = Path(args.public).resolve()
    cert = Path(args.cert).resolve()
    key = Path(args.key).resolve()
    if not public.exists():
        raise SystemExit(f"Public directory not found: {public}")
    if not cert.exists() or not key.exists():
        raise SystemExit("HTTPS cert/key not found. Run create-local-ca-and-cert.ps1 first.")

    handler = lambda *handler_args, **handler_kwargs: PocHandler(
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
