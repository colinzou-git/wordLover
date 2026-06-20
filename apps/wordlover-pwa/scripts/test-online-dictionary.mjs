import assert from "node:assert/strict";
import {
  extractGroundingSources,
  normalizeOnlineDictionaryResult,
  normalizeOnlineTerm,
} from "../public/online-dictionary-normalize.js";

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

console.log("online dictionary tests passed");
