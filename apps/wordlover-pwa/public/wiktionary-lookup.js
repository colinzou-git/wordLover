import { cleanOnlineString } from "./online-dictionary-normalize.js?v=20260701-8";

// English Wiktionary is the only "nice" dictionary that answers cross-origin
// (Access-Control-Allow-Origin: *), so a no-backend PWA can read it directly.
// Two endpoints are used: the REST definition API for clean English senses, and
// the action=parse wikitext API for Chinese translations (which the REST API omits).
const WIKTIONARY_ORIGIN = "https://en.wiktionary.org";
const MAX_ITEMS = 6;

function stripHtml(value) {
  return String(value ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// Mandarin translations live in wikitext as {{t|cmn|放棄|tr=fàngqì}} / {{t+|cmn|...}}.
// We ship the Traditional form Wiktionary provides as-is (no Simplified conversion yet).
function extractMandarin(wikitext) {
  const out = [];
  const seen = new Set();
  const re = /\{\{t\+?\|cmn\|([^|}]+)((?:\|[^}]*)?)\}\}/g;
  let match;
  while ((match = re.exec(wikitext)) !== null) {
    const hanzi = match[1].trim();
    if (!hanzi || hanzi.startsWith("{{") || seen.has(hanzi)) continue;
    seen.add(hanzi);
    out.push(hanzi);
    if (out.length >= MAX_ITEMS) break;
  }
  return out;
}

// Best-effort IPA from the English pronunciation section: {{IPA|en|/əˈbændən/|...}}.
function extractIpa(wikitext) {
  const match = /\{\{IPA\|en\|([^}|]+)/.exec(wikitext);
  if (!match) return "";
  const first = match[1].trim();
  return first.startsWith("/") || first.startsWith("[") ? cleanOnlineString(first, 160) : "";
}

async function fetchJson(url, fetchImpl) {
  const response = await fetchImpl(url, { headers: { "Api-User-Agent": "WordFan/1.0 (vocabulary PWA)" } });
  if (response.status === 404) return { missing: true };
  if (!response.ok) return { error: `Wiktionary HTTP ${response.status}` };
  return { json: await response.json() };
}

// Returns { found: false } when the word has no English Wiktionary entry, otherwise
// { found: true, canonicalWord, partsOfSpeech, englishMeanings, chineseMeanings, phonetic, sourceUrl }.
// Chinese/phonetic are best-effort: a found English entry is returned even if the
// wikitext call fails or carries no cmn translations (the caller then tops up Chinese).
export async function lookupWiktionary(term, fetchImpl = fetch) {
  const word = cleanOnlineString(term, 120);
  if (!word) return { found: false };

  const defUrl = `${WIKTIONARY_ORIGIN}/api/rest_v1/page/definition/${encodeURIComponent(word)}`;
  let defResult;
  try {
    defResult = await fetchJson(defUrl, fetchImpl);
  } catch (error) {
    return { found: false, error: error instanceof Error ? error.message : String(error) };
  }
  if (defResult.missing || defResult.error || !defResult.json) {
    return { found: false, error: defResult.error };
  }

  const englishSections = Array.isArray(defResult.json.en) ? defResult.json.en : [];
  const partsOfSpeech = [];
  const englishMeanings = [];
  for (const section of englishSections) {
    const pos = String(section?.partOfSpeech ?? "").trim();
    if (pos && !partsOfSpeech.includes(pos)) partsOfSpeech.push(pos);
    for (const def of Array.isArray(section?.definitions) ? section.definitions : []) {
      const text = stripHtml(def?.definition);
      if (text && englishMeanings.length < MAX_ITEMS) englishMeanings.push(text);
    }
  }
  if (!englishMeanings.length) return { found: false };

  let chineseMeanings = [];
  let phonetic = "";
  try {
    const parseUrl = `${WIKTIONARY_ORIGIN}/w/api.php?action=parse&page=${encodeURIComponent(word)}&prop=wikitext&format=json&origin=*`;
    const parseResult = await fetchJson(parseUrl, fetchImpl);
    const wikitext = parseResult.json?.parse?.wikitext?.["*"] ?? "";
    if (wikitext) {
      chineseMeanings = extractMandarin(wikitext);
      phonetic = extractIpa(wikitext);
    }
  } catch {
    // Chinese + IPA are best-effort; the English entry is still useful on its own.
  }

  return {
    found: true,
    canonicalWord: word,
    partsOfSpeech,
    englishMeanings,
    chineseMeanings,
    phonetic,
    sourceUrl: `${WIKTIONARY_ORIGIN}/wiki/${encodeURIComponent(word)}`,
  };
}
