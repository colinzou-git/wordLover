#!/usr/bin/env python3
"""Use build-time MT hints to reorder existing WordFan Chinese candidates."""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import os
import random
import re
import sqlite3
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import deque
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable


DEFAULT_REPORT = Path("data/kaikki-build/mt-rerank-report.json")
PROVIDER_MODEL = {"mock": "deterministic-v1", "google": "google-translate-v2"}
OVERLAY_SOURCES = {"wordfan-full-overlay", "wordfan-slim-overlay"}
SPLIT_RE = re.compile(r"[,，;；、/|\n]+")
POS_PREFIX_RE = re.compile(r"^(?:n|v|adj|adv|prep|pron|conj|interj|phr)\.\s*", re.I)


@dataclass
class MatchDecision:
    matched_candidates: list[str]
    confidence: float
    reason: str


@dataclass
class RerankDecision:
    reordered_candidates: list[str]
    matched_candidates: list[str]
    confidence: float
    changed: bool
    reason: str


class MTProvider:
    name = "base"
    model = "unknown"

    def __init__(self) -> None:
        self.request_count = 0
        self.request_characters = 0

    def translate_batch(self, texts: list[str], source_lang: str, target_lang: str) -> list[str]:
        raise NotImplementedError


class MockMTProvider(MTProvider):
    name = "mock"
    model = PROVIDER_MODEL["mock"]

    def __init__(self, mappings: dict[str, str] | None = None) -> None:
        super().__init__()
        self.mappings = mappings or {
            "without needing to pay": "免费",
            "to ask someone to pay money": "收费",
            "to supply electricity": "充电",
        }

    def translate_batch(self, texts: list[str], source_lang: str, target_lang: str) -> list[str]:
        self.request_count += 1
        self.request_characters += sum(len(text) for text in texts)
        return [self.mappings.get(text, text) for text in texts]


class CharacterRateLimiter:
    def __init__(self, chars_per_minute: int) -> None:
        self.limit = max(1, chars_per_minute)
        self.events: deque[tuple[float, int]] = deque()

    def wait_for(self, chars: int) -> None:
        while True:
            now = time.monotonic()
            while self.events and now - self.events[0][0] >= 60:
                self.events.popleft()
            used = sum(value for _, value in self.events)
            if used + chars <= self.limit:
                self.events.append((now, chars))
                return
            time.sleep(max(0.01, 60 - (now - self.events[0][0])))


class GoogleTranslateProvider(MTProvider):
    name = "google"
    model = PROVIDER_MODEL["google"]

    def __init__(self, api_key: str | None = None, chars_per_minute: int = 100_000, max_attempts: int = 5) -> None:
        super().__init__()
        self.api_key = api_key or os.environ.get("GOOGLE_TRANSLATE_API_KEY")
        if not self.api_key:
            raise ValueError("GOOGLE_TRANSLATE_API_KEY is required for --provider google")
        self.rate_limiter = CharacterRateLimiter(chars_per_minute)
        self.max_attempts = max_attempts

    def translate_batch(self, texts: list[str], source_lang: str, target_lang: str) -> list[str]:
        chars = sum(len(text) for text in texts)
        self.rate_limiter.wait_for(chars)
        payload = json.dumps({"q": texts, "source": source_lang, "target": target_lang, "format": "text"}).encode()
        url = "https://translation.googleapis.com/language/translate/v2?" + urllib.parse.urlencode({"key": self.api_key})
        for attempt in range(self.max_attempts):
            try:
                request = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
                with urllib.request.urlopen(request, timeout=60) as response:
                    data = json.loads(response.read().decode("utf-8"))
                values = [html.unescape(item["translatedText"]) for item in data["data"]["translations"]]
                if len(values) != len(texts):
                    raise RuntimeError("Google Translate returned a different number of results")
                self.request_count += 1
                self.request_characters += chars
                return values
            except urllib.error.HTTPError as error:
                body = error.read().decode("utf-8", "replace")
                retryable = error.code in {429, 500, 502, 503, 504} or (
                    error.code == 403 and re.search(r"quota|rate", body, re.I)
                )
                if not retryable or attempt + 1 >= self.max_attempts:
                    raise RuntimeError(f"Google Translate HTTP {error.code}: {body[:500]}") from error
            except (urllib.error.URLError, TimeoutError) as error:
                if attempt + 1 >= self.max_attempts:
                    raise RuntimeError(f"Google Translate request failed: {error}") from error
            time.sleep(min(60, 2 ** attempt + random.random()))
        raise RuntimeError("Google Translate retries exhausted")


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", type=Path, required=True)
    parser.add_argument("--cache", type=Path, required=True)
    parser.add_argument("--provider", choices=("mock", "google"), required=True)
    parser.add_argument("--target-lang", default="zh-CN")
    parser.add_argument("--source-lang", default="en")
    ranks = parser.add_mutually_exclusive_group()
    ranks.add_argument("--rank-max", type=int, default=50_000)
    ranks.add_argument("--all-ranks", action="store_true")
    parser.add_argument("--limit", type=int, default=5_000)
    parser.add_argument("--batch-size", type=int, default=50)
    parser.add_argument("--request-chars-max", type=int, default=5_000)
    parser.add_argument("--chars-per-minute", type=int, default=100_000)
    parser.add_argument("--min-confidence", type=float, default=0.85)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", action="store_true")
    mode.add_argument("--apply", action="store_true")
    parser.add_argument("--resume", action="store_true")
    parser.add_argument("--force-refresh", action="store_true")
    parser.add_argument("--continue-on-errors", action="store_true")
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT)
    args = parser.parse_args(argv)
    args.dry_run = not args.apply
    for name in ("limit", "batch_size", "request_chars_max", "chars_per_minute"):
        if getattr(args, name) < 1:
            parser.error(f"--{name.replace('_', '-')} must be positive")
    if not 0 <= args.min_confidence <= 1:
        parser.error("--min-confidence must be between 0 and 1")
    return args


def connect_db(path: Path, *, readonly: bool = False) -> sqlite3.Connection:
    if readonly:
        conn = sqlite3.connect(f"file:{path.resolve()}?mode=ro", uri=True)
    else:
        path.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    return conn


def ensure_cache_schema(cache_db: sqlite3.Connection) -> None:
    cache_db.executescript("""
    CREATE TABLE IF NOT EXISTS mt_translation_cache (
      cache_key TEXT PRIMARY KEY, provider TEXT NOT NULL, provider_model TEXT,
      source_lang TEXT NOT NULL, target_lang TEXT NOT NULL,
      normalized_word TEXT NOT NULL, word TEXT NOT NULL, pos TEXT,
      source_text TEXT NOT NULL, mt_output TEXT NOT NULL,
      request_chars INTEGER NOT NULL, response_json TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS mt_rerank_decisions (
      normalized_word TEXT PRIMARY KEY, word TEXT NOT NULL, provider TEXT NOT NULL,
      source_text TEXT NOT NULL, mt_output TEXT, original_translation TEXT NOT NULL,
      reordered_translation TEXT NOT NULL, matched_candidate TEXT,
      confidence REAL NOT NULL, changed INTEGER NOT NULL, reason TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    """)
    cache_db.commit()


def parse_detail_json(value: str | None) -> dict | None:
    try:
        parsed = json.loads(value) if value else {}
        return parsed if isinstance(parsed, dict) else None
    except (json.JSONDecodeError, TypeError):
        return None


def clean_mt_source_text(text: object | None) -> str | None:
    value = str(text or "").splitlines()[0].strip()
    value = POS_PREFIX_RE.sub("", value)
    value = re.split(r'["“”]', value, maxsplit=1)[0].strip()
    value = re.sub(r"\s+", " ", value)[:300].strip(" ;")
    return value if len(re.findall(r"[A-Za-z]", value)) >= 3 else None


def choose_mt_source_text(row: sqlite3.Row) -> tuple[str | None, dict]:
    detail = parse_detail_json(row["detail"])
    if detail is None:
        return None, {"reason": "malformed-detail"}
    meanings = detail.get("displayMeanings") if isinstance(detail.get("displayMeanings"), list) else []
    for item in meanings:
        if isinstance(item, dict) and clean_mt_source_text(item.get("en")):
            return clean_mt_source_text(item["en"]), {"source": "displayMeaning", "detail": detail}
    groups = detail.get("detailedDefinitions") if isinstance(detail.get("detailedDefinitions"), list) else []
    for group in groups:
        for sense in group.get("senses", []) if isinstance(group, dict) else []:
            if isinstance(sense, dict) and clean_mt_source_text(sense.get("definition")):
                return clean_mt_source_text(sense["definition"]), {"source": "detailedDefinition", "detail": detail}
    for line in str(row["definition"] or "").splitlines():
        if clean_mt_source_text(line):
            return clean_mt_source_text(line), {"source": "legacyDefinition", "detail": detail}
    return None, {"reason": "no-gloss", "detail": detail}


def split_zh_candidates(text: str) -> list[str]:
    output: list[str] = []
    for part in SPLIT_RE.split(str(text or "")):
        value = part.strip()
        if value and value not in output:
            output.append(value)
    return output


def normalize_zh_for_match(value: str) -> str:
    text = re.sub(r"\s+", "", str(value or ""))
    return text.strip("，,。.;；、/|（）()[]【】《》<>\"'“”‘’")


def split_mt_output(text: str) -> list[str]:
    return split_zh_candidates(text)


def _match_score(mt: str, candidate: str) -> tuple[float, str]:
    if mt == candidate:
        return 1.0, "exact"
    if candidate.endswith("的") and candidate[:-1] == mt:
        return 0.95, "adjective-suffix"
    if mt and mt in candidate:
        return 0.90, "substring"
    if candidate and candidate in mt:
        return 0.88, "reverse-substring"
    left, right = set(mt), set(candidate)
    overlap = len(left & right) / max(1, len(left | right))
    return min(0.85, 0.75 + overlap * 0.10), "character-overlap"


def match_mt_to_candidates(mt_output: str, candidates: list[str], min_confidence: float = 0.85) -> MatchDecision | None:
    matched: list[str] = []
    confidences: list[float] = []
    reasons: list[str] = []
    for raw_mt in split_mt_output(mt_output):
        mt = normalize_zh_for_match(raw_mt)
        best: tuple[float, str, str] | None = None
        for candidate in candidates:
            if candidate in matched:
                continue
            score, reason = _match_score(mt, normalize_zh_for_match(candidate))
            if best is None or score > best[0]:
                best = (score, candidate, reason)
        if best and best[0] >= min_confidence:
            confidences.append(best[0])
            matched.append(best[1])
            reasons.append(best[2])
    if not matched:
        return None
    return MatchDecision(matched, min(confidences), "+".join(dict.fromkeys(reasons)))


def rerank_candidates_by_mt(candidates: list[str], mt_output: str, min_confidence: float) -> RerankDecision:
    match = match_mt_to_candidates(mt_output, candidates, min_confidence)
    if match is None:
        return RerankDecision(list(candidates), [], 0.0, False, "no-match")
    reordered = match.matched_candidates + [item for item in candidates if item not in match.matched_candidates]
    changed = reordered != candidates
    return RerankDecision(reordered, match.matched_candidates, match.confidence, changed,
                          match.reason if changed else "already-first")


def make_cache_key(provider: str, target_lang: str, normalized_word: str, source_text: str) -> str:
    return hashlib.sha256("\n".join((provider, target_lang, normalized_word, source_text)).encode()).hexdigest()


def load_cached_translation(cache_conn: sqlite3.Connection, cache_key: str) -> str | None:
    row = cache_conn.execute("SELECT mt_output FROM mt_translation_cache WHERE cache_key=?", (cache_key,)).fetchone()
    return row[0] if row else None


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def store_cached_translation(cache_conn: sqlite3.Connection, *, cache_key: str, provider: MTProvider,
                             source_lang: str, target_lang: str, row: sqlite3.Row,
                             source_text: str, mt_output: str) -> None:
    now = _now()
    cache_conn.execute("""
      INSERT INTO mt_translation_cache VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(cache_key) DO UPDATE SET mt_output=excluded.mt_output,
        response_json=excluded.response_json, updated_at=excluded.updated_at
    """, (cache_key, provider.name, provider.model, source_lang, target_lang,
          row["normalized_word"], row["word"], row["pos"], source_text, mt_output,
          len(source_text), json.dumps({"translatedText": mt_output}, ensure_ascii=False), now, now))


def store_rerank_decision(cache_conn: sqlite3.Connection, *, row: sqlite3.Row, provider: MTProvider,
                          source_text: str, mt_output: str, original: str,
                          reordered: str, decision: RerankDecision) -> None:
    cache_conn.execute("""
      INSERT OR REPLACE INTO mt_rerank_decisions VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    """, (row["normalized_word"], row["word"], provider.name, source_text, mt_output,
          original, reordered, ", ".join(decision.matched_candidates) or None,
          decision.confidence, int(decision.changed), decision.reason, _now()))


def load_candidate_rows(conn: sqlite3.Connection, args: argparse.Namespace) -> Iterable[sqlite3.Row]:
    rank_clause = "" if args.all_ranks else "AND (frq <= :rank OR bnc <= :rank)"
    sql = f"""
      SELECT id,word,normalized_word,pos,definition,translation,detail,frq,bnc
      FROM dictionary_entries
      WHERE translation IS NOT NULL AND trim(translation) <> ''
        {rank_clause}
      ORDER BY min(COALESCE(frq,2147483647),COALESCE(bnc,2147483647)), id
    """
    return conn.execute(sql, {"rank": args.rank_max})


def _batches(items: list[dict], max_count: int, max_chars: int) -> Iterable[list[dict]]:
    batch: list[dict] = []
    chars = 0
    for item in items:
        size = len(item["source_text"])
        if batch and (len(batch) >= max_count or chars + size > max_chars):
            yield batch
            batch, chars = [], 0
        batch.append(item)
        chars += size
    if batch:
        yield batch


def update_dictionary_row(conn: sqlite3.Connection, row_id: int, reordered_translation: str, updated_detail: dict) -> None:
    conn.execute("UPDATE dictionary_entries SET translation=?, detail=? WHERE id=?", (
        reordered_translation, json.dumps(updated_detail, ensure_ascii=False, separators=(",", ":")), row_id,
    ))


def write_report(report_path: Path, report: dict) -> None:
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def create_provider(args: argparse.Namespace) -> MTProvider:
    if args.provider == "mock":
        return MockMTProvider()
    return GoogleTranslateProvider(chars_per_minute=args.chars_per_minute)


def run(args: argparse.Namespace, provider: MTProvider | None = None) -> tuple[dict, bool]:
    provider = provider or create_provider(args)
    started = _now()
    report = {
        "provider": provider.name, "providerModel": provider.model,
        "targetLang": args.target_lang, "sourceLang": args.source_lang,
        "dryRun": args.dry_run, "startedAt": started, "candidateRows": 0,
        "cacheHits": 0, "apiRequests": 0, "apiCharacters": 0,
        "rowsTranslated": 0, "rowsMatched": 0, "rowsChanged": 0,
        "rowsUnchangedAlreadyFirst": 0, "rowsNoMatch": 0,
        "rowsSkippedSingleCandidate": 0, "rowsSkippedNoGloss": 0,
        "rowsSkippedNonOverlaySource": 0, "rowsSkippedMalformedDetail": 0,
        "rowsSkippedAlreadyReranked": 0, "errors": [], "sampleChanges": [],
    }
    success = True
    with connect_db(args.db, readonly=args.dry_run) as conn, connect_db(args.cache) as cache:
        ensure_cache_schema(cache)
        prepared: list[dict] = []
        for row in load_candidate_rows(conn, args):
            detail = parse_detail_json(row["detail"])
            if detail is None:
                report["rowsSkippedMalformedDetail"] += 1
                continue
            fallback = detail.get("translationFallback") if isinstance(detail.get("translationFallback"), dict) else {}
            if fallback.get("zhSource") not in OVERLAY_SOURCES:
                report["rowsSkippedNonOverlaySource"] += 1
                continue
            if report["candidateRows"] >= args.limit:
                break
            report["candidateRows"] += 1
            candidates = split_zh_candidates(row["translation"])
            if len(candidates) < 2:
                report["rowsSkippedSingleCandidate"] += 1
                continue
            source_text, context = choose_mt_source_text(row)
            if context.get("reason") == "malformed-detail":
                report["rowsSkippedMalformedDetail"] += 1
                continue
            if not source_text:
                report["rowsSkippedNoGloss"] += 1
                continue
            detail = context["detail"]
            previous = detail.get("translationFallback", {}).get("mtRerank", {})
            if previous.get("provider") == provider.name and not args.force_refresh:
                report["rowsSkippedAlreadyReranked"] += 1
                continue
            key = make_cache_key(provider.name, args.target_lang, row["normalized_word"], source_text)
            cached = None if args.force_refresh else load_cached_translation(cache, key)
            item = {"row": row, "candidates": candidates, "source_text": source_text,
                    "detail": detail, "cache_key": key, "mt_output": cached}
            if cached is not None:
                report["cacheHits"] += 1
            prepared.append(item)
        pending = [item for item in prepared if item["mt_output"] is None]
        for batch in _batches(pending, args.batch_size, args.request_chars_max):
            try:
                outputs = provider.translate_batch([item["source_text"] for item in batch], args.source_lang, args.target_lang)
                for item, output in zip(batch, outputs):
                    item["mt_output"] = output
                    store_cached_translation(cache, cache_key=item["cache_key"], provider=provider,
                                             source_lang=args.source_lang, target_lang=args.target_lang,
                                             row=item["row"], source_text=item["source_text"], mt_output=output)
                    report["rowsTranslated"] += 1
                cache.commit()
            except Exception as error:
                success = False
                report["errors"].append(str(error))
                if not args.continue_on_errors:
                    break
        for item in prepared:
            if item["mt_output"] is None:
                continue
            row = item["row"]
            decision = rerank_candidates_by_mt(item["candidates"], item["mt_output"], args.min_confidence)
            reordered = ", ".join(decision.reordered_candidates)
            if decision.matched_candidates:
                report["rowsMatched"] += 1
            if decision.changed:
                report["rowsChanged"] += 1
                if len(report["sampleChanges"]) < 50:
                    report["sampleChanges"].append({
                        "word": row["word"], "sourceText": item["source_text"],
                        "mtOutput": item["mt_output"], "original": row["translation"],
                        "reordered": reordered, "confidence": decision.confidence,
                    })
                if args.apply:
                    fallback = item["detail"]["translationFallback"]
                    fallback.setdefault("zhOriginal", row["translation"])
                    fallback["zh"] = reordered
                    fallback["zhDisplayOrderSource"] = "mt-reranked-ecdict"
                    fallback["mtRerank"] = {
                        "provider": provider.name, "targetLang": args.target_lang,
                        "sourceText": item["source_text"], "mtOutput": item["mt_output"],
                        "matchedCandidate": ", ".join(decision.matched_candidates),
                        "confidence": decision.confidence, "changed": True,
                    }
                    update_dictionary_row(conn, row["id"], reordered, item["detail"])
            elif decision.matched_candidates:
                report["rowsUnchangedAlreadyFirst"] += 1
            else:
                report["rowsNoMatch"] += 1
            store_rerank_decision(cache, row=row, provider=provider, source_text=item["source_text"],
                                  mt_output=item["mt_output"], original=row["translation"],
                                  reordered=reordered, decision=decision)
        if args.apply:
            conn.commit()
        cache.commit()
    report["apiRequests"] = provider.request_count
    report["apiCharacters"] = provider.request_characters
    report["estimatedGoogleCostUsd"] = round(max(0, provider.request_characters - 500_000) / 1_000_000 * 20, 4)
    report["finishedAt"] = _now()
    report["status"] = "pass" if success else "partial" if args.continue_on_errors else "fail"
    write_report(args.report, report)
    return report, success or args.continue_on_errors


def main(argv: list[str] | None = None) -> int:
    try:
        args = parse_args(argv)
        if not args.db.is_file():
            raise FileNotFoundError(f"Dictionary DB not found: {args.db}")
        report, success = run(args)
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return 0 if success else 1
    except (ValueError, FileNotFoundError, sqlite3.Error) as error:
        print(f"ERROR: {error}")
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
