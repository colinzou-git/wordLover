import assert from "node:assert/strict";
import {
  createDictionarySupplementStore,
  dictionarySupplementKey,
  mergeDictionarySupplementRecords,
  normalizeSupplementTerm,
  SupplementPolicyError,
} from "../public/dictionary-supplements.js";
import { validateYoudaoEntry } from "../public/youdao-entry-schema.js";

const fixture = (term = "they're") => ({ schemaVersion: 1, provider: { id: "youdao", label: "Youdao" }, normalizedTerm: term, headword: term, sourceUrl: `https://dict.youdao.com/result?word=${encodeURIComponent(term)}&lang=en`, retrievedAt: "2026-07-14T00:00:00.000Z", parserVersion: "fixture-1", chineseDefinitions: [{ text: "他们是" }], englishDefinitions: [] });
const records = new Map();
const store = createDictionarySupplementStore({ read: async (key) => records.get(key), write: async (key, value) => records.set(key, value), remove: async (key) => records.delete(key), list: async () => [...records.values()], validateEntry: validateYoudaoEntry, canPersistProvider: (id) => id === "youdao" });

assert.equal(normalizeSupplementTerm("  IT’S  well-being "), "it's well-being");
assert.equal(dictionarySupplementKey("They’re", "YOUDAO"), "youdao:they're");
const first = await store.save(fixture());
assert.equal((await store.get("They’re", "youdao")).entry.chineseDefinitions[0].text, "他们是");
const second = await store.save({ ...fixture(), chineseDefinitions: [{ text: "他们正在" }] });
assert.equal(records.size, 1, "save must be idempotent per provider and normalized term");
assert.equal(second.savedAt, first.savedAt, "refresh-like saves preserve the original savedAt");
assert.equal((await store.list()).length, 1);
records.set("corrupt", { nope: true });
assert.equal((await store.list()).length, 1, "corrupt records must be isolated");
await store.remove("they're", "youdao");
assert.equal(await store.get("they're", "youdao"), null);
assert.equal((await store.list({ includeDeleted: true }))[0].deleted, true, "removal must create a syncable tombstone");

const olderLive = { ...first, updatedAt: "2026-07-14T00:00:00.000Z" };
const newerDelete = { ...(await store.list({ includeDeleted: true }))[0], updatedAt: "2026-07-15T00:00:00.000Z" };
assert.equal(mergeDictionarySupplementRecords([olderLive], [newerDelete], { validateEntry: validateYoudaoEntry }).records[0].deleted, true);
assert.equal(mergeDictionarySupplementRecords([olderLive], [{ corrupt: true }], { validateEntry: validateYoudaoEntry }).records[0].entry.provider.label, "Youdao");
assert.equal(mergeDictionarySupplementRecords([], [{ corrupt: true }], { validateEntry: validateYoudaoEntry }).skipped, 1);

const denied = createDictionarySupplementStore({ read: async () => null, write: async () => {}, remove: async () => {}, list: async () => [], validateEntry: validateYoudaoEntry });
await assert.rejects(() => denied.save(fixture()), SupplementPolicyError);
await assert.rejects(() => denied.remove("they're", "youdao"), SupplementPolicyError);
console.log("dictionary supplement tests passed");
