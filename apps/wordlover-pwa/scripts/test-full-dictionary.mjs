import assert from "node:assert/strict";
import { createHash, webcrypto } from "node:crypto";
import { gzipSync } from "node:zlib";

// Synchronize trigger after hardening the one-shot audit finalizer.
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
  (copy) => { copy.shards[0].path = "invalid/shard-00.json.gz"; },
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

const noCryptoClient = createFullDictionaryClient({ ...options, cryptoApi: {}, cachesApi: new MemoryCaches(), storage: new MemoryStorage() });
const noCrypto = await noCryptoClient.lookup("fullsizeonlyword");
assert.equal(noCrypto.status, "unavailable");
assert.match(noCrypto.reason, /cannot verify/i);

const concurrentCalls = [];
const concurrentFetch = async (url) => {
  concurrentCalls.push(String(url));
  if (String(url).endsWith("manifest.json")) {
    return new Response(JSON.stringify(manifest), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  if (String(url).endsWith("shard-00.json.gz")) {
    await new Promise((resolve) => setTimeout(resolve, 30));
    return new Response(compressed, { status: 200, headers: { "Content-Type": "application/gzip" } });
  }
  return new Response("not found", { status: 404 });
};
const concurrentClient = createFullDictionaryClient({
  ...options,
  fetchFn: concurrentFetch,
  cachesApi: new MemoryCaches(),
  storage: new MemoryStorage(),
  isOnline: () => true,
});
const [concurrentExact, concurrentAlias] = await Promise.all([
  concurrentClient.lookup("fullsizeonlyword"),
  concurrentClient.lookup("fullsizeonlywords"),
]);
assert.equal(concurrentExact.status, "found");
assert.equal(concurrentAlias.status, "found");
assert.equal(
  concurrentCalls.filter((url) => url.endsWith("shard-00.json.gz")).length,
  1,
  "concurrent lookups should share one shard fetch and parse",
);

const reordered = structuredClone(manifest);
reordered.shards[0].id = "01";
reordered.shards[0].path = "shard-01.json.gz";
assert.throws(() => validateFullDictionaryManifest(reordered), /out of order/i);

const offlineClient = createFullDictionaryClient({
  ...options,
  fetchFn: async () => { throw new Error("network should not be called"); },
  cachesApi: new MemoryCaches(),
  storage: new MemoryStorage(),
  isOnline: () => false,
});
const offlineMissing = await offlineClient.lookup("fullsizeonlyword");
assert.equal(offlineMissing.status, "unavailable");
assert.match(offlineMissing.reason, /not available offline/i);

console.log("full dictionary client tests passed");
