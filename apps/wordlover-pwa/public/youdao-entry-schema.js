export const YOUDAO_ENTRY_SCHEMA_VERSION = 1;

const cleanText = (value, field, { required = false } = {}) => {
  if (value == null && !required) return "";
  if (typeof value !== "string" || (required && !value.trim())) throw new TypeError(`Youdao entry ${field} is invalid.`);
  return value.replace(/<[^>]*>/g, "").trim();
};
const stringList = (value, field) => {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new TypeError(`Youdao entry ${field} must be an array.`);
  return [...new Set(value.map((item) => cleanText(item, field)).filter(Boolean))];
};
const definitionList = (value, field) => {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new TypeError(`Youdao entry ${field} must be an array.`);
  return value.map((item) => {
    if (!item || typeof item !== "object") throw new TypeError(`Youdao entry ${field} item is invalid.`);
    const partOfSpeech = cleanText(item.partOfSpeech, `${field}.partOfSpeech`);
    const domain = cleanText(item.domain, `${field}.domain`);
    return Object.freeze({ text: cleanText(item.text, `${field}.text`, { required: true }), ...(partOfSpeech ? { partOfSpeech } : {}), ...(domain ? { domain } : {}) });
  });
};

export function validateYoudaoEntry(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError("Youdao entry must be an object.");
  if (value.schemaVersion !== YOUDAO_ENTRY_SCHEMA_VERSION) throw new TypeError(`Unsupported Youdao entry schema: ${value.schemaVersion ?? "missing"}.`);
  if (value.provider?.id !== "youdao" || cleanText(value.provider?.label, "provider.label", { required: true }) !== "Youdao") throw new TypeError("Youdao entry provider is invalid.");
  const chineseDefinitions = definitionList(value.chineseDefinitions, "chineseDefinitions");
  const englishDefinitions = definitionList(value.englishDefinitions, "englishDefinitions");
  if (!chineseDefinitions.length && !englishDefinitions.length) throw new TypeError("Youdao entry needs at least one definition.");
  const phonetics = value.phonetics == null ? {} : value.phonetics;
  if (!phonetics || typeof phonetics !== "object" || Array.isArray(phonetics)) throw new TypeError("Youdao entry phonetics is invalid.");
  const pairs = (items, field, left, right) => {
    if (items == null) return [];
    if (!Array.isArray(items)) throw new TypeError(`Youdao entry ${field} must be an array.`);
    return items.map((item) => Object.freeze({ [left]: cleanText(item?.[left], `${field}.${left}`, { required: true }), [right]: Array.isArray(item?.[right]) ? stringList(item[right], `${field}.${right}`) : cleanText(item?.[right], `${field}.${right}`, { required: true }) }));
  };
  const retrievedAt = cleanText(value.retrievedAt, "retrievedAt", { required: true });
  if (!Number.isFinite(Date.parse(retrievedAt))) throw new TypeError("Youdao entry retrievedAt is invalid.");
  const us = cleanText(phonetics.us, "phonetics.us"), uk = cleanText(phonetics.uk, "phonetics.uk");
  return Object.freeze({
    schemaVersion: YOUDAO_ENTRY_SCHEMA_VERSION,
    provider: Object.freeze({ id: "youdao", label: "Youdao" }),
    normalizedTerm: cleanText(value.normalizedTerm, "normalizedTerm", { required: true }),
    headword: cleanText(value.headword, "headword", { required: true }),
    sourceUrl: cleanText(value.sourceUrl, "sourceUrl", { required: true }),
    retrievedAt,
    parserVersion: cleanText(value.parserVersion, "parserVersion", { required: true }),
    phonetics: Object.freeze({ ...(us ? { us } : {}), ...(uk ? { uk } : {}) }),
    chineseDefinitions,
    englishDefinitions,
    wordForms: pairs(value.wordForms, "wordForms", "name", "value"),
    phrases: pairs(value.phrases, "phrases", "phrase", "meanings"),
    examples: (Array.isArray(value.examples) ? value.examples : []).map((item) => { const translation = cleanText(item?.translation, "examples.translation"); return Object.freeze({ sentence: cleanText(item?.sentence, "examples.sentence", { required: true }), ...(translation ? { translation } : {}) }); }),
    synonyms: stringList(value.synonyms, "synonyms"),
    antonyms: stringList(value.antonyms, "antonyms"),
    domains: stringList(value.domains, "domains"),
    ...(cleanText(value.providerRecordId, "providerRecordId") ? { providerRecordId: cleanText(value.providerRecordId, "providerRecordId") } : {}),
  });
}
