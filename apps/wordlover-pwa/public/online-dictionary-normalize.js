const MAX_SOURCE_COUNT = 6;
const MAX_MEANING_COUNT = 6;

export class OnlineDictionaryRequestError extends Error {
  constructor(message, { status = 0, body = "" } = {}) {
    super(message);
    this.name = "OnlineDictionaryRequestError";
    this.status = status;
    this.body = body;
  }
}

// Turn a Gemini HTTP failure into actionable guidance instead of a bare status
// code. 429 is the common one: grounded Google-Search lookups have a small
// free-tier quota that the app cannot raise, so the message must point at the
// real remedies (switch model, new key) rather than look like a transient glitch.
export function explainOnlineDictionaryError(status, bodyText = "") {
  if (status === 429) {
    let retryHint = "";
    try {
      const parsed = JSON.parse(bodyText);
      const retry = parsed?.error?.details?.find?.((d) => d["@type"]?.includes("RetryInfo"))?.retryDelay;
      if (retry) retryHint = ` Retry in ~${retry}.`;
    } catch {}
    return [
      "Gemini quota exceeded for this API key, so the online dictionary search could not run.",
      "Grounded Google Search lookups have a small free-tier quota that resets daily.",
      "Switch model in the Gemini key dialog (each model has its own quota bucket), or create a new key in Google AI Studio (https://aistudio.google.com/app/apikey) so the project gets fresh free-tier quota.",
      retryHint,
    ].filter(Boolean).join(" ");
  }
  if (status === 403) {
    return `Gemini rejected the online lookup (403). Enable the Generative Language API for the Cloud project tied to this key, and allow the generativelanguage.googleapis.com endpoint in any key restrictions. Raw: ${String(bodyText).slice(0, 300)}`;
  }
  if (status === 400) {
    return `Gemini rejected the online lookup request (400). The model name may be invalid for your project, or the request is unsupported. Raw: ${String(bodyText).slice(0, 300)}`;
  }
  return `Online dictionary request failed: ${status}`;
}

export const ONLINE_DICTIONARY_SCHEMA = {
  type: "object",
  properties: {
    status: { type: "string", enum: ["found", "not_found", "correction"] },
    canonicalWord: { type: "string" },
    suggestedWord: { type: "string" },
    phonetic: { type: "string" },
    entryType: {
      type: "string",
      enum: ["word", "phrase", "proper noun", "abbreviation", "technical term", "informal", "obsolete"],
    },
    partsOfSpeech: { type: "array", items: { type: "string" } },
    englishMeanings: { type: "array", items: { type: "string" } },
    chineseMeanings: { type: "array", items: { type: "string" } },
    tags: { type: "array", items: { type: "string" } },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
  },
  required: [
    "status",
    "canonicalWord",
    "suggestedWord",
    "phonetic",
    "entryType",
    "partsOfSpeech",
    "englishMeanings",
    "chineseMeanings",
    "tags",
    "confidence",
  ],
};

export function normalizeOnlineTerm(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[\u2018\u2019\u02bc\uff07]/g, "'")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function cleanOnlineString(value, maxLength = 500) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function cleanList(values, { maxItems = MAX_MEANING_COUNT, maxLength = 500 } = {}) {
  const seen = new Set();
  const result = [];
  for (const value of Array.isArray(values) ? values : []) {
    const clean = cleanOnlineString(value, maxLength);
    const key = clean.toLowerCase();
    if (!clean || seen.has(key)) continue;
    seen.add(key);
    result.push(clean);
    if (result.length >= maxItems) break;
  }
  return result;
}

export function extractGroundingSources(metadata) {
  const sources = [];
  const seen = new Set();
  for (const chunk of metadata?.groundingChunks ?? []) {
    const uri = cleanOnlineString(chunk?.web?.uri, 2048);
    const title = cleanOnlineString(chunk?.web?.title || "Web source", 200);
    if (!uri || seen.has(uri)) continue;
    try {
      const parsed = new URL(uri);
      if (!["http:", "https:"].includes(parsed.protocol)) continue;
    } catch {
      continue;
    }
    seen.add(uri);
    sources.push({ title, url: uri });
    if (sources.length >= MAX_SOURCE_COUNT) break;
  }
  return sources;
}

export function normalizeOnlineDictionaryResult({
  input,
  structured,
  groundingMetadata,
  model,
  queryMs = 0,
}) {
  const inputTerm = cleanOnlineString(input, 120);
  const canonicalWord = cleanOnlineString(structured?.canonicalWord || inputTerm, 120);
  const suggestedWord = cleanOnlineString(structured?.suggestedWord, 120);
  const englishMeanings = cleanList(structured?.englishMeanings);
  const chineseMeanings = cleanList(structured?.chineseMeanings);
  const partsOfSpeech = cleanList(structured?.partsOfSpeech, { maxItems: 8, maxLength: 80 });
  const tags = cleanList(structured?.tags, { maxItems: 10, maxLength: 80 });
  const sourceUrls = extractGroundingSources(groundingMetadata);
  const searchQueries = cleanList(groundingMetadata?.webSearchQueries, { maxItems: 8, maxLength: 200 });
  const confidence = ["high", "medium", "low"].includes(structured?.confidence)
    ? structured.confidence
    : "low";
  let status = ["found", "not_found", "correction"].includes(structured?.status)
    ? structured.status
    : "not_found";

  const exactSpelling = normalizeOnlineTerm(canonicalWord) === normalizeOnlineTerm(inputTerm);
  let correction = suggestedWord;
  if (status === "found" && !exactSpelling) {
    status = "correction";
    correction ||= canonicalWord;
  }
  if (status === "correction" && !correction && !exactSpelling) correction = canonicalWord;

  if (
    status === "found"
    && (
      !englishMeanings.length
      || !chineseMeanings.length
      || !sourceUrls.length
      || confidence === "low"
    )
  ) {
    status = "not_found";
  }

  return {
    status,
    canonicalWord,
    suggestedWord: correction,
    phonetic: cleanOnlineString(structured?.phonetic, 160),
    entryType: cleanOnlineString(structured?.entryType || (inputTerm.includes(" ") ? "phrase" : "word"), 80),
    partsOfSpeech,
    englishMeanings,
    chineseMeanings,
    tags,
    confidence,
    sourceUrls,
    searchQueries,
    model,
    queryMs,
  };
}

export function onlineResponseText(payload) {
  return payload?.candidates?.[0]?.content?.parts
    ?.map((part) => part?.text)
    .filter(Boolean)
    .join("\n")
    .trim() ?? "";
}
