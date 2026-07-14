import {
  ONLINE_DICTIONARY_SCHEMA,
  OnlineDictionaryRequestError,
  buildOnlineEntry,
  cleanOnlineString,
  explainOnlineDictionaryError,
  extractGroundingSources,
  normalizeOnlineDictionaryResult,
  onlineResponseText,
} from "./online-dictionary-normalize.js?v=20260714-4";
import { lookupWiktionary } from "./wiktionary-lookup.js?v=20260714-4";

function geminiEndpoint(model, apiKey) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
}

async function postGemini(endpoint, body, fetchImpl, explainError) {
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const responseBody = await response.text();
    throw new OnlineDictionaryRequestError(
      typeof explainError === "function"
        ? explainError(response.status, responseBody)
        : `Online dictionary request failed: ${response.status}`,
      { status: response.status, body: responseBody },
    );
  }
  return response.json();
}

export async function requestOnlineDictionaryEntry({
  term,
  apiKey,
  model,
  fetchImpl = fetch,
  explainError = explainOnlineDictionaryError,
}) {
  const cleanTerm = cleanOnlineString(term, 120);
  if (!cleanTerm) throw new Error("A word or phrase is required for online lookup.");
  if (!apiKey) throw new Error("A Gemini API key is required for online lookup.");
  const startedAt = Date.now();
  const endpoint = geminiEndpoint(model, apiKey);

  const evidencePrompt = [
    `Use Google Search to verify the exact English spelling "${cleanTerm}".`,
    "Consult reputable dictionaries or authoritative language references, preferably at least two.",
    "Do not silently correct the spelling. Clearly distinguish a recognized English word, accepted phrase, proper noun, abbreviation, technical term, informal form, or obsolete form from a likely typo.",
    "Collect its IPA pronunciation when reliably available, part(s) of speech, concise English definitions, and accurate simplified-Chinese meanings.",
    "If the exact spelling is not a recognized term, state that and identify one likely correction only when the evidence strongly supports it.",
    "Provide a compact evidence summary for a second structured extraction step.",
  ].join("\n");

  const groundedPayload = await postGemini(endpoint, {
    contents: [{ role: "user", parts: [{ text: evidencePrompt }] }],
    tools: [{ google_search: {} }],
  }, fetchImpl, explainError);

  const candidate = groundedPayload?.candidates?.[0];
  const evidence = onlineResponseText(groundedPayload);
  const groundingMetadata = candidate?.groundingMetadata ?? {};
  const sourceUrls = extractGroundingSources(groundingMetadata);
  if (!evidence || !sourceUrls.length) {
    return normalizeOnlineDictionaryResult({
      input: cleanTerm,
      structured: {
        status: "not_found",
        canonicalWord: cleanTerm,
        suggestedWord: "",
        phonetic: "",
        entryType: cleanTerm.includes(" ") ? "phrase" : "word",
        partsOfSpeech: [],
        englishMeanings: [],
        chineseMeanings: [],
        tags: [],
        confidence: "low",
      },
      groundingMetadata,
      model,
      queryMs: Date.now() - startedAt,
    });
  }

  const normalizationPrompt = [
    `Convert the following Google-Search-grounded evidence into a dictionary record for the exact user input "${cleanTerm}".`,
    "Rules:",
    "- status=found only when the exact spelling is recognized. Capitalization and apostrophe style may be normalized, but do not silently repair another spelling.",
    "- status=correction when the exact spelling is not recognized but one strongly supported correction exists; put it in suggestedWord.",
    "- status=not_found when evidence is insufficient.",
    "- Give 1-6 concise English meanings and corresponding simplified-Chinese meanings.",
    "- Use standard IPA in phonetic only when supported; otherwise use an empty string.",
    "- confidence must be high, medium, or low.",
    "",
    "Grounded evidence:",
    evidence.slice(0, 12000),
  ].join("\n");

  const structuredPayload = await postGemini(endpoint, {
    contents: [{ role: "user", parts: [{ text: normalizationPrompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: ONLINE_DICTIONARY_SCHEMA,
      temperature: 0,
    },
  }, fetchImpl, explainError);

  const text = onlineResponseText(structuredPayload);
  let structured;
  try {
    structured = JSON.parse(text);
  } catch {
    throw new OnlineDictionaryRequestError(`Gemini returned non-JSON dictionary data: ${text.slice(0, 200)}`);
  }

  return normalizeOnlineDictionaryResult({
    input: cleanTerm,
    structured,
    groundingMetadata,
    model,
    queryMs: Date.now() - startedAt,
  });
}

const TRANSLATION_SCHEMA = {
  type: "object",
  properties: { chineseMeanings: { type: "array", items: { type: "string" } } },
  required: ["chineseMeanings"],
};

// Translate a word whose English sense is already known (from Wiktionary) into
// simplified Chinese. This is plain text — no Google Search grounding — so it uses
// the large generateContent quota instead of the scarce grounding quota, and
// translating a known meaning is low-hallucination.
export async function requestGeminiTranslation({
  term,
  englishMeanings = [],
  apiKey,
  model,
  fetchImpl = fetch,
  explainError = explainOnlineDictionaryError,
}) {
  const cleanTerm = cleanOnlineString(term, 120);
  if (!cleanTerm) throw new Error("A word or phrase is required for translation.");
  if (!apiKey) throw new Error("A Gemini API key is required for translation.");
  const prompt = [
    `Give concise simplified-Chinese meanings for the English ${cleanTerm.includes(" ") ? "phrase" : "word"} "${cleanTerm}".`,
    englishMeanings.length
      ? `English senses for reference:\n- ${englishMeanings.slice(0, 6).join("\n- ")}`
      : "",
    "Return 1-6 short simplified-Chinese gloss strings. No pinyin, no English, no punctuation-only entries.",
  ].filter(Boolean).join("\n");

  const payload = await postGemini(geminiEndpoint(model, apiKey), {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: TRANSLATION_SCHEMA,
      temperature: 0,
    },
  }, fetchImpl, explainError);

  try {
    const parsed = JSON.parse(onlineResponseText(payload));
    return Array.isArray(parsed?.chineseMeanings) ? parsed.chineseMeanings.map((value) => String(value)) : [];
  } catch {
    return [];
  }
}

// Last resort: build an entry from the model's own knowledge with NO web grounding.
// Used only after grounding fails for a transient/quota reason. Results are inherently
// unverified, so confidence is capped low and tagged source "gemini-plain" — the bridge
// must not silently auto-add these.
export async function requestPlainOnlineEntry({
  term,
  apiKey,
  model,
  fetchImpl = fetch,
  explainError = explainOnlineDictionaryError,
}) {
  const cleanTerm = cleanOnlineString(term, 120);
  if (!cleanTerm) throw new Error("A word or phrase is required for online lookup.");
  if (!apiKey) throw new Error("A Gemini API key is required for online lookup.");
  const startedAt = Date.now();
  const prompt = [
    `Without using web search, produce a dictionary record for the exact English input "${cleanTerm}" from your own knowledge.`,
    `Treat common phrases/collocations such as "sloppy work" as valid entries when you are confident of their meaning, even if they are not headwords in a dictionary.`,
    "Do not invent obscure terms. For valid phrases, give concise meanings and Simplified Chinese glosses.",
    "Rules:",
    "- This is an unverified last resort. If you are not confident the exact spelling/phrase is real English, set status=not_found and do not invent meanings.",
    "- status=found for a word, phrase, or collocation you are confident of; status=correction with suggestedWord for a likely typo; otherwise status=not_found.",
    "- Preserve the exact input; do not rewrite a multi-word phrase to a single word.",
    "- Give 1-6 concise English meanings and matching simplified-Chinese meanings.",
    "- confidence must honestly reflect your certainty (high, medium, or low).",
  ].join("\n");

  const payload = await postGemini(geminiEndpoint(model, apiKey), {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: ONLINE_DICTIONARY_SCHEMA,
      temperature: 0,
    },
  }, fetchImpl, explainError);

  let structured;
  try {
    structured = JSON.parse(onlineResponseText(payload));
  } catch {
    throw new OnlineDictionaryRequestError("Gemini returned non-JSON dictionary data for the plain-text fallback.");
  }

  return buildOnlineEntry({
    input: cleanTerm,
    source: "gemini-plain",
    status: structured?.status,
    canonicalWord: structured?.canonicalWord,
    suggestedWord: structured?.suggestedWord,
    phonetic: structured?.phonetic,
    entryType: structured?.entryType,
    partsOfSpeech: structured?.partsOfSpeech,
    englishMeanings: structured?.englishMeanings,
    chineseMeanings: structured?.chineseMeanings,
    tags: structured?.tags,
    confidence: "low",
    model,
    queryMs: Date.now() - startedAt,
  });
}

function withTrace(entry, fallbackTrace) {
  return { ...entry, fallbackTrace };
}

// A grounded result is usable only when it positively resolved the term: a "found"
// entry, or a "correction" that actually names a suggestion. Anything else (a
// not_found, or a normalization that downgraded to not_found for lack of sources /
// meanings) means grounding could not help, so we must try the plain fallback.
function usableResolvedEntry(entry) {
  return entry.status === "found" || (entry.status === "correction" && Boolean(entry.suggestedWord));
}

// Tiered online lookup. Order is tuned to spend the scarce grounded-search quota only
// where it is the only option (a word absent from Wiktionary), and to never dead-end a
// valid term before every tier has been tried:
//   1. Wiktionary  — free, browser-direct, no quota. Full hit wins outright.
//   2. Wiktionary English but no Chinese — plain-text translate (cheap quota), merge.
//   3. Wiktionary miss — Gemini grounding (needs the live web to find/verify/correct).
//   4. Grounding misses/errors/normalizes to not_found — plain-text last resort, flagged
//      gemini-plain / low confidence so the bridge reviews instead of auto-adding.
// Only after the plain fallback also fails do we report an actionable not_found/error.
export async function resolveOnlineDictionaryEntry({
  term,
  apiKey,
  model,
  fetchImpl = fetch,
  explainError = explainOnlineDictionaryError,
}) {
  const cleanTerm = cleanOnlineString(term, 120);
  if (!cleanTerm) throw new Error("A word or phrase is required for online lookup.");
  const startedAt = Date.now();
  const trace = [];

  // Tier 1 / 2: Wiktionary.
  const wik = await lookupWiktionary(cleanTerm, fetchImpl);
  if (wik.found) {
    const wikSource = [{ title: "Wiktionary", url: wik.sourceUrl }];
    if (wik.chineseMeanings.length) {
      trace.push({ tier: "wiktionary", status: "found" });
      return withTrace(buildOnlineEntry({
        input: cleanTerm,
        source: "wiktionary",
        status: "found",
        canonicalWord: wik.canonicalWord,
        phonetic: wik.phonetic,
        entryType: cleanTerm.includes(" ") ? "phrase" : "word",
        partsOfSpeech: wik.partsOfSpeech,
        englishMeanings: wik.englishMeanings,
        chineseMeanings: wik.chineseMeanings,
        confidence: "high",
        sourceUrls: wikSource,
        queryMs: Date.now() - startedAt,
      }), trace);
    }
    // English found, Chinese missing: top up with a plain-text translation.
    if (apiKey) {
      try {
        const chineseMeanings = await requestGeminiTranslation({
          term: cleanTerm,
          englishMeanings: wik.englishMeanings,
          apiKey,
          model,
          fetchImpl,
          explainError,
        });
        if (chineseMeanings.length) {
          trace.push({ tier: "wiktionary", status: "found-english-only" }, { tier: "gemini-translation", status: "found" });
          return withTrace(buildOnlineEntry({
            input: cleanTerm,
            source: "wiktionary+gemini",
            status: "found",
            canonicalWord: wik.canonicalWord,
            phonetic: wik.phonetic,
            entryType: cleanTerm.includes(" ") ? "phrase" : "word",
            partsOfSpeech: wik.partsOfSpeech,
            englishMeanings: wik.englishMeanings,
            chineseMeanings,
            confidence: "medium",
            sourceUrls: wikSource,
            queryMs: Date.now() - startedAt,
          }), trace);
        }
      } catch {
        // Translation failed (quota/error); fall through to English-only.
      }
    }
    // English-only: still useful, but unverified for Chinese — low confidence, no auto-add.
    trace.push({ tier: "wiktionary", status: "found-english-only" });
    return withTrace(buildOnlineEntry({
      input: cleanTerm,
      source: "wiktionary",
      status: "found",
      canonicalWord: wik.canonicalWord,
      phonetic: wik.phonetic,
      entryType: cleanTerm.includes(" ") ? "phrase" : "word",
      partsOfSpeech: wik.partsOfSpeech,
      englishMeanings: wik.englishMeanings,
      chineseMeanings: [],
      confidence: "low",
      sourceUrls: wikSource,
      queryMs: Date.now() - startedAt,
    }), trace);
  }
  trace.push({ tier: "wiktionary", status: "miss" });

  // No Gemini key: the grounded and plain tiers cannot run, so stop with an honest
  // not_found whose source makes clear a key is what's missing (the bridge guides the user).
  if (!apiKey) {
    return withTrace(buildOnlineEntry({
      input: cleanTerm,
      source: "wiktionary",
      status: "not_found",
      canonicalWord: cleanTerm,
      confidence: "low",
      queryMs: Date.now() - startedAt,
    }), trace);
  }

  // Tier 3: Gemini grounding. A positive result wins; any failure or unusable/not_found
  // result is captured and we fall through to the plain fallback rather than dead-ending.
  let groundingFailure = "";
  try {
    const grounded = await requestOnlineDictionaryEntry({ term: cleanTerm, apiKey, model, fetchImpl, explainError });
    if (usableResolvedEntry(grounded)) {
      trace.push({ tier: "gemini-grounded", status: grounded.status });
      return withTrace(grounded, trace);
    }
    trace.push({ tier: "gemini-grounded", status: "not_found" });
    groundingFailure = "grounded search found no reliable dictionary entry";
  } catch (error) {
    trace.push({ tier: "gemini-grounded", status: "error" });
    groundingFailure = error instanceof Error ? error.message : String(error);
  }

  // Tier 4: Gemini plain-text last resort (unverified, low confidence, never auto-added).
  let plain;
  try {
    plain = await requestPlainOnlineEntry({ term: cleanTerm, apiKey, model, fetchImpl, explainError });
  } catch (error) {
    const plainFailure = error instanceof Error ? error.message : String(error);
    trace.push({ tier: "gemini-plain", status: "error" });
    throw new OnlineDictionaryRequestError(
      [
        `Online lookup for "${cleanTerm}" failed after every fallback.`,
        groundingFailure ? `Grounded search: ${groundingFailure}.` : "",
        `Plain fallback: ${plainFailure}`,
      ].filter(Boolean).join(" "),
    );
  }
  trace.push({ tier: "gemini-plain", status: usableResolvedEntry(plain) ? plain.status : "not_found" });
  return withTrace(plain, trace);
}

export { OnlineDictionaryRequestError } from "./online-dictionary-normalize.js?v=20260714-4";
