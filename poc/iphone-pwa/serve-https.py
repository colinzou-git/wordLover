import argparse
import http.server
import ssl
from pathlib import Path


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
