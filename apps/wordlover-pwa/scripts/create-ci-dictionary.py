#!/usr/bin/env python3
"""Create a tiny web dictionary package for browser CI.

The production dictionary is generated from the offline ECDICT pipeline and is
not committed. CI only needs enough real SQLite/FTS structure for app-shell
smoke tests, so this fixture reuses the production slim schema and packaging
metadata shape without checking in generated dictionary files.
"""

from __future__ import annotations

import argparse
import json
import shutil
import sqlite3
import sys
import time
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.build_slim_dictionary import SCHEMA_SQL, populate_fts  # noqa: E402
from scripts.package_dictionary_web import compress_zstd, sha256_file  # noqa: E402
from scripts.package_dictionary_shards import package as package_full_dictionary_shards  # noqa: E402


DEFAULT_OUTPUT_DIR = ROOT / "apps/wordlover-pwa/public"
DEFAULT_WORK_DIR = ROOT / "data/ci"
DEFAULT_VERSION = "ci.fixture.1"


COLUMNS = [
    "id",
    "word",
    "normalized_word",
    "phonetic",
    "definition",
    "definition_source",
    "definition_augmented_at",
    "translation",
    "pos",
    "collins",
    "oxford",
    "tag",
    "is_toefl",
    "bnc",
    "frq",
    "exchange",
    "detail",
    "audio",
    "source",
]


FIXTURE_ROWS = [
    {
        "word": "structuredword",
        "phonetic": "/ˈstrʌktʃərd/",
        "definition": "n. a structured dictionary fixture",
        "translation": "结构化词条",
        "pos": "n",
        "bnc": 1,
        "frq": 1,
        "detail": json.dumps({
            "displayMeanings": [{
                "rank": 1, "pos": "n.", "zh": "结构化词条", "zhSource": "kaikki-sense",
                "en": "a structured dictionary fixture", "domain": "Computing", "source": "Kaikki/Wiktextract",
            }],
            "detailedDefinitions": [{
                "pos": "Noun", "senses": [{
                    "definition": "an entry used to verify structured rendering",
                    "domain": None, "examples": ["This structured example wraps safely."],
                    "source": "Kaikki/Wiktextract",
                }],
            }],
        }, ensure_ascii=False, separators=(",", ":")),
    },
    {
        "word": "abandon",
        "phonetic": "/əˈbændən/",
        "definition": "to leave a place, thing, or person permanently",
        "translation": "放弃；抛弃",
        "pos": "v",
        "bnc": 1250,
        "frq": 1250,
        "detail": "They had to abandon the plan after the storm.",
    },
    {
        "word": "take off",
        "phonetic": "/teɪk ɔːf/",
        "definition": "to leave the ground and begin to fly; to remove something",
        "translation": "起飞；脱下",
        "pos": "phr",
        "bnc": 1800,
        "frq": 1800,
        "detail": "The plane will take off at noon.",
    },
    {
        "word": "take",
        "phonetic": "/teɪk/",
        "definition": "to get, carry, or move something; to accept or use something",
        "translation": "拿；取；接受；花费",
        "pos": "v",
        "bnc": 51,
        "frq": 63,
        "exchange": "p:took/d:taken/i:taking/3:takes",
        "detail": "Please take this book with you.",
    },
    {
        "word": "hurry",
        "phonetic": "/ˈhɜːri/",
        "definition": "to move or do something quickly",
        "translation": "赶快；匆忙；催促",
        "pos": "v",
        "bnc": 3065,
        "frq": 3609,
        "exchange": "p:hurried/i:hurrying/d:hurried/3:hurries",
        "detail": "We need to hurry to catch the train.",
    },
    {
        "word": "in terms of",
        "phonetic": "/ɪn tɜːrmz əv/",
        "definition": "used to describe which particular area of a subject is being discussed",
        "translation": "就……而言；从……方面",
        "pos": "phr",
        "bnc": 2100,
        "frq": 2100,
        "detail": "In terms of speed, this option is better.",
    },
    {
        "word": "abundant",
        "phonetic": "/əˈbʌndənt/",
        "definition": "existing in large quantities",
        "translation": "丰富的；充足的",
        "pos": "adj",
        "bnc": 2600,
        "frq": 2600,
        "detail": "The region has abundant fresh water.",
    },
    {
        "word": "accurate",
        "phonetic": "/ˈækjərət/",
        "definition": "correct, exact, and without mistakes",
        "translation": "准确的；精确的",
        "pos": "adj",
        "bnc": 2300,
        "frq": 2300,
        "detail": "The report gives an accurate account of events.",
    },
    {
        "word": "echo",
        "phonetic": "/ˈekoʊ/",
        "definition": "a sound that is repeated because it bounces back",
        "translation": "回声；回响",
        "pos": "n",
        "bnc": 60,
        "frq": 60,
        "detail": "Her voice made an echo in the hall.",
    },
    {
        "word": "delta",
        "phonetic": "/ˈdeltə/",
        "definition": "an area of low land where a river divides before entering the sea",
        "translation": "三角洲",
        "pos": "n",
        "bnc": 70,
        "frq": 70,
        "detail": "The river forms a wide delta.",
    },
    {
        "word": "charlie",
        "phonetic": "/ˈtʃɑːrli/",
        "definition": "a code word for the letter C",
        "translation": "字母 C 的代码词",
        "pos": "n",
        "bnc": 80,
        "frq": 80,
        "detail": "Charlie is used for C in the radio alphabet.",
    },
    {
        "word": "bravo",
        "phonetic": "/ˌbrɑːˈvoʊ/",
        "definition": "a word used to praise a performance",
        "translation": "喝彩；太好了",
        "pos": "interj",
        "bnc": 90,
        "frq": 90,
        "detail": "The crowd shouted bravo after the song.",
    },
    {
        "word": "alpha",
        "phonetic": "/ˈælfə/",
        "definition": "the first letter of the Greek alphabet",
        "translation": "希腊字母表的第一个字母",
        "pos": "n",
        "bnc": 100,
        "frq": 100,
        "detail": "Alpha comes before beta.",
    },
    {
        "word": "academic",
        "phonetic": "/ˌækəˈdemɪk/",
        "definition": "relating to education, schools, universities, or study",
        "translation": "学术的；学院的",
        "pos": "adj",
        "bnc": 5000,
        "frq": 5000,
        "tag": "TOEFL",
        "is_toefl": 1,
        "detail": "She wrote an academic essay.",
    },
    {
        "word": "capacity",
        "phonetic": "/kəˈpæsəti/",
        "definition": "the total amount that can be contained or produced",
        "translation": "容量；能力",
        "pos": "n",
        "bnc": 2400,
        "frq": 2400,
        "detail": "The room has a capacity of fifty people.",
    },
    {
        "word": "temporary",
        "phonetic": "/ˈtempəreri/",
        "definition": "lasting for only a limited period of time",
        "translation": "临时的；暂时的",
        "pos": "adj",
        "bnc": 2450,
        "frq": 2450,
        "detail": "They found a temporary solution.",
    },
    {
        "word": "sufficient",
        "phonetic": "/səˈfɪʃnt/",
        "definition": "enough for a particular purpose",
        "translation": "足够的；充分的",
        "pos": "adj",
        "bnc": 2500,
        "frq": 2500,
        "detail": "There was sufficient time to finish.",
    },
    {
        "word": "evidence",
        "phonetic": "/ˈevɪdəns/",
        "definition": "facts or information showing whether something is true",
        "translation": "证据；根据",
        "pos": "n",
        "bnc": 2550,
        "frq": 2550,
        "detail": "The scientist collected evidence.",
    },
]



FULL_ONLY_ROW = {
    "word": "fullsizeonlyword",
    "phonetic": "/fʊl/",
    "definition": "a term present only in the full dictionary fixture",
    "definition_source": "CI full fixture",
    "translation": "仅存在于完整词典中的词",
    "pos": "n",
    "tag": "rare",
    "exchange": "s:fullsizeonlywords",
    "detail": "This entry verifies the supplemental full dictionary fallback.",
    "source": "CI full fixture",
}

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--work-dir", type=Path, default=DEFAULT_WORK_DIR)
    parser.add_argument("--version", default=DEFAULT_VERSION)
    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite an existing production dictionary in the output dir. "
        "Required outside throwaway CI checkouts (the default refuses to clobber "
        "the shipped dictionary).",
    )
    return parser.parse_args()


def guard_production_dictionary(output_dir: Path, force: bool) -> None:
    """Refuse to replace a shipped dictionary with the CI fixture unless forced.

    Running this script writes into the same files the app serves. If the output
    dir already holds a production manifest (variant != "ci-fixture"), overwriting
    it silently swaps the real ~100k-entry dictionary for the 17-row fixture and
    dirties the tracked manifest. CI runs in a throwaway checkout and opts in with
    --force; a developer machine should not clobber its served dictionary.
    """
    manifest_path = output_dir / "dictionary-manifest.json"
    if force or not manifest_path.exists():
        return
    try:
        existing = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return
    if existing.get("variant") == "ci-fixture":
        return
    raise SystemExit(
        f"Refusing to overwrite the production dictionary manifest at {manifest_path}\n"
        f"  (variant={existing.get('variant')!r}, "
        f"dictionaryDataVersion={existing.get('dictionaryDataVersion')!r}).\n"
        "This would replace the shipped dictionary with the 17-row CI fixture.\n"
        "  - In CI / a throwaway checkout, pass --force.\n"
        "  - On a dev machine, this is almost certainly a mistake. If you really want\n"
        "    the fixture, pass --force, then restore production with:\n"
        "      python scripts/package_dictionary_web.py --copy-sqlite"
    )


def normalized_word(word: str) -> str:
    return " ".join(word.strip().lower().split())


def row_values(row_id: int, row: dict[str, object]) -> list[object]:
    merged = {
        "id": row_id,
        "word": row["word"],
        "normalized_word": row.get("normalized_word") or normalized_word(str(row["word"])),
        "phonetic": row.get("phonetic"),
        "definition": row["definition"],
        "definition_source": row.get("definition_source", "CI fixture"),
        "definition_augmented_at": row.get("definition_augmented_at"),
        "translation": row["translation"],
        "pos": row.get("pos"),
        "collins": row.get("collins", 0),
        "oxford": row.get("oxford", 0),
        "tag": row.get("tag"),
        "is_toefl": row.get("is_toefl", 0),
        "bnc": row.get("bnc"),
        "frq": row.get("frq"),
        "exchange": row.get("exchange"),
        "detail": row.get("detail"),
        "audio": row.get("audio"),
        "source": row.get("source", "CI fixture"),
    }
    return [merged[column] for column in COLUMNS]


def build_fixture_sqlite(path: Path, version: str) -> int:
    if path.exists():
        path.unlink()
    path.parent.mkdir(parents=True, exist_ok=True)
    placeholders = ",".join("?" for _ in COLUMNS)
    with sqlite3.connect(path) as conn:
        conn.executescript(SCHEMA_SQL)
        conn.executemany(
            f"INSERT INTO dictionary_entries ({','.join(COLUMNS)}) VALUES ({placeholders})",
            [row_values(index + 1, row) for index, row in enumerate(FIXTURE_ROWS)],
        )
        conn.executemany(
            "INSERT INTO metadata(key, value) VALUES (?, ?)",
            [
                ("dictionary_data_version", version),
                ("variant", "ci-fixture"),
                ("generated_at", time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())),
            ],
        )
        populate_fts(conn)
        conn.commit()
        return int(conn.execute("SELECT count(*) FROM dictionary_entries").fetchone()[0])



def build_full_fixture_sqlite(source: Path, target: Path) -> None:
    shutil.copy2(source, target)
    placeholders = ",".join("?" for _ in COLUMNS)
    with sqlite3.connect(target) as conn:
        next_id = int(conn.execute("SELECT COALESCE(max(id), 0) + 1 FROM dictionary_entries").fetchone()[0])
        conn.execute(
            f"INSERT INTO dictionary_entries ({','.join(COLUMNS)}) VALUES ({placeholders})",
            row_values(next_id, FULL_ONLY_ROW),
        )
        conn.commit()


def write_manifest(output_dir: Path, sqlite_path: Path, zst_path: Path, row_count: int, version: str) -> None:
    manifest = {
        "app": "wordlover",
        "dictionaryDataVersion": version,
        "variant": "ci-fixture",
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "rowCount": row_count,
        "sqlite": {
            "path": "dictionary.sqlite",
            "bytes": sqlite_path.stat().st_size,
            "sha256": sha256_file(sqlite_path),
        },
        "zstd": {
            "path": "dictionary.sqlite.zst",
            "bytes": zst_path.stat().st_size,
            "sha256": sha256_file(zst_path),
            "level": 3,
        },
        "sources": ["CI fixture"],
    }
    (output_dir / "dictionary-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(manifest, indent=2))


def main() -> None:
    args = parse_args()
    guard_production_dictionary(args.output_dir, args.force)
    args.output_dir.mkdir(parents=True, exist_ok=True)
    args.work_dir.mkdir(parents=True, exist_ok=True)

    work_sqlite = args.work_dir / "dictionary-ci-fixture.sqlite"
    row_count = build_fixture_sqlite(work_sqlite, args.version)
    full_work_sqlite = args.work_dir / "dictionary-full-ci-fixture.sqlite"
    build_full_fixture_sqlite(work_sqlite, full_work_sqlite)
    package_full_dictionary_shards(argparse.Namespace(
        input=full_work_sqlite,
        output_dir=args.output_dir / "dictionary-full",
        version=f"{args.version}.full",
        shard_count=4,
        gzip_level=9,
        skip_validation=False,
    ))

    sqlite_path = args.output_dir / "dictionary.sqlite"
    zst_path = args.output_dir / "dictionary.sqlite.zst"
    shutil.copy2(work_sqlite, sqlite_path)
    compress_zstd(work_sqlite, zst_path, level=3)
    write_manifest(args.output_dir, sqlite_path, zst_path, row_count, args.version)


if __name__ == "__main__":
    main()
