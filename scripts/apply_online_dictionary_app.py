from pathlib import Path
import re

ROOT = Path("apps/wordlover-pwa")
APP = ROOT / "public" / "app.js"
PATCHES = Path("scripts/patches")


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one anchor, found {count}")
    return text.replace(old, new, 1)


app = APP.read_text(encoding="utf-8")

import_anchor = '''import {
  createFullDictionaryClient,
} from "./full-dictionary.js?v=20260618-1";
'''
import_replacement = import_anchor + '''
import {
  OnlineDictionaryRequestError,
  requestOnlineDictionaryEntry,
} from "./online-dictionary.js?v=20260618-1";
'''
app = replace_once(app, import_anchor, import_replacement, "online dictionary import")

old_user_result = '''function userDictionaryToResult(entry, queryMs = 0) {
  return {
    status: "found",
    term: entry.word,
    entryType: entry.word.includes(" ") ? "phrase" : "word",
    phonetic: entry.phonetic ?? "",
    englishMeanings: entry.englishMeanings ?? [],
    englishMeaningSource: "user dictionary",
    chineseMeanings: entry.chineseMeanings ?? [],
    tags: ["user"],
    queryMs,
    source: "user-dictionary",
  };
}
'''
new_user_result = '''function userDictionaryToResult(entry, queryMs = 0) {
  const onlineDictionary = entry.source === "google-search-grounded";
  return {
    status: "found",
    term: entry.word,
    entryType: entry.entryType || (entry.word.includes(" ") ? "phrase" : "word"),
    phonetic: entry.phonetic ?? "",
    englishMeanings: entry.englishMeanings ?? [],
    englishMeaningSource: entry.definitionSource ?? (onlineDictionary ? "Google Search grounded" : "user dictionary"),
    chineseMeanings: entry.chineseMeanings ?? [],
    tags: entry.tags?.length ? entry.tags : ["user"],
    partsOfSpeech: entry.partsOfSpeech ?? [],
    sourceUrls: entry.sourceUrls ?? [],
    searchQueries: entry.searchQueries ?? [],
    confidence: entry.confidence ?? "",
    lookupModel: entry.lookupModel ?? "",
    onlineDictionary,
    queryMs,
    source: onlineDictionary ? "online-user-dictionary" : "user-dictionary",
  };
}
'''
app = replace_once(app, old_user_result, new_user_result, "user dictionary result mapping")

block = "\n".join(
    (PATCHES / name).read_text(encoding="utf-8").rstrip()
    for name in (
        "online-dictionary-app-block-1.txt",
        "online-dictionary-app-block-2.txt",
    )
)
app = replace_once(
    app,
    "function resultToTrackItem(data) {",
    block + "\n\nfunction resultToTrackItem(data) {",
    "online lookup functions",
)

app = replace_once(
    app,
    '      <p class="muted">This word does not match any dictionary words.</p>\n',
    '      <p class="muted">This word does not match any dictionary words.</p>\n'
    '      ${data.onlineMessage ? `<p class="${data.onlineRetryable ? "error" : "muted"}">${escapeHtml(data.onlineMessage)}</p>` : ""}\n',
    "not-found online message",
)

app = replace_once(
    app,
    '          <button id="addToDictionary" class="secondary-button" type="button" data-typed-term="${escapeHtml(typed)}">Add to dictionary</button>\n',
    '          <button id="addToDictionary" class="secondary-button" type="button" data-typed-term="${escapeHtml(typed)}">Add to dictionary</button>\n'
    '          ${data.onlineRetryable ? `<button id="retryOnlineLookup" class="secondary-button" type="button">Retry online search</button>` : ""}\n'
    '          ${data.onlineNeedsSetup ? `<button id="configureOnlineLookup" class="secondary-button" type="button">Set Gemini key</button>` : ""}\n',
    "not-found online actions",
)

old_head = '''      ${data.baseTerm ? `<p class="small muted">Resolved through base word <strong>${escapeHtml(data.baseTerm)}</strong>.</p>` : ""}
    </div>
    <div class="meaning-grid">
'''
new_head = '''      ${data.baseTerm ? `<p class="small muted">Resolved through base word <strong>${escapeHtml(data.baseTerm)}</strong>.</p>` : ""}
    </div>
    ${data.onlineDictionary ? `<aside class="online-dictionary-meta"><p><strong>Online dictionary result</strong> · Added to your dictionary</p><p class="small muted">${escapeHtml([data.confidence ? `${data.confidence} confidence` : "", data.lookupModel || "", (data.sourceUrls ?? []).map((source) => source.title).filter(Boolean).join(" · ")].filter(Boolean).join(" · "))}</p></aside>` : ""}
    <div class="meaning-grid">
'''
app = replace_once(app, old_head, new_head, "online result metadata")

pattern = re.compile(r"await\s+lookupTermWithFullFallback\(([^)\n]+)\)")
matches = pattern.findall(app)
if len(matches) != 1:
    raise RuntimeError(f"runLookup integration: expected one awaited full fallback call, found {len(matches)}")
app = pattern.sub(r"await lookupTermWithOnlineFallback(\1, Boolean(commit))", app, count=1)

event_anchor = '''  if (event.target instanceof HTMLButtonElement && event.target.id === "editCurrentTerm" && currentResult) {
'''
event_replacement = '''  if (event.target instanceof HTMLButtonElement && event.target.id === "retryOnlineLookup") {
    lastReturnValue = null;
    void runLookup({ commit: true });
    return;
  }
  if (event.target instanceof HTMLButtonElement && event.target.id === "configureOnlineLookup") {
    void (async () => {
      const key = await promptForGeminiApiKey();
      if (key) await runLookup({ commit: true });
    })();
    return;
  }
''' + event_anchor
app = replace_once(app, event_anchor, event_replacement, "online click handlers")

APP.write_text(app, encoding="utf-8")
print("Patched app.js")
