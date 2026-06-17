#!/usr/bin/env python3
"""Apply post-merge dictionary/runtime fixes once, then remove this helper."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "apps/wordlover-pwa/public"
OLD_ASSET = "20260615-2"
NEW_ASSET = "20260617-1"
OLD_CACHE = "wordlover-shell-v131"
NEW_CACHE = "wordlover-shell-v132"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write(path: Path, text: str) -> None:
    path.write_text(text, encoding="utf-8")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, found {count}")
    return text.replace(old, new, 1)


def replace_between(text: str, start: str, end: str, replacement: str, label: str) -> str:
    start_index = text.find(start)
    if start_index < 0:
        raise RuntimeError(f"{label}: start marker missing")
    end_index = text.find(end, start_index)
    if end_index < 0:
        raise RuntimeError(f"{label}: end marker missing")
    return text[:start_index] + replacement.rstrip() + "\n\n" + text[end_index:]


def patch_full_dictionary() -> None:
    path = PUBLIC / "full-dictionary.js"
    text = read(path)
    text = replace_once(
        text,
        'const MAX_PARSED_SHARDS = 4;\n',
        'const MAX_PARSED_SHARDS = 4;\nconst MAX_CONFIGURED_PARSED_SHARDS = 16;\nconst SHARD_PATH_RE = /^shard-[0-9a-f]+\\.json\\.gz$/;\nconst SHA256_RE = /^[0-9a-f]{64}$/;\n',
        "dictionary constants",
    )
    text = replace_once(
        text,
        'function hasOwn(record, key) {\n  return Object.prototype.hasOwnProperty.call(record, key);\n}\n',
        'function hasOwn(record, key) {\n  return Object.prototype.hasOwnProperty.call(record, key);\n}\n\nfunction isRecord(value) {\n  return Boolean(value) && typeof value === "object" && !Array.isArray(value);\n}\n\nfunction isNonNegativeInteger(value) {\n  return Number.isInteger(value) && value >= 0;\n}\n',
        "dictionary helpers",
    )
    manifest_fn = r'''export function validateFullDictionaryManifest(manifest) {
  if (!isRecord(manifest)) throw new Error("Full dictionary manifest is missing.");
  if (manifest.app !== "wordlover" || manifest.formatVersion !== 1 || manifest.variant !== "full-sharded") {
    throw new Error("Unsupported full dictionary manifest format.");
  }
  if (manifest.hash !== "fnv1a32-utf8-mod" || manifest.compression !== "gzip") {
    throw new Error("Unsupported full dictionary package encoding.");
  }
  if (typeof manifest.dictionaryDataVersion !== "string" || !manifest.dictionaryDataVersion.trim()) {
    throw new Error("Full dictionary manifest has no data version.");
  }
  if (!Number.isInteger(manifest.shardCount) || manifest.shardCount < 1 || manifest.shardCount > 1024) {
    throw new Error("Full dictionary manifest has an invalid shard count.");
  }
  if (!isNonNegativeInteger(manifest.rowCount) || !isNonNegativeInteger(manifest.aliasCount)) {
    throw new Error("Full dictionary manifest has invalid entry totals.");
  }
  if (!isNonNegativeInteger(manifest.totalCompressedBytes)) {
    throw new Error("Full dictionary manifest has an invalid compressed size.");
  }
  if (!Array.isArray(manifest.shards) || manifest.shards.length !== manifest.shardCount) {
    throw new Error("Full dictionary manifest shard list is incomplete.");
  }

  const ids = new Set();
  const paths = new Set();
  let totalBytes = 0;
  let totalEntries = 0;
  let totalAliases = 0;
  for (const [index, shard] of manifest.shards.entries()) {
    if (!isRecord(shard) || typeof shard.id !== "string" || !/^[0-9a-f]+$/.test(shard.id)) {
      throw new Error(`Full dictionary shard ${index} has an invalid id.`);
    }
    if (ids.has(shard.id)) throw new Error(`Full dictionary shard id ${shard.id} is duplicated.`);
    ids.add(shard.id);
    if (typeof shard.path !== "string" || !SHARD_PATH_RE.test(shard.path)) {
      throw new Error(`Full dictionary shard ${index} has an invalid path.`);
    }
    if (paths.has(shard.path)) throw new Error(`Full dictionary shard path ${shard.path} is duplicated.`);
    paths.add(shard.path);
    if (!Number.isInteger(shard.bytes) || shard.bytes <= 0) {
      throw new Error(`Full dictionary shard ${index} has an invalid size.`);
    }
    if (typeof shard.sha256 !== "string" || !SHA256_RE.test(shard.sha256.toLowerCase())) {
      throw new Error(`Full dictionary shard ${index} has an invalid checksum.`);
    }
    if (!isNonNegativeInteger(shard.entries) || !isNonNegativeInteger(shard.aliases)) {
      throw new Error(`Full dictionary shard ${index} has invalid row counts.`);
    }
    totalBytes += shard.bytes;
    totalEntries += shard.entries;
    totalAliases += shard.aliases;
  }
  if (totalBytes !== manifest.totalCompressedBytes) {
    throw new Error("Full dictionary manifest compressed-size total does not match its shards.");
  }
  if (totalEntries !== manifest.rowCount || totalAliases !== manifest.aliasCount) {
    throw new Error("Full dictionary manifest row totals do not match its shards.");
  }
  return manifest;
}'''
    text = replace_between(
        text,
        "export function validateFullDictionaryManifest(manifest) {",
        "export async function decodeFullDictionaryShard",
        manifest_fn,
        "manifest validator",
    )
    decode_fn = r'''export async function decodeFullDictionaryShard(bytes, DecompressionStreamCtor = globalThis.DecompressionStream) {
  if (typeof DecompressionStreamCtor !== "function") {
    throw new Error("This browser cannot decompress the full dictionary package.");
  }
  const source = new Blob([bytes]).stream();
  const decoded = source.pipeThrough(new DecompressionStreamCtor("gzip"));
  const payload = JSON.parse(await new Response(decoded).text());
  if (payload?.v !== 1 || !isRecord(payload.e) || !isRecord(payload.a)) {
    throw new Error("Full dictionary shard data is invalid.");
  }
  return payload;
}'''
    text = replace_between(
        text,
        "export async function decodeFullDictionaryShard",
        "export function fullDictionaryEntryToResult",
        decode_fn,
        "shard decoder",
    )
    text = replace_once(
        text,
        '    this.maxParsedShards = Number(options.maxParsedShards ?? MAX_PARSED_SHARDS);\n    this.manifest = null;\n',
        '    const requestedParsedShards = Number(options.maxParsedShards ?? MAX_PARSED_SHARDS);\n    this.maxParsedShards = Number.isInteger(requestedParsedShards) && requestedParsedShards > 0\n      ? Math.min(requestedParsedShards, MAX_CONFIGURED_PARSED_SHARDS)\n      : MAX_PARSED_SHARDS;\n    this.manifest = null;\n',
        "parsed shard limit",
    )
    text = replace_once(
        text,
        '    this.progress = null;\n    this.lastError = null;\n',
        '    this.progress = null;\n    this.lastError = null;\n    this.offlineInstalled = false;\n    this.offlineVerificationVersion = null;\n',
        "offline state fields",
    )
    text = replace_once(
        text,
        '      offlineInstalled: Boolean(\n        manifest && safeStorageGet(this.storage, INSTALLED_VERSION_KEY) === manifest.dictionaryDataVersion,\n      ),\n',
        '      offlineInstalled: this.offlineInstalled,\n',
        "offline status",
    )
    text = replace_once(
        text,
        '          safeStorageRemove(this.storage, INSTALLED_VERSION_KEY);\n          this.parsedShards.clear();\n          await this.cleanupOldCaches();\n',
        '          this._markOfflineIncomplete();\n          this.parsedShards.clear();\n          await this.cleanupOldCaches();\n',
        "version change offline reset",
    )
    text = replace_once(
        text,
        '      this.manifestCheckedAt = Date.now();\n      this._notify();\n',
        '      if (this.manifest) await this._refreshOfflineInstalledState({ force });\n      this.manifestCheckedAt = Date.now();\n      this._notify();\n',
        "manifest offline verification",
    )
    cache_methods = r'''  async cleanupOldCaches() {
    if (!this.cachesApi?.keys) return;
    const current = this.manifest ? this._cacheName() : null;
    const names = await this.cachesApi.keys();
    await Promise.all(
      names
        .filter((name) => name.startsWith(CACHE_PREFIX) && name !== current)
        .map((name) => this.cachesApi.delete(name)),
    );
  }

  _shardUrl(shard) {
    return `${this.baseUrl}/${shard.path}`;
  }

  _markOfflineIncomplete() {
    safeStorageRemove(this.storage, INSTALLED_VERSION_KEY);
    this.offlineInstalled = false;
    this.offlineVerificationVersion = null;
  }

  async _openCurrentCache() {
    if (!this.cachesApi?.open) return null;
    return this.cachesApi.open(this._cacheName());
  }

  async _cacheHasAllShardResponses(manifest = this.manifest) {
    if (!manifest) return false;
    const cache = await this._openCurrentCache();
    if (!cache?.match) return false;
    const matches = await Promise.all(
      manifest.shards.map((shard) => cache.match(this._shardUrl(shard))),
    );
    return matches.every(Boolean);
  }

  async _missingShardBytes(manifest = this.manifest) {
    if (!manifest) return 0;
    const cache = await this._openCurrentCache();
    if (!cache?.match) return Number(manifest.totalCompressedBytes ?? 0);
    const matches = await Promise.all(
      manifest.shards.map((shard) => cache.match(this._shardUrl(shard))),
    );
    return manifest.shards.reduce(
      (total, shard, index) => total + (matches[index] ? 0 : Number(shard.bytes ?? 0)),
      0,
    );
  }

  async _refreshOfflineInstalledState({ force = false } = {}) {
    const manifest = this.manifest;
    if (!manifest) {
      this._markOfflineIncomplete();
      return false;
    }
    if (!force && this.offlineVerificationVersion === manifest.dictionaryDataVersion) {
      return this.offlineInstalled;
    }
    const markerMatches = safeStorageGet(this.storage, INSTALLED_VERSION_KEY) === manifest.dictionaryDataVersion;
    const complete = markerMatches && await this._cacheHasAllShardResponses(manifest);
    this.offlineInstalled = Boolean(complete);
    this.offlineVerificationVersion = manifest.dictionaryDataVersion;
    if (!complete && markerMatches) safeStorageRemove(this.storage, INSTALLED_VERSION_KEY);
    return this.offlineInstalled;
  }

  async _requireWritableCache() {
    const cache = await this._openCurrentCache();
    if (!cache?.match || !cache?.put) {
      throw new Error("This browser cannot store the full dictionary for offline use.");
    }
    return cache;
  }'''
    text = replace_between(
        text,
        "  async cleanupOldCaches() {",
        "  async _verifyShardBytes",
        cache_methods,
        "cache helpers",
    )
    verify_fn = r'''  async _verifyShardBytes(bytes, shard) {
    if (bytes.byteLength !== Number(shard.bytes)) {
      throw new Error(`Full dictionary shard size mismatch for ${shard.path}.`);
    }
    const digest = await sha256Hex(bytes, this.cryptoApi);
    if (shard.sha256 && !digest) {
      throw new Error("This browser cannot verify full dictionary checksums.");
    }
    if (digest !== String(shard.sha256).toLowerCase()) {
      throw new Error(`Full dictionary shard checksum mismatch for ${shard.path}.`);
    }
  }'''
    text = replace_between(text, "  async _verifyShardBytes", "  async _readCachedShard", verify_fn, "checksum verifier")
    text = replace_once(
        text,
        '    } catch {\n      await cache.delete?.(url);\n      return null;\n',
        '    } catch {\n      await cache.delete?.(url);\n      this._markOfflineIncomplete();\n      return null;\n',
        "corrupt cache state",
    )
    text = replace_once(
        text,
        '    const url = `${this.baseUrl}/${shard.path}`;\n',
        '    const url = this._shardUrl(shard);\n',
        "shard URL helper",
    )
    text = replace_once(
        text,
        '    const cached = await this._readCachedShard(cache, url, shard);\n    if (cached) return cached;\n    if (!this.fetchFn || !this._isOnline()) {\n',
        '    const cached = await this._readCachedShard(cache, url, shard);\n    if (cached) return cached;\n    if (this.offlineInstalled) this._markOfflineIncomplete();\n    if (!this.fetchFn || !this._isOnline()) {\n',
        "evicted cache detection",
    )
    install_fn = r'''  async installAll({ onProgress, concurrency = 4 } = {}) {
    if (this.busy) throw new Error("A full dictionary operation is already running.");
    const manifest = await this.ensureManifest({ force: true });
    if (!manifest) throw new Error(this.lastError ?? "Full dictionary package unavailable.");
    await this._requireWritableCache();
    const missingBytes = await this._missingShardBytes(manifest);
    await this._checkStorage(missingBytes);
    this.busy = true;
    this.lastError = null;
    this._markOfflineIncomplete();
    let completed = 0;
    let completedBytes = 0;
    const total = manifest.shards.length;
    const totalBytes = Number(manifest.totalCompressedBytes ?? 0);
    const report = () => {
      this.progress = {
        completed,
        total,
        completedBytes,
        totalBytes,
        percent: total ? Math.round((completed / total) * 100) : 100,
      };
      onProgress?.(this.progress);
      this._notify();
    };
    report();
    let cursor = 0;
    const worker = async () => {
      while (cursor < total) {
        const index = cursor;
        cursor += 1;
        const shard = manifest.shards[index];
        await this._getShardBytes(shard);
        completed += 1;
        completedBytes += Number(shard.bytes ?? 0);
        report();
      }
    };
    try {
      const workerCount = Math.max(1, Math.min(8, Number(concurrency) || 4));
      await Promise.all(Array.from({ length: workerCount }, worker));
      if (!await this._cacheHasAllShardResponses(manifest)) {
        throw new Error("The full dictionary download finished, but one or more shards were not stored.");
      }
      safeStorageSet(this.storage, INSTALLED_VERSION_KEY, manifest.dictionaryDataVersion);
      this.offlineInstalled = true;
      this.offlineVerificationVersion = manifest.dictionaryDataVersion;
      this.progress = { completed: total, total, completedBytes: totalBytes, totalBytes, percent: 100 };
      return this.status();
    } catch (error) {
      this._markOfflineIncomplete();
      this.lastError = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      this.busy = false;
      this._notify();
    }
  }'''
    text = replace_between(text, "  async installAll(", "  async removeOfflineCopy", install_fn, "offline installer")
    remove_fn = r'''  async removeOfflineCopy() {
    if (this.busy) throw new Error("A full dictionary operation is already running.");
    this.busy = true;
    this.lastError = null;
    this._notify();
    try {
      if (this.cachesApi?.keys && this.cachesApi?.delete) {
        const names = await this.cachesApi.keys();
        await Promise.all(
          names.filter((name) => name.startsWith(CACHE_PREFIX)).map((name) => this.cachesApi.delete(name)),
        );
      } else if (this.cachesApi?.delete && this.manifest) {
        await this.cachesApi.delete(this._cacheName());
      }
      this._markOfflineIncomplete();
      this.parsedShards.clear();
      this.progress = null;
      return this.status();
    } finally {
      this.busy = false;
      this._notify();
    }
  }'''
    text = replace_between(text, "  async removeOfflineCopy()", "}\n\nexport function createFullDictionaryClient", remove_fn + "\n}", "offline removal")
    write(path, text)


def patch_app() -> None:
    path = PUBLIC / "app.js"
    text = read(path)
    text = text.replace(f"?v={OLD_ASSET}", f"?v={NEW_ASSET}")
    text = text.replace(OLD_CACHE, NEW_CACHE)
    text = replace_once(text, 'const APP_VERSION = "0.6.2-product.20260615-2-v131";', 'const APP_VERSION = "0.6.2-product.20260617-1-v132";', "app version")
    text = replace_once(text, 'let debounceHandle = 0;\n', 'let debounceHandle = 0;\nlet lookupRequestSequence = 0;\n', "lookup sequence state")
    old_sanitize = '''function sanitizeTermInput() {
  const before = termInput.value;
  const cleaned = before.replace(DISALLOWED_TERM_CHARS, "");
  if (cleaned === before) return;
  const caret = termInput.selectionStart ?? cleaned.length;
  const keptBeforeCaret = before.slice(0, caret).replace(DISALLOWED_TERM_CHARS, "").length;
  termInput.value = cleaned;
  try {
    termInput.setSelectionRange(keptBeforeCaret, keptBeforeCaret);
  } catch {
    /* setSelectionRange not available in this state */
  }
}'''
    new_sanitize = '''function sanitizeTermInput() {
  const before = termInput.value;
  const normalized = normalizeApostrophes(before);
  const cleaned = normalized.replace(DISALLOWED_TERM_CHARS, "");
  if (cleaned === before) return;
  const caret = termInput.selectionStart ?? cleaned.length;
  const keptBeforeCaret = normalizeApostrophes(before.slice(0, caret)).replace(DISALLOWED_TERM_CHARS, "").length;
  termInput.value = cleaned;
  try {
    termInput.setSelectionRange(keptBeforeCaret, keptBeforeCaret);
  } catch {
    /* setSelectionRange not available in this state */
  }
}'''
    text = replace_once(text, old_sanitize, new_sanitize, "smart apostrophe sanitization")
    text = replace_once(text, 'function clearSearchField() {\n  termInput.value = "";\n', 'function clearSearchField() {\n  lookupRequestSequence += 1;\n  termInput.value = "";\n', "clear invalidates lookup")
    text = replace_once(text, 'termInput.addEventListener("input", () => {\n  sanitizeTermInput();\n', 'termInput.addEventListener("input", () => {\n  lookupRequestSequence += 1;\n  sanitizeTermInput();\n', "input invalidates lookup")
    run_lookup = r'''async function runLookup({ commit = false, allowFull = commit } = {}) {
  const value = termInput.value;
  const requestId = ++lookupRequestSequence;
  if (!value.trim()) {
    result.innerHTML = `<p class="muted">Type a term to test local lookup.</p>`;
    renderSuggestions([]);
    return null;
  }
  if (!loaded) {
    const ready = await ensureDictionaryLoaded();
    if (!ready || requestId !== lookupRequestSequence || termInput.value !== value) return null;
  }
  try {
    const data = allowFull ? await lookupTermWithFullFallback(value) : lookupTerm(value);
    if (requestId !== lookupRequestSequence || termInput.value !== value) return null;
    renderResult(data);
    if (commit && data.status === "found") {
      const at = nowIso();
      await addHistory({ term: data.term, searchedAt: at, queriedAt: at, queryMs: data.queryMs ?? 0 });
    }
    return data;
  } catch (error) {
    if (requestId !== lookupRequestSequence || termInput.value !== value) return null;
    result.innerHTML = `<p class="error">${escapeHtml(error instanceof Error ? error.message : String(error))}</p>`;
    return null;
  }
}'''
    text = replace_between(text, "async function runLookup(", "async function runLoadedLookupForReturn", run_lookup, "lookup sequencing")
    loaded_lookup = r'''async function runLoadedLookupForReturn() {
  return runLookup({ commit: true, allowFull: true });
}'''
    text = replace_between(text, "async function runLoadedLookupForReturn", "let invalidFlagHandle", loaded_lookup, "return lookup delegation")
    write(path, text)


def patch_normalizers() -> None:
    for relative in ("scripts/build_dictionary.py", "scripts/package_dictionary_shards.py"):
        path = ROOT / relative
        text = read(path)
        if "APOSTROPHE_TRANSLATION" not in text:
            marker = 'SHORT_TERM_RE = re.compile(r"^[A-Za-z]+(?:[ \'-][A-Za-z]+){0,5}$")\n' if relative.endswith("build_dictionary.py") else 'DEFAULT_VERSION = f"{time.strftime(\'%Y.%m.%d\')}.full-shards"\n'
            text = replace_once(
                text,
                marker,
                marker + 'APOSTROPHE_TRANSLATION = str.maketrans({"‘": "\'", "’": "\'", "ʼ": "\'", "`": "\'", "＇": "\'"})\n',
                f"{relative} apostrophe table",
            )
        if relative.endswith("build_dictionary.py"):
            text = replace_once(
                text,
                '    word = word.strip().replace("’", "\'").replace("`", "\'")\n',
                '    word = word.strip().translate(APOSTROPHE_TRANSLATION)\n',
                "build normalizer",
            )
        else:
            text = replace_once(
                text,
                '    return " ".join(value.strip().replace("’", "\'").replace("`", "\'").split()).casefold()\n',
                '    return " ".join(value.strip().translate(APOSTROPHE_TRANSLATION).split()).casefold()\n',
                "shard normalizer",
            )
            text = replace_once(
                text,
                '        path = output_dir / shard["path"]\n        with gzip.open(path, "rt", encoding="utf-8") as handle:\n',
                '        path = output_dir / shard["path"]\n        if not path.is_file():\n            raise RuntimeError(f"Missing shard file: {path}")\n        if path.stat().st_size != shard["bytes"]:\n            raise RuntimeError(f"Shard size mismatch: {path}")\n        if sha256_file(path) != shard["sha256"]:\n            raise RuntimeError(f"Shard checksum mismatch: {path}")\n        with gzip.open(path, "rt", encoding="utf-8") as handle:\n',
                "package validation integrity",
            )
        write(path, text)


def write_validator() -> None:
    path = ROOT / "scripts/validate_dictionary_shards.py"
    write(path, '''#!/usr/bin/env python3
"""Validate an existing sharded WordFan dictionary directory."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from scripts.package_dictionary_shards import validate_package


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path)
    args = parser.parse_args()
    manifest_path = args.directory / "manifest.json"
    if not manifest_path.is_file():
        raise SystemExit(f"Manifest not found: {manifest_path}")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    validate_package(args.directory, manifest)
    print(
        f"Validated {manifest['rowCount']:,} entries, {manifest['aliasCount']:,} aliases, "
        f"and {manifest['shardCount']} shards ({manifest['totalCompressedBytes']:,} bytes)."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
''')


def patch_python_tests() -> None:
    path = ROOT / "scripts/tests/test_package_dictionary_shards.py"
    text = read(path)
    text = replace_once(
        text,
        'from scripts.package_dictionary_shards import fnv1a32, package, shard_index\n',
        'from scripts.package_dictionary_shards import fnv1a32, normalize_word, package, shard_index\n',
        "test normalizer import",
    )
    insert = '''
    def test_all_apostrophe_variants_share_one_normalized_key(self) -> None:
        variants = ["they‘re", "they’re", "theyʼre", "they`re", "they＇re"]
        self.assertEqual({normalize_word(value) for value in variants}, {"they're"})
        self.assertEqual({shard_index(value, 128) for value in variants}, {shard_index("they're", 128)})

    def test_validation_detects_changed_shard_bytes(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            database = root / "dictionary.sqlite"
            output = root / "shards"
            self.build_database(database)
            manifest = package(argparse.Namespace(
                input=database,
                output_dir=output,
                version="test.full.1",
                shard_count=4,
                gzip_level=9,
                skip_validation=False,
            ))
            shard_path = output / manifest["shards"][0]["path"]
            shard_path.write_bytes(shard_path.read_bytes() + b"corrupt")
            from scripts.package_dictionary_shards import validate_package
            with self.assertRaisesRegex(RuntimeError, "size mismatch"):
                validate_package(output, manifest)
'''
    text = replace_once(text, '\n\nif __name__ == "__main__":\n', '\n' + insert + '\n\nif __name__ == "__main__":\n', "python regression tests")
    write(path, text)


def write_node_tests() -> None:
    path = ROOT / "apps/wordlover-pwa/scripts/test-full-dictionary.mjs"
    write(path, r'''import assert from "node:assert/strict";
import { createHash, webcrypto } from "node:crypto";
import { gzipSync } from "node:zlib";

import {
  createFullDictionaryClient,
  fnv1a32,
  fullDictionaryShardIndex,
  validateFullDictionaryManifest,
} from "../public/full-dictionary.js";

class MemoryStorage {
  #values = new Map();
  getItem(key) { return this.#values.has(key) ? this.#values.get(key) : null; }
  setItem(key, value) { this.#values.set(key, String(value)); }
  removeItem(key) { this.#values.delete(key); }
}

class MemoryCache {
  #responses = new Map();
  async match(key) {
    const response = this.#responses.get(String(key));
    return response ? response.clone() : undefined;
  }
  async put(key, response) { this.#responses.set(String(key), response.clone()); }
  async delete(key) { return this.#responses.delete(String(key)); }
  clearOne() {
    const first = this.#responses.keys().next().value;
    if (first) this.#responses.delete(first);
  }
}

class MemoryCaches {
  #caches = new Map();
  async open(name) {
    if (!this.#caches.has(name)) this.#caches.set(name, new MemoryCache());
    return this.#caches.get(name);
  }
  async keys() { return [...this.#caches.keys()]; }
  async delete(name) { return this.#caches.delete(name); }
  async clearOne(name) { (await this.open(name)).clearOne(); }
}

function sha256(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function gzipPayload(payload) { return gzipSync(Buffer.from(JSON.stringify(payload)), { level: 9, mtime: 0 }); }

assert.equal(fnv1a32("abandon"), 3402497766);
assert.equal(fullDictionaryShardIndex("abandon", 128), 102);
for (const value of ["they‘re", "they’re", "theyʼre", "they`re", "they＇re"]) {
  assert.equal(fullDictionaryShardIndex(value, 128), fullDictionaryShardIndex("they're", 128));
}

const payload = {
  v: 1,
  e: {
    fullsizeonlyword: ["fullsizeonlyword", "/fʊl/", "a term present only in the full dictionary fixture", "CI full fixture", "仅存在于完整词典中的词", "rare"],
  },
  a: {
    fullsizeonlywords: ["/fʊl/", "a term present only in the full dictionary fixture", "CI full fixture", "仅存在于完整词典中的词", "rare", "fullsizeonlyword", "plural", "fullsizeonlyword"],
  },
};
const compressed = gzipPayload(payload);
const manifest = {
  app: "wordlover",
  formatVersion: 1,
  dictionaryDataVersion: "ci.full.1",
  variant: "full-sharded",
  generatedAt: new Date(0).toISOString(),
  rowCount: 1,
  aliasCount: 1,
  shardCount: 1,
  hash: "fnv1a32-utf8-mod",
  compression: "gzip",
  totalCompressedBytes: compressed.byteLength,
  shards: [{ id: "00", path: "shard-00.json.gz", bytes: compressed.byteLength, sha256: sha256(compressed), entries: 1, aliases: 1 }],
};
validateFullDictionaryManifest(manifest);
for (const mutate of [
  (copy) => { copy.shards[0].path = "../shard-00.json.gz"; },
  (copy) => { copy.shards[0].sha256 = "bad"; },
  (copy) => { copy.totalCompressedBytes += 1; },
  (copy) => { copy.rowCount += 1; },
]) {
  const invalid = structuredClone(manifest);
  mutate(invalid);
  assert.throws(() => validateFullDictionaryManifest(invalid));
}

let online = true;
const calls = [];
const fetchFn = async (url) => {
  calls.push(String(url));
  if (!online) throw new Error("offline");
  if (String(url).endsWith("manifest.json")) return new Response(JSON.stringify(manifest), { status: 200, headers: { "Content-Type": "application/json" } });
  if (String(url).endsWith("shard-00.json.gz")) return new Response(compressed, { status: 200, headers: { "Content-Type": "application/gzip" } });
  return new Response("not found", { status: 404 });
};

const storage = new MemoryStorage();
const cachesApi = new MemoryCaches();
const options = {
  baseUrl: "/dictionary-full",
  fetchFn,
  cachesApi,
  storage,
  storageManager: { async estimate() { return { quota: 100 * 1024 * 1024, usage: 0 }; } },
  cryptoApi: webcrypto,
  DecompressionStreamCtor: globalThis.DecompressionStream,
};
const client = createFullDictionaryClient({ ...options, maxParsedShards: Number.NaN });
assert.equal(client.maxParsedShards, 4);

const exact = await client.lookup("FullSizeOnlyWord");
assert.equal(exact.status, "found");
assert.equal(exact.dictionaryCoverage, "full");
assert.deepEqual(exact.chineseMeanings, ["仅存在于完整词典中的词"]);
const alias = await client.lookup("fullsizeonlywords");
assert.equal(alias.status, "found");
assert.equal(alias.baseTerm, "fullsizeonlyword");
assert.equal(calls.filter((url) => url.endsWith("shard-00.json.gz")).length, 1);

const installed = await client.installAll();
assert.equal(installed.offlineInstalled, true);
const cacheName = (await cachesApi.keys()).find((name) => name.startsWith("wordfan-full-dictionary-v1-"));
await cachesApi.clearOne(cacheName);
online = false;
const evictedClient = createFullDictionaryClient(options);
await evictedClient.ensureManifest();
assert.equal(evictedClient.status().offlineInstalled, false, "cache eviction must clear the stale installed marker");
const unavailable = await evictedClient.lookup("fullsizeonlyword");
assert.equal(unavailable.status, "unavailable");

online = true;
await evictedClient.installAll();
await cachesApi.open("wordfan-full-dictionary-v1-old-version");
assert((await cachesApi.keys()).length >= 2);
await evictedClient.removeOfflineCopy();
assert.equal(evictedClient.status().offlineInstalled, false);
assert.deepEqual((await cachesApi.keys()).filter((name) => name.startsWith("wordfan-full-dictionary-v1-")), []);

const noCacheClient = createFullDictionaryClient({ ...options, cachesApi: null });
await assert.rejects(() => noCacheClient.installAll(), /cannot store/i);

const noCryptoClient = createFullDictionaryClient({ ...options, cryptoApi: null, cachesApi: new MemoryCaches(), storage: new MemoryStorage() });
const noCrypto = await noCryptoClient.lookup("fullsizeonlyword");
assert.equal(noCrypto.status, "unavailable");
assert.match(noCrypto.reason, /cannot verify/i);

console.log("full dictionary client tests passed");
''')


def patch_browser_smoke() -> None:
    path = ROOT / "apps/wordlover-pwa/scripts/smoke-full-dictionary.py"
    text = read(path)
    text = replace_once(
        text,
        '        page = context.new_page()\n        page.goto(f"{args.base}/?fresh=full-dictionary", wait_until="domcontentloaded")\n',
        '        page = context.new_page()\n        shard_requests: list[str] = []\n        delayed_first_shard = {"pending": True}\n\n        def observe_request(request) -> None:\n            if "/dictionary-full/shard-" in request.url:\n                shard_requests.append(request.url)\n\n        def delay_first_shard(route) -> None:\n            if delayed_first_shard["pending"]:\n                delayed_first_shard["pending"] = False\n                page.wait_for_timeout(300)\n            route.continue_()\n\n        page.on("request", observe_request)\n        page.route("**/dictionary-full/shard-*.json.gz", delay_first_shard)\n        page.goto(f"{args.base}/?fresh=full-dictionary", wait_until="domcontentloaded")\n',
        "browser request instrumentation",
    )
    insertion = '''
        page.locator("#termInput").fill("they’re")
        normalized_input = page.locator("#termInput").input_value()
        report["steps"]["smartApostrophe"] = normalized_input
        if normalized_input != "they're":
            raise AssertionError(f"Smart apostrophe was not normalized in the input: {normalized_input!r}")

        page.locator("#termInput").fill("fullsizeonlyword")
        page.wait_for_timeout(350)
        report["steps"]["lazyShardRequests"] = len(shard_requests)
        if shard_requests:
            raise AssertionError(f"Typing triggered full dictionary downloads before Enter: {shard_requests}")

        page.locator("#termInput").press("Enter")
        page.wait_for_timeout(50)
        page.locator("#termInput").fill("abandon")
        page.locator("#termInput").press("Enter")
        page.wait_for_timeout(500)
        current_result = page.locator("#result").inner_text()
        report["steps"]["staleLookupProtection"] = current_result
        if "abandon" not in current_result.lower() or "fullsizeonlyword" in current_result.lower():
            raise AssertionError(f"A stale full-dictionary response replaced the newer lookup: {current_result}")
'''
    text = replace_once(
        text,
        '        if status.get("rowCount", 0) < 1:\n            raise AssertionError(f"Full dictionary manifest did not load: {status}")\n\n',
        '        if status.get("rowCount", 0) < 1:\n            raise AssertionError(f"Full dictionary manifest did not load: {status}")\n\n' + insertion + '\n',
        "browser regression scenarios",
    )
    write(path, text)


def patch_ci() -> None:
    path = ROOT / ".github/workflows/ci.yml"
    text = read(path)
    text = replace_once(
        text,
        '          python -m unittest scripts.tests.test_package_dictionary_shards\n          node apps/wordlover-pwa/scripts/test-full-dictionary.mjs\n',
        '          python -m unittest discover -s scripts/tests -p \'test_*.py\'\n          node apps/wordlover-pwa/scripts/test-full-dictionary.mjs\n',
        "all Python tests",
    )
    text = replace_once(
        text,
        '          if git ls-tree -d --name-only origin/gh-pages dictionary-full | grep -q \'^dictionary-full$\'; then\n            git archive origin/gh-pages dictionary-full | tar -x -C "$SITE"\n          fi\n\n          # GitHub Pages config.\n',
        '          if git ls-tree -d --name-only origin/gh-pages dictionary-full | grep -q \'^dictionary-full$\'; then\n            git archive origin/gh-pages dictionary-full | tar -x -C "$SITE"\n            python3 scripts/validate_dictionary_shards.py "$SITE/dictionary-full"\n          fi\n\n          # GitHub Pages config.\n',
        "preserved package validation",
    )
    text = replace_once(
        text,
        '          python scripts/package_dictionary_shards.py \\\n            --input data/dictionary.sqlite \\\n            --output-dir full-dictionary-web \\\n            --version "$VERSION.sharded" \\\n            --shard-count 128 \\\n            --gzip-level 9\n',
        '          python scripts/package_dictionary_shards.py \\\n            --input data/dictionary.sqlite \\\n            --output-dir full-dictionary-web \\\n            --version "$VERSION.sharded" \\\n            --shard-count 128 \\\n            --gzip-level 9\n          python scripts/validate_dictionary_shards.py full-dictionary-web\n',
        "full package validation command",
    )
    text = replace_once(
        text,
        '    steps:\n      - uses: actions/download-artifact@v4\n        with:\n          name: wordfan-full-dictionary-web-${{ github.run_number }}\n',
        '    steps:\n      - uses: actions/checkout@v4\n\n      - uses: actions/download-artifact@v4\n        with:\n          name: wordfan-full-dictionary-web-${{ github.run_number }}\n',
        "publish checkout",
    )
    text = replace_once(
        text,
        '          rm -rf "$SITE/dictionary-full"\n          cp -a dictionary-full "$SITE/dictionary-full"\n          cd "$SITE"\n',
        '          rm -rf "$SITE/dictionary-full"\n          cp -a dictionary-full "$SITE/dictionary-full"\n          python3 scripts/validate_dictionary_shards.py "$SITE/dictionary-full"\n          cd "$SITE"\n',
        "publish validation",
    )
    write(path, text)


def bump_shell_versions() -> None:
    for path in PUBLIC.iterdir():
        if path.is_file() and path.suffix in {".js", ".html", ".css"}:
            text = read(path)
            updated = text.replace(f"?v={OLD_ASSET}", f"?v={NEW_ASSET}").replace(OLD_CACHE, NEW_CACHE)
            if updated != text:
                write(path, updated)


def main() -> int:
    patch_full_dictionary()
    patch_app()
    patch_normalizers()
    write_validator()
    patch_python_tests()
    write_node_tests()
    patch_browser_smoke()
    patch_ci()
    bump_shell_versions()

    # Remove one-shot scaffolding before the generated map and commit are created.
    workflow = ROOT / ".github/workflows/apply-post-merge-audit-fixes.yml"
    if workflow.exists():
        workflow.unlink()
    Path(__file__).unlink()
    print("Applied post-merge audit fixes.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
