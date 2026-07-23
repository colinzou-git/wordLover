export const MAX_STUDY_SUPPLEMENT_MEANINGS = 3;
export const MAX_STUDY_SUPPLEMENT_LENGTH = 96;
export const MAX_QUIZ_MEANING_LENGTH = 180;

const normalizeText = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const comparisonKey = (value) => normalizeText(value).toLocaleLowerCase().replace(/[\s\p{P}]+/gu, "");

function maskTarget(value, targetTerm) {
  const term = normalizeText(targetTerm);
  if (!term) return value;
  const variants = new Set([term, `${term}s`, `${term}es`, `${term}ed`, `${term}ing`]);
  if (term.endsWith("e")) variants.add(`${term.slice(0, -1)}ing`);
  if (/[^aeiou]y$/i.test(term)) variants.add(`${term.slice(0, -1)}ies`);
  const forms = [...variants].sort((left, right) => right.length - left.length).map((item) => item.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/[’']/g, "[’']")).join("|");
  return value.replace(new RegExp(`\\b(?:${forms})\\b`, "giu"), "____");
}

export function savedSupplementToStudySnapshot(record, { localMeanings = [], targetTerm = "" } = {}) {
  const entry = record?.entry ?? record;
  if (!entry || entry.provider?.id !== "youdao") return null;
  const existing = new Set((localMeanings ?? []).map(comparisonKey).filter(Boolean));
  const language = entry.chineseDefinitions?.length ? "zh" : "en";
  const source = language === "zh" ? entry.chineseDefinitions : entry.englishDefinitions ?? [];
  const meanings = [];
  for (const definition of source) {
    let text = maskTarget(normalizeText(definition?.text), targetTerm);
    if (!text || text.length > MAX_STUDY_SUPPLEMENT_LENGTH) continue;
    const key = comparisonKey(text);
    if (!key || existing.has(key) || meanings.some((item) => comparisonKey(item.text) === key)) continue;
    meanings.push(Object.freeze({ text, ...(normalizeText(definition.partOfSpeech) ? { partOfSpeech: normalizeText(definition.partOfSpeech) } : {}), ...(normalizeText(definition.domain) ? { domain: normalizeText(definition.domain) } : {}) }));
    if (meanings.length >= MAX_STUDY_SUPPLEMENT_MEANINGS) break;
  }
  if (!meanings.length) return null;
  return Object.freeze({ providerId: "youdao", providerLabel: "Youdao", sourceUrl: String(entry.sourceUrl ?? ""), entrySchemaVersion: entry.schemaVersion, retrievedAt: entry.retrievedAt, language, meanings: Object.freeze(meanings) });
}

export function quizMeaningWithSupplement(localMeaning, snapshot) {
  const local = normalizeText(localMeaning);
  const supplemental = snapshot?.meanings?.[0]?.text ?? "";
  if (!supplemental) return local;
  if (!local) return supplemental.slice(0, MAX_QUIZ_MEANING_LENGTH);
  if (comparisonKey(local) === comparisonKey(supplemental)) return local;
  return `${local} · ${supplemental}`.slice(0, MAX_QUIZ_MEANING_LENGTH).trim();
}

export function appendSupplementHint(localHint, snapshot) {
  const local = normalizeText(localHint);
  const additions = (snapshot?.meanings ?? []).map((item) => item.text).filter((text) => comparisonKey(text) !== comparisonKey(local));
  return [local, ...additions].filter(Boolean).join(" · ");
}
