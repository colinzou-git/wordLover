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
  normalizeYoudaoTerm,
  youdaoProvider,
} from "../public/youdao-provider.js";
import {
  DEFAULT_ONLINE_DICTIONARY_MODE,
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

assert.equal(DEFAULT_ONLINE_DICTIONARY_MODE, "manual");
assert.equal(normalizeOnlineDictionaryMode("off"), "off");
assert.equal(normalizeOnlineDictionaryMode("automatic"), "automatic");
assert.equal(normalizeOnlineDictionaryMode("unexpected"), "manual");
assert.equal(normalizeUiPreferences({}).onlineDictionaryMode, "manual");
assert.equal(normalizeUiPreferences({ onlineDictionaryMode: "automatic" }).onlineDictionaryMode, "automatic");

const actions = await import("../public/online-dictionary-actions.js");
const manualHtml = actions.renderOnlineDictionaryActions("take off", { mode: "manual", context: "test", online: true });
assert.match(manualHtml, /Source: Youdao/);
assert.match(manualHtml, /Open full entry on Youdao/);
assert.match(manualHtml, /q=take%20off/);
assert.doesNotMatch(manualHtml, /target=/);
assert.equal(actions.renderOnlineDictionaryActions("charge", { mode: "off" }), "");
const offlineHtml = actions.renderOnlineDictionaryActions("charge", { mode: "manual", online: false });
assert.match(offlineHtml, /unavailable while offline/);
assert.doesNotMatch(offlineHtml, /href=/);

console.log("youdao provider tests passed");
