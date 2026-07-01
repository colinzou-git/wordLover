#!/usr/bin/env python3
"""Stream Kaikki/Wiktextract English JSONL into a WordFan-compatible SQLite DB."""

from __future__ import annotations

import argparse
import gzip
import json
import os
import re
import sqlite3
import sys
import time
from collections import OrderedDict
from contextlib import contextmanager
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Iterable, Iterator, TextIO

try:
    from scripts.build_slim_dictionary import AP_STEM_TAGS, tag_matches_ap_stem
except ModuleNotFoundError:  # Direct execution: python scripts/build_kaikki_dictionary.py
    from build_slim_dictionary import AP_STEM_TAGS, tag_matches_ap_stem


SOURCE_NAME = "Kaikki/Wiktextract"
DEFAULT_OUTPUT = Path("data/dictionary-kaikki.sqlite")
DEFAULT_REPORT = Path("data/kaikki-dictionary-report.json")
APOSTROPHE_TRANSLATION = str.maketrans({"‘": "'", "’": "'", "ʼ": "'", "`": "'", "＇": "'"})
TERM_RE = re.compile(r"^[A-Za-z]+(?:[ '-][A-Za-z]+){0,5}$")
HAN_RE = re.compile(r"[\u3400-\u9fff]")
EXCHANGE_ORDER = ("p", "d", "i", "3", "s")
DOMAIN_LABELS = {
    "physics": "Physics", "law": "Law", "criminal-law": "criminal law",
    "mathematics": "Mathematics", "biology": "Biology", "chemistry": "Chemistry",
    "computing": "Computing", "medicine": "Medicine", "finance": "Finance",
    "music": "Music", "grammar": "Grammar", "linguistics": "Linguistics",
    "astronomy": "Astronomy", "geology": "Geology", "engineering": "Engineering",
}
POS_DISPLAY = {
    "noun": ("n.", "Noun"), "verb": ("v.", "Verb"),
    "adj": ("adj.", "Adjective"), "adjective": ("adj.", "Adjective"),
    "adv": ("adv.", "Adverb"), "adverb": ("adv.", "Adverb"),
    "prep": ("prep.", "Preposition"), "preposition": ("prep.", "Preposition"),
    "pron": ("pron.", "Pronoun"), "pronoun": ("pron.", "Pronoun"),
    "conj": ("conj.", "Conjunction"), "conjunction": ("conj.", "Conjunction"),
    "interj": ("interj.", "Interjection"), "interjection": ("interj.", "Interjection"),
    "phrase": ("phr.", "Phrase"), "proper-noun": ("n.", "Proper Noun"),
}


@dataclass
class OverlayRecord:
    normalized_word: str
    phonetic: str | None = None
    translation: str | None = None
    tag: str | None = None
    is_toefl: int = 0
    bnc: int | None = None
    frq: int | None = None
    collins: int = 0
    oxford: int = 0
    source: str = "unknown"


@dataclass
class TranslationOverlayRecord:
    normalized_word: str
    translation: str | None = None
    phonetic: str | None = None
    tag: str | None = None
    source: str = "unknown"


@dataclass
class CurrentDictionaryRow(OverlayRecord):
    word: str = ""
    definition: str | None = None
    definition_source: str | None = None
    pos: str | None = None
    exchange: str | None = None
    detail: str | None = None
    audio: str | None = None


@dataclass
class FormRecord:
    form: str
    normalized_form: str
    code: str
    raw_tags: list[str]


@dataclass
class AliasRecord:
    alias: str
    normalized_alias: str
    base: str
    normalized_base: str
    code: str | None
    raw_tags: list[str]


@dataclass
class SenseRecord:
    raw_pos: str | None
    display_pos: str | None
    gloss: str
    compact_gloss: str
    zh: str | None
    zh_source: str
    domain: str | None
    examples: list[str]
    tags: list[str]
    topics: list[str]
    categories: list[str]
    source_order: int


@dataclass
class RowData:
    word: str
    normalized_word: str
    phonetic: str | None = None
    definition: str | None = None
    definition_source: str = SOURCE_NAME
    definition_augmented_at: str | None = None
    translation: str | None = None
    pos: str | None = None
    collins: int = 0
    oxford: int = 0
    tag: str | None = None
    is_toefl: int = 0
    bnc: int | None = None
    frq: int | None = None
    exchange: str | None = None
    detail: str | None = None
    audio: str | None = None
    source: str = SOURCE_NAME
    zh_source: str = "none"

    def tuple(self) -> tuple:
        values = asdict(self)
        values.pop("zh_source", None)
        return tuple(values[name] for name in ROW_COLUMNS)


ROW_COLUMNS = (
    "word", "normalized_word", "phonetic", "definition", "definition_source",
    "definition_augmented_at", "translation", "pos", "collins", "oxford", "tag",
    "is_toefl", "bnc", "frq", "exchange", "detail", "audio", "source",
)


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT)
    parser.add_argument("--data-version", default=f"{time.strftime('%Y.%m.%d')}.kaikki")
    parser.add_argument("--batch-size", type=int, default=5000)
    parser.add_argument("--skip-fts", action="store_true")
    parser.add_argument("--tag-source", type=Path, default=Path("data/dictionary.sqlite"))
    parser.add_argument("--tag-source-shards", type=Path, default=Path("apps/wordlover-pwa/public/dictionary-full"))
    parser.add_argument("--full-translation-source-shards", type=Path)
    parser.add_argument("--full-translation-source", type=Path,
                        help="Current full WordFan SQLite DB used for Chinese fallback.")
    parser.add_argument("--slim-translation-source", type=Path)
    parser.add_argument("--max-compact-senses", type=int, default=12)
    parser.add_argument("--max-detailed-senses-per-pos", type=int, default=20)
    parser.add_argument("--max-examples-per-sense", type=int, default=3)
    parser.add_argument("--max-example-chars", type=int, default=240)
    return parser.parse_args(argv)


def normalize_word(word: str) -> str:
    return " ".join(str(word).strip().translate(APOSTROPHE_TRANSLATION).split()).casefold()


def clean_text(value: object | None) -> str | None:
    if value is None:
        return None
    text = " ".join(str(value).replace("\x00", "").split()).strip()
    return text or None


@contextmanager
def open_jsonl(path: Path) -> Iterator[TextIO]:
    opener = gzip.open if path.name.endswith(".gz") else open
    with opener(path, "rt", encoding="utf-8-sig", errors="replace") as handle:
        yield handle


def connect_database(path: Path) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        path.unlink()
    conn = sqlite3.connect(path)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.execute("PRAGMA temp_store=MEMORY")
    return conn


def create_schema(conn: sqlite3.Connection) -> None:
    conn.executescript("""
        CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE dictionary_entries (
            id INTEGER PRIMARY KEY,
            word TEXT NOT NULL,
            normalized_word TEXT NOT NULL,
            phonetic TEXT,
            definition TEXT,
            definition_source TEXT NOT NULL DEFAULT 'Kaikki/Wiktextract',
            definition_augmented_at TEXT,
            translation TEXT,
            pos TEXT,
            collins INTEGER DEFAULT 0,
            oxford INTEGER DEFAULT 0,
            tag TEXT,
            is_toefl INTEGER NOT NULL DEFAULT 0,
            bnc INTEGER,
            frq INTEGER,
            exchange TEXT,
            detail TEXT,
            audio TEXT,
            source TEXT NOT NULL DEFAULT 'Kaikki/Wiktextract'
        );
        CREATE INDEX idx_dictionary_entries_normalized_word ON dictionary_entries(normalized_word);
        CREATE INDEX idx_dictionary_entries_word_nocase ON dictionary_entries(word COLLATE NOCASE);
        CREATE INDEX idx_dictionary_entries_toefl_frequency ON dictionary_entries(is_toefl, frq, bnc);
        CREATE INDEX idx_dictionary_entries_frequency ON dictionary_entries(frq, bnc);
        CREATE VIEW toefl_entries AS SELECT * FROM dictionary_entries WHERE is_toefl = 1;
        CREATE TABLE kaikki_aggregates (
            normalized_word TEXT PRIMARY KEY,
            word TEXT NOT NULL,
            entries_json TEXT NOT NULL,
            exchange TEXT,
            source_order INTEGER NOT NULL
        );
        CREATE TABLE kaikki_aliases (
            alias TEXT NOT NULL,
            normalized_alias TEXT NOT NULL,
            base TEXT NOT NULL,
            normalized_base TEXT NOT NULL,
            code TEXT,
            raw_tags TEXT,
            UNIQUE(normalized_alias, normalized_base, code)
        );
    """)


def is_english_entry(entry: dict) -> bool:
    return entry.get("lang_code") == "en" or str(entry.get("lang", "")).casefold() == "english"


def is_valid_word(word: str) -> bool:
    return bool(TERM_RE.fullmatch(normalize_word(word)))


def is_form_of_only(entry: dict) -> bool:
    senses = entry.get("senses") or []
    meaningful = False
    form_of = False
    for sense in senses:
        if not isinstance(sense, dict):
            continue
        tags = {str(tag).casefold() for tag in sense.get("tags") or []}
        form_of = form_of or bool(sense.get("form_of") or sense.get("alt_of")) or "form-of" in tags
        glosses = [clean_text(g) for g in (sense.get("glosses") or sense.get("raw_glosses") or [])]
        if any(glosses) and not ({"form-of", "alt-of"} & tags or sense.get("form_of") or sense.get("alt_of")):
            meaningful = True
    return form_of and not meaningful


def map_pos(pos: str | None) -> str | None:
    raw = clean_text(pos)
    return POS_DISPLAY.get(raw.casefold(), (raw, raw.title()))[0] if raw else None


def pos_heading(pos: str | None) -> str:
    raw = clean_text(pos) or "other"
    return POS_DISPLAY.get(raw.casefold(), (raw, raw.title()))[1]


def first_ipa(entry: dict) -> str | None:
    for sound in entry.get("sounds") or []:
        if isinstance(sound, dict) and clean_text(sound.get("ipa")):
            return clean_text(sound["ipa"])
    return clean_text(entry.get("ipa"))


def extract_definition_lines(entry: dict) -> list[str]:
    prefix = map_pos(entry.get("pos"))
    lines: list[str] = []
    for sense in entry.get("senses") or []:
        if not isinstance(sense, dict):
            continue
        for gloss in sense.get("glosses") or sense.get("raw_glosses") or []:
            text = clean_text(gloss)
            if text:
                lines.append(f"{prefix} {text}" if prefix else text)
    return lines


def append_tag(existing: str | None, new_tag: str | None) -> str | None:
    return merge_tag_tokens((existing, new_tag))


def merge_tag_tokens(values: Iterable[str | None]) -> str | None:
    output: list[str] = []
    seen: set[str] = set()
    for value in values:
        for token in (clean_text(value) or "").split():
            if token not in seen:
                seen.add(token)
                output.append(token)
    return " ".join(output) or None


def contains_tag(tag: str | None, expected: str) -> bool:
    return expected in (clean_text(tag) or "").split()


def _minimum(left: int | None, right: int | None) -> int | None:
    values = [value for value in (left, right) if value is not None]
    return min(values) if values else None


def _merge_overlay(existing: OverlayRecord | None, incoming: OverlayRecord) -> OverlayRecord:
    if existing is None:
        return incoming
    existing.tag = merge_tag_tokens((existing.tag, incoming.tag))
    existing.is_toefl = max(existing.is_toefl, incoming.is_toefl)
    existing.frq = _minimum(existing.frq, incoming.frq)
    existing.bnc = _minimum(existing.bnc, incoming.bnc)
    existing.collins = max(existing.collins, incoming.collins)
    existing.oxford = max(existing.oxford, incoming.oxford)
    existing.phonetic = existing.phonetic or incoming.phonetic
    existing.translation = existing.translation or incoming.translation
    return existing


def _table_columns(conn: sqlite3.Connection) -> set[str]:
    return {str(row[1]) for row in conn.execute("PRAGMA table_info(dictionary_entries)")}


def load_overlay_from_sqlite(path: Path) -> dict[str, OverlayRecord]:
    if not path.exists():
        return {}
    output: dict[str, OverlayRecord] = {}
    with sqlite3.connect(f"file:{path.resolve()}?mode=ro", uri=True) as conn:
        columns = _table_columns(conn)
        wanted = ["word", "normalized_word", "phonetic", "translation", "tag", "is_toefl", "bnc", "frq", "collins", "oxford"]
        selected = [column for column in wanted if column in columns]
        for row in conn.execute(f"SELECT {','.join(selected)} FROM dictionary_entries"):
            values = dict(zip(selected, row))
            normalized = normalize_word(values.get("word") or values.get("normalized_word") or "")
            if not normalized:
                continue
            record = OverlayRecord(
                normalized_word=normalized,
                phonetic=clean_text(values.get("phonetic")), translation=clean_text(values.get("translation")),
                tag=clean_text(values.get("tag")), is_toefl=int(values.get("is_toefl") or 0),
                bnc=_as_int(values.get("bnc")), frq=_as_int(values.get("frq")),
                collins=int(values.get("collins") or 0), oxford=int(values.get("oxford") or 0),
                source="wordfan-slim-overlay",
            )
            output[normalized] = _merge_overlay(output.get(normalized), record)
    return output


def _read_shards(path: Path) -> Iterator[tuple[str, list]]:
    if not path.exists():
        return
    for shard in sorted(path.glob("shard-*.json.gz")):
        with gzip.open(shard, "rt", encoding="utf-8") as handle:
            payload = json.load(handle)
        for normalized, row in (payload.get("e") or {}).items():
            if isinstance(row, list):
                yield normalized, row


def load_overlay_from_shards(path: Path) -> dict[str, OverlayRecord]:
    output: dict[str, OverlayRecord] = {}
    for normalized, row in _read_shards(path):
        key = normalize_word(normalized or (row[0] if row else ""))
        if not key:
            continue
        record = OverlayRecord(
            key, clean_text(row[1] if len(row) > 1 else None),
            clean_text(row[4] if len(row) > 4 else None), clean_text(row[5] if len(row) > 5 else None),
            source="wordfan-full-overlay",
        )
        output[key] = _merge_overlay(output.get(key), record)
    return output


def load_overlay(args: argparse.Namespace) -> dict[str, OverlayRecord]:
    sqlite_path = getattr(args, "tag_source", None)
    if sqlite_path and Path(sqlite_path).exists():
        return load_overlay_from_sqlite(Path(sqlite_path))
    shard_path = getattr(args, "tag_source_shards", None)
    return load_overlay_from_shards(Path(shard_path)) if shard_path and Path(shard_path).exists() else {}


def apply_overlay(row_data: RowData, overlay: OverlayRecord | None) -> RowData:
    if overlay is None:
        return row_data
    row_data.tag = merge_tag_tokens((row_data.tag, overlay.tag))
    row_data.is_toefl = max(row_data.is_toefl, overlay.is_toefl, int(contains_tag(row_data.tag, "toefl")))
    row_data.frq, row_data.bnc = overlay.frq, overlay.bnc
    row_data.collins, row_data.oxford = overlay.collins, overlay.oxford
    row_data.phonetic = row_data.phonetic or overlay.phonetic
    return row_data


def load_translation_overlay_from_shards(path: Path) -> dict[str, TranslationOverlayRecord]:
    return {key: TranslationOverlayRecord(key, value.translation, value.phonetic, value.tag, "wordfan-full-overlay")
            for key, value in load_overlay_from_shards(path).items()}


def load_translation_overlay_from_sqlite(path: Path, source: str = "wordfan-slim-overlay") -> dict[str, TranslationOverlayRecord]:
    return {key: TranslationOverlayRecord(key, value.translation, value.phonetic, value.tag, source)
            for key, value in load_overlay_from_sqlite(path).items()}


def choose_chinese_translation(
    kaikki_sense_translation: str | None,
    kaikki_entry_translation: str | None,
    full_overlay: TranslationOverlayRecord | None,
    slim_overlay: TranslationOverlayRecord | None,
) -> tuple[str | None, str]:
    for value, source in (
        (kaikki_sense_translation, "kaikki-sense"), (kaikki_entry_translation, "kaikki-entry"),
        (full_overlay.translation if full_overlay else None, "wordfan-full-overlay"),
        (slim_overlay.translation if slim_overlay else None, "wordfan-slim-overlay"),
    ):
        if clean_text(value):
            return clean_text(value), source
    return None, "none"


def _as_int(value: object) -> int | None:
    try:
        return int(value) if value not in (None, "") else None
    except (TypeError, ValueError):
        return None


def extract_chinese_translations(entry: dict, sense: dict | None = None) -> list[str]:
    candidates: list[object] = []
    target = sense if sense is not None else entry
    for key in ("translations", "translation", "zh", "zh_translation"):
        value = target.get(key) if isinstance(target, dict) else None
        candidates.extend(value if isinstance(value, list) else [value])
    output: list[str] = []
    for candidate in candidates:
        if isinstance(candidate, dict):
            lang = str(candidate.get("lang_code") or candidate.get("code") or candidate.get("lang") or "").casefold()
            if lang and lang not in {"zh", "zh-cn", "zh-hans", "cmn", "yue", "chinese", "mandarin", "chinese mandarin"}:
                continue
            candidate = candidate.get("word") or candidate.get("text") or candidate.get("translation")
        text = clean_text(candidate)
        if text and HAN_RE.search(text) and text not in output:
            output.append(text)
    return output


def _aligned_entry_translation(entry: dict, gloss: str) -> str | None:
    gloss_words = set(re.findall(r"[a-z]+", gloss.casefold()))
    best: tuple[float, str] | None = None
    for candidate in entry.get("translations") or []:
        if not isinstance(candidate, dict):
            continue
        words = extract_chinese_translations({"translations": [candidate]})
        sense_label = clean_text(candidate.get("sense"))
        if not words or not sense_label:
            continue
        sense_words = set(re.findall(r"[a-z]+", sense_label.casefold()))
        if not sense_words:
            continue
        score = len(gloss_words & sense_words) / len(sense_words)
        if score >= 0.6 and (best is None or score > best[0]):
            best = (score, words[0])
    return best[1] if best else None


def extract_examples(sense: dict, *, max_examples: int, max_chars: int) -> list[str]:
    output: list[str] = []
    for raw in sense.get("examples") or []:
        if isinstance(raw, dict):
            raw = raw.get("text") or raw.get("english") or raw.get("example")
        text = clean_text(raw)
        if text:
            output.append(text[:max_chars])
        if len(output) >= max_examples:
            break
    return output


def extract_domain(sense: dict, entry: dict) -> str | None:
    for raw in list(sense.get("topics") or []) + list(entry.get("topics") or []) + list(sense.get("tags") or []):
        key = normalize_word(str(raw)).replace(" ", "-")
        if key in DOMAIN_LABELS:
            return DOMAIN_LABELS[key]
    return None


def compact_english_definition(gloss: str) -> str:
    return (clean_text(gloss) or "")[:240]


def extract_senses(entry: dict, args: argparse.Namespace | None = None, start_order: int = 0) -> list[SenseRecord]:
    args = args or argparse.Namespace(max_examples_per_sense=3, max_example_chars=240)
    output: list[SenseRecord] = []
    for sense in entry.get("senses") or []:
        if not isinstance(sense, dict) or sense.get("form_of") or sense.get("alt_of"):
            continue
        glosses = sense.get("glosses") or sense.get("raw_glosses") or []
        for gloss in glosses:
            text = clean_text(gloss)
            if not text:
                continue
            direct_zh = extract_chinese_translations(entry, sense)
            aligned_zh = _aligned_entry_translation(entry, text) if not direct_zh else None
            output.append(SenseRecord(
                clean_text(entry.get("pos")), map_pos(entry.get("pos")), text,
                compact_english_definition(text), direct_zh[0] if direct_zh else aligned_zh,
                "kaikki-sense" if (direct_zh or aligned_zh) else "none",
                extract_domain(sense, entry),
                extract_examples(sense, max_examples=args.max_examples_per_sense, max_chars=args.max_example_chars),
                [str(x) for x in sense.get("tags") or []], [str(x) for x in sense.get("topics") or []],
                [str(x) for x in entry.get("categories") or []], start_order + len(output),
            ))
    return output


def build_display_meanings(entries: list[dict], args: argparse.Namespace) -> list[dict]:
    senses: list[SenseRecord] = []
    for entry in entries:
        senses.extend(extract_senses(entry, args, len(senses)))
    output: list[dict] = []
    for rank, sense in enumerate(senses[: args.max_compact_senses], 1):
        output.append({
            "rank": rank, "pos": sense.display_pos, "zh": sense.zh,
            "zhSource": sense.zh_source if sense.zh else "none", "en": sense.compact_gloss,
            "domain": sense.domain, "source": SOURCE_NAME,
        })
    return output


def build_detailed_definitions(entries: list[dict], args: argparse.Namespace) -> list[dict]:
    groups: OrderedDict[str, list[dict]] = OrderedDict()
    for entry in entries:
        heading = pos_heading(entry.get("pos"))
        group = groups.setdefault(heading, [])
        for sense in extract_senses(entry, args):
            if len(group) >= args.max_detailed_senses_per_pos:
                break
            group.append({"definition": sense.gloss, "domain": sense.domain, "examples": sense.examples, "source": SOURCE_NAME})
    return [{"pos": pos, "senses": senses} for pos, senses in groups.items() if senses]


def serialize_legacy_definition(display_meanings: list[dict]) -> str | None:
    return "\n".join(f"{item.get('pos') or ''} {item.get('en') or ''}".strip() + (f" ({item['domain']})" if item.get("domain") else "") for item in display_meanings) or None


def serialize_legacy_translation(display_meanings: list[dict]) -> str | None:
    values = [clean_text(item.get("zh")) for item in display_meanings]
    return "\n".join(value or "" for value in values) if any(values) else None


def serialize_detail(display_meanings: list[dict], detailed_definitions: list[dict], entries: list[dict], translation_fallback: tuple[str, str] | None = None, supplement: dict | None = None) -> str | None:
    raw_pos, topics, tags, categories = [], [], [], []
    for entry in entries:
        _append_unique(raw_pos, [entry.get("pos")], 12)
        _append_unique(topics, entry.get("topics") or [], 12)
        _append_unique(categories, entry.get("categories") or [], 12)
        for sense in entry.get("senses") or []:
            if isinstance(sense, dict):
                _append_unique(topics, sense.get("topics") or [], 12)
                _append_unique(tags, sense.get("tags") or [], 20)
    detail: dict = {}
    if display_meanings:
        detail["displayMeanings"] = display_meanings
    if detailed_definitions:
        detail["detailedDefinitions"] = detailed_definitions
    kaikki = {key: value for key, value in (("rawPos", raw_pos), ("topics", topics), ("senseTags", tags), ("categories", categories)) if value}
    if kaikki:
        detail["kaikki"] = kaikki
    if translation_fallback and translation_fallback[0]:
        detail["translationFallback"] = {"zh": translation_fallback[0], "zhSource": translation_fallback[1]}
    if supplement:
        detail["supplement"] = supplement
    return json.dumps(detail, ensure_ascii=False, separators=(",", ":")) if detail else None


def _append_unique(target: list[str], values: Iterable[object], maximum: int) -> None:
    for value in values:
        text = clean_text(value)
        if text and text not in target:
            target.append(text)
        if len(target) >= maximum:
            break


def map_kaikki_form_tags_to_exchange_code(tags: list[str], source_pos: str | None = None) -> str | None:
    values = {normalize_word(tag).replace(" ", "-") for tag in tags}
    if "plural" in values:
        return "s"
    if "third-person" in values and "singular" in values:
        return "3"
    if "gerund" in values or ({"present", "participle"} <= values):
        return "i"
    if {"past", "participle"} <= values:
        return "d"
    if "past" in values:
        return "p"
    return None


def extract_form_records(entry: dict) -> list[FormRecord]:
    output: list[FormRecord] = []
    for value in entry.get("forms") or []:
        if not isinstance(value, dict):
            continue
        form = clean_text(value.get("form"))
        tags = [str(tag) for tag in value.get("tags") or []]
        code = map_kaikki_form_tags_to_exchange_code(tags, entry.get("pos"))
        if form and code:
            output.append(FormRecord(form, normalize_word(form), code, tags))
    return output


def extract_form_of_aliases(entry: dict) -> list[AliasRecord]:
    output: list[AliasRecord] = []
    alias = clean_text(entry.get("word"))
    if not alias:
        return output
    for sense in entry.get("senses") or []:
        if not isinstance(sense, dict):
            continue
        tags = [str(tag) for tag in sense.get("tags") or []]
        codes = [map_kaikki_form_tags_to_exchange_code(tags, entry.get("pos"))]
        normalized_tags = {normalize_word(tag).replace(" ", "-") for tag in tags}
        if {"past", "participle"} <= normalized_tags:
            codes = ["p", "d"]
        references = list(sense.get("form_of") or []) + list(sense.get("alt_of") or [])
        if not references and "form-of" in normalized_tags:
            for gloss in sense.get("glosses") or sense.get("raw_glosses") or []:
                match = re.search(r"\bof\s+([A-Za-z]+(?:[ '-][A-Za-z]+){0,5})\s*$", clean_text(gloss) or "", re.IGNORECASE)
                if match:
                    references.append({"word": match.group(1)})
        for reference in references:
            base = clean_text(reference.get("word") if isinstance(reference, dict) else reference)
            if base:
                for code in codes:
                    if code:
                        output.append(AliasRecord(alias, normalize_word(alias), base, normalize_word(base), code, tags))
    return output


def add_exchange_form(exchange_map: dict[str, set[str]], code: str, form: str, base: str) -> None:
    normalized_form, normalized_base = normalize_word(form), normalize_word(base)
    if code in EXCHANGE_ORDER and normalized_form != normalized_base and is_valid_word(normalized_form):
        exchange_map.setdefault(code, set()).add(normalized_form)


def serialize_exchange(exchange_map: dict[str, set[str]]) -> str | None:
    parts = [f"{code}:{','.join(sorted(exchange_map.get(code, set())))}" for code in EXCHANGE_ORDER if exchange_map.get(code)]
    return "/".join(parts) or None


def merge_exchange(existing: str | None, new_exchange: str | None) -> str | None:
    exchange_map: dict[str, set[str]] = {}
    for value in (existing, new_exchange):
        for part in str(value or "").split("/"):
            if ":" not in part:
                continue
            code, forms = part.split(":", 1)
            for form in forms.split(","):
                normalized = normalize_word(form)
                if normalized:
                    exchange_map.setdefault(code, set()).add(normalized)
    return serialize_exchange(exchange_map)


def attach_aliases_to_base_entries(conn: sqlite3.Connection, report: dict) -> None:
    for alias, normalized_alias, _base, normalized_base, code, _tags in conn.execute(
        "SELECT alias, normalized_alias, base, normalized_base, code, raw_tags FROM kaikki_aliases ORDER BY rowid"
    ):
        report["form_of_aliases_seen"] += 1
        row = conn.execute("SELECT exchange FROM kaikki_aggregates WHERE normalized_word=?", (normalized_base,)).fetchone()
        if not row:
            report["form_aliases_without_base"] += 1
            continue
        if not code or not is_valid_word(normalized_alias) or normalized_alias == normalized_base:
            report["forms_rejected_invalid"] += 1
            continue
        exchange_map: dict[str, set[str]] = {}
        add_exchange_form(exchange_map, code, normalized_alias, normalized_base)
        merged = merge_exchange(row[0], serialize_exchange(exchange_map))
        conn.execute("UPDATE kaikki_aggregates SET exchange=? WHERE normalized_word=?", (merged, normalized_base))
        report["form_of_aliases_attached"] += 1


def load_current_stem_rows_from_sqlite(path: Path) -> dict[str, CurrentDictionaryRow]:
    if not path.exists():
        return {}
    output: dict[str, CurrentDictionaryRow] = {}
    with sqlite3.connect(f"file:{path.resolve()}?mode=ro", uri=True) as conn:
        columns = _table_columns(conn)
        selected = [name for name in ("word",) + ROW_COLUMNS if name in columns]
        for raw in conn.execute(f"SELECT {','.join(selected)} FROM dictionary_entries"):
            values = dict(zip(selected, raw))
            if not tag_matches_ap_stem(values.get("tag")):
                continue
            normalized = normalize_word(values.get("word") or values.get("normalized_word") or "")
            output[normalized] = CurrentDictionaryRow(
                normalized_word=normalized, word=values.get("word") or normalized,
                phonetic=clean_text(values.get("phonetic")), translation=clean_text(values.get("translation")),
                tag=clean_text(values.get("tag")), is_toefl=int(values.get("is_toefl") or 0),
                bnc=_as_int(values.get("bnc")), frq=_as_int(values.get("frq")),
                collins=int(values.get("collins") or 0), oxford=int(values.get("oxford") or 0),
                definition=clean_text(values.get("definition")), definition_source=clean_text(values.get("definition_source")),
                pos=clean_text(values.get("pos")), exchange=clean_text(values.get("exchange")), detail=clean_text(values.get("detail")),
                audio=clean_text(values.get("audio")), source=clean_text(values.get("source")) or "WordFan_STEM_Supplement",
            )
    return output


def append_missing_stem_rows(output_rows: dict[str, RowData], current_stem_rows: dict[str, CurrentDictionaryRow]) -> tuple[dict[str, RowData], dict]:
    stats = {"missing_stem_rows_appended": 0}
    for normalized, current in current_stem_rows.items():
        if normalized in output_rows:
            continue
        detail = _merge_detail(current.detail, {"supplement": {"source": "current-wordfan-stem", "reason": "missing-from-kaikki"}})
        output_rows[normalized] = RowData(
            current.word, normalized, current.phonetic, current.definition,
            current.definition_source or "WordFan_STEM_Supplement", None, current.translation,
            current.pos, current.collins, current.oxford, current.tag, current.is_toefl,
            current.bnc, current.frq, current.exchange, detail, current.audio,
            current.source or "WordFan_STEM_Supplement",
            "wordfan-slim-overlay" if current.translation else "none",
        )
        stats["missing_stem_rows_appended"] += 1
    return output_rows, stats


def _merge_detail(existing: str | None, additions: dict) -> str:
    try:
        value = json.loads(existing) if existing else {}
        if not isinstance(value, dict):
            value = {}
    except json.JSONDecodeError:
        value = {}
    value.update(additions)
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def row_from_aggregate(entries: list[dict], normalized: str, word: str, exchange: str | None, args: argparse.Namespace,
                       overlay: OverlayRecord | None = None,
                       full_translation: TranslationOverlayRecord | None = None,
                       slim_translation: TranslationOverlayRecord | None = None) -> RowData:
    display = build_display_meanings(entries, args)
    detailed = build_detailed_definitions(entries, args)
    sense_zh = next((item["zh"] for item in display if item.get("zh")), None)
    entry_zh_values: list[str] = []
    for entry in entries:
        entry_zh_values.extend(extract_chinese_translations(entry))
    entry_zh = "\n".join(dict.fromkeys(entry_zh_values)) or None
    translation, zh_source = choose_chinese_translation(sense_zh, entry_zh, full_translation, slim_translation)
    if zh_source == "kaikki-entry" and display:
        display[0]["zh"], display[0]["zhSource"] = translation, "kaikki-entry"
    fallback = (translation, zh_source) if zh_source.startswith("wordfan-") else None
    if fallback:
        for item in display:
            if not item.get("zh"):
                item["zhSource"] = "none"
    phonetic = next((first_ipa(entry) for entry in entries if first_ipa(entry)), None)
    row = RowData(
        word=word, normalized_word=normalized, phonetic=phonetic,
        definition=serialize_legacy_definition(display),
        translation=translation or serialize_legacy_translation(display),
        pos=merge_tag_tokens(map_pos(entry.get("pos")) for entry in entries),
        exchange=exchange,
        detail=serialize_detail(display, detailed, entries, fallback), zh_source=zh_source,
    )
    return apply_overlay(row, overlay)


def insert_batch(conn: sqlite3.Connection, batch: list[tuple]) -> None:
    placeholders = ",".join("?" for _ in ROW_COLUMNS)
    conn.executemany(f"INSERT INTO dictionary_entries ({','.join(ROW_COLUMNS)}) VALUES ({placeholders})", batch)


def build_fts_index(conn: sqlite3.Connection) -> None:
    conn.executescript("""
        CREATE VIRTUAL TABLE dictionary_search_fts USING fts5(
            word, normalized_word, definition, translation,
            content='dictionary_entries', content_rowid='id',
            tokenize='unicode61 remove_diacritics 2'
        );
        INSERT INTO dictionary_search_fts(rowid, word, normalized_word, definition, translation)
        SELECT id, word, normalized_word, COALESCE(definition,''), COALESCE(translation,'') FROM dictionary_entries;
    """)


def _stage_entry(conn: sqlite3.Connection, entry: dict, order: int, report: dict) -> None:
    normalized = normalize_word(entry["word"])
    if is_form_of_only(entry):
        report["skipped_form_of_only"] += 1
        for alias in extract_form_of_aliases(entry):
            conn.execute("INSERT OR IGNORE INTO kaikki_aliases VALUES (?,?,?,?,?,?)", (
                alias.alias, alias.normalized_alias, alias.base, alias.normalized_base, alias.code,
                json.dumps(alias.raw_tags, ensure_ascii=False),
            ))
        return
    row = conn.execute("SELECT entries_json, exchange FROM kaikki_aggregates WHERE normalized_word=?", (normalized,)).fetchone()
    entries = json.loads(row[0]) if row else []
    entries.append(entry)
    exchange_map: dict[str, set[str]] = {}
    for form in extract_form_records(entry):
        report["forms_seen"] += 1
        before = sum(map(len, exchange_map.values()))
        add_exchange_form(exchange_map, form.code, form.form, normalized)
        after = sum(map(len, exchange_map.values()))
        if after > before:
            report["forms_added_to_exchange"] += 1
        elif not is_valid_word(form.normalized_form) or form.normalized_form == normalized:
            report["forms_rejected_invalid"] += 1
    exchange = merge_exchange(row[1] if row else None, serialize_exchange(exchange_map))
    if row:
        conn.execute("UPDATE kaikki_aggregates SET entries_json=?, exchange=? WHERE normalized_word=?", (
            json.dumps(entries, ensure_ascii=False, separators=(",", ":")), exchange, normalized,
        ))
    else:
        conn.execute("INSERT INTO kaikki_aggregates VALUES (?,?,?,?,?)", (
            normalized, clean_text(entry["word"]) or normalized,
            json.dumps(entries, ensure_ascii=False, separators=(",", ":")), exchange, order,
        ))


def _initial_report(args: argparse.Namespace) -> dict:
    return {
        "source": str(args.source), "output": str(args.output), "data_version": args.data_version,
        "input_lines": 0, "json_errors": 0, "skipped_non_english": 0, "skipped_redirects": 0,
        "skipped_invalid_terms": 0, "skipped_form_of_only": 0, "accepted_entry_objects": 0,
        "final_rows": 0, "rows_with_definition": 0, "rows_with_phonetic": 0,
        "fts5_search_index": "skipped" if args.skip_fts else "built", "sqlite_size_bytes": 0,
        "elapsed_seconds": 0, "forms_seen": 0, "forms_added_to_exchange": 0,
        "form_of_aliases_seen": 0, "form_of_aliases_attached": 0, "form_aliases_without_base": 0,
        "forms_rejected_invalid": 0, "forms_rejected_same_as_base": 0,
    }


def build_database(args: argparse.Namespace) -> dict:
    start = time.monotonic()
    if not args.source.exists():
        raise FileNotFoundError(args.source)
    tmp = args.output.with_suffix(args.output.suffix + ".tmp")
    report = _initial_report(args)
    conn: sqlite3.Connection | None = None
    try:
        conn = connect_database(tmp)
        create_schema(conn)
        with open_jsonl(args.source) as handle:
            for order, line in enumerate(handle):
                report["input_lines"] += 1
                try:
                    entry = json.loads(line)
                except (json.JSONDecodeError, TypeError):
                    report["json_errors"] += 1
                    continue
                if not isinstance(entry, dict) or not is_english_entry(entry):
                    report["skipped_non_english"] += 1
                    continue
                if entry.get("redirect"):
                    report["skipped_redirects"] += 1
                    continue
                word = clean_text(entry.get("word"))
                if not word or not is_valid_word(word):
                    report["skipped_invalid_terms"] += 1
                    continue
                report["accepted_entry_objects"] += 1
                _stage_entry(conn, entry, order, report)
                if report["input_lines"] % args.batch_size == 0:
                    conn.commit()
        attach_aliases_to_base_entries(conn, report)
        conn.commit()

        slim_path = Path(getattr(args, "slim_translation_source", None) or args.tag_source)
        full_path = Path(getattr(args, "full_translation_source_shards", None) or args.tag_source_shards)
        full_sqlite_path = getattr(args, "full_translation_source", None)
        full_sqlite_path = Path(full_sqlite_path) if full_sqlite_path else None
        overlay = load_overlay(args)
        def translations_from_overlay(values: dict[str, OverlayRecord], source: str) -> dict[str, TranslationOverlayRecord]:
            return {key: TranslationOverlayRecord(key, item.translation, item.phonetic, item.tag, source)
                    for key, item in values.items()}

        tag_source_path = Path(args.tag_source) if getattr(args, "tag_source", None) else None
        if full_sqlite_path and full_sqlite_path.exists():
            if tag_source_path and full_sqlite_path.resolve() == tag_source_path.resolve() and overlay:
                full_translations = translations_from_overlay(overlay, "wordfan-full-overlay")
            else:
                full_translations = load_translation_overlay_from_sqlite(full_sqlite_path, "wordfan-full-overlay")
        else:
            full_translations = load_translation_overlay_from_shards(full_path) if full_path.exists() else {}
        if slim_path.exists() and not (full_sqlite_path and slim_path.resolve() == full_sqlite_path.resolve()):
            if tag_source_path and slim_path.resolve() == tag_source_path.resolve() and overlay:
                slim_translations = translations_from_overlay(overlay, "wordfan-slim-overlay")
            else:
                slim_translations = load_translation_overlay_from_sqlite(slim_path)
        else:
            slim_translations = {}
        stem_rows = load_current_stem_rows_from_sqlite(slim_path) if slim_path.exists() else {}
        report.update({
            "tag_overlay_available": bool(overlay), "tag_overlay_source": str(args.tag_source) if overlay else None,
            "overlay_records_loaded": len(overlay), "full_translation_overlay_records_loaded": len(full_translations),
            "slim_translation_overlay_records_loaded": len(slim_translations), "current_stem_rows_loaded": len(stem_rows),
            "kaikki_rows_with_stem_overlay": 0,
        })
        for key in ("rows_with_kaikki_sense_chinese", "rows_with_kaikki_entry_chinese",
                    "rows_with_full_dictionary_chinese_overlay", "rows_with_slim_dictionary_chinese_overlay"):
            report[key] = 0
        batch: list[tuple] = []
        aggregate_cursor = conn.execute(
            "SELECT normalized_word, word, entries_json, exchange FROM kaikki_aggregates ORDER BY source_order"
        )
        for normalized, word, entries_json, exchange in aggregate_cursor:
            row = row_from_aggregate(json.loads(entries_json), normalized, word, exchange, args,
                                     overlay.get(normalized), full_translations.get(normalized), slim_translations.get(normalized))
            if tag_matches_ap_stem(row.tag):
                report["kaikki_rows_with_stem_overlay"] += 1
                stem = stem_rows.get(normalized)
                if stem and stem.translation and row.zh_source.startswith("wordfan-"):
                    row.translation, row.zh_source = stem.translation, "wordfan-slim-overlay"
                    row.detail = _merge_detail(row.detail, {"translationFallback": {"zh": row.translation, "zhSource": row.zh_source}})
            source_counter = {
                "kaikki-sense": "rows_with_kaikki_sense_chinese",
                "kaikki-entry": "rows_with_kaikki_entry_chinese",
                "wordfan-full-overlay": "rows_with_full_dictionary_chinese_overlay",
                "wordfan-slim-overlay": "rows_with_slim_dictionary_chinese_overlay",
            }.get(row.zh_source)
            if source_counter:
                report[source_counter] += 1
            batch.append(row.tuple())
            if len(batch) >= args.batch_size:
                insert_batch(conn, batch)
                batch.clear()
        if batch:
            insert_batch(conn, batch)
        report["missing_stem_rows_appended"] = 0
        supplement_batch: list[tuple] = []
        for normalized, current in stem_rows.items():
            if conn.execute("SELECT 1 FROM dictionary_entries WHERE normalized_word=? LIMIT 1", (normalized,)).fetchone():
                continue
            supplemental, _stats = append_missing_stem_rows({}, {normalized: current})
            row = supplemental[normalized]
            supplement_batch.append(row.tuple())
            report["missing_stem_rows_appended"] += 1
            if row.translation:
                report["rows_with_slim_dictionary_chinese_overlay"] += 1
            if len(supplement_batch) >= args.batch_size:
                insert_batch(conn, supplement_batch)
                supplement_batch.clear()
        if supplement_batch:
            insert_batch(conn, supplement_batch)
        if not args.skip_fts:
            build_fts_index(conn)
        generated = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        metadata = {
            "source_name": SOURCE_NAME, "source_format": "jsonl", "data_version": args.data_version,
            "variant": "kaikki-full", "generated_at": generated, "created_at_unix": str(int(time.time())),
        }
        conn.executemany("INSERT INTO metadata(key,value) VALUES (?,?)", metadata.items())
        conn.execute("DROP TABLE kaikki_aggregates")
        conn.execute("DROP TABLE kaikki_aliases")
        conn.commit()
        quick = conn.execute("PRAGMA quick_check").fetchone()[0]
        if quick != "ok":
            raise RuntimeError(f"SQLite quick_check failed: {quick}")
        count_where = lambda clause: int(conn.execute(f"SELECT count(*) FROM dictionary_entries WHERE {clause}").fetchone()[0])
        report["final_rows"] = count_where("1")
        report["rows_with_definition"] = count_where("definition IS NOT NULL AND trim(definition) <> ''")
        report["rows_with_phonetic"] = count_where("phonetic IS NOT NULL AND trim(phonetic) <> ''")
        report["rows_with_exchange"] = count_where("exchange IS NOT NULL AND trim(exchange) <> ''")
        report["rows_with_current_tag"] = count_where("tag IS NOT NULL AND trim(tag) <> ''")
        report["rows_with_toefl"] = count_where("is_toefl = 1")
        report["rows_with_frq"] = count_where("frq IS NOT NULL")
        report["rows_with_bnc"] = count_where("bnc IS NOT NULL")
        report["rows_with_collins"] = count_where("collins > 0")
        report["rows_with_oxford"] = count_where("oxford > 0")
        report["rows_without_chinese_translation"] = count_where("translation IS NULL OR trim(translation) = ''")
        report["final_rows_with_chinese_translation"] = report["final_rows"] - report["rows_without_chinese_translation"]
        report["final_chinese_translation_coverage_percent"] = round(100 * report["final_rows_with_chinese_translation"] / max(1, report["final_rows"]), 4)
        stem_tags = [tag for (tag,) in conn.execute("SELECT tag FROM dictionary_entries WHERE tag IS NOT NULL AND trim(tag) <> ''") if tag_matches_ap_stem(tag)]
        report["final_stem_rows"] = len(stem_tags)
        report["final_k12_stem_rows"] = sum(any(token.startswith("k12_") for token in tag.split()) for tag in stem_tags)
        report["final_ap_stem_rows"] = sum(any(token.startswith("ap_") for token in tag.split()) for tag in stem_tags)
        report["final_linear_algebra_extension_rows"] = sum(contains_tag(tag, "linear_algebra_extension") for tag in stem_tags)
        conn.close()
        conn = None
        os.replace(tmp, args.output)
        report["sqlite_size_bytes"] = args.output.stat().st_size
        report["elapsed_seconds"] = round(time.monotonic() - start, 3)
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        return report
    except Exception:
        if conn is not None:
            conn.close()
        for candidate in (tmp, Path(str(tmp) + "-wal"), Path(str(tmp) + "-shm")):
            candidate.unlink(missing_ok=True)
        raise


def main(argv: list[str] | None = None) -> int:
    try:
        args = parse_args(argv)
        report = build_database(args)
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return 0
    except (FileNotFoundError, ValueError) as error:
        print(f"Kaikki build failed: {error}", file=sys.stderr)
        return 2
    except Exception as error:
        print(f"Kaikki build failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
