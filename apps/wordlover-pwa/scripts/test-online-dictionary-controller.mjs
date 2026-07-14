import assert from "node:assert/strict";
import { clearOnlineDictionaryRequestsForTest, createOnlineDictionaryLookupController } from "../public/online-dictionary-lookup-controller.js";
import { renderYoudaoState } from "../public/online-dictionary-result-renderer.js";

const entry = { headword: "charge", phonetics: { us: "tʃɑrdʒ" }, chineseDefinitions: [{ text: "费用", partOfSpeech: "n." }], englishDefinitions: [], wordForms: [], phrases: [], examples: [], synonyms: [], antonyms: [] };
const makeProvider = (lookup) => ({ id: "youdao", supports: (term) => Boolean(term), canLookupInApp: true, lookup });
const states = [];

const off = createOnlineDictionaryLookupController({ provider: makeProvider(async () => entry), mode: "off", online: () => true, onState: (state) => states.push(state) });
assert.equal((await off.display("charge")).status, "hidden");
const manual = createOnlineDictionaryLookupController({ provider: makeProvider(async () => entry), mode: "manual", online: () => true });
assert.equal((await manual.display("charge")).status, "manual-ready");
assert.equal((await manual.lookup("charge")).status, "success");
const automatic = createOnlineDictionaryLookupController({ provider: makeProvider(async () => entry), mode: "automatic", online: () => true });
assert.equal((await automatic.display("charge")).status, "success");
const saved = createOnlineDictionaryLookupController({ provider: makeProvider(async () => { throw new Error("must not call"); }), mode: "automatic", online: () => true, getSaved: async () => entry });
assert.equal((await saved.display("charge")).status, "saved");
const offline = createOnlineDictionaryLookupController({ provider: makeProvider(async () => entry), mode: "automatic", online: () => false });
assert.equal((await offline.display("charge")).status, "offline");

let calls = 0, resolveLookup;
const delayed = makeProvider(() => { calls += 1; return new Promise((resolve) => { resolveLookup = resolve; }); });
const a = createOnlineDictionaryLookupController({ provider: delayed, mode: "automatic", online: () => true });
const b = createOnlineDictionaryLookupController({ provider: delayed, mode: "automatic", online: () => true });
const aResult = a.display("charge"), bResult = b.display("charge");
await new Promise((resolve) => setTimeout(resolve)); assert.equal(calls, 1, "same-term requests deduplicate"); resolveLookup(entry); assert.equal((await aResult).status, "success"); assert.equal((await bResult).status, "success");

let staleResolve;
const staleStates = [];
const staleProvider = makeProvider((args) => args.term === "old" ? new Promise((resolve) => { staleResolve = resolve; }) : Promise.resolve({ ...entry, headword: args.term }));
const staleController = createOnlineDictionaryLookupController({ provider: staleProvider, mode: "automatic", online: () => true, onState: (state) => staleStates.push(state) });
const old = staleController.display("old"); await new Promise((resolve) => setTimeout(resolve)); const newer = await staleController.display("new"); staleResolve(entry); await old; assert.equal(newer.entry.headword, "new"); assert.notEqual(staleStates.at(-1)?.entry?.headword, "charge", "late old response cannot replace new term");

let refreshCalls = 0;
const refresh = createOnlineDictionaryLookupController({ provider: makeProvider(async () => { refreshCalls += 1; return entry; }), mode: "manual", online: () => true, allowSessionCache: true });
await refresh.lookup("charge"); await refresh.lookup("charge"); assert.equal(refreshCalls, 1); await refresh.refresh("charge"); assert.equal(refreshCalls, 2, "refresh bypasses cache and deduplication");

const timeout = createOnlineDictionaryLookupController({ provider: makeProvider((_args) => new Promise(() => {})), mode: "automatic", online: () => true, timeoutMs: 5 });
assert.equal((await timeout.display("charge")).status, "timed-out");
clearOnlineDictionaryRequestsForTest();

for (const status of ["manual-ready", "checking", "offline", "no-result", "timed-out", "rate-limited", "provider-unavailable", "disabled", "malformed", "error"]) {
  const html = renderYoudaoState("charge", { status }); assert.match(html, /Source: Youdao/); assert.match(html, /Open full entry on Youdao/);
}
const resultHtml = renderYoudaoState("charge", { status: "success", entry: { ...entry, chineseDefinitions: [{ text: "<script>alert(1)</script>" }] } });
assert.doesNotMatch(resultHtml, /<script>/); assert.match(resultHtml, /&lt;script&gt;/); assert.match(resultHtml, /Source: Youdao/);

console.log("online dictionary controller and renderer tests passed");
