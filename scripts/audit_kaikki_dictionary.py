#!/usr/bin/env python3
"""Audit a generated Kaikki WordFan dictionary and optional comparison/package sources."""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import sqlite3
import sys
from pathlib import Path

try:
    from scripts.build_kaikki_dictionary import AP_STEM_TAGS, contains_tag, normalize_word
except ModuleNotFoundError:
    from build_kaikki_dictionary import AP_STEM_TAGS, contains_tag, normalize_word


REQUIRED_METADATA = {"source_name", "source_format", "data_version", "variant", "generated_at", "created_at_unix"}
STEM_SAMPLES = ("isosceles", "scalene", "rhombus", "derivative", "momentum", "eigenvalue")
CORE_SQLITE_MAX_BYTES = 50 * 1024 * 1024


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--kaikki-db", type=Path, required=True)
    parser.add_argument("--current-slim-db", type=Path)
    parser.add_argument("--current-full-shards", type=Path)
    parser.add_argument("--preview-package", type=Path)
    parser.add_argument("--report", type=Path)
    parser.add_argument("--strict", action="store_true",
                        help="Require full-build STEM, representative inflection, and overlay quality gates.")
    return parser.parse_args(argv)


def _table_exists(conn: sqlite3.Connection, name: str) -> bool:
    return conn.execute("SELECT 1 FROM sqlite_master WHERE name=?", (name,)).fetchone() is not None


def audit_health(conn: sqlite3.Connection) -> tuple[dict, list[str]]:
    failures: list[str] = []
    quick = conn.execute("PRAGMA quick_check").fetchone()[0]
    rows = int(conn.execute("SELECT count(*) FROM dictionary_entries").fetchone()[0])
    fts_exists = _table_exists(conn, "dictionary_search_fts")
    fts_rows = int(conn.execute("SELECT count(*) FROM dictionary_search_fts").fetchone()[0]) if fts_exists else 0
    metadata = {row[0] for row in conn.execute("SELECT key FROM metadata")} if _table_exists(conn, "metadata") else set()
    if quick != "ok":
        failures.append(f"SQLite quick_check failed: {quick}")
    if not fts_exists or fts_rows != rows:
        failures.append(f"FTS row mismatch: dictionary={rows}, fts={fts_rows}")
    missing = sorted(REQUIRED_METADATA - metadata)
    if missing:
        failures.append("Missing metadata keys: " + ", ".join(missing))
    return {
        "quick_check": quick, "dictionary_rows": rows, "fts_rows": fts_rows,
        "fts_matches_dictionary_rows": fts_exists and fts_rows == rows,
        "metadata_keys_present": sorted(metadata), "metadata_keys_missing": missing,
    }, failures


def _details(conn: sqlite3.Connection):
    for normalized, translation, detail in conn.execute("SELECT normalized_word, translation, detail FROM dictionary_entries"):
        parsed = None
        malformed = False
        if detail:
            try:
                parsed = json.loads(detail)
                malformed = not isinstance(parsed, dict)
            except (json.JSONDecodeError, TypeError):
                malformed = True
        yield normalized, translation, detail, parsed, malformed


def audit_chinese_and_detail(conn: sqlite3.Connection, total: int) -> tuple[dict, dict, list[str]]:
    chinese = {
        "rows_with_translation": 0, "rows_with_kaikki_sense_chinese": 0,
        "rows_with_kaikki_entry_chinese": 0, "rows_with_wordfan_full_overlay_chinese": 0,
        "rows_with_wordfan_slim_overlay_chinese": 0, "rows_without_chinese": 0,
    }
    detail_stats = {
        "rows_with_detail": 0, "rows_with_display_meanings": 0,
        "rows_with_detailed_definitions": 0, "rows_with_translation_fallback": 0,
        "malformed_detail_rows": 0,
    }
    for _normalized, translation, detail, parsed, malformed in _details(conn):
        if translation and str(translation).strip():
            chinese["rows_with_translation"] += 1
        else:
            chinese["rows_without_chinese"] += 1
        if detail:
            detail_stats["rows_with_detail"] += 1
        if malformed:
            detail_stats["malformed_detail_rows"] += 1
            continue
        if not parsed:
            continue
        meanings = parsed.get("displayMeanings") if isinstance(parsed.get("displayMeanings"), list) else []
        if meanings:
            detail_stats["rows_with_display_meanings"] += 1
        if isinstance(parsed.get("detailedDefinitions"), list) and parsed["detailedDefinitions"]:
            detail_stats["rows_with_detailed_definitions"] += 1
        fallback = parsed.get("translationFallback") if isinstance(parsed.get("translationFallback"), dict) else None
        if fallback:
            detail_stats["rows_with_translation_fallback"] += 1
        sources = {item.get("zhSource") for item in meanings if isinstance(item, dict) and item.get("zh")}
        if fallback and fallback.get("zh"):
            sources.add(fallback.get("zhSource"))
        for source, key in (
            ("kaikki-sense", "rows_with_kaikki_sense_chinese"),
            ("kaikki-entry", "rows_with_kaikki_entry_chinese"),
            ("wordfan-full-overlay", "rows_with_wordfan_full_overlay_chinese"),
            ("wordfan-slim-overlay", "rows_with_wordfan_slim_overlay_chinese"),
        ):
            if source in sources:
                chinese[key] += 1
    chinese["translation_coverage_percent"] = round(100 * chinese["rows_with_translation"] / max(1, total), 4)
    failures = [f"Malformed structured detail rows: {detail_stats['malformed_detail_rows']}"] if detail_stats["malformed_detail_rows"] else []
    return chinese, detail_stats, failures


def audit_stem(conn: sqlite3.Connection) -> dict:
    rows = list(conn.execute("SELECT normalized_word, tag FROM dictionary_entries WHERE tag IS NOT NULL AND trim(tag) <> ''"))
    stem = [(word, tag) for word, tag in rows if any(contains_tag(tag, token) or any(part.startswith(token + "_") for part in str(tag).split()) for token in AP_STEM_TAGS)]
    present = {normalize_word(row[0]) for row in conn.execute(
        f"SELECT normalized_word FROM dictionary_entries WHERE normalized_word IN ({','.join('?' for _ in STEM_SAMPLES)})", STEM_SAMPLES
    )}
    samples = {term: term in present for term in STEM_SAMPLES}
    return {
        "status": "checked" if present else "skipped-no-sample-terms",
        "final_stem_rows": len(stem),
        "final_k12_stem_rows": sum(any(token.startswith("k12_") for token in str(tag).split()) for _, tag in stem),
        "final_ap_stem_rows": sum(any(token.startswith("ap_") for token in str(tag).split()) for _, tag in stem),
        "final_linear_algebra_extension_rows": sum(contains_tag(tag, "linear_algebra_extension") for _, tag in stem),
        "sample_stem_terms": samples,
        "sample_stem_terms_present": all(term in present for term in STEM_SAMPLES),
    }


def audit_inflections(conn: sqlite3.Connection) -> dict:
    values = {row[0]: row[1] for row in conn.execute(
        "SELECT normalized_word, exchange FROM dictionary_entries WHERE normalized_word IN ('run','excite')"
    )}
    run = str(values.get("run") or "")
    excite = str(values.get("excite") or "")
    return {
        "run_present": "run" in values, "running_alias": "running" in run,
        "ran_alias": "ran" in run, "excite_present": "excite" in values,
        "excited_alias": "excited" in excite,
        "status": "checked" if values else "skipped-no-sample-terms",
    }


def audit_overlay_preservation(conn: sqlite3.Connection, source: Path | None) -> dict:
    if source is None or not source.exists():
        return {"status": "skipped", "reason": "current slim comparison source not provided or missing"}
    metrics = {"matching_rows": 0, "tags_preserved": 0, "toefl_preserved": 0, "frq_preserved": 0, "bnc_preserved": 0, "collins_preserved": 0, "oxford_preserved": 0}
    with sqlite3.connect(f"file:{source.resolve()}?mode=ro", uri=True) as current:
        columns = {row[1] for row in current.execute("PRAGMA table_info(dictionary_entries)")}
        wanted = [name for name in ("normalized_word", "tag", "is_toefl", "frq", "bnc", "collins", "oxford") if name in columns]
        target = {row[0]: row for row in conn.execute("SELECT normalized_word,tag,is_toefl,frq,bnc,collins,oxford FROM dictionary_entries")}
        for source_row in current.execute(f"SELECT {','.join(wanted)} FROM dictionary_entries"):
            values = dict(zip(wanted, source_row))
            key = normalize_word(values.get("normalized_word") or "")
            row = target.get(key)
            if not row:
                continue
            metrics["matching_rows"] += 1
            _word, tag, toefl, frq, bnc, collins, oxford = row
            source_tags = set(str(values.get("tag") or "").split())
            if source_tags <= set(str(tag or "").split()): metrics["tags_preserved"] += 1
            if not values.get("is_toefl") or toefl: metrics["toefl_preserved"] += 1
            if values.get("frq") is None or frq == values.get("frq"): metrics["frq_preserved"] += 1
            if values.get("bnc") is None or bnc == values.get("bnc"): metrics["bnc_preserved"] += 1
            if not values.get("collins") or collins >= values.get("collins"): metrics["collins_preserved"] += 1
            if not values.get("oxford") or oxford >= values.get("oxford"): metrics["oxford_preserved"] += 1
    return {"status": "checked", **metrics}


def audit_shards(path: Path | None) -> dict:
    if path is None or not path.exists():
        return {"status": "skipped", "reason": "current full shard comparison source not provided or missing"}
    result = {
        "status": "failed", "shards_checked": 0, "entries_counted": 0,
        "aliases_counted": 0, "bytes_counted": 0,
    }

    def fail(reason: str) -> dict:
        result["reason"] = reason
        return result

    manifest_path = path / "manifest.json"
    if not manifest_path.is_file():
        return fail("manifest.json missing")
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        shards = manifest.get("shards")
        shard_count = manifest.get("shardCount")
        if manifest.get("formatVersion") != 1:
            return fail("unsupported manifest formatVersion")
        if not isinstance(shards, list) or not isinstance(shard_count, int) or shard_count < 1:
            return fail("invalid manifest shards or shardCount")
        if len(shards) != shard_count:
            return fail(f"shardCount mismatch: manifest={shard_count}, listed={len(shards)}")
        for index, shard in enumerate(shards):
            if not isinstance(shard, dict):
                return fail(f"invalid shard record at index {index}")
            relative = shard.get("path")
            expected_id = format(index, f"0{max(2, len(f'{shard_count - 1:x}'))}x")
            if (not isinstance(relative, str) or not relative
                    or Path(relative).name != relative or Path(relative).is_absolute()):
                return fail(f"invalid shard path at index {index}: {relative!r}")
            if shard.get("id") != expected_id or relative != f"shard-{expected_id}.json.gz":
                return fail(f"invalid shard ordering/path at index {index}: {relative}")
            shard_path = path / relative
            if not shard_path.is_file():
                return fail(f"missing {relative}")
            actual_bytes = shard_path.stat().st_size
            if not isinstance(shard.get("bytes"), int) or actual_bytes != shard["bytes"]:
                return fail(f"size mismatch for {relative}")
            checksum = hashlib.sha256(shard_path.read_bytes()).hexdigest()
            if checksum != shard.get("sha256"):
                return fail(f"checksum mismatch for {relative}")
            with gzip.open(shard_path, "rt", encoding="utf-8") as handle:
                payload = json.load(handle)
            if (payload.get("v") != 1 or not isinstance(payload.get("e"), dict)
                    or not isinstance(payload.get("a"), dict)):
                return fail(f"invalid payload {relative}")
            entries = len(payload["e"])
            aliases = len(payload["a"])
            if entries != shard.get("entries") or aliases != shard.get("aliases"):
                return fail(f"payload count mismatch for {relative}")
            result["shards_checked"] += 1
            result["entries_counted"] += entries
            result["aliases_counted"] += aliases
            result["bytes_counted"] += actual_bytes
        if result["entries_counted"] != manifest.get("rowCount"):
            return fail("row total mismatch")
        if result["aliases_counted"] != manifest.get("aliasCount"):
            return fail("alias total mismatch")
        if result["bytes_counted"] != manifest.get("totalCompressedBytes"):
            return fail("total compressed bytes mismatch")
    except (OSError, UnicodeError, json.JSONDecodeError, TypeError, ValueError) as exc:
        return fail(f"invalid shard package: {exc}")
    result.update({"status": "checked", "reason": None, "format_version": 1})
    return result


def audit_preview_package(path: Path | None) -> dict:
    if path is None or not path.exists():
        return {"status": "skipped", "reason": "preview package not provided or missing"}
    required = (path / "dictionary-manifest.json", path / "dictionary-full/manifest.json")
    missing = [str(item) for item in required if not item.is_file()]
    if missing:
        return {"status": "failed", "missing": missing}
    manifest = json.loads(required[0].read_text(encoding="utf-8"))
    core_bytes = int(manifest.get("sqlite", {}).get("bytes") or 0)
    within_target = 0 < core_bytes <= CORE_SQLITE_MAX_BYTES
    return {
        "status": "checked" if within_target else "failed",
        "missing": [], "core_sqlite_bytes": core_bytes,
        "core_sqlite_max_bytes": CORE_SQLITE_MAX_BYTES,
        "core_within_memory_target": within_target,
    }


def audit_database(args: argparse.Namespace) -> tuple[dict, bool]:
    failures: list[str] = []
    strict = bool(getattr(args, "strict", False))
    with sqlite3.connect(f"file:{args.kaikki_db.resolve()}?mode=ro", uri=True) as conn:
        health, health_failures = audit_health(conn)
        failures.extend(health_failures)
        chinese, detail, detail_failures = audit_chinese_and_detail(conn, health["dictionary_rows"])
        failures.extend(detail_failures)
        shards = audit_shards(args.current_full_shards)
        package = audit_preview_package(args.preview_package)
        if shards.get("status") == "failed": failures.append(shards.get("reason", "shard audit failed"))
        if package.get("status") == "failed": failures.append("preview package is incomplete or exceeds the core memory target")
        stem = audit_stem(conn)
        inflections = audit_inflections(conn)
        if strict:
            if not stem["sample_stem_terms_present"]:
                missing_stem = [term for term, present in stem["sample_stem_terms"].items() if not present]
                failures.append("Strict STEM samples missing: " + ", ".join(missing_stem))
                stem["status"] = "problem"
            if inflections["run_present"] and not (inflections["running_alias"] and inflections["ran_alias"]):
                failures.append("Strict inflection check failed: run must include running and ran")
                inflections["status"] = "problem"
            if inflections["excite_present"] and not inflections["excited_alias"]:
                failures.append("Strict inflection check failed: excite must include excited")
                inflections["status"] = "problem"
            if args.current_full_shards is not None and shards.get("status") == "checked" and chinese["rows_with_wordfan_full_overlay_chinese"] == 0:
                failures.append("Strict full-overlay check failed: no WordFan full-overlay Chinese rows found")
                shards["overlay_chinese_status"] = "problem"
        report = {
            "status": "pass" if not failures else "fail", "strict": strict, "kaikki_db": str(args.kaikki_db),
            "health": health, "chinese_coverage": chinese,
            "tag_rank_preservation": audit_overlay_preservation(conn, args.current_slim_db),
            "stem_preservation": stem, "inflections": inflections,
            "structured_detail": detail, "full_shard_comparison": shards,
            "packaging_compatibility": package, "failures": failures,
        }
    return report, not failures


def write_report(path: Path | None, report: dict) -> None:
    if path is None:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    try:
        args = parse_args(argv)
    except SystemExit as error:
        return 2 if error.code else 0
    if not args.kaikki_db.is_file():
        report = {"status": "invalid-input", "failures": [f"Required Kaikki DB missing: {args.kaikki_db}"]}
        write_report(args.report, report)
        return 2
    try:
        report, passed = audit_database(args)
    except Exception as error:
        report = {"status": "fail", "kaikki_db": str(args.kaikki_db), "failures": [str(error)]}
        write_report(args.report, report)
        return 1
    write_report(args.report, report)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
