import assert from "node:assert/strict";
import { clearOnlineDictionaryRequestsForTest, createOnlineDictionaryLookupController } from "../public/online-dictionary-lookup-controller.js";
import { renderYoudaoState } from "../public/online-dictionary-result-renderer.js";

const entry = { headword: "charge", phonetics: { us: "tʃɑrdʒ" }, chineseDefinitions: [{ text: "费用", partOfSpeech: "n." }], englishDefinitions: [], wordForms: [], phrases: [], examples: [], synonyms: [], antonyms: [] };
const makeProvider = (lookup) => ({ id: "youdao", supports: (term) => Boolean(term), canLookupInApp: true, lookup });
const states = [];

let disabledCalls = 0;
const off = createOnlineDictionaryLookupController({ provider: makeProvider(async () => { disabledCalls += 1; return entry; }), enabled: false, online: () => true, onState: (state) => states.push(state) });
assert.equal((await off.display("charge")).status, "hidden");
assert.equal(disabledCalls, 0, "disabled display must make zero provider calls");
const automatic = createOnlineDictionaryLookupController({ provider: makeProvider(async () => entry), enabled: true, online: () => true });
assert.equal((await automatic.display("charge")).status, "success");
assert.equal((await automatic.display("charge", { allowNetwork: false })).status, "offline", "network can be suppressed without exposing a manual state");
let automaticallySaved = null, automaticCalls = 0;
const automaticPersistence = createOnlineDictionaryLookupController({
  provider: makeProvider(async () => { automaticCalls += 1; return { ...entry, normalizedTerm: "charge" }; }),
  enabled: true,
  online: () => true,
  getSaved: async () => automaticallySaved,
  onSuccess: async ({ entry: found }) => { automaticallySaved = found; return { status: "saved", entry: found }; },
});
assert.equal((await automaticPersistence.display("charge")).status, "saved");
assert.equal((await automaticPersistence.display("charge")).status, "saved");
assert.equal(automaticCalls, 1, "second display must use the encrypted local record without a provider request");
const saved = createOnlineDictionaryLookupController({ provider: makeProvider(async () => { throw new Error("must not call"); }), enabled: true, online: () => true, getSaved: async () => entry });
assert.equal((await saved.display("charge")).status, "saved");
const offline = createOnlineDictionaryLookupController({ provider: makeProvider(async () => entry), enabled: true, online: () => false });
assert.equal((await offline.display("charge")).status, "offline");

let calls = 0, resolveLookup;
const delayed = makeProvider(() => { calls += 1; return new Promise((resolve) => { resolveLookup = resolve; }); });
const a = createOnlineDictionaryLookupController({ provider: delayed, enabled: true, online: () => true });
const b = createOnlineDictionaryLookupController({ provider: delayed, enabled: true, online: () => true });
const aResult = a.display("charge"), bResult = b.display("charge");
await new Promise((resolve) => setTimeout(resolve)); assert.equal(calls, 1, "same-term requests deduplicate"); resolveLookup(entry); assert.equal((await aResult).status, "success"); assert.equal((await bResult).status, "success");

let staleResolve;
const staleStates = [];
const staleProvider = makeProvider((args) => args.term === "old" ? new Promise((resolve) => { staleResolve = resolve; }) : Promise.resolve({ ...entry, headword: args.term }));
const staleController = createOnlineDictionaryLookupController({ provider: staleProvider, enabled: true, online: () => true, onState: (state) => staleStates.push(state) });
const old = staleController.display("old"); await new Promise((resolve) => setTimeout(resolve)); const newer = await staleController.display("new"); staleResolve(entry); await old; assert.equal(newer.entry.headword, "new"); assert.notEqual(staleStates.at(-1)?.entry?.headword, "charge", "late old response cannot replace new term");

let staleSaveCount = 0, staleSaveResolve;
const stalePersistence = createOnlineDictionaryLookupController({ provider: makeProvider(({ term }) => term === "old" ? new Promise((resolve) => { staleSaveResolve = resolve; }) : Promise.resolve({ ...entry, headword: "new", normalizedTerm: "new" })), enabled: true, online: () => true, onSuccess: async ({ entry: found }) => { staleSaveCount += 1; return { status: "saved", entry: found }; } });
const staleOld = stalePersistence.display("old"); await new Promise((resolve) => setTimeout(resolve)); await stalePersistence.display("new"); staleSaveResolve({ ...entry, normalizedTerm: "old" }); await staleOld; assert.equal(staleSaveCount, 1, "stale provider responses are not persisted");

let mismatchedSaved = 0;
const mismatched = createOnlineDictionaryLookupController({ provider: makeProvider(async () => ({ ...entry, normalizedTerm: "other" })), enabled: true, online: () => true, onSuccess: async () => { mismatchedSaved += 1; } });
assert.equal((await mismatched.display("charge")).status, "malformed");
assert.equal(mismatchedSaved, 0, "wrong-term responses are never persisted");

const failedPersistence = createOnlineDictionaryLookupController({ provider: makeProvider(async () => ({ ...entry, normalizedTerm: "charge" })), enabled: true, online: () => true, onSuccess: async () => { throw new Error("disk full"); } });
const failedPersistenceState = await failedPersistence.display("charge");
assert.equal(failedPersistenceState.status, "success");
assert.match(failedPersistenceState.saveError.message, /could not be saved/);

let refreshCalls = 0;
const refresh = createOnlineDictionaryLookupController({ provider: makeProvider(async () => { refreshCalls += 1; return entry; }), enabled: true, online: () => true, allowSessionCache: true });
await refresh.lookup("charge"); await refresh.lookup("charge"); assert.equal(refreshCalls, 1); await refresh.refresh("charge"); assert.equal(refreshCalls, 2, "refresh bypasses cache and deduplication");
const refreshStates = [];
const refreshSaved = createOnlineDictionaryLookupController({ provider: makeProvider(async () => ({ ...entry, headword: "fresh", normalizedTerm: "charge" })), enabled: true, online: () => true, getSaved: async () => entry, onState: (state) => refreshStates.push(state) });
assert.equal((await refreshSaved.refresh("charge")).entry.headword, "fresh");
assert.equal(refreshStates.some((state) => state.status === "saved" && state.refreshing), true, "refresh keeps the prior saved entry visible while checking");

const timeout = createOnlineDictionaryLookupController({ provider: makeProvider((_args) => new Promise(() => {})), enabled: true, online: () => true, timeoutMs: 5 });
assert.equal((await timeout.display("charge")).status, "timed-out");

let closeAborted = false, closePersisted = 0;
const closing = createOnlineDictionaryLookupController({ provider: makeProvider(({ signal }) => new Promise((_resolve, reject) => signal.addEventListener("abort", () => { closeAborted = true; reject(signal.reason); }, { once: true }))), enabled: true, online: () => true, onSuccess: async ({ entry: found }) => { closePersisted += 1; return { status: "saved", entry: found }; } });
const closingResult = closing.display("charge");
await new Promise((resolve) => setTimeout(resolve));
closing.close();
assert.equal((await closingResult).status, "cancelled", "closing a view cancels its lookup");
await new Promise((resolve) => setTimeout(resolve));
assert.equal(closeAborted, true, "closing the last consumer aborts the provider request");
assert.equal(closePersisted, 0, "turning the feature Off/closing its mount cannot persist an aborted response");

let transientCalls = 0;
const transient = createOnlineDictionaryLookupController({ provider: makeProvider(async () => { transientCalls += 1; const error = new Error("temporary"); error.category = "provider_unavailable"; error.retryable = true; throw error; }), enabled: true, online: () => true, allowSessionCache: true });
assert.equal((await transient.lookup("charge")).status, "provider-unavailable");
assert.equal((await transient.lookup("charge")).status, "provider-unavailable");
assert.equal(transientCalls, 2, "transient failures are never session-cached");

let noResultCalls = 0;
const noResult = createOnlineDictionaryLookupController({ provider: makeProvider(async () => { noResultCalls += 1; const error = new Error("none"); error.category = "no_result"; throw error; }), enabled: true, online: () => true, allowSessionCache: true, cacheMaxEntries: 2 });
assert.equal((await noResult.lookup("missing")).status, "no-result");
assert.equal((await noResult.lookup("missing")).status, "no-result");
assert.equal(noResultCalls, 1, "stable no-result responses may be cached when policy permits");
clearOnlineDictionaryRequestsForTest();

for (const status of ["checking", "offline", "no-result", "timed-out", "rate-limited", "provider-unavailable", "disabled", "malformed", "error"]) {
  const html = renderYoudaoState("charge", { status }); assert.match(html, /Source: Youdao/); assert.match(html, /Open full entry on Youdao/);
}
const resultHtml = renderYoudaoState("charge", { status: "success", entry: { ...entry, chineseDefinitions: [{ text: "<script>alert(1)</script>" }] } });
assert.doesNotMatch(resultHtml, /<script>/); assert.match(resultHtml, /&lt;script&gt;/); assert.match(resultHtml, /Source: Youdao/);
const saveHtml = renderYoudaoState("charge", { status: "success", entry, saveError: { message: "not saved" } });
assert.match(saveHtml, /not saved/); assert.doesNotMatch(saveHtml, /Retry local save|data-youdao-save/);
const savedHtml = renderYoudaoState("charge", { status: "saved", entry, canRefresh: true, refreshError: { message: "kept" } });
assert.doesNotMatch(savedHtml, /Refresh saved entry|Remove saved definition|Check Youdao|data-youdao-save/); assert.match(savedHtml, /kept/);
assert.equal(renderYoudaoState("charge", { status: "hidden" }), "");
assert.doesNotMatch(renderYoudaoState("charge", { status: "offline" }), /Retry Youdao/);
assert.match(renderYoudaoState("charge", { status: "error" }), /data-youdao-retry/);

console.log("online dictionary controller and renderer tests passed");
