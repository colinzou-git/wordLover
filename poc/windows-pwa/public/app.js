const loadButton = document.querySelector("#loadDictionary");
const exportButton = document.querySelector("#exportState");
const termInput = document.querySelector("#termInput");
const clearSearchButton = document.querySelector("#clearSearch");
const result = document.querySelector("#result");
const metrics = document.querySelector("#metrics");
const diagnostics = document.querySelector("#diagnostics");
const historyList = document.querySelector("#history");
const recentSearchPopover = document.querySelector("#recentSearchPopover");
const pwaStatus = document.querySelector("#pwaStatus");
const dictionaryState = document.querySelector("#dictionaryState");
const dictionarySource = document.querySelector("#dictionarySource");
const suggestions = document.querySelector("#suggestions");
const installBanner = document.querySelector("#installBanner");
const wordPromptPanel = document.querySelector("#wordPromptPanel");
const wordPromptText = document.querySelector("#wordPromptText");
const exploreWordButton = document.querySelector("#exploreWord");
const autosaveToggle = document.querySelector("#autosaveToggle");
const vocabularySummary = document.querySelector("#vocabularySummary");
const vocabularyList = document.querySelector("#vocabularyList");
const studySummary = document.querySelector("#studySummary");
const statNewSaved = document.querySelector("#statNewSaved");
const statReviewed = document.querySelector("#statReviewed");
const statMastered = document.querySelector("#statMastered");
const startReviewButton = document.querySelector("#startReview");
const studyNewWordButton = document.querySelector("#studyNewWord");
const quizPanel = document.querySelector("#quizPanel");

const DB_NAME = "wordlover-poc-user";
const STORE = "kv";
const FILE_STORE = "files";
const KEY_STORE = "keys";
const DICTIONARY_KEY = "dictionary.sqlite";
const DICTIONARY_PROGRESS_KEY = "dictionary.sqlite.downloadProgress";
const DICTIONARY_CHUNK_PREFIX = "dictionary.sqlite.chunk.";
const DICTIONARY_CHUNK_SIZE = 4 * 1024 * 1024;
const TERM_RE = /^[a-z]+(?:[ '-][a-z]+){0,5}$/;
const HAN_RE = /[\u3400-\u9fff]/;
const DEFAULT_PLACEHOLDER = "abandon, take off, in terms of";
const AUTOSAVE_DWELL_MS = 5000;
const FSRS_RATING_LABELS = {
  again: "Again",
  hard: "Hard",
  good: "Good",
  easy: "Easy",
};

let SQL = null;
let dictionaryDb = null;
let loaded = false;
let historyItems = [];
let lastMetrics = null;
let debounceHandle = 0;
let suggestionHandle = 0;
let autosaveHandle = 0;
let dbPromise = null;
let encryptionKeyPromise = null;
let currentPromptTerm = null;
let currentResult = null;
let vocabularyItems = [];
let studyEvents = [];
let autosaveEnabled = true;
let deviceId = null;
let activeQuiz = null;

function formatMs(value) {
  return `${Math.round(value)} ms`;
}

function normalizeTerm(term) {
  return term.trim().replace(/[\u2019`]/g, "'").replace(/\s+/g, " ").toLowerCase();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isChineseInput(value) {
  return HAN_RE.test(value);
}

function nowIso() {
  return new Date().toISOString();
}

function todayPrefix() {
  return new Date().toISOString().slice(0, 10);
}

function isToday(value) {
  return typeof value === "string" && value.startsWith(todayPrefix());
}

function topLines(value, limit = 3) {
  if (!value) return [];
  return value
    .replace(/\\r/g, "\r")
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, limit);
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function openUserDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 3);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      if (!db.objectStoreNames.contains(FILE_STORE)) db.createObjectStore(FILE_STORE);
      if (!db.objectStoreNames.contains(KEY_STORE)) db.createObjectStore(KEY_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getUserDb() {
  dbPromise ??= openUserDb();
  return dbPromise;
}

async function saveRawValue(storeName, key, value) {
  const db = await getUserDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadRawValue(storeName, key, fallback = null) {
  const db = await getUserDb();
  const tx = db.transaction(storeName, "readonly");
  const value = await requestToPromise(tx.objectStore(storeName).get(key));
  return value ?? fallback;
}

async function deleteRawValue(storeName, key) {
  const db = await getUserDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function isEncryptedRecord(value) {
  return Boolean(value && value.__encrypted === true && value.iv && value.ciphertext);
}

async function getEncryptionKey() {
  if (!window.crypto?.subtle) {
    throw new Error("Web Crypto is required for encrypted local user data.");
  }
  encryptionKeyPromise ??= (async () => {
    let rawKey = await loadRawValue(KEY_STORE, "localAesGcmKey");
    if (!rawKey) {
      rawKey = crypto.getRandomValues(new Uint8Array(32));
      await saveRawValue(KEY_STORE, "localAesGcmKey", rawKey);
    }
    return crypto.subtle.importKey("raw", rawKey, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  })();
  return encryptionKeyPromise;
}

async function encryptValue(value) {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  return {
    __encrypted: true,
    v: 1,
    alg: "AES-GCM",
    iv,
    ciphertext,
  };
}

async function decryptValue(record) {
  const key = await getEncryptionKey();
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: record.iv }, key, record.ciphertext);
  return JSON.parse(new TextDecoder().decode(plaintext));
}

async function saveValue(key, value) {
  await saveRawValue(STORE, key, await encryptValue(value));
}

async function loadValue(key, fallback) {
  const value = await loadRawValue(STORE, key);
  if (value === null || value === undefined) return fallback;
  if (!isEncryptedRecord(value)) {
    await saveValue(key, value);
    return value;
  }
  try {
    return await decryptValue(value);
  } catch {
    return fallback;
  }
}

async function getDeviceId() {
  if (deviceId) return deviceId;
  deviceId = await loadValue("deviceId", null);
  if (!deviceId) {
    deviceId = crypto.randomUUID ? crypto.randomUUID() : `device-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    await saveValue("deviceId", deviceId);
  }
  return deviceId;
}

async function hasInstalledDictionary() {
  return Boolean(await loadValue("dictionaryInstalled", false));
}

async function saveFile(key, value) {
  await saveRawValue(FILE_STORE, key, value);
}

async function loadFile(key) {
  const value = await loadRawValue(FILE_STORE, key);
  if (!value) return null;
  return value instanceof Uint8Array ? value : new Uint8Array(value);
}

function renderMetrics() {
  const dictionary = lastMetrics
    ? `${lastMetrics.entries.toLocaleString()} rows, ${(lastMetrics.bytes / 1024 / 1024).toFixed(1)} MB, source ${lastMetrics.source ?? "network"}, load ${formatMs(lastMetrics.fetchMs)}, SQL init ${formatMs(lastMetrics.initMs)}, open ${formatMs(lastMetrics.openMs)}`
    : "Dictionary not loaded";
  const storage = "storage" in navigator ? "Storage API available" : "Storage API unavailable";
  metrics.innerHTML = `
    <div><strong>Dictionary</strong><span>${escapeHtml(dictionary)}</span></div>
    <div><strong>Persistence</strong><span>Encrypted IndexedDB user records; persistent connection; ${escapeHtml(storage)}</span></div>
    <div><strong>Target</strong><span>Local lookup under 1 second after dictionary load</span></div>
  `;
  dictionaryState.textContent = loaded ? "Ready" : lastMetrics ? "Installed" : "Not loaded";
  dictionarySource.textContent = lastMetrics?.source ?? "Online setup needed";
}

async function renderDiagnostics() {
  const storageEstimate = navigator.storage?.estimate ? await navigator.storage.estimate() : null;
  const persisted = navigator.storage?.persisted ? await navigator.storage.persisted() : null;
  const displayMode = window.matchMedia("(display-mode: standalone)").matches
    ? "standalone"
    : window.navigator.standalone
      ? "ios-standalone"
      : "browser";
  const serviceWorker = "serviceWorker" in navigator
    ? navigator.serviceWorker.controller
      ? "registered and controlling page"
      : "available; reload after registration for controller"
    : "not available";
  const quotaText = storageEstimate
    ? `${((storageEstimate.usage ?? 0) / 1024 / 1024).toFixed(1)} MB used / ${((storageEstimate.quota ?? 0) / 1024 / 1024).toFixed(1)} MB quota`
    : "not available";

  diagnostics.innerHTML = `
    <div><strong>Secure context</strong><span>${window.isSecureContext ? "yes" : "no"}</span></div>
    <div><strong>Display mode</strong><span>${displayMode}</span></div>
    <div><strong>Service worker</strong><span>${serviceWorker}</span></div>
    <div><strong>IndexedDB</strong><span>${"indexedDB" in window ? "available" : "unavailable"}</span></div>
    <div><strong>WebAssembly</strong><span>${"WebAssembly" in window ? "available" : "unavailable"}</span></div>
    <div><strong>Storage persisted</strong><span>${persisted === null ? "unknown" : persisted ? "yes" : "no"}</span></div>
    <div><strong>Storage estimate</strong><span>${quotaText}</span></div>
    <div><strong>User agent</strong><span>${navigator.userAgent}</span></div>
  `;
}

function renderInstallContext() {
  const userAgent = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(userAgent);
  const isSafari = /Safari/.test(userAgent) && !/CriOS|FxiOS|EdgiOS/.test(userAgent);
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  if (!isIOS || isStandalone) {
    installBanner.hidden = true;
    return;
  }
  installBanner.hidden = false;
  installBanner.textContent = isSafari
    ? "For long-term offline use on iPhone, add WordLover to the Home Screen from Safari after the dictionary is installed."
    : "For iPhone offline install, open this address in Safari, then add WordLover to the Home Screen.";
}

function renderHistory() {
  historyList.innerHTML = historyItems.length
    ? historyItems
        .map((item) => `<li><button type="button" data-term="${escapeHtml(item.term)}">${escapeHtml(item.term)}</button><span>${formatMs(item.queryMs)}</span></li>`)
        .join("")
    : '<li class="muted">No successful searches yet.</li>';
}

function renderRecentSearchPopover() {
  if (!historyItems.length) {
    recentSearchPopover.hidden = true;
    recentSearchPopover.innerHTML = "";
    return;
  }
  recentSearchPopover.innerHTML = historyItems
    .slice(0, 10)
    .map((item) => `<button type="button" data-term="${escapeHtml(item.term)}">${escapeHtml(item.term)}</button>`)
    .join("");
  recentSearchPopover.hidden = false;
}

function hideRecentSearchPopover() {
  recentSearchPopover.hidden = true;
}

function renderResult(data) {
  if (data.status === "invalid_input") {
    currentResult = null;
    scheduleAutosave(null);
    result.innerHTML = `<p class="muted">Invalid input. Use English letters, Chinese characters, spaces, hyphens, or apostrophes.</p>`;
    return;
  }
  if (data.status === "not_found") {
    currentResult = null;
    scheduleAutosave(null);
    result.innerHTML = `
      <p class="muted">No exact dictionary match found.</p>
      ${data.alternatives?.length ? renderResultList(data.alternatives, "Closest matches") : ""}
      <p class="small">Query time: ${formatMs(data.queryMs ?? 0)}</p>
    `;
    return;
  }
  if (data.status === "chinese_results") {
    currentResult = null;
    scheduleAutosave(null);
    result.innerHTML = `
      <p class="muted">Chinese to English matches for <strong>${escapeHtml(data.term)}</strong>.</p>
      ${renderResultList(data.matches, "English candidates")}
      <p class="small">Query time: ${formatMs(data.queryMs ?? 0)}</p>
    `;
    return;
  }
  currentResult = data;
  const vocabularyItem = getVocabularyItem(data.term);
  const isActiveSaved = Boolean(vocabularyItem && !vocabularyItem.archivedAt);
  result.innerHTML = `
    <div class="result-head">
      <div>
        <h2>${escapeHtml(data.term)}</h2>
        <p>${escapeHtml(data.entryType)}${data.phonetic ? ` - ${escapeHtml(data.phonetic)}` : ""}</p>
      </div>
      <span>${formatMs(data.queryMs ?? 0)}</span>
    </div>
    <div class="meaning-grid">
      <section>
        <h3>English <em>${escapeHtml(data.englishMeaningSource ?? "")}</em></h3>
        ${data.englishMeanings?.length ? data.englishMeanings.map((line) => `<p>${escapeHtml(line)}</p>`).join("") : '<p class="muted">No English definition.</p>'}
      </section>
      <section>
        <h3>Chinese</h3>
        ${data.chineseMeanings?.length ? data.chineseMeanings.map((line) => `<p>${escapeHtml(line)}</p>`).join("") : '<p class="muted">No Chinese translation.</p>'}
      </section>
    </div>
    <p class="small">${data.tags?.length ? `Tags: ${escapeHtml(data.tags.join(", "))}` : "No tags"}</p>
    <div class="result-actions">
      <button id="saveCurrentTerm" type="button" ${isActiveSaved ? "disabled" : ""}>${isActiveSaved ? "Saved" : "Save to vocabulary"}</button>
      ${vocabularyItem ? `<button id="editCurrentTerm" class="secondary-button" type="button">Edit saved meaning</button>` : ""}
    </div>
  `;
  scheduleAutosave(data);
}

function renderResultList(items, title) {
  if (!items?.length) return "";
  return `
    <h3>${escapeHtml(title)}</h3>
    <div class="result-list">
      ${items
        .map(
          (item) => `
            <button class="result-option" type="button" data-term="${escapeHtml(item.word)}">
              <strong>${escapeHtml(item.word)}</strong>
              <span>${escapeHtml(item.preview ?? "")}</span>
            </button>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderSuggestions(items) {
  suggestions.innerHTML = items.length
    ? items.map((item) => `<button type="button" class="${item.kind === "fuzzy" ? "fuzzy" : ""}" data-term="${escapeHtml(item.word)}">${escapeHtml(item.word)}</button>`).join("")
    : "";
}

async function cleanupDictionaryChunks(chunkCount) {
  await deleteRawValue(FILE_STORE, DICTIONARY_PROGRESS_KEY);
  await Promise.allSettled(
    Array.from({ length: chunkCount }, (_, index) => deleteRawValue(FILE_STORE, `${DICTIONARY_CHUNK_PREFIX}${index}`)),
  );
}

async function assembleDictionaryChunks(totalBytes, chunkCount) {
  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (let index = 0; index < chunkCount; index += 1) {
    const chunk = await loadFile(`${DICTIONARY_CHUNK_PREFIX}${index}`);
    if (!chunk) throw new Error(`Dictionary chunk ${index + 1} is missing; retry while online.`);
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

async function fetchDictionaryWithResume(url) {
  let totalBytes = 0;
  try {
    const head = await fetch(url, { method: "HEAD", cache: "no-store" });
    totalBytes = Number(head.headers.get("content-length") ?? 0);
  } catch {
    totalBytes = 0;
  }

  if (!totalBytes) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`Dictionary fetch failed: ${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    await saveFile(DICTIONARY_KEY, bytes);
    return bytes;
  }

  const expectedChunkCount = Math.ceil(totalBytes / DICTIONARY_CHUNK_SIZE);
  let progress = await loadRawValue(FILE_STORE, DICTIONARY_PROGRESS_KEY, null);
  if (!progress || progress.totalBytes !== totalBytes || progress.chunkSize !== DICTIONARY_CHUNK_SIZE) {
    progress = { totalBytes, chunkSize: DICTIONARY_CHUNK_SIZE, completedChunks: 0 };
    await saveRawValue(FILE_STORE, DICTIONARY_PROGRESS_KEY, progress);
  }

  for (let index = progress.completedChunks; index < expectedChunkCount; index += 1) {
    const start = index * DICTIONARY_CHUNK_SIZE;
    const end = Math.min(start + DICTIONARY_CHUNK_SIZE - 1, totalBytes - 1);
    const response = await fetch(url, {
      cache: "no-store",
      headers: { Range: `bytes=${start}-${end}` },
    });
    if (response.status === 200 && index === 0) {
      const bytes = new Uint8Array(await response.arrayBuffer());
      await saveFile(DICTIONARY_KEY, bytes);
      await cleanupDictionaryChunks(expectedChunkCount);
      return bytes;
    }
    if (response.status !== 206) {
      throw new Error(`Dictionary range fetch failed: ${response.status}`);
    }
    const chunk = new Uint8Array(await response.arrayBuffer());
    await saveFile(`${DICTIONARY_CHUNK_PREFIX}${index}`, chunk);
    progress = { totalBytes, chunkSize: DICTIONARY_CHUNK_SIZE, completedChunks: index + 1 };
    await saveRawValue(FILE_STORE, DICTIONARY_PROGRESS_KEY, progress);
    const percent = Math.round((progress.completedChunks / expectedChunkCount) * 100);
    loadButton.textContent = `Downloading ${percent}%`;
    result.innerHTML = `<p class="muted">Downloading dictionary ${percent}%.</p>`;
  }

  const bytes = await assembleDictionaryChunks(totalBytes, expectedChunkCount);
  await saveFile(DICTIONARY_KEY, bytes);
  await cleanupDictionaryChunks(expectedChunkCount);
  return bytes;
}

async function loadDictionary() {
  const start = performance.now();
  let source = "network";
  let bytes = null;
  try {
    bytes = await fetchDictionaryWithResume("/dictionary.sqlite");
    await saveValue("dictionaryInstalled", true);
  } catch (error) {
    bytes = await loadFile(DICTIONARY_KEY);
    source = "indexedDB offline copy";
    if (!bytes) {
      throw new Error(
        `Dictionary is unavailable online and no offline copy is installed yet. Load it once while online first. ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  const fetched = performance.now();
  SQL ??= await initSqlJs({ locateFile: (file) => `/vendor/${file}` });
  const initialized = performance.now();
  dictionaryDb?.close();
  dictionaryDb = new SQL.Database(bytes);
  const opened = performance.now();
  const count = dictionaryDb.exec("SELECT count(*) AS count FROM dictionary_entries")[0].values[0][0];
  lastMetrics = {
    fetchMs: fetched - start,
    initMs: initialized - fetched,
    openMs: opened - initialized,
    bytes: bytes.byteLength,
    entries: count,
    source,
  };
  await saveValue("lastMetrics", lastMetrics);
  await renderDiagnostics();
  return lastMetrics;
}

function setSearchLoading(isLoading) {
  termInput.disabled = isLoading;
  termInput.placeholder = isLoading ? "Loading dictionary..." : DEFAULT_PLACEHOLDER;
  clearSearchButton.disabled = isLoading;
}

async function ensureDictionaryLoaded() {
  if (loaded) return true;
  loadButton.disabled = true;
  loadButton.textContent = "Loading dictionary...";
  dictionaryState.textContent = "Loading";
  setSearchLoading(true);
  if (termInput.value.trim()) result.innerHTML = `<p class="muted">Opening local dictionary.</p>`;
  try {
    await loadDictionary();
    loaded = true;
    loadButton.textContent = "Dictionary ready";
    loadButton.hidden = true;
    setSearchLoading(false);
    renderMetrics();
    await renderWordPrompt();
    return true;
  } catch (error) {
    loadButton.disabled = false;
    loadButton.textContent = "Install/load dictionary";
    loadButton.hidden = false;
    setSearchLoading(false);
    result.innerHTML = `<p class="error">${error instanceof Error ? error.message : String(error)}</p>`;
    return false;
  }
}

function lookupTerm(input) {
  const normalized = normalizeTerm(input);
  if (isChineseInput(input)) return lookupChineseTerm(input);
  if (!TERM_RE.test(normalized)) return { status: "invalid_input", term: input };
  if (!dictionaryDb) throw new Error("Dictionary is not loaded yet.");

  const start = performance.now();
  const statement = dictionaryDb.prepare(`
    SELECT word, phonetic, definition, definition_source, translation, tag
    FROM dictionary_entries
    WHERE normalized_word = :term
    ORDER BY
      CASE WHEN word = :raw THEN 0 ELSE 1 END,
      frq IS NULL,
      frq,
      bnc IS NULL,
      bnc
    LIMIT 1
  `);
  try {
    statement.bind({ ":term": normalized, ":raw": input.trim() });
    if (!statement.step()) {
      const alternatives = findFuzzySuggestions(normalized, 6);
      return { status: "not_found", term: input, queryMs: performance.now() - start, alternatives };
    }
    const row = statement.getAsObject();
    return {
      status: "found",
      term: row.word ?? input,
      entryType: row.word?.includes(" ") ? "phrase" : "word",
      phonetic: row.phonetic,
      englishMeanings: topLines(row.definition),
      englishMeaningSource: row.definition_source ?? "unknown",
      chineseMeanings: topLines(row.translation),
      tags: row.tag ? row.tag.split(/\s+/).filter(Boolean) : [],
      queryMs: performance.now() - start,
    };
  } finally {
    statement.free();
  }
}

function lookupChineseTerm(input) {
  const term = input.trim();
  if (!term || !dictionaryDb) return { status: "invalid_input", term: input };
  const start = performance.now();
  const statement = dictionaryDb.prepare(`
    SELECT word, translation, definition, frq, bnc
    FROM dictionary_entries
    WHERE translation LIKE :term
    ORDER BY
      is_toefl DESC,
      frq IS NULL,
      frq,
      bnc IS NULL,
      bnc,
      length(word),
      word
    LIMIT 10
  `);
  const matches = [];
  try {
    statement.bind({ ":term": `%${term}%` });
    while (statement.step()) {
      const row = statement.getAsObject();
      matches.push({
        word: row.word,
        preview: topLines(row.translation, 1)[0] ?? topLines(row.definition, 1)[0] ?? "",
      });
    }
  } finally {
    statement.free();
  }
  if (!matches.length) return { status: "not_found", term: input, queryMs: performance.now() - start, alternatives: [] };
  return { status: "chinese_results", term, matches, queryMs: performance.now() - start };
}

function levenshteinWithin(a, b, maxDistance = 2) {
  if (Math.abs(a.length - b.length) > maxDistance) return maxDistance + 1;
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = new Array(b.length + 1);
  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    let rowMin = current[0];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
      rowMin = Math.min(rowMin, current[j]);
    }
    if (rowMin > maxDistance) return maxDistance + 1;
    previous.splice(0, previous.length, ...current);
  }
  return previous[b.length];
}

function findFuzzySuggestions(normalized, limit = 6) {
  if (!dictionaryDb || normalized.length < 4 || normalized.includes(" ")) return [];
  const first = normalized.slice(0, 1);
  const statement = dictionaryDb.prepare(`
    SELECT word, normalized_word, definition, translation, frq, bnc
    FROM dictionary_entries
    WHERE normalized_word >= :prefix
      AND normalized_word < :upper
      AND instr(normalized_word, ' ') = 0
      AND length(normalized_word) BETWEEN :minLength AND :maxLength
    ORDER BY
      frq IS NULL,
      frq,
      bnc IS NULL,
      bnc
    LIMIT 700
  `);
  const candidates = [];
  try {
    statement.bind({
      ":prefix": first,
      ":upper": `${first}\uffff`,
      ":minLength": Math.max(1, normalized.length - 2),
      ":maxLength": normalized.length + 2,
    });
    while (statement.step()) {
      const row = statement.getAsObject();
      const distance = levenshteinWithin(normalized, row.normalized_word, 2);
      if (distance <= 2) {
        candidates.push({
          word: row.word,
          kind: "fuzzy",
          distance,
          preview: topLines(row.definition, 1)[0] ?? topLines(row.translation, 1)[0] ?? "",
        });
      }
    }
  } finally {
    statement.free();
  }
  return candidates.sort((left, right) => left.distance - right.distance || left.word.length - right.word.length).slice(0, limit);
}

function suggestTerms(input) {
  const normalized = normalizeTerm(input);
  if (!dictionaryDb || normalized.length < 2) return [];
  if (isChineseInput(input)) return lookupChineseTerm(input).matches ?? [];
  if (!TERM_RE.test(normalized)) return [];
  const statement = dictionaryDb.prepare(`
    SELECT word, definition, translation,
      CASE
        WHEN normalized_word = :term THEN 0
        WHEN normalized_word LIKE :phrasePrefix THEN 1
        WHEN normalized_word >= :prefix AND normalized_word < :upper THEN 2
        ELSE 3
      END AS tier
    FROM dictionary_entries
    WHERE (normalized_word >= :prefix AND normalized_word < :upper)
       OR normalized_word LIKE :phrasePrefix
    ORDER BY
      tier,
      is_toefl DESC,
      frq IS NULL,
      frq,
      bnc IS NULL,
      bnc,
      word
    LIMIT 8
  `);
  const upper = `${normalized}\uffff`;
  const items = [];
  try {
    statement.bind({
      ":term": normalized,
      ":prefix": normalized,
      ":upper": upper,
      ":phrasePrefix": `${normalized} %`,
    });
    while (statement.step()) {
      const row = statement.getAsObject();
      items.push({
        word: row.word,
        kind: row.tier === 1 ? "phrase" : "prefix",
        preview: topLines(row.definition, 1)[0] ?? topLines(row.translation, 1)[0] ?? "",
      });
    }
    if (items.length < 3) {
      for (const item of findFuzzySuggestions(normalized, 3)) {
        if (!items.some((existing) => existing.word === item.word)) items.push(item);
      }
    }
    return items;
  } finally {
    statement.free();
  }
}

function getVocabularyItem(term) {
  const normalizedTerm = normalizeTerm(term);
  return vocabularyItems.find((item) => item.normalizedTerm === normalizedTerm) ?? null;
}

function summarizeLines(lines) {
  return Array.isArray(lines) && lines.length ? lines.join("; ") : "No meaning yet";
}

async function persistVocabulary() {
  await saveValue("vocabularyItems", vocabularyItems);
  renderVocabulary();
  renderStudyStats();
}

function resultToVocabularyItem(data) {
  const now = nowIso();
  const normalizedTerm = normalizeTerm(data.term);
  return {
    id: normalizedTerm,
    term: data.term,
    normalizedTerm,
    entryType: data.entryType,
    savedAt: now,
    updatedAt: now,
    archivedAt: null,
    original: {
      phonetic: data.phonetic ?? "",
      englishMeanings: data.englishMeanings ?? [],
      englishMeaningSource: data.englishMeaningSource ?? "unknown",
      chineseMeanings: data.chineseMeanings ?? [],
      tags: data.tags ?? [],
    },
    user: {
      phonetic: data.phonetic ?? "",
      englishMeanings: data.englishMeanings ?? [],
      chineseMeanings: data.chineseMeanings ?? [],
    },
    createdDeviceId: deviceId,
    syncVersion: 1,
    isSynced: false,
    review: {
      lastRating: "again",
      intervalDays: 0,
      dueAt: now,
      reviewCount: 0,
      lastReviewedAt: null,
      masteredAt: null,
    },
  };
}

async function saveVocabularyItem(data, reason = "manual") {
  if (!data || data.status !== "found") return null;
  await getDeviceId();
  const normalizedTerm = normalizeTerm(data.term);
  const existing = getVocabularyItem(data.term);
  const now = nowIso();
  if (existing) {
    existing.archivedAt = null;
    existing.updatedAt = now;
    existing.syncVersion = (existing.syncVersion ?? 0) + 1;
    existing.isSynced = false;
    existing.lastSaveReason = reason;
    existing.review ??= {
      lastRating: "again",
      intervalDays: 0,
      dueAt: now,
      reviewCount: 0,
      lastReviewedAt: null,
      masteredAt: null,
    };
  } else {
    const item = resultToVocabularyItem(data);
    item.lastSaveReason = reason;
    vocabularyItems = [item, ...vocabularyItems];
  }
  vocabularyItems = vocabularyItems
    .filter((item, index, all) => all.findIndex((candidate) => candidate.normalizedTerm === item.normalizedTerm) === index)
    .sort((left, right) => (right.savedAt ?? "").localeCompare(left.savedAt ?? ""));
  await persistVocabulary();
  renderStudyStats();
  if (currentResult && normalizeTerm(currentResult.term) === normalizedTerm) renderResult(currentResult);
  return getVocabularyItem(data.term);
}

function scheduleAutosave(data) {
  window.clearTimeout(autosaveHandle);
  if (!autosaveEnabled || !data || data.status !== "found" || getVocabularyItem(data.term)) return;
  autosaveHandle = window.setTimeout(() => {
    if (currentResult && normalizeTerm(currentResult.term) === normalizeTerm(data.term)) {
      void saveVocabularyItem(data, "autosave");
    }
  }, AUTOSAVE_DWELL_MS);
}

async function editVocabularyItem(term) {
  const item = getVocabularyItem(term);
  if (!item) return;
  const english = window.prompt("Edit English meaning. Use semicolons for multiple meanings.", summarizeLines(item.user.englishMeanings));
  if (english === null) return;
  const chinese = window.prompt("Edit Chinese meaning. Use semicolons for multiple meanings.", summarizeLines(item.user.chineseMeanings));
  if (chinese === null) return;
  const phonetic = window.prompt("Edit pronunciation / IPA.", item.user.phonetic ?? "");
  if (phonetic === null) return;
  item.user.englishMeanings = english.split(";").map((line) => line.trim()).filter(Boolean);
  item.user.chineseMeanings = chinese.split(";").map((line) => line.trim()).filter(Boolean);
  item.user.phonetic = phonetic.trim();
  item.updatedAt = nowIso();
  item.syncVersion = (item.syncVersion ?? 0) + 1;
  item.isSynced = false;
  await persistVocabulary();
  if (currentResult && normalizeTerm(currentResult.term) === item.normalizedTerm) renderResult(currentResult);
}

async function setVocabularyArchived(term, archived) {
  const item = getVocabularyItem(term);
  if (!item) return;
  item.archivedAt = archived ? nowIso() : null;
  item.updatedAt = nowIso();
  item.syncVersion = (item.syncVersion ?? 0) + 1;
  item.isSynced = false;
  await persistVocabulary();
  if (currentResult && normalizeTerm(currentResult.term) === item.normalizedTerm) renderResult(currentResult);
}

function renderVocabulary() {
  const active = vocabularyItems.filter((item) => !item.archivedAt);
  const archived = vocabularyItems.filter((item) => item.archivedAt);
  vocabularySummary.textContent = `${active.length} active, ${archived.length} archived`;
  if (!vocabularyItems.length) {
    vocabularyList.innerHTML = `<p class="muted">Search a word and save it here. Autosave can add valid searches after a short pause.</p>`;
    return;
  }
  vocabularyList.innerHTML = vocabularyItems
    .map((item) => {
      const english = summarizeLines(item.user?.englishMeanings ?? item.original?.englishMeanings);
      const chinese = summarizeLines(item.user?.chineseMeanings ?? item.original?.chineseMeanings);
      const archivedClass = item.archivedAt ? " archived" : "";
      return `
        <article class="vocab-item${archivedClass}" data-term="${escapeHtml(item.term)}">
          <h3>${escapeHtml(item.term)}</h3>
          <p>${escapeHtml(chinese)}</p>
          <p>${escapeHtml(english)}</p>
          <p class="vocab-meta">
            ${escapeHtml(item.user?.phonetic || item.original?.phonetic || "No pronunciation")} - source ${escapeHtml(item.original?.englishMeaningSource ?? "unknown")} - saved ${escapeHtml(new Date(item.savedAt).toLocaleDateString())} - rating ${escapeHtml(FSRS_RATING_LABELS[item.review?.lastRating] ?? "Again")}${item.archivedAt ? " - archived" : ""}
          </p>
          <div class="vocab-actions">
            <button class="secondary-button" type="button" data-action="open" data-term="${escapeHtml(item.term)}">Open</button>
            <button class="secondary-button" type="button" data-action="edit" data-term="${escapeHtml(item.term)}">Edit</button>
            <button class="secondary-button" type="button" data-action="${item.archivedAt ? "restore" : "archive"}" data-term="${escapeHtml(item.term)}">${item.archivedAt ? "Restore" : "Archive"}</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function getDueVocabularyItems() {
  const now = Date.now();
  return vocabularyItems.filter((item) => {
    if (item.archivedAt || item.review?.masteredAt) return false;
    return !item.review?.dueAt || Date.parse(item.review.dueAt) <= now;
  });
}

function ensureVocabularyReviewStates() {
  const now = nowIso();
  vocabularyItems = vocabularyItems.map((item) => ({
    ...item,
    review: item.review ?? {
      lastRating: "again",
      intervalDays: 0,
      dueAt: now,
      reviewCount: 0,
      lastReviewedAt: null,
      masteredAt: null,
    },
  }));
}

function getTodayStats() {
  const newSaved = vocabularyItems.filter((item) => isToday(item.savedAt)).length;
  const reviewed = studyEvents.filter((event) => event.type === "review" && isToday(event.occurredAt)).length;
  const mastered = studyEvents.filter((event) => event.type === "review" && event.rating === "easy" && isToday(event.occurredAt)).length;
  return { newSaved, reviewed, mastered, dueCount: getDueVocabularyItems().length };
}

function renderStudyStats() {
  const stats = getTodayStats();
  statNewSaved.textContent = String(stats.newSaved);
  statReviewed.textContent = String(stats.reviewed);
  statMastered.textContent = String(stats.mastered);
  startReviewButton.disabled = stats.dueCount === 0;
  studySummary.textContent = stats.dueCount
    ? `${stats.dueCount} saved ${stats.dueCount === 1 ? "term is" : "terms are"} ready to review.`
    : "No saved terms are due right now.";
}

function scheduleFromFsrsRating(rating) {
  if (rating === "again") return { intervalDays: 0, dueAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(), masteredAt: null };
  if (rating === "hard") return { intervalDays: 1, dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), masteredAt: null };
  if (rating === "good") return { intervalDays: 3, dueAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), masteredAt: null };
  return { intervalDays: null, dueAt: null, masteredAt: nowIso() };
}

function inferFsrsRating(passed, responseMs) {
  if (!passed) return "again";
  if (responseMs <= 5000) return "easy";
  if (responseMs <= 15000) return "good";
  return "hard";
}

async function persistStudyEvents() {
  await saveValue("studyEvents", studyEvents.slice(-500));
  renderStudyStats();
}

async function recordReviewRating(item, rating, quizResult, responseMs) {
  const schedule = scheduleFromFsrsRating(rating);
  item.review = {
    ...(item.review ?? {}),
    lastRating: rating,
    intervalDays: schedule.intervalDays,
    dueAt: schedule.dueAt,
    masteredAt: schedule.masteredAt,
    lastReviewedAt: nowIso(),
    reviewCount: (item.review?.reviewCount ?? 0) + 1,
  };
  item.updatedAt = nowIso();
  item.syncVersion = (item.syncVersion ?? 0) + 1;
  item.isSynced = false;
  studyEvents.push({
    id: crypto.randomUUID ? crypto.randomUUID() : `event-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type: "review",
    term: item.term,
    normalizedTerm: item.normalizedTerm,
    rating,
    responseMs,
    quizResult,
    occurredAt: nowIso(),
    deviceId,
  });
  await persistVocabulary();
  await persistStudyEvents();
  hideQuiz();
}

function hideQuiz() {
  activeQuiz = null;
  quizPanel.hidden = true;
  quizPanel.innerHTML = "";
}

function suggestWordOfTheDay() {
  if (!dictionaryDb) return null;
  const searched = new Set(historyItems.map((item) => normalizeTerm(item.term)));
  const statement = dictionaryDb.prepare(`
    SELECT word, definition, translation
    FROM dictionary_entries
    WHERE is_toefl = 1
      AND definition IS NOT NULL
      AND translation IS NOT NULL
      AND instr(normalized_word, ' ') = 0
    ORDER BY
      frq IS NULL,
      frq,
      bnc IS NULL,
      bnc,
      word
    LIMIT 200
  `);
  const candidates = [];
  try {
    while (statement.step()) {
      const row = statement.getAsObject();
      if (!searched.has(normalizeTerm(row.word))) {
        candidates.push({
          word: row.word,
          preview: topLines(row.definition, 1)[0] ?? topLines(row.translation, 1)[0] ?? "",
        });
      }
    }
  } finally {
    statement.free();
  }
  if (!candidates.length) return null;
  const dayIndex = Math.floor(Date.now() / 86400000) % candidates.length;
  return candidates[dayIndex];
}

async function renderWordPrompt() {
  const suggestion = suggestWordOfTheDay();
  if (!suggestion) {
    wordPromptPanel.hidden = true;
    currentPromptTerm = null;
    return;
  }
  currentPromptTerm = suggestion.word;
  wordPromptText.textContent = `${suggestion.word} - ${suggestion.preview}`;
  wordPromptPanel.hidden = false;
}

function meaningPreviewFromEntry(entry) {
  return topLines(entry.translation, 1)[0] ?? topLines(entry.definition, 1)[0] ?? "No meaning available";
}

function quizEntryFromVocabulary(item) {
  return {
    term: item.term,
    normalizedTerm: item.normalizedTerm,
    correct: summarizeLines(item.user?.chineseMeanings?.length ? item.user.chineseMeanings : item.original?.chineseMeanings),
    sourceItem: item,
  };
}

function randomize(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function getQuizDistractors(correctTerm, limit = 3) {
  if (!dictionaryDb) return [];
  const statement = dictionaryDb.prepare(`
    SELECT word, definition, translation
    FROM dictionary_entries
    WHERE normalized_word != :term
      AND translation IS NOT NULL
      AND instr(normalized_word, ' ') = 0
    ORDER BY is_toefl DESC, frq IS NULL, frq, bnc IS NULL, bnc, word
    LIMIT 80
  `);
  const rows = [];
  try {
    statement.bind({ ":term": normalizeTerm(correctTerm) });
    while (statement.step()) {
      const row = statement.getAsObject();
      const preview = meaningPreviewFromEntry(row);
      if (preview && !rows.some((item) => item.text === preview)) rows.push({ text: preview, term: row.word });
    }
  } finally {
    statement.free();
  }
  return randomize(rows).slice(0, limit);
}

function buildQuizOptions(entry) {
  const correct = { text: entry.correct, correct: true, term: entry.term };
  const distractors = getQuizDistractors(entry.term, 3).map((item) => ({ ...item, correct: false }));
  return randomize([correct, ...distractors]).slice(0, 4);
}

function renderQuiz(entry, mode) {
  activeQuiz = {
    id: crypto.randomUUID ? crypto.randomUUID() : `quiz-${Date.now()}`,
    mode,
    entry,
    answered: false,
    startedAt: performance.now(),
    options: buildQuizOptions(entry),
  };
  quizPanel.hidden = false;
  quizPanel.innerHTML = `
    <div class="quiz-question">
      <span>${mode === "review" ? "Review" : "First check"}</span>
      <strong>${escapeHtml(entry.term)}</strong>
      <p class="muted">Choose the closest meaning.</p>
    </div>
    <div class="quiz-options">
      ${activeQuiz.options
        .map(
          (option, index) => `
            <button type="button" data-quiz-option="${index}">
              ${escapeHtml(option.text)}
            </button>
          `,
        )
        .join("")}
    </div>
  `;
  quizPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function startDueReview() {
  const [item] = getDueVocabularyItems();
  if (!item) {
    renderStudyStats();
    return;
  }
  renderQuiz(quizEntryFromVocabulary(item), "review");
}

function pickNewStudyEntry() {
  if (!dictionaryDb) return null;
  const saved = new Set(vocabularyItems.map((item) => item.normalizedTerm));
  const statement = dictionaryDb.prepare(`
    SELECT word, normalized_word, definition, translation
    FROM dictionary_entries
    WHERE is_toefl = 1
      AND translation IS NOT NULL
      AND definition IS NOT NULL
      AND instr(normalized_word, ' ') = 0
    ORDER BY frq IS NULL, frq, bnc IS NULL, bnc, word
    LIMIT 250
  `);
  const candidates = [];
  try {
    while (statement.step()) {
      const row = statement.getAsObject();
      if (!saved.has(row.normalized_word)) {
        candidates.push({
          term: row.word,
          normalizedTerm: row.normalized_word,
          correct: meaningPreviewFromEntry(row),
        });
      }
    }
  } finally {
    statement.free();
  }
  if (!candidates.length) return null;
  return candidates[Math.floor(Date.now() / 86400000) % candidates.length];
}

async function startNewWordStudy() {
  if (!(await ensureDictionaryLoaded())) return;
  const entry = pickNewStudyEntry();
  if (!entry) {
    quizPanel.hidden = false;
    quizPanel.innerHTML = `<p class="muted">No unsaved TOEFL candidate found right now.</p>`;
    return;
  }
  renderQuiz(entry, "new");
}

async function handleQuizAnswer(index) {
  if (!activeQuiz || activeQuiz.answered) return;
  const selected = activeQuiz.options[index];
  if (!selected) return;
  activeQuiz.answered = true;
  quizPanel.querySelectorAll("[data-quiz-option]").forEach((button, buttonIndex) => {
    const option = activeQuiz.options[buttonIndex];
    button.disabled = true;
    if (option.correct) button.classList.add("correct");
    if (buttonIndex === index && !option.correct) button.classList.add("incorrect");
  });
  const passed = Boolean(selected.correct);
  const responseMs = performance.now() - activeQuiz.startedAt;
  const rating = inferFsrsRating(passed, responseMs);
  if (activeQuiz.mode === "new") {
    await handleNewWordQuizResult(passed, rating, responseMs);
    return;
  }
  await recordReviewRating(activeQuiz.entry.sourceItem, rating, passed ? "pass" : "miss", responseMs);
  quizPanel.hidden = false;
  quizPanel.innerHTML = `<p class="muted">Review recorded as ${escapeHtml(FSRS_RATING_LABELS[rating])}.</p><div class="quiz-actions"><button class="secondary-button" type="button" data-quiz-close="1">Close</button><button type="button" data-review-next="1">Review next</button></div>`;
}

async function handleNewWordQuizResult(passed, rating, responseMs) {
  if (!activeQuiz) return;
  const entry = activeQuiz.entry;
  if (passed) {
    studyEvents.push({
      id: crypto.randomUUID ? crypto.randomUUID() : `event-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type: "new-word-first-pass",
      term: entry.term,
      normalizedTerm: entry.normalizedTerm,
      rating,
      responseMs,
      occurredAt: nowIso(),
      deviceId,
    });
    await persistStudyEvents();
    quizPanel.insertAdjacentHTML(
      "beforeend",
      `<p class="muted">You passed on the first try, so this word was not added to your vocabulary list.</p><div class="quiz-actions"><button class="secondary-button" type="button" data-quiz-close="1">Close</button><button type="button" data-study-next="1">Study another</button></div>`,
    );
    return;
  }
  const lookup = lookupTerm(entry.term);
  if (lookup.status === "found") await saveVocabularyItem(lookup, "new-word-quiz-failed");
  quizPanel.insertAdjacentHTML(
    "beforeend",
    `<p class="muted">Missed on the first try. This word is now in your vocabulary list for review.</p><div class="quiz-actions"><button class="secondary-button" type="button" data-quiz-close="1">Close</button><button type="button" data-study-next="1">Study another</button></div>`,
  );
}

async function addHistory(item) {
  historyItems = [item, ...historyItems.filter((entry) => entry.term !== item.term)].slice(0, 10);
  await saveValue("history", historyItems);
  renderHistory();
}

async function runLookup() {
  const value = termInput.value;
  if (!value.trim()) {
    result.innerHTML = `<p class="muted">Type a term to test local lookup.</p>`;
    renderSuggestions([]);
    return;
  }
  if (!loaded) {
    const ready = await ensureDictionaryLoaded();
    if (!ready) return;
  }
  try {
    const data = lookupTerm(value);
    renderResult(data);
    if (data.status === "found") {
      await addHistory({ term: data.term, searchedAt: nowIso(), queryMs: data.queryMs ?? 0 });
      await renderWordPrompt();
    }
  } catch (error) {
    result.innerHTML = `<p class="error">${error instanceof Error ? error.message : String(error)}</p>`;
  }
}

async function sendSmokeResult(payload) {
  if (window.location.protocol !== "https:") return null;
  const response = await fetch("/__poc_results", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Smoke result upload failed: ${response.status}`);
  return response.json();
}

async function runAutomatedSearchSmoke(term, shouldReport) {
  termInput.value = term;
  const ready = await ensureDictionaryLoaded();
  if (!ready) return;
  const data = lookupTerm(term);
  renderResult(data);
  if (data.status === "found") {
    await addHistory({ term: data.term, searchedAt: nowIso(), queryMs: data.queryMs ?? 0 });
  }
  if (shouldReport) {
    await sendSmokeResult({
      completedAt: nowIso(),
      kind: "dictionary-search-smoke",
      diagnostics: {
        userAgent: navigator.userAgent,
        displayMode: window.matchMedia("(display-mode: standalone)").matches
          ? "standalone"
          : window.navigator.standalone
            ? "ios-standalone"
            : "browser",
        secureContext: window.isSecureContext,
      },
      dictionary: lastMetrics,
      search: data,
    });
  }
}

function runSuggestions() {
  if (!loaded || !termInput.value.trim()) {
    renderSuggestions([]);
    return;
  }
  try {
    renderSuggestions(suggestTerms(termInput.value));
  } catch {
    renderSuggestions([]);
  }
}

async function init() {
  renderInstallContext();
  await getDeviceId();
  historyItems = await loadValue("history", []);
  vocabularyItems = await loadValue("vocabularyItems", []);
  ensureVocabularyReviewStates();
  studyEvents = await loadValue("studyEvents", []);
  autosaveEnabled = await loadValue("autosaveEnabled", true);
  autosaveToggle.checked = autosaveEnabled;
  lastMetrics = await loadValue("lastMetrics", null);
  renderHistory();
  renderVocabulary();
  renderStudyStats();
  renderMetrics();
  const installed = await hasInstalledDictionary();
  if (installed && !lastMetrics) {
    dictionaryState.textContent = "Installed";
    dictionarySource.textContent = "Opening local copy";
  }
  result.innerHTML = installed
    ? ""
    : `<p class="muted">Install the local dictionary once while online. After that, search can work from the local copy.</p>`;
  loadButton.hidden = installed;
  if (installed) setSearchLoading(true);

  if ("serviceWorker" in navigator) {
    try {
      await navigator.serviceWorker.register("/sw.js");
      pwaStatus.textContent = "Offline shell registered";
    } catch (error) {
      pwaStatus.textContent = `Service worker failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  } else {
    pwaStatus.textContent = "Service worker unavailable";
  }

  if ("storage" in navigator && "persist" in navigator.storage) {
    await navigator.storage.persist();
  }
  await renderDiagnostics();

  const params = new URLSearchParams(window.location.search);
  const smokeTerm = params.get("q");
  if (installed && !smokeTerm) {
    void ensureDictionaryLoaded().then(() => {
      termInput.focus();
      if (termInput.value.trim()) void runLookup();
    });
  }

  if (smokeTerm) {
    void runAutomatedSearchSmoke(smokeTerm, params.get("report") === "1");
  }
}

loadButton.addEventListener("click", async () => {
  if (await ensureDictionaryLoaded()) await runLookup();
});

termInput.addEventListener("input", () => {
  hideRecentSearchPopover();
  window.clearTimeout(debounceHandle);
  window.clearTimeout(suggestionHandle);
  suggestionHandle = window.setTimeout(runSuggestions, 75);
  debounceHandle = window.setTimeout(() => void runLookup(), 150);
});

termInput.addEventListener("focus", () => {
  if (!termInput.value.trim()) renderRecentSearchPopover();
});

historyList.addEventListener("click", (event) => {
  if (!(event.target instanceof HTMLButtonElement)) return;
  termInput.value = event.target.dataset.term ?? "";
  void runLookup();
});

suggestions.addEventListener("click", (event) => {
  if (!(event.target instanceof HTMLButtonElement)) return;
  termInput.value = event.target.dataset.term ?? "";
  renderSuggestions([]);
  hideRecentSearchPopover();
  void runLookup();
});

recentSearchPopover.addEventListener("click", (event) => {
  if (!(event.target instanceof HTMLButtonElement)) return;
  termInput.value = event.target.dataset.term ?? "";
  hideRecentSearchPopover();
  void runLookup();
});

result.addEventListener("click", (event) => {
  if (event.target instanceof HTMLButtonElement && event.target.id === "saveCurrentTerm") {
    void saveVocabularyItem(currentResult, "manual");
    return;
  }
  if (event.target instanceof HTMLButtonElement && event.target.id === "editCurrentTerm" && currentResult) {
    void editVocabularyItem(currentResult.term);
    return;
  }
  const button = event.target instanceof Element ? event.target.closest("button[data-term]") : null;
  if (!(button instanceof HTMLButtonElement)) return;
  termInput.value = button.dataset.term ?? "";
  renderSuggestions([]);
  void runLookup();
});

vocabularyList.addEventListener("click", (event) => {
  const button = event.target instanceof Element ? event.target.closest("button[data-action]") : null;
  if (!(button instanceof HTMLButtonElement)) return;
  const term = button.dataset.term ?? "";
  const action = button.dataset.action;
  if (action === "open") {
    termInput.value = term;
    renderSuggestions([]);
    void runLookup();
  }
  if (action === "edit") void editVocabularyItem(term);
  if (action === "archive") void setVocabularyArchived(term, true);
  if (action === "restore") void setVocabularyArchived(term, false);
});

clearSearchButton.addEventListener("click", () => {
  termInput.value = "";
  renderSuggestions([]);
  currentResult = null;
  scheduleAutosave(null);
  result.innerHTML = `<p class="muted">Type a term to search.</p>`;
  termInput.focus();
  renderRecentSearchPopover();
});

autosaveToggle.addEventListener("change", async () => {
  autosaveEnabled = autosaveToggle.checked;
  await saveValue("autosaveEnabled", autosaveEnabled);
  if (!autosaveEnabled) scheduleAutosave(null);
  if (currentResult) renderResult(currentResult);
});

startReviewButton.addEventListener("click", () => {
  startDueReview();
});

studyNewWordButton.addEventListener("click", () => {
  void startNewWordStudy();
});

quizPanel.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;
  const optionButton = target.closest("[data-quiz-option]");
  if (optionButton instanceof HTMLButtonElement) {
    void handleQuizAnswer(Number(optionButton.dataset.quizOption));
    return;
  }
  if (target.closest("[data-quiz-close]")) {
    hideQuiz();
    return;
  }
  if (target.closest("[data-study-next]")) {
    void startNewWordStudy();
    return;
  }
  if (target.closest("[data-review-next]")) {
    startDueReview();
  }
});

exploreWordButton.addEventListener("click", () => {
  if (!currentPromptTerm) return;
  termInput.value = currentPromptTerm;
  renderSuggestions([]);
  void runLookup();
});

exportButton.addEventListener("click", () => {
  const payload = {
    exportedAt: nowIso(),
    app: "wordlover-windows-pwa-poc",
    historyItems,
    vocabularyItems,
    studyEvents,
    autosaveEnabled,
    lastMetrics,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "wordlover-poc-user-data.json";
  anchor.click();
  URL.revokeObjectURL(url);
});

window.WordLoverApp = {
  ensureDictionaryLoaded,
  lookupTerm,
  suggestTerms,
  lookupChineseTerm,
  saveVocabularyItem,
  getVocabulary: () => vocabularyItems,
  getStudyEvents: () => studyEvents,
  startDueReview,
  startNewWordStudy,
  getDueVocabularyItems,
  setAutosaveEnabled: async (enabled) => {
    autosaveEnabled = Boolean(enabled);
    autosaveToggle.checked = autosaveEnabled;
    await saveValue("autosaveEnabled", autosaveEnabled);
  },
  runAutomatedSearchSmoke,
  getState: () => ({
    loaded,
    lastMetrics,
    historyItems,
    vocabularyItems,
    studyEvents,
    autosaveEnabled,
    encryptedUserStore: true,
    persistentIndexedDbConnection: Boolean(dbPromise),
  }),
};

void init();
