import assert from "node:assert/strict";
import { createHash, webcrypto } from "node:crypto";
import { gzipSync } from "node:zlib";

import {
  createFullDictionaryClient,
  fnv1a32,
  fullDictionaryShardIndex,
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
  async put(key, response) {
    this.#responses.set(String(key), response.clone());
  }
  async delete(key) {
    return this.#responses.delete(String(key));
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
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

assert.equal(fnv1a32("abandon"), 3402497766);
assert.equal(fullDictionaryShardIndex("abandon", 128), 102);
assert.equal(fullDictionaryShardIndex("they're", 128), 113);

const payload = {
  v: 1,
  e: {
    fullsizeonlyword: [
      "fullsizeonlyword",
      "/fʊl/",
      "a term present only in the full dictionary fixture",
      "CI full fixture",
      "仅存在于完整词典中的词",
      "rare",
    ],
  },
  a: {
    fullsizeonlywords: [
      "/fʊl/",
      "a term present only in the full dictionary fixture",
      "CI full fixture",
      "仅存在于完整词典中的词",
      "rare",
      "fullsizeonlyword",
      "plural",
      "fullsizeonlyword",
    ],
  },
};
const compressed = gzipSync(Buffer.from(JSON.stringify(payload)), { level: 9, mtime: 0 });
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
  shards: [
    {
      id: "00",
      path: "shard-00.json.gz",
      bytes: compressed.byteLength,
      sha256: sha256(compressed),
      entries: 1,
      aliases: 1,
    },
  ],
};

let online = true;
const calls = [];
const fetchFn = async (url) => {
  calls.push(String(url));
  if (!online) throw new Error("offline");
  if (String(url).endsWith("manifest.json")) {
    return new Response(JSON.stringify(manifest), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (String(url).endsWith("shard-00.json.gz")) {
    return new Response(compressed, {
      status: 200,
      headers: { "Content-Type": "application/gzip" },
    });
  }
  return new Response("not found", { status: 404 });
};

const storage = new MemoryStorage();
const cachesApi = new MemoryCaches();
const client = createFullDictionaryClient({
  baseUrl: "/dictionary-full",
  fetchFn,
  cachesApi,
  storage,
  storageManager: {
    async estimate() {
      return { quota: 100 * 1024 * 1024, usage: 0 };
    },
  },
  cryptoApi: webcrypto,
  DecompressionStreamCtor: globalThis.DecompressionStream,
});

const exact = await client.lookup("FullSizeOnlyWord");
assert.equal(exact.status, "found");
assert.equal(exact.term, "fullsizeonlyword");
assert.equal(exact.dictionaryCoverage, "full");
assert.deepEqual(exact.chineseMeanings, ["仅存在于完整词典中的词"]);

const alias = await client.lookup("fullsizeonlywords");
assert.equal(alias.status, "found");
assert.equal(alias.baseTerm, "fullsizeonlyword");
assert.equal(alias.inflectionLabel, "plural");

assert.equal(calls.filter((url) => url.endsWith("shard-00.json.gz")).length, 1);
const installed = await client.installAll();
assert.equal(installed.offlineInstalled, true);

online = false;
const offlineClient = createFullDictionaryClient({
  baseUrl: "/dictionary-full",
  fetchFn,
  cachesApi,
  storage,
  storageManager: { async estimate() { return { quota: 100 * 1024 * 1024, usage: 0 }; } },
  cryptoApi: webcrypto,
  DecompressionStreamCtor: globalThis.DecompressionStream,
});
const offline = await offlineClient.lookup("fullsizeonlyword");
assert.equal(offline.status, "found");
assert.equal(offlineClient.status().offlineInstalled, true);

await offlineClient.removeOfflineCopy();
assert.equal(offlineClient.status().offlineInstalled, false);

console.log("full dictionary client tests passed");
