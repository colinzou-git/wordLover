import assert from "node:assert/strict";

import {
  clearOnlineDictionaryProvidersForTest,
  getOnlineDictionaryProvider,
  listOnlineDictionaryProviders,
  registerOnlineDictionaryProvider,
} from "../public/online-dictionary-provider.js";
import {
  buildYoudaoLookupUrl,
  canLookupYoudaoTerm,
  createYoudaoProvider,
  normalizeYoudaoTerm,
  YoudaoProviderError,
  youdaoProvider,
} from "../public/youdao-provider.js";
import { validateYoudaoEntry } from "../public/youdao-entry-schema.js";
import {
  DEFAULT_ONLINE_DICTIONARY_MODE,
  DEFAULT_AUTO_SHOW_YOUDAO_DEFINITIONS,
  normalizeAutoShowYoudaoDefinitions,
  normalizeOnlineDictionaryMode,
  normalizeUiPreferences,
} from "../public/ui-preferences.js";

clearOnlineDictionaryProvidersForTest();
const registered = registerOnlineDictionaryProvider(youdaoProvider);
assert.equal(registered.id, "youdao");
assert.equal(getOnlineDictionaryProvider("youdao"), registered);
assert.deepEqual(listOnlineDictionaryProviders().map(({ id }) => id), ["youdao"]);
assert.throws(() => registerOnlineDictionaryProvider({ id: "bad provider" }), TypeError);

for (const term of ["charge", "isosceles", "they're", "it’s", "well-known", "take off", "charged"]) {
  assert.equal(canLookupYoudaoTerm(term), true, `${term} should be supported`);
}
for (const term of ["", "   ", "word/word", "hello123", "你好", "one two three four five six seven"]) {
  assert.equal(canLookupYoudaoTerm(term), false, `${term} should be rejected`);
  assert.equal(buildYoudaoLookupUrl(term), "");
}

assert.equal(normalizeYoudaoTerm("  It’s   Fine  "), "it's fine");
assert.equal(buildYoudaoLookupUrl("charge"), "https://m.youdao.com/dict?le=eng&q=charge");
assert.equal(buildYoudaoLookupUrl("it’s fine"), "https://m.youdao.com/dict?le=eng&q=it's%20fine");
assert.equal(buildYoudaoLookupUrl("take off"), "https://m.youdao.com/dict?le=eng&q=take%20off");

assert.equal(DEFAULT_ONLINE_DICTIONARY_MODE, "automatic");
assert.equal(normalizeOnlineDictionaryMode("off"), "off");
assert.equal(normalizeOnlineDictionaryMode("automatic"), "automatic");
assert.equal(normalizeOnlineDictionaryMode("unexpected"), "automatic");
assert.equal(DEFAULT_AUTO_SHOW_YOUDAO_DEFINITIONS, true);
assert.equal(normalizeAutoShowYoudaoDefinitions(undefined, "automatic"), true);
assert.equal(normalizeAutoShowYoudaoDefinitions(undefined, "manual"), true);
assert.equal(normalizeAutoShowYoudaoDefinitions(undefined, "off"), false);
assert.equal(normalizeUiPreferences({}).autoShowYoudaoDefinitions, true);
assert.equal(normalizeUiPreferences({ onlineDictionaryMode: "automatic" }).autoShowYoudaoDefinitions, true);
assert.equal(normalizeUiPreferences({ onlineDictionaryMode: "manual" }).autoShowYoudaoDefinitions, true);
assert.equal(normalizeUiPreferences({ onlineDictionaryMode: "off" }).autoShowYoudaoDefinitions, false);
assert.equal(normalizeUiPreferences({ autoShowYoudaoDefinitions: true, onlineDictionaryMode: "off" }).autoShowYoudaoDefinitions, true);
assert.equal(normalizeUiPreferences({ autoShowYoudaoDefinitions: false, onlineDictionaryMode: "automatic" }).autoShowYoudaoDefinitions, false);

const fixture = {
  schemaVersion: 1, provider: { id: "youdao", label: "Youdao" }, normalizedTerm: "charge", headword: "charge",
  sourceUrl: "https://m.youdao.com/dict?le=eng&q=charge", retrievedAt: "2026-07-14T00:00:00Z", parserVersion: "fixture-v1",
  phonetics: { us: "tʃɑrdʒ" }, chineseDefinitions: [{ text: "费用", partOfSpeech: "n." }, { text: "指控", domain: "law" }], englishDefinitions: [],
  wordForms: [{ name: "past", value: "charged" }], phrases: [{ phrase: "in charge", meanings: ["负责"] }],
  examples: [{ sentence: "They charge a fee.", translation: "他们收取费用。" }], synonyms: ["cost"], antonyms: [], domains: ["law"],
};
assert.equal(validateYoudaoEntry({ ...fixture, unknownFutureField: true }).headword, "charge");
assert.throws(() => validateYoudaoEntry({ ...fixture, schemaVersion: 2 }), /Unsupported/);
assert.throws(() => validateYoudaoEntry({ ...fixture, chineseDefinitions: [], englishDefinitions: [] }), /at least one definition/);
assert.doesNotMatch(JSON.stringify(validateYoudaoEntry({ ...fixture, chineseDefinitions: [{ text: "<b>费用</b>" }] })), /<b>/);

const integrated = createYoudaoProvider({ endpoint: "https://gateway.example", fetchImpl: async (url, init) => {
  assert.equal(url.searchParams.get("term"), "it's fine"); assert.equal(url.searchParams.get("refresh"), "1"); assert.ok(init.signal); return Response.json({ ...fixture, normalizedTerm: "it's fine", headword: "it's fine" });
} });
assert.equal(integrated.canLookupInApp, true);
assert.equal((await integrated.lookup({ term: "It’s fine", signal: new AbortController().signal, forceRefresh: true })).normalizedTerm, "it's fine");
const abortController = new AbortController(); abortController.abort();
const aborting = createYoudaoProvider({ endpoint: "https://gateway.example", fetchImpl: async (_url, { signal }) => { throw signal.reason; } });
await assert.rejects(aborting.lookup({ term: "charge", signal: abortController.signal }), (error) => error.name === "AbortError");
const disabledIntegrated = createYoudaoProvider();
await assert.rejects(disabledIntegrated.lookup({ term: "charge" }), (error) => error instanceof YoudaoProviderError && error.category === "configuration_disabled");
const malformedIntegrated = createYoudaoProvider({ endpoint: "https://gateway.example", fetchImpl: async () => Response.json({ nope: true }) });
await assert.rejects(malformedIntegrated.lookup({ term: "charge" }), (error) => error.category === "malformed_response");
assert.equal(disabledIntegrated.buildExternalUrl("charge"), "https://m.youdao.com/dict?le=eng&q=charge");

const actions = await import("../public/online-dictionary-actions.js");
const enabledHtml = actions.renderOnlineDictionaryActions("take off", { enabled: true, context: "test" });
assert.match(enabledHtml, /online-dictionary-actions/);
assert.match(enabledHtml, /data-term="take off"/);
assert.doesNotMatch(enabledHtml, /Check Youdao|Open full entry|data-youdao-check/);
assert.equal(actions.renderOnlineDictionaryActions("charge", { enabled: false }), "");

console.log("youdao provider tests passed");
