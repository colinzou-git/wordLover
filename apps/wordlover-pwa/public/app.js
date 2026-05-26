const loadButton = document.querySelector("#loadDictionary");
const exportButton = document.querySelector("#exportState");
const appMenuButton = document.querySelector("#appMenuButton");
const appMenu = document.querySelector("#appMenu");
const appVersion = document.querySelector("#appVersion");
const dataFormatVersion = document.querySelector("#dataFormatVersion");
const dictionaryEngine = document.querySelector("#dictionaryEngine");
const syncStatus = document.querySelector("#syncStatus");
const memoryNote = document.querySelector("#memoryNote");
const googleStatus = document.querySelector("#googleStatus");
const googleAccount = document.querySelector("#googleAccount");
const googleAuthStatus = document.querySelector("#googleAuthStatus");
const googleSignInButton = document.querySelector("#googleSignIn");
const googleSyncNowButton = document.querySelector("#googleSyncNow");
const googleRestoreButton = document.querySelector("#googleRestore");
const googleSignOutButton = document.querySelector("#googleSignOut");
const themeSelect = document.querySelector("#themeSelect");
const checkForUpdateButton = document.querySelector("#checkForUpdate");
const applyUpdateButton = document.querySelector("#applyUpdate");
const exportStateMenuButton = document.querySelector("#exportStateMenu");
const updateStatus = document.querySelector("#updateStatus");
const aiDetailPanel = document.querySelector("#aiDetailPanel");
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
const debugModeToggle = document.querySelector("#debugModeToggle");
const runReviewAutomationButton = document.querySelector("#runReviewAutomation");
const debugStatus = document.querySelector("#debugStatus");

const DB_NAME = "wordlover-user";
const STORE = "kv";
const FILE_STORE = "files";
const KEY_STORE = "keys";
const VOCABULARY_STORE = "vocabularyRecords";
const STUDY_EVENT_STORE = "studyEventRecords";
const DICTIONARY_KEY = "dictionary.sqlite";
const DICTIONARY_PROGRESS_KEY = "dictionary.sqlite.downloadProgress";
const DICTIONARY_CHUNK_PREFIX = "dictionary.sqlite.chunk.";
const DICTIONARY_CHUNK_SIZE = 4 * 1024 * 1024;
const TERM_RE = /^[a-z]+(?:[ '-][a-z]+){0,5}$/;
const HAN_RE = /[\u3400-\u9fff]/;
const DEFAULT_PLACEHOLDER = "abandon, take off, in terms of";
const AUTOSAVE_DWELL_MS = 5000;
const APP_VERSION = "0.5.3-product.20260525-v31";
const USER_DATA_FORMAT_VERSION = "0.3";
const SHELL_CACHE_VERSION = "wordlover-shell-v31";
const DICTIONARY_ENGINE = "OPFS package store active; wa-sqlite OPFS engine pending bundle install";
const MEMORY_TARGET_NOTE =
  "Memory target: iPhone normal-use DRAM <= 50 MB. This build stores the package in OPFS/IndexedDB and keeps the wa-sqlite OPFS engine as the production gate.";
const CONFIG = window.WORDLOVER_CONFIG ?? {};
const DEFAULT_THEME = "calm";
const DEBUG_DAY_MS = 20 * 1000;
const NORMAL_DAY_MS = 24 * 60 * 60 * 1000;
const DEBUG_TIME_SCALE = NORMAL_DAY_MS / DEBUG_DAY_MS;
const REVIEW_REFRESH_INTERVAL_MS = 3 * 60 * 60 * 1000;
const GOOGLE_IDENTITY_SCRIPT = "https://accounts.google.com/gsi/client";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";
const GOOGLE_DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files";
const GOOGLE_DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files";
const FTS_TABLE = "dictionary_search_fts";
const FSRS_RATING_LABELS = {
  again: "Again",
  hard: "Hard",
  good: "Good",
  easy: "Easy",
};
const FSRS_RATINGS = Object.keys(FSRS_RATING_LABELS);
const VOCABULARY_PAGE_SIZE = 10;
const GEMINI_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    meanings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          definition: { type: "string" },
          examples: { type: "array", items: { type: "string" } },
          commonPhrases: { type: "array", items: { type: "string" } },
        },
        required: ["definition", "examples"],
      },
    },
    wordHistory: { type: "string" },
    commonUsage: { type: "string" },
    learnerNotes: { type: "string" },
  },
  required: ["meanings"],
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
let encryptionPassphrase = null;
let ftsSearchAvailable = null;
let currentPromptTerm = null;
let currentResult = null;
let vocabularyItems = [];
let studyEvents = [];
let autosaveEnabled = true;
let deviceId = null;
let activeQuiz = null;
let theme = DEFAULT_THEME;
let vocabularyView = {
  filter: "summary",
  page: 0,
  selectedTerm: null,
};
let debugMode = {
  enabled: false,
  sessionId: null,
  startedRealAt: null,
  startedVirtualAt: null,
};
let googleAuth = {
  accessToken: null,
  expiresAt: 0,
  profile: null,
  scopes: [],
};
let googleTokenClient = null;
let pendingAppReloadUrl = null;

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

function realNowMs() {
  return Date.now();
}

function appNowMs() {
  if (!debugMode.enabled || !debugMode.startedRealAt || !debugMode.startedVirtualAt) return realNowMs();
  return debugMode.startedVirtualAt + (realNowMs() - debugMode.startedRealAt) * DEBUG_TIME_SCALE;
}

function nowIso() {
  return new Date(appNowMs()).toISOString();
}

function todayPrefix() {
  return new Date(appNowMs()).toISOString().slice(0, 10);
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
    const request = indexedDB.open(DB_NAME, 4);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      if (!db.objectStoreNames.contains(FILE_STORE)) db.createObjectStore(FILE_STORE);
      if (!db.objectStoreNames.contains(KEY_STORE)) db.createObjectStore(KEY_STORE);
      if (!db.objectStoreNames.contains(VOCABULARY_STORE)) db.createObjectStore(VOCABULARY_STORE);
      if (!db.objectStoreNames.contains(STUDY_EVENT_STORE)) db.createObjectStore(STUDY_EVENT_STORE);
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

async function clearRawStore(storeName) {
  const db = await getUserDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function isEncryptedRecord(value) {
  return Boolean(value && value.__encrypted === true && value.iv && value.ciphertext);
}

function bytesToBase64(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function deriveKek(passphrase, salt) {
  return derivePassphraseAesKey(passphrase, salt, ["wrapKey", "unwrapKey"]);
}

async function derivePassphraseAesKey(passphrase, salt, usages) {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 200000, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    usages,
  );
}

function getLocalDataPassphrase() {
  if (encryptionPassphrase) return encryptionPassphrase;
  const configured = String(CONFIG.localDevelopmentPassphrase ?? "").trim();
  if (configured) {
    encryptionPassphrase = configured;
    return encryptionPassphrase;
  }
  const isLocalhost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  if (isLocalhost) {
    encryptionPassphrase = "wordlover-localhost-development-passphrase";
    return encryptionPassphrase;
  }
  const entered = window.prompt("Enter your WordLover local data passphrase. Keep it safe; it unlocks this device's encrypted study data.");
  if (!entered) throw new Error("A local data passphrase is required to unlock encrypted WordLover data.");
  encryptionPassphrase = entered;
  return encryptionPassphrase;
}

async function getEncryptionKey() {
  if (!window.crypto?.subtle) {
    throw new Error("Web Crypto is required for encrypted local user data.");
  }
  encryptionKeyPromise ??= (async () => {
    const passphrase = getLocalDataPassphrase();
    const wrapped = await loadRawValue(KEY_STORE, "wrappedDek");
    if (wrapped?.wrappedKey && wrapped?.salt && wrapped?.wrapIv) {
      const kek = await deriveKek(passphrase, new Uint8Array(wrapped.salt));
      return crypto.subtle.unwrapKey(
        "raw",
        wrapped.wrappedKey,
        kek,
        { name: "AES-GCM", iv: new Uint8Array(wrapped.wrapIv) },
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"],
      );
    }
    const legacyRawKey = await loadRawValue(KEY_STORE, "localAesGcmKey");
    const dek = legacyRawKey
      ? await crypto.subtle.importKey("raw", new Uint8Array(legacyRawKey), { name: "AES-GCM" }, true, ["encrypt", "decrypt"])
      : await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const wrapIv = crypto.getRandomValues(new Uint8Array(12));
    const kek = await deriveKek(passphrase, salt);
    const wrappedKey = await crypto.subtle.wrapKey("raw", dek, kek, { name: "AES-GCM", iv: wrapIv });
    await saveRawValue(KEY_STORE, "wrappedDek", { wrappedKey: new Uint8Array(wrappedKey), salt, wrapIv, kdf: "PBKDF2-SHA256", iterations: 200000 });
    if (legacyRawKey) await deleteRawValue(KEY_STORE, "localAesGcmKey");
    const raw = await crypto.subtle.exportKey("raw", dek);
    return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
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

async function saveRecordValue(storeName, key, value) {
  await saveRawValue(storeName, key, await encryptValue(value));
}

async function deleteRecordValue(storeName, key) {
  await deleteRawValue(storeName, key);
}

async function loadAllRecordValues(storeName) {
  const db = await getUserDb();
  const tx = db.transaction(storeName, "readonly");
  const values = await requestToPromise(tx.objectStore(storeName).getAll());
  const records = [];
  for (const value of values) {
    if (!isEncryptedRecord(value)) {
      records.push(value);
      continue;
    }
    try {
      records.push(await decryptValue(value));
    } catch {
      // Ignore records that cannot be decrypted with the current passphrase.
    }
  }
  return records;
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

async function saveOpfsFile(key, value) {
  if (!navigator.storage?.getDirectory) return false;
  const root = await navigator.storage.getDirectory();
  const handle = await root.getFileHandle(key, { create: true });
  const writable = await handle.createWritable();
  await writable.write(value);
  await writable.close();
  return true;
}

async function loadOpfsFile(key) {
  if (!navigator.storage?.getDirectory) return null;
  try {
    const root = await navigator.storage.getDirectory();
    const handle = await root.getFileHandle(key);
    const file = await handle.getFile();
    return new Uint8Array(await file.arrayBuffer());
  } catch {
    return null;
  }
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

function renderAppMenu() {
  appVersion.textContent = APP_VERSION;
  dataFormatVersion.textContent = USER_DATA_FORMAT_VERSION;
  dictionaryEngine.textContent = DICTIONARY_ENGINE;
  syncStatus.textContent = googleAuth.accessToken ? (navigator.onLine ? "Pending sync" : "Offline") : "Local only";
  memoryNote.textContent = MEMORY_TARGET_NOTE;
  googleStatus.textContent = "Offline dictionary and study features stay local. Drive sync and Gemini require Google sign-in.";
  googleAccount.textContent = googleAuth.profile?.email ?? "Not signed in";
  googleAuthStatus.textContent = googleAuth.accessToken
    ? "Google is connected for Drive sync and online AI details."
    : getGoogleClientId()
      ? "Ready to connect Google."
      : "Google OAuth client ID is not configured yet.";
  googleSignInButton.disabled = !getGoogleClientId();
  googleSyncNowButton.disabled = !googleAuth.accessToken;
  googleRestoreButton.disabled = !googleAuth.accessToken;
  googleSignOutButton.disabled = !googleAuth.accessToken;
  themeSelect.value = theme;
}

function applyTheme(nextTheme) {
  theme = ["calm", "ink", "sunrise"].includes(nextTheme) ? nextTheme : DEFAULT_THEME;
  document.documentElement.dataset.theme = theme;
}

function getGoogleClientId() {
  return String(CONFIG.googleClientId ?? "").trim();
}

function getGoogleScopes(includeGemini = false) {
  const scopes = [...(CONFIG.googleScopes ?? [])];
  if (includeGemini) scopes.push(...(CONFIG.geminiScopes ?? []));
  return Array.from(new Set(scopes.filter(Boolean))).join(" ");
}

function renderDebugState() {
  debugModeToggle.textContent = debugMode.enabled ? "Disable debug speed" : "Enable debug speed";
  debugStatus.textContent = debugMode.enabled
    ? `Debug speed is on: 20 seconds = 1 day. Session ${debugMode.sessionId}.`
    : "Debug speed is off.";
}

function markDebugRecord(record) {
  if (!debugMode.enabled) return record;
  record.debugSessionId = debugMode.sessionId;
  record.debugCreatedAt = nowIso();
  return record;
}

async function purgeDebugData() {
  const sessionId = debugMode.sessionId;
  const removedVocabulary = vocabularyItems.filter((item) => item.debugSessionId === sessionId);
  const removedEvents = studyEvents.filter((event) => event.debugSessionId === sessionId);
  vocabularyItems = vocabularyItems.filter((item) => !item.debugSessionId || item.debugSessionId !== sessionId);
  studyEvents = studyEvents.filter((event) => !event.debugSessionId || event.debugSessionId !== sessionId);
  historyItems = historyItems.filter((item) => !item.debugSessionId || item.debugSessionId !== sessionId);
  await Promise.all(removedVocabulary.map((item) => deleteVocabularyRecord(item)));
  await Promise.all(removedEvents.map((event) => deleteRecordValue(STUDY_EVENT_STORE, event.id)));
  await persistVocabulary();
  await persistStudyEvents();
  await saveValue("history", historyItems);
  renderVocabulary();
  renderHistory();
  renderStudyStats();
}

async function setDebugMode(enabled) {
  if (enabled) {
    debugMode = {
      enabled: true,
      sessionId: crypto.randomUUID ? crypto.randomUUID() : `debug-${Date.now()}`,
      startedRealAt: realNowMs(),
      startedVirtualAt: realNowMs(),
    };
    await saveValue("debugMode", debugMode);
    renderDebugState();
    return;
  }
  await purgeDebugData();
  debugMode = { enabled: false, sessionId: null, startedRealAt: null, startedVirtualAt: null };
  await saveValue("debugMode", debugMode);
  renderDebugState();
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
      <button id="showAiDetails" class="secondary-button" type="button">Gemini details</button>
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
    await saveOpfsFile(DICTIONARY_KEY, bytes);
    await saveValue("dictionaryInstalled", true);
  } catch (error) {
    bytes = await loadOpfsFile(DICTIONARY_KEY);
    source = "OPFS offline copy";
    if (!bytes) {
      bytes = await loadFile(DICTIONARY_KEY);
      source = "indexedDB offline copy";
    }
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
  ftsSearchAvailable = null;
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

function hasFtsSearch() {
  if (ftsSearchAvailable !== null) return ftsSearchAvailable;
  try {
    dictionaryDb.exec(`SELECT rowid FROM ${FTS_TABLE} LIMIT 1`);
    ftsSearchAvailable = true;
  } catch {
    ftsSearchAvailable = false;
  }
  return ftsSearchAvailable;
}

function escapeFtsQuery(value) {
  return String(value ?? "").replace(/"/g, '""').trim();
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
    result.innerHTML = `<p class="error">${escapeHtml(error instanceof Error ? error.message : String(error))}</p>`;
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
  const matches = [];
  if (hasFtsSearch()) {
    try {
      const ftsStatement = dictionaryDb.prepare(`
        SELECT d.word, d.translation, d.definition, d.frq, d.bnc
        FROM dictionary_search_fts fts
        JOIN dictionary_entries d ON d.id = fts.rowid
        WHERE fts.translation MATCH :term
        ORDER BY
          d.is_toefl DESC,
          d.frq IS NULL,
          d.frq,
          d.bnc IS NULL,
          d.bnc,
          length(d.word),
          d.word
        LIMIT 10
      `);
      try {
        ftsStatement.bind({ ":term": escapeFtsQuery(term) });
        while (ftsStatement.step()) {
          const row = ftsStatement.getAsObject();
          matches.push({
            word: row.word,
            preview: topLines(row.translation, 1)[0] ?? topLines(row.definition, 1)[0] ?? "",
          });
        }
      } finally {
        ftsStatement.free();
      }
    } catch {
      matches.length = 0;
    }
  }
  if (matches.length) return { status: "chinese_results", term, matches, queryMs: performance.now() - start };
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

function fetchFtsFuzzyCandidates(normalized, limit = 350) {
  if (!hasFtsSearch()) return [];
  const prefix = `${escapeFtsQuery(normalized.slice(0, 2))}*`;
  const statement = dictionaryDb.prepare(`
    SELECT d.word, d.normalized_word, d.definition, d.translation, d.frq, d.bnc
    FROM dictionary_search_fts fts
    JOIN dictionary_entries d ON d.id = fts.rowid
    WHERE fts.normalized_word MATCH :prefix
      AND instr(d.normalized_word, ' ') = 0
    ORDER BY d.frq IS NULL, d.frq, d.bnc IS NULL, d.bnc
    LIMIT :limit
  `);
  const rows = [];
  try {
    statement.bind({ ":prefix": prefix, ":limit": limit });
    while (statement.step()) rows.push(statement.getAsObject());
  } catch {
    return [];
  } finally {
    statement.free();
  }
  return rows;
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
  const ftsRows = fetchFtsFuzzyCandidates(normalized);
  if (ftsRows.length) {
    return ftsRows
      .map((row) => ({
        word: row.word,
        kind: "fuzzy",
        distance: levenshteinWithin(normalized, row.normalized_word, 2),
        preview: topLines(row.definition, 1)[0] ?? topLines(row.translation, 1)[0] ?? "",
      }))
      .filter((item) => item.distance <= 2)
      .sort((left, right) => left.distance - right.distance || left.word.length - right.word.length)
      .slice(0, limit);
  }
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

function suggestTermsViaFts(normalized, limit = 5) {
  if (!hasFtsSearch()) return [];
  const query = normalized.includes(" ") ? `"${escapeFtsQuery(normalized)}"` : `${escapeFtsQuery(normalized)}*`;
  const statement = dictionaryDb.prepare(`
    SELECT d.word, d.definition, d.translation
    FROM dictionary_search_fts fts
    JOIN dictionary_entries d ON d.id = fts.rowid
    WHERE fts.normalized_word MATCH :query
    ORDER BY d.is_toefl DESC, d.frq IS NULL, d.frq, d.bnc IS NULL, d.bnc, d.word
    LIMIT :limit
  `);
  const rows = [];
  try {
    statement.bind({ ":query": query, ":limit": limit });
    while (statement.step()) {
      const row = statement.getAsObject();
      rows.push({
        word: row.word,
        kind: row.word?.includes(" ") ? "phrase" : "prefix",
        preview: topLines(row.definition, 1)[0] ?? topLines(row.translation, 1)[0] ?? "",
      });
    }
  } catch {
    return [];
  } finally {
    statement.free();
  }
  return rows;
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
    for (const item of suggestTermsViaFts(normalized, 5)) {
      if (!items.some((existing) => existing.word === item.word)) items.push(item);
      if (items.length >= 8) break;
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

function createFsrsCard(now = nowIso()) {
  return {
    due: now,
    stability: 0,
    difficulty: 5,
    elapsedDays: 0,
    scheduledDays: 0,
    reps: 0,
    lapses: 0,
    state: "new",
  };
}

function normalizeReviewState(review = {}) {
  const fsrsCard = {
    ...createFsrsCard(review.dueAt ?? nowIso()),
    ...(review.fsrsCard ?? {}),
  };
  return {
    lastRating: review.lastRating ?? "again",
    intervalDays: review.intervalDays ?? 0,
    dueAt: review.dueAt ?? fsrsCard.due ?? nowIso(),
    reviewCount: review.reviewCount ?? 0,
    lastReviewedAt: review.lastReviewedAt ?? null,
    masteredAt: review.masteredAt ?? null,
    fsrsCard,
  };
}

async function persistVocabulary() {
  await Promise.all(vocabularyItems.map((item) => saveRecordValue(VOCABULARY_STORE, item.normalizedTerm, item)));
  renderVocabulary();
  renderStudyStats();
}

async function persistVocabularyItem(item) {
  await saveRecordValue(VOCABULARY_STORE, item.normalizedTerm, item);
  renderVocabulary();
  renderStudyStats();
}

async function deleteVocabularyRecord(item) {
  await deleteRecordValue(VOCABULARY_STORE, item.normalizedTerm);
}

async function persistStudyEvent(event) {
  await saveRecordValue(STUDY_EVENT_STORE, event.id, event);
  renderStudyStats();
}

function resultToVocabularyItem(data) {
  const now = nowIso();
  const normalizedTerm = normalizeTerm(data.term);
  return markDebugRecord({
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
      fsrsCard: createFsrsCard(now),
    },
  });
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
    existing.review = normalizeReviewState(existing.review ?? { dueAt: now });
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
  await persistVocabularyItem(item);
  if (currentResult && normalizeTerm(currentResult.term) === item.normalizedTerm) renderResult(currentResult);
}

async function setVocabularyArchived(term, archived) {
  const item = getVocabularyItem(term);
  if (!item) return;
  item.archivedAt = archived ? nowIso() : null;
  item.updatedAt = nowIso();
  item.syncVersion = (item.syncVersion ?? 0) + 1;
  item.isSynced = false;
  await persistVocabularyItem(item);
  if (currentResult && normalizeTerm(currentResult.term) === item.normalizedTerm) renderResult(currentResult);
}

function getVocabularyRating(item) {
  const rating = item.review?.lastRating ?? "again";
  return FSRS_RATING_LABELS[rating] ? rating : "again";
}

function getVocabularyRatingChangedAt(item) {
  return item.review?.lastReviewedAt ?? item.updatedAt ?? item.savedAt ?? "";
}

function getVocabularyPhonetic(item) {
  return item.user?.phonetic || item.original?.phonetic || "";
}

function renderIpa(phonetic) {
  return phonetic ? `<span class="word-ipa">${escapeHtml(phonetic)}</span>` : `<span class="word-ipa missing">No IPA</span>`;
}

function getVocabularyStats() {
  const active = vocabularyItems.filter((item) => !item.archivedAt);
  const archived = vocabularyItems.filter((item) => item.archivedAt);
  const counts = Object.fromEntries(FSRS_RATINGS.map((rating) => [rating, 0]));
  active.forEach((item) => {
    counts[getVocabularyRating(item)] += 1;
  });
  return { active, archived, counts };
}

function getVocabularyViewTitle(filter) {
  if (filter === "all") return "All vocabulary";
  if (FSRS_RATING_LABELS[filter]) return `${FSRS_RATING_LABELS[filter]} words`;
  return "Vocabulary";
}

function getVocabularyViewItems(filter, active) {
  const items = filter === "all" ? active : active.filter((item) => getVocabularyRating(item) === filter);
  return [...items].sort((left, right) => {
    if (filter !== "all") {
      const rightChanged = getVocabularyRatingChangedAt(right);
      const leftChanged = getVocabularyRatingChangedAt(left);
      if (rightChanged !== leftChanged) return rightChanged.localeCompare(leftChanged);
    }
    return (right.savedAt ?? "").localeCompare(left.savedAt ?? "");
  });
}

function renderVocabularyStats(stats) {
  const total = stats.active.length;
  const archivedText = stats.archived.length ? `, ${stats.archived.length} archived` : "";
  vocabularySummary.textContent = `${total} saved${archivedText}`;
  return `
    <div class="vocab-stats" aria-label="Vocabulary status counts">
      <button class="vocab-stat total" type="button" data-action="vocab-filter" data-filter="all">
        <span>Total</span>
        <strong>${total}</strong>
      </button>
      ${FSRS_RATINGS.map((rating) => `
        <button class="vocab-stat" type="button" data-action="vocab-filter" data-filter="${rating}">
          <span>${escapeHtml(FSRS_RATING_LABELS[rating])}</span>
          <strong>${stats.counts[rating]}</strong>
        </button>
      `).join("")}
    </div>
  `;
}

function renderVocabularyDetail(item) {
  const english = summarizeLines(item.user?.englishMeanings ?? item.original?.englishMeanings);
  const chinese = summarizeLines(item.user?.chineseMeanings ?? item.original?.chineseMeanings);
  return `
    <div class="vocab-detail">
      <p>${escapeHtml(chinese)}</p>
      <p>${escapeHtml(english)}</p>
      <p class="vocab-meta">
        ${escapeHtml(getVocabularyPhonetic(item) || "No pronunciation")} - source ${escapeHtml(item.original?.englishMeaningSource ?? "unknown")} - saved ${escapeHtml(new Date(item.savedAt).toLocaleDateString())} - rating ${escapeHtml(FSRS_RATING_LABELS[getVocabularyRating(item)])}
      </p>
      <div class="vocab-actions">
        <button class="secondary-button" type="button" data-action="open" data-term="${escapeHtml(item.term)}">Search</button>
        <button class="secondary-button" type="button" data-action="edit" data-term="${escapeHtml(item.term)}">Edit</button>
        <button class="secondary-button" type="button" data-action="archive" data-term="${escapeHtml(item.term)}">Archive</button>
      </div>
    </div>
  `;
}

function renderVocabularyBrowser(stats) {
  const filter = vocabularyView.filter === "summary" ? "all" : vocabularyView.filter;
  const items = getVocabularyViewItems(filter, stats.active);
  const maxPage = Math.max(0, Math.ceil(items.length / VOCABULARY_PAGE_SIZE) - 1);
  if (vocabularyView.page > maxPage) vocabularyView.page = maxPage;
  if (vocabularyView.page < 0) vocabularyView.page = 0;
  const start = vocabularyView.page * VOCABULARY_PAGE_SIZE;
  const pageItems = items.slice(start, start + VOCABULARY_PAGE_SIZE);
  const selectedItem = vocabularyView.selectedTerm ? getVocabularyItem(vocabularyView.selectedTerm) : null;
  const rangeStart = items.length ? start + 1 : 0;
  const rangeEnd = Math.min(start + VOCABULARY_PAGE_SIZE, items.length);

  return `
    <div class="vocab-browser">
      <div class="vocab-browser-head">
        <div>
          <strong>${escapeHtml(getVocabularyViewTitle(filter))}</strong>
          <p class="muted">${rangeStart}-${rangeEnd} of ${items.length}</p>
        </div>
        <button class="secondary-button" type="button" data-action="vocab-summary">Stats</button>
      </div>
      ${pageItems.length ? `
        <ol class="vocab-word-list" start="${start + 1}">
          ${pageItems.map((item) => {
            const selected = selectedItem?.normalizedTerm === item.normalizedTerm;
            return `
              <li class="${selected ? "selected" : ""}">
                <button type="button" data-action="vocab-select" data-term="${escapeHtml(item.term)}">
                  <span class="vocab-term">${escapeHtml(item.term)}</span>
                  ${renderIpa(getVocabularyPhonetic(item))}
                </button>
                ${selected ? renderVocabularyDetail(item) : ""}
              </li>
            `;
          }).join("")}
        </ol>
      ` : `<p class="muted">No words in this status yet.</p>`}
      <div class="vocab-pager">
        <button class="secondary-button" type="button" data-action="vocab-page" data-page="${vocabularyView.page - 1}" ${vocabularyView.page <= 0 ? "disabled" : ""}>Previous</button>
        <span>Page ${vocabularyView.page + 1} of ${maxPage + 1}</span>
        <button class="secondary-button" type="button" data-action="vocab-page" data-page="${vocabularyView.page + 1}" ${vocabularyView.page >= maxPage ? "disabled" : ""}>Next</button>
      </div>
    </div>
  `;
}

function renderVocabulary() {
  const stats = getVocabularyStats();
  if (!stats.active.length && !stats.archived.length) {
    vocabularySummary.textContent = "No saved terms yet.";
    vocabularyList.innerHTML = `<p class="muted">Search a word and save it here. Autosave can add valid searches after a short pause.</p>`;
    return;
  }
  if (vocabularyView.filter !== "summary" && vocabularyView.selectedTerm) {
    const selected = getVocabularyItem(vocabularyView.selectedTerm);
    if (!selected || selected.archivedAt) vocabularyView.selectedTerm = null;
  }
  const statsHtml = renderVocabularyStats(stats);
  vocabularyList.innerHTML = vocabularyView.filter === "summary"
    ? statsHtml
    : `${statsHtml}${renderVocabularyBrowser(stats)}`;
}

function getDueVocabularyItems() {
  const now = appNowMs();
  return vocabularyItems.filter((item) => {
    if (item.archivedAt || item.review?.masteredAt) return false;
    return !item.review?.dueAt || Date.parse(item.review.dueAt) <= now;
  });
}

function getPracticeVocabularyItems() {
  return vocabularyItems
    .filter((item) => !item.archivedAt)
    .sort((left, right) => {
      const leftReviewed = left.review?.lastReviewedAt ?? "";
      const rightReviewed = right.review?.lastReviewedAt ?? "";
      if (leftReviewed !== rightReviewed) return leftReviewed.localeCompare(rightReviewed);
      return (left.savedAt ?? "").localeCompare(right.savedAt ?? "");
    });
}

function ensureVocabularyReviewStates() {
  const now = nowIso();
  vocabularyItems = vocabularyItems.map((item) => ({
    ...item,
    review: normalizeReviewState(item.review ?? {
      lastRating: "again",
      intervalDays: 0,
      dueAt: now,
      reviewCount: 0,
      lastReviewedAt: null,
      masteredAt: null,
    }),
  }));
}

function getTodayStats() {
  const newSaved = vocabularyItems.filter((item) => isToday(item.savedAt)).length;
  const reviewed = studyEvents.filter((event) => event.type === "review" && isToday(event.occurredAt)).length;
  const mastered = vocabularyItems.filter((item) => isToday(item.review?.masteredAt)).length;
  return { newSaved, reviewed, mastered, dueCount: getDueVocabularyItems().length, activeCount: getPracticeVocabularyItems().length };
}

function renderStudyStats() {
  const stats = getTodayStats();
  statNewSaved.textContent = String(stats.newSaved);
  statReviewed.textContent = String(stats.reviewed);
  statMastered.textContent = String(stats.mastered);
  startReviewButton.disabled = stats.activeCount === 0;
  startReviewButton.textContent = stats.dueCount ? `Review due (${stats.dueCount})` : stats.activeCount ? "Practice review" : "No review";
  studySummary.textContent = stats.dueCount
    ? `${stats.dueCount} saved ${stats.dueCount === 1 ? "term is" : "terms are"} ready to review.`
    : stats.activeCount
      ? "No words are due right now. You can still practice saved words."
      : "No saved words to review yet.";
}

function refreshReviewScheduleViews() {
  ensureVocabularyReviewStates();
  renderStudyStats();
  renderVocabulary();
  if (loaded) void renderWordPrompt();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function daysBetween(fromIso, toMs = appNowMs()) {
  const fromMs = Date.parse(fromIso);
  if (!Number.isFinite(fromMs)) return 0;
  return Math.max(0, (toMs - fromMs) / NORMAL_DAY_MS);
}

function scheduleFromFsrsRating(reviewState, rating) {
  const review = normalizeReviewState(reviewState);
  const previousCard = review.fsrsCard ?? createFsrsCard(review.dueAt ?? nowIso());
  const elapsedDays = daysBetween(previousCard.lastReview ?? review.lastReviewedAt ?? previousCard.due ?? nowIso());
  const previousStability = Number(previousCard.stability ?? 0);
  const previousDifficulty = Number(previousCard.difficulty ?? 5);
  const reps = Number(previousCard.reps ?? review.reviewCount ?? 0) + 1;
  const lapses = Number(previousCard.lapses ?? 0) + (rating === "again" ? 1 : 0);

  const difficultyDelta = { again: 1.2, hard: 0.6, good: -0.15, easy: -0.45 }[rating] ?? 0;
  const difficulty = clamp(previousDifficulty + difficultyDelta, 1, 10);
  let stability = previousStability;
  let intervalDays = 0;

  if (rating === "again") {
    stability = clamp(previousStability * 0.35, 0.05, 1);
    intervalDays = 0;
  } else if (rating === "hard") {
    stability = previousStability ? clamp(previousStability * (1.15 + Math.max(0, elapsedDays) * 0.02), 0.5, 3650) : 1;
    intervalDays = Math.max(1, Math.round(stability));
  } else if (rating === "good") {
    stability = previousStability ? clamp(previousStability * (1.75 + (10 - difficulty) * 0.03), 2, 3650) : 3;
    intervalDays = Math.max(1, Math.round(stability));
  } else {
    stability = previousStability ? clamp(previousStability * (2.5 + (10 - difficulty) * 0.05), 4, 3650) : 7;
    intervalDays = Math.max(2, Math.round(stability));
  }

  const masteredAt = stability >= 90 && reps >= 3 && rating !== "again" ? nowIso() : null;
  const dueAt = masteredAt ? null : new Date(appNowMs() + (intervalDays === 0 ? 10 * 60 * 1000 : intervalDays * NORMAL_DAY_MS)).toISOString();
  const fsrsCard = {
    ...previousCard,
    due: dueAt,
    stability,
    difficulty,
    elapsedDays,
    scheduledDays: intervalDays,
    reps,
    lapses,
    state: masteredAt ? "mastered" : reps <= 1 ? "learning" : "review",
    lastReview: nowIso(),
  };

  return { fsrsCard, intervalDays, dueAt, masteredAt };
}

function inferFsrsRating(passed, responseMs) {
  if (!passed) return "again";
  if (responseMs <= 5000) return "easy";
  if (responseMs <= 15000) return "good";
  return "hard";
}

async function persistStudyEvents() {
  await Promise.all(studyEvents.map((event) => saveRecordValue(STUDY_EVENT_STORE, event.id, event)));
  renderStudyStats();
}

async function recordReviewRating(item, rating, quizResult, responseMs) {
  const schedule = scheduleFromFsrsRating(item.review ?? {}, rating);
  const reviewedAt = nowIso();
  item.review = {
    ...(item.review ?? {}),
    lastRating: rating,
    intervalDays: schedule.intervalDays,
    dueAt: schedule.dueAt,
    masteredAt: schedule.masteredAt,
    lastReviewedAt: reviewedAt,
    reviewCount: (item.review?.reviewCount ?? 0) + 1,
    fsrsCard: schedule.fsrsCard,
  };
  item.updatedAt = reviewedAt;
  item.syncVersion = (item.syncVersion ?? 0) + 1;
  item.isSynced = false;
  const event = markDebugRecord({
    id: crypto.randomUUID ? crypto.randomUUID() : `event-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type: "review",
    term: item.term,
    normalizedTerm: item.normalizedTerm,
    rating,
    responseMs,
    quizResult,
    mastered: Boolean(schedule.masteredAt),
    occurredAt: reviewedAt,
    deviceId,
  });
  studyEvents.push(event);
  await saveRecordValue(VOCABULARY_STORE, item.normalizedTerm, item);
  await persistStudyEvent(event);
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
    SELECT word, phonetic, definition, translation
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
          phonetic: row.phonetic,
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
  wordPromptText.textContent = `${suggestion.word}${suggestion.phonetic ? ` ${suggestion.phonetic}` : ""} - ${suggestion.preview}`;
  wordPromptPanel.hidden = false;
}

function meaningPreviewFromEntry(entry) {
  return topLines(entry.translation, 1)[0] ?? topLines(entry.definition, 1)[0] ?? "No meaning available";
}

function quizEntryFromVocabulary(item) {
  return {
    term: item.term,
    normalizedTerm: item.normalizedTerm,
    phonetic: getVocabularyPhonetic(item),
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
      <span>${mode === "review" ? "Review" : mode === "practice" ? "Practice" : "First check"}</span>
      <strong>${escapeHtml(entry.term)}</strong>
      ${renderIpa(entry.phonetic)}
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

async function startDueReview() {
  if (!(await ensureDictionaryLoaded())) return;
  const [item] = getDueVocabularyItems();
  const [practiceItem] = item ? [] : getPracticeVocabularyItems();
  const reviewItem = item ?? practiceItem;
  if (!reviewItem) {
    renderStudyStats();
    quizPanel.hidden = false;
    quizPanel.innerHTML = `<p class="muted">No saved words are available for review yet.</p>`;
    return;
  }
  renderQuiz(quizEntryFromVocabulary(reviewItem), item ? "review" : "practice");
}

function pickNewStudyEntry() {
  if (!dictionaryDb) return null;
  const saved = new Set(vocabularyItems.map((item) => item.normalizedTerm));
  const alreadyKnown = new Set(
    studyEvents
      .filter((event) => event.type === "new-word-first-pass")
      .map((event) => event.normalizedTerm)
      .filter(Boolean),
  );
  const statement = dictionaryDb.prepare(`
    SELECT word, normalized_word, phonetic, definition, translation
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
      if (!saved.has(row.normalized_word) && !alreadyKnown.has(row.normalized_word)) {
        candidates.push({
          term: row.word,
          normalizedTerm: row.normalized_word,
          phonetic: row.phonetic,
          correct: meaningPreviewFromEntry(row),
        });
      }
    }
  } finally {
    statement.free();
  }
  if (!candidates.length) return null;
  return candidates[0];
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

function renderFsrsRatingChoices(passed) {
  const hint = passed ? "Choose how well you remembered it." : "Choose Again unless you still remembered part of it.";
  quizPanel.insertAdjacentHTML(
    "beforeend",
    `
      <div class="fsrs-rating-panel">
        <p class="muted">${escapeHtml(hint)}</p>
        <div class="quiz-actions fsrs-ratings" aria-label="Review rating">
          <button class="secondary-button" type="button" data-fsrs-rating="again">Again</button>
          <button class="secondary-button" type="button" data-fsrs-rating="hard">Hard</button>
          <button type="button" data-fsrs-rating="good">Good</button>
          <button class="secondary-button" type="button" data-fsrs-rating="easy">Easy</button>
        </div>
      </div>
    `,
  );
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
  activeQuiz.pendingResult = { passed, responseMs, quizResult: passed ? "pass" : "miss" };
  renderFsrsRatingChoices(passed);
}

async function handleFsrsRating(rating) {
  if (!activeQuiz?.pendingResult || !FSRS_RATING_LABELS[rating]) return;
  const { sourceItem } = activeQuiz.entry;
  const { quizResult, responseMs } = activeQuiz.pendingResult;
  await recordReviewRating(sourceItem, rating, quizResult, responseMs);
  quizPanel.hidden = false;
  quizPanel.innerHTML = `<p class="muted">Review recorded as ${escapeHtml(FSRS_RATING_LABELS[rating])}.</p><div class="quiz-actions"><button class="secondary-button" type="button" data-quiz-close="1">Close</button><button type="button" data-review-next="1">Review next</button></div>`;
}

async function handleNewWordQuizResult(passed, rating, responseMs) {
  if (!activeQuiz) return;
  const entry = activeQuiz.entry;
  if (passed) {
    const event = markDebugRecord({
      id: crypto.randomUUID ? crypto.randomUUID() : `event-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type: "new-word-first-pass",
      term: entry.term,
      normalizedTerm: entry.normalizedTerm,
      rating,
      responseMs,
      occurredAt: nowIso(),
      deviceId,
    });
    studyEvents.push(event);
    await persistStudyEvent(event);
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
  markDebugRecord(item);
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
    result.innerHTML = `<p class="error">${escapeHtml(error instanceof Error ? error.message : String(error))}</p>`;
  }
}

async function sendSmokeResult(payload) {
  if (window.location.protocol !== "https:") return null;
  const response = await fetch("/__test_results", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Smoke result upload failed: ${response.status}`);
  return response.json();
}

function loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      if (window.google?.accounts?.oauth2) resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.append(script);
  });
}

async function ensureGoogleToken(includeGemini = false) {
  const clientId = getGoogleClientId();
  if (!clientId) throw new Error("Google OAuth client ID is not configured in wordlover-config.js.");
  if (googleAuth.accessToken && googleAuth.expiresAt > Date.now() + 60_000) return googleAuth.accessToken;
  await loadScriptOnce(GOOGLE_IDENTITY_SCRIPT);
  const scope = getGoogleScopes(includeGemini);
  const tokenResponse = await new Promise((resolve, reject) => {
    googleTokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope,
      prompt: "",
      callback: (response) => {
        if (response?.error) reject(new Error(response.error_description ?? response.error));
        else resolve(response);
      },
    });
    googleTokenClient.requestAccessToken({ prompt: googleAuth.accessToken ? "" : "consent" });
  });
  googleAuth = {
    ...googleAuth,
    accessToken: tokenResponse.access_token,
    expiresAt: Date.now() + Number(tokenResponse.expires_in ?? 3600) * 1000,
    scopes: String(tokenResponse.scope ?? scope).split(/\s+/).filter(Boolean),
  };
  await loadGoogleProfile();
  await saveValue("googleProfile", googleAuth.profile);
  renderAppMenu();
  return googleAuth.accessToken;
}

async function googleFetch(url, options = {}, includeGemini = false) {
  const token = await ensureGoogleToken(includeGemini);
  const headers = new Headers(options.headers ?? {});
  headers.set("Authorization", `Bearer ${token}`);
  return fetch(url, { ...options, headers });
}

async function loadGoogleProfile() {
  if (!googleAuth.accessToken) return null;
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${googleAuth.accessToken}` },
  });
  if (!response.ok) return null;
  googleAuth.profile = await response.json();
  return googleAuth.profile;
}

function buildUserDataSnapshot() {
  return {
    app: "wordlover",
    appVersion: APP_VERSION,
    userDataFormatVersion: USER_DATA_FORMAT_VERSION,
    exportedAt: nowIso(),
    profile: googleAuth.profile ? { email: googleAuth.profile.email, sub: googleAuth.profile.sub } : null,
    historyItems,
    vocabularyItems,
    studyEvents,
    autosaveEnabled,
    theme,
    lastMetrics,
  };
}

async function encryptSnapshotPayload(snapshot) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await derivePassphraseAesKey(getLocalDataPassphrase(), salt, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(snapshot));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext));
  return {
    app: "wordlover",
    format: "wordlover-user-data-aes-gcm-v1",
    appVersion: APP_VERSION,
    userDataFormatVersion: USER_DATA_FORMAT_VERSION,
    encryptedAt: nowIso(),
    kdf: "PBKDF2-SHA256",
    iterations: 200000,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    data: bytesToBase64(ciphertext),
  };
}

async function decryptSnapshotPayload(envelope) {
  if (envelope?.format !== "wordlover-user-data-aes-gcm-v1") throw new Error("Cloud snapshot format is not supported.");
  const salt = base64ToBytes(envelope.salt);
  const key = await derivePassphraseAesKey(getLocalDataPassphrase(), salt, ["decrypt"]);
  const iv = base64ToBytes(envelope.iv);
  const ciphertext = base64ToBytes(envelope.data);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return JSON.parse(new TextDecoder().decode(plaintext));
}

function driveNameQuery(fileName) {
  return encodeURIComponent(`name = '${String(fileName).replace(/'/g, "\\'")}' and trashed = false`);
}

async function listGoogleDriveSnapshots() {
  const fileName = CONFIG.googleDriveFileName ?? "wordlover-user-data.json";
  const response = await googleFetch(
    `${GOOGLE_DRIVE_FILES_URL}?spaces=appDataFolder&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc&q=${driveNameQuery(fileName)}`,
  );
  if (!response.ok) throw new Error(`Google Drive list failed: ${response.status} ${await response.text()}`);
  const data = await response.json();
  return data.files ?? [];
}

async function syncToGoogleDrive() {
  googleAuthStatus.textContent = "Encrypting and syncing local snapshot to Google Drive...";
  const fileName = CONFIG.googleDriveFileName ?? "wordlover-user-data.json";
  const existing = (await listGoogleDriveSnapshots())[0] ?? null;
  const encryptedSnapshot = await encryptSnapshotPayload(buildUserDataSnapshot());
  if (existing?.id) {
    const response = await googleFetch(`${GOOGLE_DRIVE_UPLOAD_URL}/${existing.id}?uploadType=media&fields=id,name,modifiedTime`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(encryptedSnapshot),
    });
    if (!response.ok) throw new Error(`Google Drive sync failed: ${response.status} ${await response.text()}`);
    const resultData = await response.json();
    googleAuthStatus.textContent = `Updated encrypted Drive backup: ${resultData.name ?? fileName}.`;
    syncStatus.textContent = "Synced";
    return resultData;
  }
  const metadata = {
    name: fileName,
    parents: ["appDataFolder"],
    mimeType: "application/json",
  };
  const boundary = `wordlover-${Date.now()}`;
  const body = [
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    JSON.stringify(metadata),
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    JSON.stringify(encryptedSnapshot),
    `--${boundary}--`,
  ].join("\r\n");
  const response = await googleFetch(`${GOOGLE_DRIVE_UPLOAD_URL}?uploadType=multipart&fields=id,name,modifiedTime`, {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  if (!response.ok) throw new Error(`Google Drive sync failed: ${response.status} ${await response.text()}`);
  const resultData = await response.json();
  googleAuthStatus.textContent = `Created encrypted Drive backup: ${resultData.name ?? resultData.id}.`;
  syncStatus.textContent = "Synced";
  return resultData;
}

async function applyUserDataSnapshot(snapshot) {
  if (snapshot?.app !== "wordlover") throw new Error("This backup is not a WordLover user-data snapshot.");
  historyItems = Array.isArray(snapshot.historyItems) ? snapshot.historyItems : [];
  vocabularyItems = Array.isArray(snapshot.vocabularyItems) ? snapshot.vocabularyItems : [];
  ensureVocabularyReviewStates();
  studyEvents = Array.isArray(snapshot.studyEvents) ? snapshot.studyEvents : [];
  autosaveEnabled = Boolean(snapshot.autosaveEnabled ?? true);
  theme = ["calm", "ink", "sunrise"].includes(snapshot.theme) ? snapshot.theme : DEFAULT_THEME;
  lastMetrics = snapshot.lastMetrics ?? lastMetrics;

  await clearRawStore(VOCABULARY_STORE);
  await clearRawStore(STUDY_EVENT_STORE);
  await persistVocabulary();
  await persistStudyEvents();
  await saveValue("history", historyItems);
  await saveValue("autosaveEnabled", autosaveEnabled);
  await saveValue("theme", theme);
  await saveValue("lastMetrics", lastMetrics);

  autosaveToggle.checked = autosaveEnabled;
  applyTheme(theme);
  renderHistory();
  renderVocabulary();
  renderStudyStats();
  renderMetrics();
  renderAppMenu();
}

async function restoreFromGoogleDrive() {
  googleAuthStatus.textContent = "Looking for encrypted Drive backup...";
  const [latest] = await listGoogleDriveSnapshots();
  if (!latest?.id) {
    googleAuthStatus.textContent = "No Drive backup found for this app.";
    return null;
  }
  const confirmed = window.confirm(`Restore WordLover data from Google Drive backup modified ${latest.modifiedTime ?? "recently"}? This replaces local vocabulary and study progress.`);
  if (!confirmed) {
    googleAuthStatus.textContent = "Drive restore canceled.";
    return null;
  }
  const response = await googleFetch(`${GOOGLE_DRIVE_FILES_URL}/${latest.id}?alt=media`);
  if (!response.ok) throw new Error(`Google Drive restore failed: ${response.status} ${await response.text()}`);
  const envelope = await response.json();
  const snapshot = await decryptSnapshotPayload(envelope);
  await applyUserDataSnapshot(snapshot);
  googleAuthStatus.textContent = `Restored encrypted Drive backup from ${latest.modifiedTime ?? "Google Drive"}.`;
  syncStatus.textContent = navigator.onLine ? "Synced" : "Offline";
  return snapshot;
}

async function requestGeminiDetails(data) {
  if (!data || data.status !== "found") throw new Error("Search a dictionary term before asking Gemini.");
  const model = CONFIG.geminiModel ?? "gemini-2.0-flash";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const prompt = [
    `Explain the English term "${data.term}" for a Chinese-speaking TOEFL learner.`,
    "Return concise JSON with meanings, two example sentences per meaning, common phrases, word history, most common usage, and learner notes.",
    `English meanings: ${summarizeLines(data.englishMeanings)}`,
    `Chinese meanings: ${summarizeLines(data.chineseMeanings)}`,
  ].join("\n");
  const response = await googleFetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: GEMINI_RESPONSE_SCHEMA,
      },
    }),
  }, true);
  if (!response.ok) throw new Error(`Gemini request failed: ${response.status} ${await response.text()}`);
  const payload = await response.json();
  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text).join("\n") ?? "";
  const structured = JSON.parse(text);
  if (!Array.isArray(structured.meanings)) throw new Error("Gemini returned an invalid detail payload.");
  return { provider: "gemini", model, generatedAt: nowIso(), structured };
}

function renderAiDetailCards(detail) {
  const meanings = detail.structured.meanings
    .map((meaning, index) => `
      <article class="ai-meaning-card">
        <h4>Meaning ${index + 1}</h4>
        <p>${escapeHtml(meaning.definition)}</p>
        ${(meaning.examples ?? []).slice(0, 2).map((example) => `<p class="example">${escapeHtml(example)}</p>`).join("")}
        ${(meaning.commonPhrases ?? []).length ? `<p class="small">Phrases: ${escapeHtml(meaning.commonPhrases.join(", "))}</p>` : ""}
      </article>
    `)
    .join("");
  return `
    <h3>Gemini details</h3>
    <p class="small">${escapeHtml(detail.model)} - ${escapeHtml(detail.generatedAt)}</p>
    <div class="ai-card-grid">${meanings}</div>
    ${detail.structured.commonUsage ? `<h4>Common usage</h4><p>${escapeHtml(detail.structured.commonUsage)}</p>` : ""}
    ${detail.structured.wordHistory ? `<h4>Word history</h4><p>${escapeHtml(detail.structured.wordHistory)}</p>` : ""}
    ${detail.structured.learnerNotes ? `<h4>Learner notes</h4><p>${escapeHtml(detail.structured.learnerNotes)}</p>` : ""}
  `;
}

async function showAiDetails(data) {
  aiDetailPanel.hidden = false;
  aiDetailPanel.innerHTML = `<p class="muted">Opening Gemini details...</p>`;
  try {
    const detail = await requestGeminiDetails(data);
    aiDetailPanel.innerHTML = renderAiDetailCards(detail);
  } catch (error) {
    aiDetailPanel.innerHTML = `<p class="error">${escapeHtml(error instanceof Error ? error.message : String(error))}</p>`;
  }
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

function exportState() {
  const payload = {
    exportedAt: nowIso(),
    app: "wordlover",
    appVersion: APP_VERSION,
    userDataFormatVersion: USER_DATA_FORMAT_VERSION,
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
  anchor.download = "wordlover-user-data.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

async function checkForAppUpdate() {
  applyUpdateButton.disabled = true;
  pendingAppReloadUrl = null;
  if (!("serviceWorker" in navigator)) {
    updateStatus.textContent = "Service worker is unavailable on this device.";
    return;
  }
  updateStatus.textContent = "Checking for an app update...";
  let latestVersion = null;
  try {
    const response = await fetch(`/app.js?update-check=${Date.now()}`, { cache: "no-store" });
    const scriptText = await response.text();
    latestVersion = scriptText.match(/const APP_VERSION = "([^"]+)"/)?.[1] ?? null;
  } catch (error) {
    updateStatus.textContent = `Could not check the server app version: ${error instanceof Error ? error.message : String(error)}.`;
    return;
  }
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) {
    updateStatus.textContent = "Offline shell is not registered yet. Reopen the app and try again.";
    return;
  }
  await registration.update();
  const waitingWorker = registration.waiting;
  if (waitingWorker) {
    applyUpdateButton.disabled = false;
    updateStatus.textContent = latestVersion && latestVersion !== APP_VERSION
      ? `App shell ${latestVersion} is ready. Tap Apply update to switch.`
      : "An app-shell update is ready. Tap Apply update to switch.";
    return;
  }
  if (latestVersion && latestVersion !== APP_VERSION) {
    pendingAppReloadUrl = `/?fresh=${encodeURIComponent(latestVersion)}-${Date.now()}`;
    applyUpdateButton.disabled = false;
    updateStatus.textContent = `App shell ${latestVersion} is available on the server. Tap Apply update to reload it.`;
    return;
  }
  updateStatus.textContent = `No app-shell update found. Current version: ${APP_VERSION}.`;
}

async function applyAppUpdate() {
  const registration = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : null;
  if (registration?.waiting) {
    updateStatus.textContent = "Applying update...";
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
    return;
  }
  if (pendingAppReloadUrl) {
    updateStatus.textContent = "Reloading the latest app shell. Local vocabulary and study data stay on this device.";
    window.location.href = pendingAppReloadUrl;
    return;
  }
  if (!registration?.waiting) {
    updateStatus.textContent = "No waiting update is available yet. Check update first.";
    return;
  }
}

async function runReviewAutomation() {
  debugStatus.textContent = "Running review and quiz automation...";
  if (!debugMode.enabled) await setDebugMode(true);
  if (!(await ensureDictionaryLoaded())) {
    debugStatus.textContent = "Automation failed: dictionary did not load.";
    return null;
  }
  const sample = lookupTerm("abandon");
  if (sample.status !== "found") {
    debugStatus.textContent = "Automation failed: sample word not found.";
    return null;
  }
  const item = await saveVocabularyItem(sample, "debug-automation");
  item.review.dueAt = nowIso();
  item.review.masteredAt = null;
  await persistVocabulary();
  await startDueReview();
  const correctIndex = activeQuiz?.options.findIndex((option) => option.correct) ?? -1;
  if (correctIndex < 0) {
    debugStatus.textContent = "Automation failed: no correct quiz option.";
    return null;
  }
  await handleQuizAnswer(correctIndex);
  await handleFsrsRating("easy");
  const latestEvent = studyEvents.at(-1);
  const firstRating = latestEvent?.rating;
  item.review.dueAt = nowIso();
  await persistVocabulary();
  await startDueReview();
  const wrongIndex = activeQuiz?.options.findIndex((option) => !option.correct) ?? -1;
  if (wrongIndex >= 0) {
    await handleQuizAnswer(wrongIndex);
    await handleFsrsRating("again");
  }
  const secondRating = studyEvents.at(-1)?.rating;
  const passed = firstRating === "easy" && secondRating === "again";
  debugStatus.textContent = passed
    ? "Review automation passed: correct answer -> Easy, wrong answer -> Again."
    : `Review automation completed with ratings ${firstRating ?? "none"} / ${secondRating ?? "none"}.`;
  renderStudyStats();
  return { passed, firstRating, secondRating, debugSessionId: debugMode.sessionId };
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
  theme = await loadValue("theme", DEFAULT_THEME);
  applyTheme(theme);
  debugMode = await loadValue("debugMode", debugMode);
  googleAuth.profile = await loadValue("googleProfile", null);
  renderDebugState();
  renderAppMenu();
  historyItems = await loadValue("history", []);
  const vocabularyRecords = await loadAllRecordValues(VOCABULARY_STORE);
  const legacyVocabularyItems = await loadValue("vocabularyItems", []);
  vocabularyItems = vocabularyRecords.length ? vocabularyRecords : legacyVocabularyItems;
  ensureVocabularyReviewStates();
  if (!vocabularyRecords.length && legacyVocabularyItems.length) await persistVocabulary();
  const studyEventRecords = await loadAllRecordValues(STUDY_EVENT_STORE);
  const legacyStudyEvents = await loadValue("studyEvents", []);
  studyEvents = studyEventRecords.length ? studyEventRecords : legacyStudyEvents;
  if (!studyEventRecords.length && legacyStudyEvents.length) await persistStudyEvents();
  autosaveEnabled = await loadValue("autosaveEnabled", true);
  autosaveToggle.checked = autosaveEnabled;
  lastMetrics = await loadValue("lastMetrics", null);
  renderHistory();
  renderVocabulary();
  renderStudyStats();
  renderMetrics();
  window.setInterval(refreshReviewScheduleViews, REVIEW_REFRESH_INTERVAL_MS);
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
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        window.location.reload();
      });
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
  if (event.target instanceof HTMLButtonElement && event.target.id === "showAiDetails" && currentResult) {
    void showAiDetails(currentResult);
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
  if (action === "vocab-filter") {
    vocabularyView = {
      filter: button.dataset.filter ?? "all",
      page: 0,
      selectedTerm: null,
    };
    renderVocabulary();
    return;
  }
  if (action === "vocab-summary") {
    vocabularyView = { filter: "summary", page: 0, selectedTerm: null };
    renderVocabulary();
    return;
  }
  if (action === "vocab-page") {
    vocabularyView.page = Number(button.dataset.page ?? 0);
    vocabularyView.selectedTerm = null;
    renderVocabulary();
    return;
  }
  if (action === "vocab-select") {
    vocabularyView.selectedTerm = vocabularyView.selectedTerm && normalizeTerm(vocabularyView.selectedTerm) === normalizeTerm(term) ? null : term;
    renderVocabulary();
    return;
  }
  if (action === "open") {
    termInput.value = term;
    renderSuggestions([]);
    void runLookup();
  }
  if (action === "edit") void editVocabularyItem(term);
  if (action === "archive") {
    vocabularyView.selectedTerm = null;
    void setVocabularyArchived(term, true);
  }
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
  void startDueReview();
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
  const ratingButton = target.closest("[data-fsrs-rating]");
  if (ratingButton instanceof HTMLButtonElement) {
    void handleFsrsRating(ratingButton.dataset.fsrsRating);
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
    void startDueReview();
  }
});

exploreWordButton.addEventListener("click", () => {
  if (!currentPromptTerm) return;
  termInput.value = currentPromptTerm;
  renderSuggestions([]);
  void runLookup();
});

exportButton.addEventListener("click", () => {
  exportState();
});

appMenuButton.addEventListener("click", () => {
  const expanded = appMenu.hidden;
  appMenu.hidden = !expanded;
  appMenuButton.setAttribute("aria-expanded", String(expanded));
  if (expanded) renderAppMenu();
});

checkForUpdateButton.addEventListener("click", () => {
  void checkForAppUpdate();
});

applyUpdateButton.addEventListener("click", () => {
  void applyAppUpdate();
});

exportStateMenuButton.addEventListener("click", () => {
  exportState();
});

themeSelect.addEventListener("change", async () => {
  applyTheme(themeSelect.value);
  await saveValue("theme", theme);
});

googleSignInButton.addEventListener("click", async () => {
  try {
    googleAuthStatus.textContent = "Opening Google sign-in...";
    await ensureGoogleToken(false);
    googleAuthStatus.textContent = "Signed in with Google.";
  } catch (error) {
    googleAuthStatus.textContent = error instanceof Error ? error.message : String(error);
  }
  renderAppMenu();
});

googleSyncNowButton.addEventListener("click", async () => {
  try {
    await syncToGoogleDrive();
  } catch (error) {
    googleAuthStatus.textContent = error instanceof Error ? error.message : String(error);
  }
  renderAppMenu();
});

googleRestoreButton.addEventListener("click", async () => {
  try {
    await restoreFromGoogleDrive();
  } catch (error) {
    googleAuthStatus.textContent = error instanceof Error ? error.message : String(error);
  }
  renderAppMenu();
});

googleSignOutButton.addEventListener("click", async () => {
  googleAuth = { accessToken: null, expiresAt: 0, profile: null, scopes: [] };
  await saveValue("googleProfile", null);
  renderAppMenu();
});

debugModeToggle.addEventListener("click", () => {
  void setDebugMode(!debugMode.enabled);
});

runReviewAutomationButton.addEventListener("click", () => {
  void runReviewAutomation();
});

window.addEventListener("online", renderAppMenu);
window.addEventListener("offline", renderAppMenu);
window.addEventListener("focus", refreshReviewScheduleViews);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") refreshReviewScheduleViews();
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
  getActiveQuiz: () => activeQuiz,
  checkForAppUpdate,
  refreshReviewScheduleViews,
  runReviewAutomation,
  setDebugMode,
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
    theme,
    debugMode,
    googleConnected: Boolean(googleAuth.accessToken),
    appVersion: APP_VERSION,
    userDataFormatVersion: USER_DATA_FORMAT_VERSION,
    shellCacheVersion: SHELL_CACHE_VERSION,
    encryptedUserStore: true,
    persistentIndexedDbConnection: Boolean(dbPromise),
  }),
};

void init();
