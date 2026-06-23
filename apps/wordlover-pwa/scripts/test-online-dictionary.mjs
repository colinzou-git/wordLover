import assert from "node:assert/strict";
import {
  explainOnlineDictionaryError,
  extractGroundingSources,
  normalizeOnlineDictionaryResult,
  normalizeOnlineTerm,
} from "../public/online-dictionary-normalize.js";
import { requestOnlineDictionaryEntry } from "../public/online-dictionary.js";

const groundingMetadata = {
  webSearchQueries: ["example dictionary definition"],
  groundingChunks: [
    { web: { uri: "https://dictionary.example/one", title: "Dictionary One" } },
    { web: { uri: "https://dictionary.example/one", title: "Duplicate" } },
    { web: { uri: "javascript:alert(1)", title: "Unsafe" } },
    { web: { uri: "https://dictionary.example/two", title: "Dictionary Two" } },
  ],
};

assert.equal(normalizeOnlineTerm("  It’s  "), "it's");
assert.deepEqual(extractGroundingSources(groundingMetadata), [
  { title: "Dictionary One", url: "https://dictionary.example/one" },
  { title: "Dictionary Two", url: "https://dictionary.example/two" },
]);

const found = normalizeOnlineDictionaryResult({
  input: "photosynthetically",
  structured: {
    status: "found",
    canonicalWord: "photosynthetically",
    suggestedWord: "",
    phonetic: "/test/",
    entryType: "word",
    partsOfSpeech: ["adverb"],
    englishMeanings: ["By means of photosynthesis."],
    chineseMeanings: ["通过光合作用。"],
    tags: ["technical"],
    confidence: "high",
  },
  groundingMetadata,
  model: "gemini-2.5-flash",
});
assert.equal(found.status, "found");
assert.equal(found.sourceUrls.length, 2);

const correction = normalizeOnlineDictionaryResult({
  input: "recieve",
  structured: {
    status: "found",
    canonicalWord: "receive",
    suggestedWord: "",
    phonetic: "",
    entryType: "word",
    partsOfSpeech: ["verb"],
    englishMeanings: ["Get something."],
    chineseMeanings: ["收到。"],
    tags: [],
    confidence: "high",
  },
  groundingMetadata,
  model: "gemini-2.5-flash",
});
assert.equal(correction.status, "correction");
assert.equal(correction.suggestedWord, "receive");

const ungrounded = normalizeOnlineDictionaryResult({
  input: "inventedword",
  structured: {
    status: "found",
    canonicalWord: "inventedword",
    suggestedWord: "",
    phonetic: "",
    entryType: "word",
    partsOfSpeech: [],
    englishMeanings: ["Made up."],
    chineseMeanings: ["虚构的。"],
    tags: [],
    confidence: "high",
  },
  groundingMetadata: {},
  model: "gemini-2.5-flash",
});
assert.equal(ungrounded.status, "not_found");

// Regression: a Gemini 429 (free-tier grounding quota exhausted) must surface
// actionable guidance, not the bare "Online dictionary request failed: 429".
// The bridge calls requestOnlineDictionaryEntry without an explainError, so the
// default explainer must turn the raw status into a remedy the user can act on.
const quotaBody = JSON.stringify({
  error: {
    code: 429,
    status: "RESOURCE_EXHAUSTED",
    details: [{ "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "37s" }],
  },
});
const quota429Fetch = async () => new Response(quotaBody, {
  status: 429,
  headers: { "Content-Type": "application/json" },
});
await assert.rejects(
  requestOnlineDictionaryEntry({
    term: "abandon",
    apiKey: "test-key",
    model: "gemini-2.5-flash",
    fetchImpl: quota429Fetch,
  }),
  (error) => {
    assert.match(error.message, /quota exceeded/i);
    assert.match(error.message, /Retry in ~37s/);
    assert.doesNotMatch(error.message, /^Online dictionary request failed: 429$/);
    return true;
  },
);

assert.match(explainOnlineDictionaryError(429, quotaBody), /Retry in ~37s/);
assert.match(explainOnlineDictionaryError(403, "denied"), /403/);
assert.equal(explainOnlineDictionaryError(500, ""), "Online dictionary request failed: 500");

console.log("online dictionary tests passed");
