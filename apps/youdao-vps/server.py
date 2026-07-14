#!/usr/bin/env python3
"""Small VPS service that turns Youdao's mobile dictionary HTML into WordFan JSON."""

from __future__ import annotations

import argparse
import datetime as dt
import html
import json
import re
import sqlite3
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

TERM_RE = re.compile(r"^[A-Za-z]+(?:[ '\-][A-Za-z]+){0,5}$")
UPSTREAM = "https://m.youdao.com/dict?le=eng&q={}"


def text_content(fragment: str) -> str:
    value = re.sub(r"<[^>]+>", "", fragment)
    return re.sub(r"\s+", " ", html.unescape(value)).strip()


def parse_youdao_html(source: str, term: str) -> dict:
    section_match = re.search(r'<div id="ec"[^>]*>(.*?)</div>\s*</div>', source, re.S)
    if not section_match:
        raise ValueError("Youdao returned no basic definition")
    section = section_match.group(1)
    headword_match = re.search(r"<h2[^>]*>\s*<span[^>]*>(.*?)</span>", section, re.S)
    headword = text_content(headword_match.group(1)) if headword_match else term
    phonetics = [text_content(value) for value in re.findall(r'<span class="phonetic">(.*?)</span>', section, re.S)]
    list_match = re.search(r"<ul[^>]*>(.*?)</ul>", section, re.S)
    definitions = [] if not list_match else [text_content(value) for value in re.findall(r"<li[^>]*>(.*?)</li>", list_match.group(1), re.S)]
    definitions = [value for value in definitions if value]
    if not definitions:
        raise ValueError("Youdao returned no definitions")
    forms = []
    for raw in re.findall(r'<p class="grey">(.*?)</p>', section, re.S):
        value = text_content(raw)
        parts = value.rsplit(" ", 1)
        if len(parts) == 2:
            forms.append({"name": parts[0], "value": parts[1]})
    normalized = term.lower()
    return {
        "schemaVersion": 1,
        "provider": {"id": "youdao", "label": "Youdao"},
        "normalizedTerm": normalized,
        "headword": headword,
        "sourceUrl": UPSTREAM.format(urllib.parse.quote(term)),
        "retrievedAt": dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z"),
        "parserVersion": "youdao-mobile-html-v1",
        "phonetics": {
            **({"uk": phonetics[0]} if phonetics else {}),
            **({"us": phonetics[1]} if len(phonetics) > 1 else {}),
        },
        "chineseDefinitions": [{"text": value} for value in definitions],
        "englishDefinitions": [],
        "wordForms": forms,
        "phrases": [],
        "examples": [],
        "synonyms": [],
        "antonyms": [],
        "domains": [],
    }


class LookupStore:
    def __init__(self, path: Path):
        self.connection = sqlite3.connect(path, check_same_thread=False)
        self.connection.execute("CREATE TABLE IF NOT EXISTS lookups (term TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at TEXT NOT NULL)")

    def get(self, term: str) -> dict | None:
        row = self.connection.execute("SELECT payload FROM lookups WHERE term = ?", (term,)).fetchone()
        return json.loads(row[0]) if row else None

    def put(self, term: str, payload: dict) -> None:
        self.connection.execute(
            "INSERT OR REPLACE INTO lookups(term, payload, updated_at) VALUES (?, ?, ?)",
            (term, json.dumps(payload, ensure_ascii=False), payload["retrievedAt"]),
        )
        self.connection.commit()


def fetch_entry(term: str) -> dict:
    request = urllib.request.Request(UPSTREAM.format(urllib.parse.quote(term)), headers={"User-Agent": "Mozilla/5.0 WordFan/1.0"})
    with urllib.request.urlopen(request, timeout=8) as response:
        return parse_youdao_html(response.read().decode("utf-8"), term)


def make_handler(store: LookupStore):
    class Handler(BaseHTTPRequestHandler):
        def send_json(self, status: int, payload: dict) -> None:
            body = json.dumps(payload, ensure_ascii=False).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", self.headers.get("Origin", "*"))
            self.send_header("Vary", "Origin")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            parsed = urllib.parse.urlparse(self.path)
            if parsed.path == "/health":
                return self.send_json(200, {"ok": True})
            if parsed.path not in {"/lookup", "/v1/dictionary/youdao"}:
                return self.send_json(404, {"error": "not_found"})
            term = urllib.parse.parse_qs(parsed.query).get("term", [""])[0].strip()
            if not TERM_RE.fullmatch(term):
                return self.send_json(400, {"error": "invalid_term"})
            refresh = urllib.parse.parse_qs(parsed.query).get("refresh", ["0"])[0] == "1"
            try:
                entry = None if refresh else store.get(term.lower())
                if entry is None:
                    entry = fetch_entry(term)
                    store.put(term.lower(), entry)
                return self.send_json(200, entry)
            except Exception as error:
                return self.send_json(502, {"error": "upstream_failed", "message": str(error)})

        def log_message(self, fmt, *args):
            print(f"{self.address_string()} {fmt % args}")

    return Handler


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8788)
    parser.add_argument("--database", type=Path, default=Path("youdao-lookups.sqlite"))
    args = parser.parse_args()
    ThreadingHTTPServer((args.host, args.port), make_handler(LookupStore(args.database))).serve_forever()


if __name__ == "__main__":
    main()
