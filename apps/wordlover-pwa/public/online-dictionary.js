import {
  ONLINE_DICTIONARY_SCHEMA,
  OnlineDictionaryRequestError,
  buildOnlineEntry,
  cleanOnlineString,
  explainOnlineDictionaryError,
  extractGroundingSources,
  normalizeOnlineDictionaryResult,
  onlineResponseText,
} from "./online-dictionary-normalize.js?v=20260624-1";
import { lookupWiktionary } from "./wiktionary-lookup.js?v=20260624-1";

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
    "Rules:",
    "- This is an unverified last resort. If you are not confident the exact spelling is a real English term, set status=not_found and do not invent meanings.",
    "- status=found only for a term you are confident exists; status=correction with suggestedWord for a likely typo; otherwise status=not_found.",
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

function transientGeminiError(error) {
  const status = error instanceof OnlineDictionaryRequestError ? error.status : 0;
  // 429 = quota, 0 = network/CORS, 5xx = server. A bad request (400) or auth/config
  // failure (403) would fail identically for plain text, so don't waste a call retrying.
  return status === 429 || status === 0 || status >= 500;
}

// Tiered online lookup. Order is tuned to spend the scarce grounded-search quota only
// where it is the only option (a word absent from Wiktionary):
//   1. Wiktionary  — free, browser-direct, no quota. Full hit wins outright.
//   2. Wiktionary English but no Chinese — plain-text translate (cheap quota), merge.
//   3. Wiktionary miss — Gemini grounding (needs the live web to find/verify/correct).
//   4. Grounding fails for a transient/quota reason — plain-text last resort, flagged.
// A grounding result that *ran* but found no evidence is returned as-is (honest
// not_found); we never fall through to ungrounded guessing for unknown words.
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

  // Tier 1 / 2: Wiktionary.
  const wik = await lookupWiktionary(cleanTerm, fetchImpl);
  if (wik.found) {
    const wikSource = [{ title: "Wiktionary", url: wik.sourceUrl }];
    if (wik.chineseMeanings.length) {
      return buildOnlineEntry({
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
      });
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
          return buildOnlineEntry({
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
          });
        }
      } catch {
        // Translation failed (quota/error); fall through to English-only.
      }
    }
    // English-only: still useful, but unverified for Chinese — low confidence, no auto-add.
    return buildOnlineEntry({
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
    });
  }

  // Tier 3: Wiktionary miss — only now spend grounded-search quota.
  if (!apiKey) {
    return buildOnlineEntry({
      input: cleanTerm,
      source: "wiktionary",
      status: "not_found",
      canonicalWord: cleanTerm,
      confidence: "low",
      queryMs: Date.now() - startedAt,
    });
  }
  try {
    return await requestOnlineDictionaryEntry({ term: cleanTerm, apiKey, model, fetchImpl, explainError });
  } catch (error) {
    // Tier 4: plain-text last resort, but only for quota/transient grounding failures.
    if (!transientGeminiError(error)) throw error;
    return await requestPlainOnlineEntry({ term: cleanTerm, apiKey, model, fetchImpl, explainError });
  }
}

export { OnlineDictionaryRequestError } from "./online-dictionary-normalize.js?v=20260624-1";
