import assert from "node:assert/strict";
import { createOnlineDictionarySupplementLifecycle } from "../public/online-dictionary-supplement-lifecycle.js";

const oldEntry = { normalizedTerm: "charge", marker: "old" };
const newEntry = { normalizedTerm: "charge", marker: "new" };
let record = null, refreshResult = { status: "success", entry: newEntry }, failSave = false, failRemove = false;
const rendered = [];
const supplements = {
  canPersist: () => true,
  get: async () => record,
  save: async (entry) => { if (failSave) throw Object.assign(new Error("write failed"), { category: "save_failed" }); record = { entry }; },
  remove: async () => { if (failRemove) throw new Error("remove failed"); record = null; },
};
const controller = {
  display: async () => record ? { status: "saved", entry: record.entry } : { status: "manual-ready" },
  refresh: async () => refreshResult,
};
const lifecycle = createOnlineDictionarySupplementLifecycle({ providerId: "youdao", supplements, controller, render: (state) => rendered.push(state) });

assert.equal((await lifecycle.save("charge", oldEntry)).status, "saved");
assert.equal(record.entry.marker, "old");
let releaseWrite;
const slowSupplements = { ...supplements, save: () => new Promise((resolve) => { releaseWrite = () => { record = { entry: oldEntry }; resolve(record); }; }) };
const slowLifecycle = createOnlineDictionarySupplementLifecycle({ providerId: "youdao", supplements: slowSupplements, controller, render: (state) => rendered.push(state) });
const rapidOne = slowLifecycle.save("charge", oldEntry), rapidTwo = slowLifecycle.save("charge", oldEntry);
assert.equal(rapidOne, rapidTwo, "rapid repeated actions share one in-flight write"); await Promise.resolve(); releaseWrite(); await rapidOne;
assert.equal((await lifecycle.refresh("charge")).entry.marker, "new");
assert.equal(record.entry.marker, "new", "successful refresh replaces saved provider snapshot");
record = { entry: oldEntry }; failSave = true;
const failedCommit = await lifecycle.refresh("charge");
assert.equal(failedCommit.status, "saved"); assert.equal(failedCommit.entry.marker, "old"); assert.equal(record.entry.marker, "old", "failed refresh commit preserves prior saved entry");
failSave = false; refreshResult = { status: "timed-out", error: { category: "timeout", message: "timeout" } };
const failedLookup = await lifecycle.refresh("charge");
assert.equal(failedLookup.status, "saved"); assert.equal(failedLookup.entry.marker, "old"); assert.equal(failedLookup.refreshError.category, "timeout");
failRemove = true;
assert.equal((await lifecycle.remove("charge")).status, "saved", "failed removal retains saved content");
failRemove = false;
assert.equal((await lifecycle.remove("charge")).status, "manual-ready"); assert.equal(record, null);

const denied = createOnlineDictionarySupplementLifecycle({ providerId: "youdao", supplements: { ...supplements, canPersist: () => false }, controller, render: (state) => rendered.push(state) });
const deniedState = await denied.save("charge", oldEntry);
assert.equal(deniedState.status, "success"); assert.equal(deniedState.saveError.category, "persistence_not_permitted");
console.log("online dictionary supplement lifecycle tests passed");
