const DEFAULT_BASE_URL = "/dictionary-full";
const MANIFEST_STORAGE_KEY = "wordfan.fullDictionary.manifest.v1";
const INSTALLED_VERSION_KEY = "wordfan.fullDictionary.installedVersion.v1";
const CACHE_PREFIX = "wordfan-full-dictionary-v1-";
const MAX_PARSED_SHARDS = 4;
const MAX_CONFIGURED_PARSED_SHARDS = 16;
const SHARD_PATH_RE = /^shard-[0-9a-f]+\.json\.gz$/;
const SHA256_RE = /^[0-9a-f]{64}$/;

const utf8Encoder = new TextEncoder();

function safeStorageGet(storage, key) {
  try {
    return storage?.getItem?.(key) ?? null;
  } catch {
    return null;
  }
}

function safeStorageSet(storage, key, value) {
  try {
    storage?.setItem?.(key, value);
  } catch {
    /* Browser storage can be unavailable in private/restricted contexts. */
  }
}

function safeStorageRemove(storage, key) {
  try {
    storage?.removeItem?.(key);
  } catch {
    /* Ignore unavailable browser storage. */
  }
}

function normalizeLookupTerm(value) {
  return String(value ?? "")
    .replace(/[\u2018\u2019\u02bc`\uff07]/g, "'")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function topLines(value, limit = 3) {
  if (!value) return [];
  return String(value)
    .replace(/\\r/g, "\r")
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, limit);
}

function tagsFrom(value) {
  return value ? String(value).split(/\s+/).filter(Boolean) : [];
}

function formatVersionForCache(value) {
  return String(value ?? "unknown").replace(/[^a-z0-9._-]+/gi, "-");
}

function hasOwn(record, key) {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

async function sha256Hex(bytes, cryptoApi = globalThis.crypto) {
  if (!cryptoApi?.subtle?.digest) return null;
  const digest = await cryptoApi.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function fetchWithTimeout(fetchFn, url, options = {}, timeoutMs = 30000) {
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    return await fetchFn(url, { ...options, ...(controller ? { signal: controller.signal } : {}) });
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function fnv1a32(value) {
  let hash = 0x811c9dc5;
  for (const byte of utf8Encoder.encode(String(value ?? ""))) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export function fullDictionaryShardIndex(value, shardCount) {
  const count = Number(shardCount);
  if (!Number.isInteger(count) || count < 1) throw new Error("Invalid full dictionary shard count.");
  return fnv1a32(normalizeLookupTerm(value)) % count;
}

export function validateFullDictionaryManifest(manifest) {
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
}

export async function decodeFullDictionaryShard(bytes, DecompressionStreamCtor = globalThis.DecompressionStream) {
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
}

export function fullDictionaryEntryToResult(input, row, queryMs = 0) {
  const [word, phonetic, definition, definitionSource, translation, tag] = row;
  return {
    status: "found",
    term: word ?? String(input ?? "").trim(),
    entryType: String(word ?? input ?? "").includes(" ") ? "phrase" : "word",
    phonetic,
    englishMeanings: topLines(definition),
    englishMeaningSource: definitionSource ?? "ECDICT",
    chineseMeanings: topLines(translation),
    tags: tagsFrom(tag),
    queryMs,
    source: "full-dictionary-shard",
    dictionaryCoverage: "full",
  };
}

export function fullDictionaryAliasToResult(input, row, queryMs = 0) {
  const [phonetic, definition, definitionSource, translation, tag, baseWord, inflectionLabel, baseNormalizedWord] = row;
  const term = String(input ?? "").trim();
  return {
    status: "found",
    term,
    entryType: `${inflectionLabel || "inflected form"} of ${baseWord}`,
    phonetic,
    englishMeanings: topLines(definition),
    englishMeaningSource: definitionSource ?? "ECDICT",
    chineseMeanings: topLines(translation),
    tags: tagsFrom(tag),
    queryMs,
    baseTerm: baseWord,
    baseNormalizedTerm: baseNormalizedWord,
    inflectionLabel: inflectionLabel || "inflected form",
    source: "full-dictionary-shard-inflection",
    dictionaryCoverage: "full",
  };
}

export class FullDictionaryClient {
  constructor(options = {}) {
    this.baseUrl = String(options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.fetchFn = options.fetchFn ?? globalThis.fetch?.bind(globalThis);
    this.cachesApi = options.cachesApi ?? globalThis.caches;
    this.storage = options.storage ?? globalThis.localStorage;
    this.storageManager = options.storageManager ?? globalThis.navigator?.storage;
    this.cryptoApi = options.cryptoApi ?? globalThis.crypto;
    this.DecompressionStreamCtor = options.DecompressionStreamCtor ?? globalThis.DecompressionStream;
    this.onStateChange = typeof options.onStateChange === "function" ? options.onStateChange : null;
    const requestedParsedShards = Number(options.maxParsedShards ?? MAX_PARSED_SHARDS);
    this.maxParsedShards = Number.isInteger(requestedParsedShards) && requestedParsedShards > 0
      ? Math.min(requestedParsedShards, MAX_CONFIGURED_PARSED_SHARDS)
      : MAX_PARSED_SHARDS;
    this.manifest = null;
    this.manifestPromise = null;
    this.manifestCheckedAt = 0;
    this.parsedShards = new Map();
    this.busy = false;
    this.progress = null;
    this.lastError = null;
    this.offlineInstalled = false;
    this.offlineVerificationVersion = null;
  }

  _isOnline() {
    return globalThis.navigator?.onLine !== false;
  }

  _manifestUrl() {
    return `${this.baseUrl}/manifest.json`;
  }

  _cacheName(manifest = this.manifest) {
    return `${CACHE_PREFIX}${formatVersionForCache(manifest?.dictionaryDataVersion)}`;
  }

  _notify() {
    this.onStateChange?.(this.status());
  }

  status() {
    const manifest = this.manifest;
    return {
      available: Boolean(manifest),
      version: manifest?.dictionaryDataVersion ?? null,
      rowCount: Number(manifest?.rowCount ?? 0),
      aliasCount: Number(manifest?.aliasCount ?? 0),
      shardCount: Number(manifest?.shardCount ?? 0),
      totalBytes: Number(manifest?.totalCompressedBytes ?? 0),
      offlineInstalled: this.offlineInstalled,
      busy: this.busy,
      progress: this.progress,
      lastError: this.lastError,
      parsedShardCount: this.parsedShards.size,
    };
  }

  _storedManifest() {
    const raw = safeStorageGet(this.storage, MANIFEST_STORAGE_KEY);
    if (!raw) return null;
    try {
      return validateFullDictionaryManifest(JSON.parse(raw));
    } catch {
      safeStorageRemove(this.storage, MANIFEST_STORAGE_KEY);
      return null;
    }
  }

  async ensureManifest({ force = false } = {}) {
    if (!force && this.manifest && Date.now() - this.manifestCheckedAt < 5 * 60 * 1000) return this.manifest;
    if (this.manifestPromise) return this.manifestPromise;
    this.manifestPromise = (async () => {
      const stored = this._storedManifest();
      if (!this.manifest && stored) this.manifest = stored;
      let remote = null;
      if (this.fetchFn && (force || this._isOnline() || !stored)) {
        try {
          const response = await fetchWithTimeout(
            this.fetchFn,
            this._manifestUrl(),
            { cache: "no-store" },
            10000,
          );
          if (!response.ok) throw new Error(`Full dictionary manifest request failed: ${response.status}`);
          remote = validateFullDictionaryManifest(await response.json());
        } catch (error) {
          if (!stored) this.lastError = error instanceof Error ? error.message : String(error);
        }
      }
      if (remote) {
        const previousVersion = this.manifest?.dictionaryDataVersion ?? stored?.dictionaryDataVersion ?? null;
        this.manifest = remote;
        safeStorageSet(this.storage, MANIFEST_STORAGE_KEY, JSON.stringify(remote));
        if (previousVersion && previousVersion !== remote.dictionaryDataVersion) {
          this._markOfflineIncomplete();
          this.parsedShards.clear();
          await this.cleanupOldCaches();
        }
        this.lastError = null;
      }
      if (this.manifest) await this._refreshOfflineInstalledState({ force });
      this.manifestCheckedAt = Date.now();
      this._notify();
      return this.manifest;
    })();
    try {
      return await this.manifestPromise;
    } finally {
      this.manifestPromise = null;
    }
  }

  async cleanupOldCaches() {
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
  }

  async _verifyShardBytes(bytes, shard) {
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
  }

  async _readCachedShard(cache, url, shard) {
    if (!cache?.match) return null;
    const response = await cache.match(url);
    if (!response) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    try {
      await this._verifyShardBytes(bytes, shard);
      return bytes;
    } catch {
      await cache.delete?.(url);
      this._markOfflineIncomplete();
      return null;
    }
  }

  async _getShardBytes(shard, { cacheResult = true } = {}) {
    if (!this.manifest) throw new Error("Full dictionary manifest is not loaded.");
    const url = this._shardUrl(shard);
    const cache = this.cachesApi?.open ? await this.cachesApi.open(this._cacheName()) : null;
    const cached = await this._readCachedShard(cache, url, shard);
    if (cached) return cached;
    if (this.offlineInstalled) this._markOfflineIncomplete();
    if (!this.fetchFn || !this._isOnline()) {
      throw new Error("This full dictionary shard is not available offline yet.");
    }
    const response = await fetchWithTimeout(this.fetchFn, url, { cache: "no-store" }, 45000);
    if (!response.ok) throw new Error(`Full dictionary shard request failed: ${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    await this._verifyShardBytes(bytes, shard);
    if (cacheResult && cache?.put) {
      await cache.put(
        url,
        new Response(bytes, {
          headers: {
            "Content-Type": "application/gzip",
            "X-WordFan-Dictionary-Version": this.manifest.dictionaryDataVersion,
          },
        }),
      );
    }
    return bytes;
  }

  _rememberParsedShard(id, payload) {
    if (this.parsedShards.has(id)) this.parsedShards.delete(id);
    this.parsedShards.set(id, payload);
    while (this.parsedShards.size > this.maxParsedShards) {
      const oldest = this.parsedShards.keys().next().value;
      this.parsedShards.delete(oldest);
    }
  }

  async _getParsedShard(index) {
    const shard = this.manifest?.shards?.[index];
    if (!shard) throw new Error(`Full dictionary shard ${index} is missing from the manifest.`);
    if (this.parsedShards.has(shard.id)) {
      const payload = this.parsedShards.get(shard.id);
      this._rememberParsedShard(shard.id, payload);
      return payload;
    }
    const bytes = await this._getShardBytes(shard);
    const payload = await decodeFullDictionaryShard(bytes, this.DecompressionStreamCtor);
    this._rememberParsedShard(shard.id, payload);
    return payload;
  }

  async lookup(input) {
    const started = performance.now();
    const normalized = normalizeLookupTerm(input);
    if (!normalized) return null;
    const manifest = await this.ensureManifest();
    if (!manifest) {
      return { status: "unavailable", term: input, reason: this.lastError ?? "Full dictionary package unavailable." };
    }
    try {
      const index = fullDictionaryShardIndex(normalized, manifest.shardCount);
      const payload = await this._getParsedShard(index);
      const queryMs = performance.now() - started;
      if (hasOwn(payload.e, normalized)) return fullDictionaryEntryToResult(input, payload.e[normalized], queryMs);
      if (hasOwn(payload.a, normalized)) return fullDictionaryAliasToResult(input, payload.a[normalized], queryMs);
      return null;
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      this._notify();
      return { status: "unavailable", term: input, reason: this.lastError };
    }
  }

  async _checkStorage(requiredBytes) {
    if (!this.storageManager?.estimate) return;
    const estimate = await this.storageManager.estimate();
    const quota = Number(estimate.quota ?? 0);
    const usage = Number(estimate.usage ?? 0);
    if (quota && quota - usage < requiredBytes * 1.15) {
      throw new Error(
        `Not enough browser storage for the full dictionary. It needs about ${Math.ceil(requiredBytes / 1024 / 1024)} MB plus headroom.`,
      );
    }
  }

  async installAll({ onProgress, concurrency = 4 } = {}) {
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
  }

  async removeOfflineCopy() {
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
  }

}

export function createFullDictionaryClient(options = {}) {
  return new FullDictionaryClient(options);
}
