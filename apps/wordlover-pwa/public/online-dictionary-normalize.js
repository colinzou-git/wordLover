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
