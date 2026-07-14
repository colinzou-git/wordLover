#!/usr/bin/env python3
"""Small VPS service that turns Youdao's mobile dictionary HTML into WordFan JSON."""

from __future__ import annotations

import argparse
import datetime as dt
import html
import json
import re
import sqlite3
import threading
import urllib.parse
import urllib.request
import unicodedata
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

TERM_RE = re.compile(r"^[A-Za-z]+(?:[ '\-][A-Za-z]+){0,5}$")
UPSTREAM = "https://m.youdao.com/dict?le=eng&q={}"
PROVIDER_ID = "youdao"
ENTRY_SCHEMA_VERSION = 1


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


def normalize_term(value: str) -> str:
    value = unicodedata.normalize("NFKC", str(value or "")).replace("‘", "'").replace("’", "'").replace("ʼ", "'").replace("`", "'").replace("＇", "'")
    return re.sub(r"\s+", " ", value).strip().lower()


def validate_entry(payload: dict, expected_term: str) -> dict:
    if not isinstance(payload, dict):
        raise ValueError("Cached payload is not an object")
    if payload.get("schemaVersion") != ENTRY_SCHEMA_VERSION:
        raise ValueError("Cached payload schema is unsupported")
    if payload.get("provider", {}).get("id") != PROVIDER_ID:
        raise ValueError("Cached payload provider is invalid")
    if normalize_term(payload.get("normalizedTerm")) != normalize_term(expected_term):
        raise ValueError("Cached payload term does not match")
    if not payload.get("parserVersion") or not payload.get("retrievedAt"):
        raise ValueError("Cached payload metadata is incomplete")
    definitions = list(payload.get("chineseDefinitions") or []) + list(payload.get("englishDefinitions") or [])
    if not any(isinstance(item, dict) and str(item.get("text") or "").strip() for item in definitions):
        raise ValueError("Cached payload contains no usable definition")
    return payload


class LookupStore:
    def __init__(self, path: Path):
        self.path = path
        self.lock = threading.RLock()
        self._migrate()

    def _connect(self):
        connection = sqlite3.connect(self.path, timeout=10)
        connection.execute("PRAGMA busy_timeout = 10000")
        return connection

    def _migrate(self) -> None:
        with self.lock, self._connect() as connection:
            columns = [row[1] for row in connection.execute("PRAGMA table_info(lookups)")]
            legacy_rows = []
            if columns and "normalized_term" not in columns:
                legacy_rows = list(connection.execute("SELECT term, payload, updated_at FROM lookups"))
                connection.execute("ALTER TABLE lookups RENAME TO lookups_legacy")
            connection.execute("""
                CREATE TABLE IF NOT EXISTS lookups (
                    provider_id TEXT NOT NULL,
                    normalized_term TEXT NOT NULL,
                    entry_schema_version INTEGER NOT NULL,
                    parser_version TEXT NOT NULL,
                    payload TEXT NOT NULL,
                    source_retrieved_at TEXT NOT NULL,
                    cached_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    PRIMARY KEY (provider_id, normalized_term, entry_schema_version)
                )
            """)
            for term, raw_payload, updated_at in legacy_rows:
                try:
                    payload = validate_entry(json.loads(raw_payload), term)
                    self._put_with_connection(connection, normalize_term(term), payload, updated_at)
                except (ValueError, TypeError, json.JSONDecodeError):
                    pass
            if legacy_rows or "lookups_legacy" in [row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type='table'")]:
                connection.execute("DROP TABLE IF EXISTS lookups_legacy")

    def get(self, term: str) -> dict | None:
        normalized = normalize_term(term)
        with self.lock, self._connect() as connection:
            row = connection.execute(
                "SELECT payload, cached_at FROM lookups WHERE provider_id = ? AND normalized_term = ? AND entry_schema_version = ?",
                (PROVIDER_ID, normalized, ENTRY_SCHEMA_VERSION),
            ).fetchone()
            if not row:
                return None
            try:
                return {"entry": validate_entry(json.loads(row[0]), normalized), "cachedAt": row[1]}
            except (ValueError, TypeError, json.JSONDecodeError):
                connection.execute(
                    "DELETE FROM lookups WHERE provider_id = ? AND normalized_term = ? AND entry_schema_version = ?",
                    (PROVIDER_ID, normalized, ENTRY_SCHEMA_VERSION),
                )
                return None

    def _put_with_connection(self, connection, term: str, payload: dict, cached_at: str | None = None) -> str:
        payload = validate_entry(payload, term)
        now = dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z")
        cached_at = cached_at or now
        connection.execute(
            """INSERT OR REPLACE INTO lookups(
                provider_id, normalized_term, entry_schema_version, parser_version, payload,
                source_retrieved_at, cached_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (PROVIDER_ID, normalize_term(term), ENTRY_SCHEMA_VERSION, payload["parserVersion"], json.dumps(payload, ensure_ascii=False), payload["retrievedAt"], cached_at, now),
        )
        return cached_at

    def put(self, term: str, payload: dict) -> str:
        with self.lock, self._connect() as connection:
            return self._put_with_connection(connection, normalize_term(term), payload)

    def resolve(self, term: str, refresh: bool, fetcher) -> tuple[dict, str, str]:
        normalized = normalize_term(term)
        # The lock deliberately covers the personal upstream call so simultaneous cache misses
        # cannot duplicate retrieval or race SQLite replacement.
        with self.lock:
            existing = self.get(normalized)
            if existing and not refresh:
                return existing["entry"], "HIT", existing["cachedAt"]
            entry = validate_entry(fetcher(normalized), normalized)
            cached_at = self.put(normalized, entry)
            return entry, "REFRESH" if refresh else "MISS", cached_at


def fetch_entry(term: str) -> dict:
    request = urllib.request.Request(UPSTREAM.format(urllib.parse.quote(term)), headers={"User-Agent": "Mozilla/5.0 WordFan/1.0"})
    with urllib.request.urlopen(request, timeout=8) as response:
        return parse_youdao_html(response.read().decode("utf-8"), term)


def make_handler(store: LookupStore, fetcher=fetch_entry):
    class Handler(BaseHTTPRequestHandler):
        def send_json(self, status: int, payload: dict, extra_headers: dict | None = None) -> None:
            body = json.dumps(payload, ensure_ascii=False).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", self.headers.get("Origin", "*"))
            self.send_header("Vary", "Origin")
            self.send_header("Content-Length", str(len(body)))
            for name, value in (extra_headers or {}).items():
                self.send_header(name, value)
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            parsed = urllib.parse.urlparse(self.path)
            if parsed.path == "/health":
                return self.send_json(200, {"ok": True})
            if parsed.path not in {"/lookup", "/v1/dictionary/youdao"}:
                return self.send_json(404, {"error": "not_found"})
            term = normalize_term(urllib.parse.parse_qs(parsed.query).get("term", [""])[0])
            if not TERM_RE.fullmatch(term):
                return self.send_json(400, {"error": "invalid_term"})
            refresh = urllib.parse.parse_qs(parsed.query).get("refresh", ["0"])[0] == "1"
            try:
                entry, cache_status, cached_at = store.resolve(term, refresh, fetcher)
                return self.send_json(200, entry, {"X-WordFan-Cache": cache_status, "X-WordFan-Gateway-Cached-At": cached_at})
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
