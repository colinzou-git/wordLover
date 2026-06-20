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
    evidenceSummary: { type: "string" },
  },
  required: ["status", "canonicalWord", "englishMeanings", "chineseMeanings", "confidence"],
};

export function normalizeOnlineTerm(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[‘’‛`´]/g, "'")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function cleanText(value, maxLength = 700) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanStringList(value, { limit = MAX_MEANING_COUNT, maxLength = 700 } = {}) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const output = [];
  for (const item of value) {
    const clean = cleanText(item, maxLength);
    const key = clean.toLowerCase();
    if (!clean || seen.has(key)) continue;
    seen.add(key);
    output.push(clean);
    if (output.length >= limit) break;
  }
  return output;
}

function safeHttpUrl(value) {
  try {
    const url = new URL(String(value ?? ""));
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
  } catch {
    return "";
  }
}

export function extractGroundingSources(groundingMetadata) {
  const chunks = groundingMetadata?.groundingChunks;
  if (!Array.isArray(chunks)) return [];
  const seen = new Set();
  const sources = [];
  for (const chunk of chunks) {
    const url = safeHttpUrl(chunk?.web?.uri);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    sources.push({
      title: cleanText(chunk?.web?.title, 180) || new URL(url).hostname,
      url,
    });
    if (sources.length >= MAX_SOURCE_COUNT) break;
  }
  return sources;
}

function correctionResult(input, suggestedWord, onlineSources, queryMs) {
  const suggestion = cleanText(suggestedWord, 120);
  return {
    status: "correction",
    term: input,
    suggestedWord: suggestion,
    alternatives: suggestion ? [{ word: suggestion, preview: "Suggested online correction" }] : [],
    onlineSources,
    queryMs,
  };
}

export function normalizeOnlineDictionaryResult({ input, structured, groundingMetadata, model, queryMs = 0 }) {
  const original = String(input ?? "").trim();
  const normalizedInput = normalizeOnlineTerm(original);
  const canonicalWord = cleanText(structured?.canonicalWord, 120);
  const normalizedCanonical = normalizeOnlineTerm(canonicalWord);
  const status = cleanText(structured?.status, 32).toLowerCase();
  const onlineSources = extractGroundingSources(groundingMetadata);

  if (status === "correction") {
    return correctionResult(original, structured?.suggestedWord || canonicalWord, onlineSources, queryMs);
  }
  if (status !== "found") {
    return { status: "not_found", term: original, alternatives: [], onlineSources, queryMs };
  }
  if (!normalizedCanonical || normalizedCanonical !== normalizedInput) {
    return correctionResult(original, structured?.suggestedWord || canonicalWord, onlineSources, queryMs);
  }

  const englishMeanings = cleanStringList(structured?.englishMeanings);
  const chineseMeanings = cleanStringList(structured?.chineseMeanings, { maxLength: 350 });
  const confidence = ["high", "medium", "low"].includes(structured?.confidence)
    ? structured.confidence
    : "low";
  if (!englishMeanings.length || !chineseMeanings.length || confidence === "low" || !onlineSources.length) {
    return { status: "not_found", term: original, alternatives: [], onlineSources, queryMs };
  }

  const partsOfSpeech = cleanStringList(structured?.partsOfSpeech, { limit: 8, maxLength: 80 });
  const tags = cleanStringList(structured?.tags, { limit: 10, maxLength: 80 });
  return {
    status: "found",
    term: original,
    entryType: cleanText(structured?.entryType, 80) || (original.includes(" ") ? "phrase" : "word"),
    phonetic: cleanText(structured?.phonetic, 160),
    englishMeanings,
    englishMeaningSource: "Google Search grounded",
    chineseMeanings,
    tags: [...new Set(["online", ...tags])],
    partsOfSpeech,
    confidence,
    evidenceSummary: cleanText(structured?.evidenceSummary, 1000),
    source: "google-search-grounded",
    onlineSources,
    lookupProvider: "gemini-google-search",
    lookupModel: cleanText(model, 120),
    generatedAt: new Date().toISOString(),
    queryMs,
  };
}
