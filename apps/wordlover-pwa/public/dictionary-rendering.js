function escapeDictionaryHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function parseDictionaryDetail(value) {
  if (!value) return null;
  if (typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function hasStructuredDictionaryDetail(detail) {
  return Boolean(detail) && (
    Array.isArray(detail.displayMeanings) && detail.displayMeanings.length > 0
    || Array.isArray(detail.detailedDefinitions) && detail.detailedDefinitions.length > 0
    || Boolean(detail.translationFallback?.zh)
  );
}

export function formatDomainSuffix(domain) {
  const value = String(domain ?? "").trim();
  return value ? ` (${value})` : "";
}

export function renderStructuredDisplayMeanings(meanings) {
  if (!Array.isArray(meanings) || !meanings.length) return "";
  return `<div class="structured-meanings">${meanings.map((meaning) => {
    const pos = meaning?.pos ? `<span class="structured-pos">${escapeDictionaryHtml(meaning.pos)}</span> ` : "";
    const zh = meaning?.zh ? `${escapeDictionaryHtml(meaning.zh)} <span class="structured-bar">|</span> ` : "";
    const english = escapeDictionaryHtml(meaning?.en ?? "");
    const domain = meaning?.domain
      ? `<span class="structured-domain">${escapeDictionaryHtml(formatDomainSuffix(meaning.domain))}</span>`
      : "";
    return `<p class="structured-meaning-line">${pos}${zh}${english}${domain}</p>`;
  }).join("")}</div>`;
}

export function renderStructuredDetailedDefinitions(groups) {
  if (!Array.isArray(groups) || !groups.length) return "";
  return `<div class="detailed-definitions">${groups.map((group) => {
    const senses = Array.isArray(group?.senses) ? group.senses : [];
    if (!senses.length) return "";
    return `<section><h4>${escapeDictionaryHtml(group?.pos ?? "Definitions")}:</h4><ol>${senses.map((sense) => {
      const examples = Array.isArray(sense?.examples) ? sense.examples : [];
      return `<li><p>${escapeDictionaryHtml(sense?.definition ?? "")}${escapeDictionaryHtml(formatDomainSuffix(sense?.domain))}</p>${examples.map((example) => `<blockquote>${escapeDictionaryHtml(example)}</blockquote>`).join("")}</li>`;
    }).join("")}</ol></section>`;
  }).join("")}</div>`;
}

export function renderStructuredDictionaryResult(_data, detail) {
  const fallback = detail?.translationFallback?.zh
    ? `<p class="structured-translation-fallback"><strong>Chinese meanings:</strong> ${escapeDictionaryHtml(detail.translationFallback.zh)}</p>`
    : "";
  return `<div class="structured-dictionary-result">${fallback}${renderStructuredDisplayMeanings(detail?.displayMeanings)}${renderStructuredDetailedDefinitions(detail?.detailedDefinitions)}</div>`;
}
