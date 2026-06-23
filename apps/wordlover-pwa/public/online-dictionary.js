import {
  ONLINE_DICTIONARY_SCHEMA,
  OnlineDictionaryRequestError,
  cleanOnlineString,
  explainOnlineDictionaryError,
  extractGroundingSources,
  normalizeOnlineDictionaryResult,
  onlineResponseText,
} from "./online-dictionary-normalize.js?v=20260618-1";

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
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

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

export { OnlineDictionaryRequestError } from "./online-dictionary-normalize.js?v=20260618-1";
