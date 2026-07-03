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
  const translated = meanings.filter((meaning) => String(meaning?.zh ?? "").trim());
  if (!translated.length) return "";
  return `<div class="structured-meanings">${translated.map((meaning) => {
    const pos = meaning?.pos ? `<span class="structured-pos">${escapeDictionaryHtml(meaning.pos)}</span> ` : "";
    const englishValue = String(meaning?.en ?? "").trim();
    const english = escapeDictionaryHtml(englishValue);
    const zh = `${escapeDictionaryHtml(meaning.zh)}${englishValue ? ' <span class="structured-bar">|</span> ' : ""}`;
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
  const meanings = renderStructuredDisplayMeanings(detail?.displayMeanings);
  const fallback = detail?.translationFallback?.zh
    ? `<p class="structured-translation-fallback"><strong>Other Chinese meanings:</strong> ${escapeDictionaryHtml(detail.translationFallback.zh)}</p>`
    : "";
  return `<div class="structured-dictionary-result">${meanings}${fallback}${renderStructuredDetailedDefinitions(detail?.detailedDefinitions)}</div>`;
}

export function canonicalPronunciationKey(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const inner = raw.replace(/^[\/[]+/, "").replace(/[\/\]]+$/, "").trim();
  return inner ? `/${inner}/` : "";
}

export function structuredPronunciations(detail) {
  if (!Array.isArray(detail?.pronunciations)) return [];
  const seen = new Set();
  return detail.pronunciations.filter((item) => {
    const ipa = canonicalPronunciationKey(item?.ipa);
    if (!ipa) return false;
    const key = `${String(item?.pos ?? "").trim()}\u0000${ipa}`;
    if (seen.has(key)) return false;
    seen.add(key);
    item.ipa = ipa;
    return true;
  });
}

export function groupPronunciationsByIpa(pronunciations) {
  const groups = [];
  const byIpa = new Map();
  for (const item of pronunciations ?? []) {
    const ipa = canonicalPronunciationKey(item?.ipa);
    if (!ipa) continue;
    let group = byIpa.get(ipa);
    if (!group) {
      group = { ipa, positions: [] };
      byIpa.set(ipa, group);
      groups.push(group);
    }
    const pos = String(item?.pos ?? "").trim();
    if (pos && !group.positions.includes(pos)) group.positions.push(pos);
  }
  return groups;
}

export function renderPronunciationLine(term, detail) {
  const groups = groupPronunciationsByIpa(structuredPronunciations(detail));
  if (groups.length < 2) return "";
  const safeTerm = escapeDictionaryHtml(term);
  return `<div class="pos-pronunciations">${groups.map((group, index) => {
    const label = group.positions.join(", ");
    const pos = label ? `<span class="pronunciation-pos">${escapeDictionaryHtml(label)}</span> ` : "";
    const speaker = `<button type="button" class="speaker-button pronunciation-speaker" data-speak-term="${safeTerm}" aria-label="Pronounce ${safeTerm} ${escapeDictionaryHtml(label)}" title="Pronounce">🔊</button>`;
    return `${index ? '<span class="pronunciation-divider">|</span> ' : ""}${pos}<span class="word-ipa">${escapeDictionaryHtml(group.ipa)}</span>${speaker}`;
  }).join(" ")}</div>`;
}
