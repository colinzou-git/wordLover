const YOUDAO_ENTRY_URL = "https://m.youdao.com/dict";
const APOSTROPHE_VARIANTS_RE = /[\u2018\u2019\u02bc`\uff07]/g;
const YOUDAO_TERM_RE = /^[a-z]+(?:[ '-][a-z]+){0,5}$/;

export function normalizeYoudaoTerm(term) {
  return String(term ?? "")
    .replace(APOSTROPHE_VARIANTS_RE, "'")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function canLookupYoudaoTerm(term) {
  return YOUDAO_TERM_RE.test(normalizeYoudaoTerm(term));
}

export function buildYoudaoLookupUrl(term) {
  const normalized = normalizeYoudaoTerm(term);
  if (!YOUDAO_TERM_RE.test(normalized)) return "";
  return `${YOUDAO_ENTRY_URL}?le=eng&q=${encodeURIComponent(normalized)}`;
}

export const youdaoProvider = Object.freeze({
  id: "youdao",
  label: "Youdao",
  supports: canLookupYoudaoTerm,
  buildExternalUrl: buildYoudaoLookupUrl,
  canLookupInApp: false,
});
