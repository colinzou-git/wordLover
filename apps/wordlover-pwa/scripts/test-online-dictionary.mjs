import assert from "node:assert/strict";
import {
  explainOnlineDictionaryError,
  extractGroundingSources,
  normalizeOnlineDictionaryResult,
  normalizeOnlineTerm,
} from "../public/online-dictionary-normalize.js";
import {
  requestOnlineDictionaryEntry,
  resolveOnlineDictionaryEntry,
} from "../public/online-dictionary.js";

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

// --- Tiered cascade (resolveOnlineDictionaryEntry) ------------------------------
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
const wikDef = (pos, defs) => json({ en: [{ partOfSpeech: pos, definitions: defs.map((d) => ({ definition: d })) }] });
const wikParse = (wikitext) => json({ parse: { wikitext: { "*": wikitext } } });
const geminiText = (text, extra = {}) => json({ candidates: [{ content: { parts: [{ text }] }, ...extra }] });
const unexpected = (label) => () => { throw new Error(`unexpected fetch: ${label}`); };

function makeFetch({ def, parse, gemini = {} } = {}) {
  const calls = { def: 0, parse: 0, grounded: 0, groundedStructured: 0, plain: 0, translation: 0 };
  const fetchImpl = async (url, opts = {}) => {
    const u = String(url);
    if (u.includes("/api/rest_v1/page/definition/")) { calls.def += 1; return (def ?? unexpected("def"))(u); }
    if (u.includes("/w/api.php")) { calls.parse += 1; return (parse ?? unexpected("parse"))(u); }
    if (u.includes("generativelanguage.googleapis.com")) {
      const body = JSON.parse(opts.body || "{}");
      const text = body.contents?.[0]?.parts?.[0]?.text || "";
      if (body.tools) { calls.grounded += 1; return (gemini.grounded ?? unexpected("grounded"))(); }
      if (text.includes("Grounded evidence")) { calls.groundedStructured += 1; return (gemini.groundedStructured ?? unexpected("groundedStructured"))(); }
      if (text.includes("Without using web search")) { calls.plain += 1; return (gemini.plain ?? unexpected("plain"))(); }
      calls.translation += 1; return (gemini.translation ?? unexpected("translation"))();
    }
    throw new Error(`unexpected fetch host: ${u}`);
  };
  return { fetchImpl, calls };
}

const ARGS = { apiKey: "k", model: "gemini-2.5-flash" };

// Tier 1: Wiktionary full hit — no Gemini call at all.
{
  const { fetchImpl, calls } = makeFetch({
    def: () => wikDef("Verb", ["<p>to give up</p>"]),
    parse: () => wikParse("{{t+|cmn|放棄|tr=fàngqì}} {{t|cmn|遺棄}}"),
  });
  const r = await resolveOnlineDictionaryEntry({ term: "abandon", ...ARGS, fetchImpl });
  assert.equal(r.source, "wiktionary");
  assert.equal(r.status, "found");
  assert.equal(r.confidence, "high");
  assert.deepEqual(r.chineseMeanings, ["放棄", "遺棄"]);
  assert.equal(calls.grounded + calls.groundedStructured + calls.plain + calls.translation, 0);
}

// Tier 2: Wiktionary English but no Chinese — plain-text translate, merge (no grounding).
{
  const { fetchImpl, calls } = makeFetch({
    def: () => wikDef("Noun", ["<p>charisma, charm</p>"]),
    parse: () => wikParse("no mandarin templates here"),
    gemini: { translation: () => geminiText(JSON.stringify({ chineseMeanings: ["魅力"] })) },
  });
  const r = await resolveOnlineDictionaryEntry({ term: "rizz", ...ARGS, fetchImpl });
  assert.equal(r.source, "wiktionary+gemini");
  assert.equal(r.confidence, "medium");
  assert.deepEqual(r.chineseMeanings, ["魅力"]);
  assert.equal(calls.translation, 1);
  assert.equal(calls.grounded, 0);
}

// Tier 3: Wiktionary miss — Gemini grounding succeeds.
{
  const { fetchImpl, calls } = makeFetch({
    def: () => new Response("", { status: 404 }),
    gemini: {
      grounded: () => geminiText("evidence", {
        groundingMetadata: { groundingChunks: [{ web: { uri: "https://dict.example/x", title: "Dict" } }], webSearchQueries: ["xyzzy"] },
      }),
      groundedStructured: () => geminiText(JSON.stringify({
        status: "found", canonicalWord: "xyzzy", suggestedWord: "", phonetic: "",
        entryType: "word", partsOfSpeech: ["noun"], englishMeanings: ["a magic word"],
        chineseMeanings: ["魔法词"], tags: [], confidence: "high",
      })),
    },
  });
  const r = await resolveOnlineDictionaryEntry({ term: "xyzzy", ...ARGS, fetchImpl });
  assert.equal(r.source, "gemini-grounded");
  assert.equal(r.status, "found");
  assert.deepEqual(r.chineseMeanings, ["魔法词"]);
  assert.equal(calls.plain, 0);
}

// Tier 4: Wiktionary miss + grounding 429 -> plain-text last resort (low confidence).
{
  const { fetchImpl, calls } = makeFetch({
    def: () => new Response("", { status: 404 }),
    gemini: {
      grounded: () => json({ error: { code: 429 } }, 429),
      plain: () => geminiText(JSON.stringify({
        status: "found", canonicalWord: "obscureword", suggestedWord: "", phonetic: "",
        entryType: "word", partsOfSpeech: ["noun"], englishMeanings: ["best-effort meaning"],
        chineseMeanings: ["尽力而为的意思"], tags: [], confidence: "high",
      })),
    },
  });
  const r = await resolveOnlineDictionaryEntry({ term: "obscureword", ...ARGS, fetchImpl });
  assert.equal(r.source, "gemini-plain");
  assert.equal(r.confidence, "low");
  assert.equal(r.status, "found");
  assert.equal(calls.plain, 1);
}

// Refinement 2: grounding RAN but found no evidence -> honest not_found, never plain text.
{
  const { fetchImpl, calls } = makeFetch({
    def: () => new Response("", { status: 404 }),
    gemini: { grounded: () => geminiText("some prose but no sources", {}) },
  });
  const r = await resolveOnlineDictionaryEntry({ term: "definitelynotaword", ...ARGS, fetchImpl });
  assert.equal(r.status, "not_found");
  assert.equal(r.source, "gemini-grounded");
  assert.equal(calls.plain, 0);
  assert.equal(calls.groundedStructured, 0);
}

console.log("online dictionary tests passed");
