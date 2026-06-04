const loadButton = document.querySelector("#loadDictionary");
const exportButton = document.querySelector("#exportState");
const appMenuButton = document.querySelector("#appMenuButton");
const appMenu = document.querySelector("#appMenu");
const appMenuBackButton = document.querySelector("#appMenuBack");
const appVersion = document.querySelector("#appVersion");
const dataFormatVersion = document.querySelector("#dataFormatVersion");
const dictionaryEngine = document.querySelector("#dictionaryEngine");
const syncStatus = document.querySelector("#syncStatus");
const syncDetails = document.querySelector("#syncDetails");
const memoryNote = document.querySelector("#memoryNote");
const googleStatus = document.querySelector("#googleStatus");
const googleAccount = document.querySelector("#googleAccount");
const googleAuthStatus = document.querySelector("#googleAuthStatus");
const googleSignInButton = document.querySelector("#googleSignIn");
const googleClientIdConfigButton = document.querySelector("#googleClientIdConfig");
const geminiApiKeyConfigButton = document.querySelector("#geminiApiKeyConfig");
const googleSyncNowButton = document.querySelector("#googleSyncNow");
const googleRestoreButton = document.querySelector("#googleRestore");
const googleSignOutButton = document.querySelector("#googleSignOut");
const authDiagnosticsToggleButton = document.querySelector("#authDiagnosticsToggle");
const authDiagnosticsSendButton = document.querySelector("#authDiagnosticsSend");
const authDiagnosticsPre = document.querySelector("#authDiagnostics");
const themeSelect = document.querySelector("#themeSelect");
const fontZoomOutButton = document.querySelector("#fontZoomOut");
const fontZoomInButton = document.querySelector("#fontZoomIn");
const fontZoomValue = document.querySelector("#fontZoomValue");
const checkForUpdateButton = document.querySelector("#checkForUpdate");
const applyUpdateButton = document.querySelector("#applyUpdate");
const exportStateMenuButton = document.querySelector("#exportStateMenu");
const createCheckpointButton = document.querySelector("#createCheckpoint");
const rollbackCheckpointButton = document.querySelector("#rollbackCheckpoint");
const deleteLocalDataButton = document.querySelector("#deleteLocalData");
const updateStatus = document.querySelector("#updateStatus");
const checkpointStatus = document.querySelector("#checkpointStatus");
const aiDetailPanel = document.querySelector("#aiDetailPanel");
const aiChatPanel = document.querySelector("#aiChatPanel");
const aiChatBackButton = document.querySelector("#aiChatBack");
const aiChatTitle = document.querySelector("#aiChatTitle");
const aiChatContent = document.querySelector("#aiChatContent");
const termInput = document.querySelector("#termInput");
const clearSearchButton = document.querySelector("#clearSearch");
const undoSaveButton = document.querySelector("#undoSave");
const result = document.querySelector("#result");
const metrics = document.querySelector("#metrics");
const diagnostics = document.querySelector("#diagnostics");
const historyList = document.querySelector("#history");
const recentSearchPopover = document.querySelector("#recentSearchPopover");
import {
  reviveFsrsCard,
  scheduleFromFsrsRating as scheduleWithFsrs,
  serializeFsrsCard,
} from "./fsrs-scheduler.js?v=20260603-24";

const pwaStatus = document.querySelector("#pwaStatus");
const dictionaryState = document.querySelector("#dictionaryState");
const dictionarySource = document.querySelector("#dictionarySource");
const suggestions = document.querySelector("#suggestions");
const installBanner = document.querySelector("#installBanner");
const autosaveToggle = document.querySelector("#autosaveToggle");
const onReturnSelect = document.querySelector("#onReturnSelect");
const speakOnReturnToggle = document.querySelector("#speakOnReturnToggle");
const vocabularySummary = document.querySelector("#vocabularySummary");
const vocabularyList = document.querySelector("#vocabularyList");
const studySummary = document.querySelector("#studySummary");
const statNewSaved = document.querySelector("#statNewSaved");
const statReviewed = document.querySelector("#statReviewed");
const statMastered = document.querySelector("#statMastered");
const statKnown = document.querySelector("#statKnown");
const startReviewButton = document.querySelector("#startReview");
const studyNewWordButton = document.querySelector("#studyNewWord");
const studyOneMoreLevelSelect = document.querySelector("#studyOneMoreLevel");
const studyOneMoreHint = document.querySelector("#studyOneMoreHint");
const startSpellingReviewButton = document.querySelector("#startSpellingReview");
const startSpellingPracticeMoreButton = document.querySelector("#startSpellingPracticeMore");
const quizPanel = document.querySelector("#quizPanel");
const spellingReviewPanel = document.querySelector("#spellingReviewPanel");
const todayTrackTabs = document.querySelectorAll("[data-today-track]");
const vocabularyTrackTabs = document.querySelectorAll("[data-vocab-track]");
const historyChart = document.querySelector("#historyChart");
const historyChartSummary = document.querySelector("#historyChartSummary");
const historyRangeLabel = document.querySelector("#historyRangeLabel");
const historyPrevButton = document.querySelector("#historyPrev");
const historyNextButton = document.querySelector("#historyNext");
const historyTodayButton = document.querySelector("#historyToday");
const historyAnchorInput = document.querySelector("#historyAnchorInput");
const historyGranularityButtons = Array.from(document.querySelectorAll("[data-history-granularity]"));
const historyTrackTabs = document.querySelectorAll("[data-history-track]");
const debugModeToggle = document.querySelector("#debugModeToggle");
const runReviewAutomationButton = document.querySelector("#runReviewAutomation");
const debugStatus = document.querySelector("#debugStatus");

const DB_NAME = "wordlover-user";
const STORE = "kv";
const FILE_STORE = "files";
const KEY_STORE = "keys";
const VOCABULARY_STORE = "vocabularyRecords";
const STUDY_EVENT_STORE = "studyEventRecords";
const SPELLING_STORE = "spellingRecords";
const SPELLING_EVENT_STORE = "spellingEventRecords";
const USER_DICTIONARY_STORE = "userDictionary";
const KNOWN_STORE = "knownRecords";
const CHECKPOINT_STORE = "checkpoints";
const DICTIONARY_KEY = "dictionary.sqlite";
const DICTIONARY_PROGRESS_KEY = "dictionary.sqlite.downloadProgress";
const DICTIONARY_CHUNK_PREFIX = "dictionary.sqlite.chunk.";
const DICTIONARY_CHUNK_SIZE = 4 * 1024 * 1024;
const TERM_RE = /^[a-z]+(?:[ '-][a-z]+){0,5}$/;
const HAN_RE = /[\u3400-\u9fff]/;
const DEFAULT_PLACEHOLDER = "abandon, take off, in terms of";
const DEFAULT_RESULT_HINT = "Type a term to search.";
const AUTOSAVE_DWELL_MS = 5000;
const APP_VERSION = "0.6.2-product.20260603-v98";
const USER_DATA_FORMAT_VERSION = "0.3";
const SHELL_CACHE_VERSION = "wordlover-shell-v98";
const DICTIONARY_ENGINE = "Slim 100k-entry dictionary in OPFS; sql.js read engine; wa-sqlite OPFS engine pending bundle install";
const MEMORY_TARGET_NOTE =
  "Memory target: iPhone normal-use DRAM <= 50 MB. This build ships the slim 100k-entry dictionary (~32 MB) so sql.js can hold it in memory; the wa-sqlite OPFS engine remains the production gate for a fuller dictionary.";
const CONFIG = window.WORDLOVER_CONFIG ?? {};
const THEME_IDS = ["sunrise", "candy", "calm", "ink", "sky", "rose", "deepblue", "forest", "lavender", "graphite", "mint"];
const DEFAULT_THEME = "sunrise";
const DEFAULT_FONT_SCALE = 1;
const FONT_SCALE_MIN = 0.9;
const FONT_SCALE_MAX = 2;
const FONT_SCALE_STEP = 0.1;
const DEBUG_DAY_MS = 20 * 1000;
const NORMAL_DAY_MS = 24 * 60 * 60 * 1000;
const DEBUG_TIME_SCALE = NORMAL_DAY_MS / DEBUG_DAY_MS;
const REVIEW_REFRESH_INTERVAL_MS = 3 * 60 * 60 * 1000;
const DICTIONARY_ESTIMATED_BYTES = 40 * 1024 * 1024;
const DICTIONARY_MANIFEST_URL = "/dictionary-manifest.json";
const DICTIONARY_VERSION_KEY = "dictionaryDataVersion";
const MAX_CHECKPOINTS = 5;
const PRODUCTION_GOOGLE_CLIENT_ID = "665953045468-gem626o90ch863ktk2686fb58qa9ql31.apps.googleusercontent.com";
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
const STUDY_ONE_MORE_LEVELS = [
  { id: "very_easy", label: "Very Easy" },
  { id: "easy", label: "Easy" },
  { id: "medium", label: "Medium" },
  { id: "hard", label: "Hard" },
  { id: "advanced", label: "Advanced" },
  { id: "toefl", label: "TOEFL" },
];
const GEMINI_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    meanings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          definition: { type: "string" },
          definitionZh: { type: "string" },
          examples: { type: "array", items: { type: "string" } },
          examplesZh: { type: "array", items: { type: "string" } },
          commonPhrases: { type: "array", items: { type: "string" } },
        },
        required: ["definition", "examples"],
      },
    },
    wordHistory: { type: "string" },
    wordHistoryZh: { type: "string" },
    commonUsage: { type: "string" },
    commonUsageZh: { type: "string" },
    learnerNotes: { type: "string" },
    learnerNotesZh: { type: "string" },
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
let ftsSearchAvailable = null;
let currentResult = null;
let vocabularyItems = [];
let studyEvents = [];
let spellingItems = [];
let spellingEvents = [];
let userDictionaryEntries = [];
let knownWords = [];
let autosaveEnabled = true;
// "vocabulary" | "spelling" | "none" — what pressing Return saves (replaces the autosave toggle).
let onReturnAction = "vocabulary";
let speakOnReturn = false;
let deviceId = null;
let activeQuiz = null;
let activeVocabularyReviewSession = null;
let activeSpellingSession = null;
let reviewDebugEvents = [];
let reviewPersistenceBeforeSaveForTest = null;
let reviewPersistenceTimeoutMs = 4000;
let theme = DEFAULT_THEME;
let fontScale = DEFAULT_FONT_SCALE;
let vocabularyView = {
  filter: "summary",
  page: 0,
  selectedTerm: null,
  query: "",
  track: "vocabulary",
  addedFrom: "",
  addedTo: "",
  reviewedFrom: "",
  reviewedTo: "",
  reviewCountMin: "",
  reviewCountMax: "",
};
let todayTrack = "vocabulary";
let studyOneMoreLevel = "very_easy";
let activeStudyOneMoreEntry = null;
let historyView = {
  granularity: "days",
  anchorMs: null,
  track: "vocabulary",
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
// True once the user has completed interactive consent on this device. Lets us refresh the
// short-lived access token silently (prompt:"") instead of forcing a full re-login each hour.
let googleGrantGranted = false;
let googleTokenClient = null;
let googleTokenClientClientId = null;
let googleTokenClientScope = null;
let pendingTokenSettlers = null;
let lastSyncInfo = null;
let driveSyncState = "idle";
// Persisted summary of the last successful sync, shown in the Settings Sync block.
let lastSyncSummary = null;
let pendingAppReloadUrl = null;
let googleClientIdOverride = "";
let dataDecryptBlock = null;
let dataDecryptWarningOpen = false;
let googleReconnectPromise = null;

function formatMs(value) {
  return `${Math.round(value)} ms`;
}

function normalizeTerm(term) {
  return term.trim().replace(/[\u2019`]/g, "'").replace(/\s+/g, " ").toLowerCase();
}

function isValidFsrsRating(rating) {
  return FSRS_RATINGS.includes(String(rating ?? "").toLowerCase());
}

function normalizeTrack(value) {
  return value === "spelling" ? "spelling" : "vocabulary";
}

function currentUiPreferences() {
  return {
    todayTrack: normalizeTrack(todayTrack),
    vocabularyTrack: normalizeTrack(vocabularyView.track),
    historyTrack: normalizeTrack(historyView.track),
  };
}

function applyUiPreferences(preferences = {}) {
  todayTrack = normalizeTrack(preferences.todayTrack ?? todayTrack);
  vocabularyView = {
    ...vocabularyView,
    track: normalizeTrack(preferences.vocabularyTrack ?? vocabularyView.track),
  };
  historyView = {
    ...historyView,
    track: normalizeTrack(preferences.historyTrack ?? historyView.track),
  };
  return currentUiPreferences();
}

function normalizeUiPreferences(preferences = {}, fallback = currentUiPreferences()) {
  return {
    todayTrack: normalizeTrack(preferences.todayTrack ?? fallback.todayTrack),
    vocabularyTrack: normalizeTrack(preferences.vocabularyTrack ?? fallback.vocabularyTrack),
    historyTrack: normalizeTrack(preferences.historyTrack ?? fallback.historyTrack),
  };
}

async function persistUiPreferences() {
  await saveValue("uiPreferences", currentUiPreferences());
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

function localDateKey(ms = appNowMs()) {
  const date = new Date(ms);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function todayPrefix() {
  return localDateKey(appNowMs());
}

function isToday(value) {
  const ms = Date.parse(value);
  return Number.isFinite(ms) && localDateKey(ms) === todayPrefix();
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

function showModal({ title, body = "", fields = [], submitText = "OK", cancelText = "Cancel", allowCancel = true, danger = false, helpLink = null }) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    const fieldHtml = fields
      .map((field) => {
        let control;
        if (field.type === "textarea") {
          control = `<textarea
              id="${escapeHtml(field.id)}"
              data-modal-field="${escapeHtml(field.id)}"
              rows="${Number(field.rows ?? 3)}"
              placeholder="${escapeHtml(field.placeholder ?? "")}"
            >${escapeHtml(field.value ?? "")}</textarea>`;
        } else if (field.type === "select") {
          const opts = (field.options ?? [])
            .map((opt) => `<option value="${escapeHtml(opt.value)}"${opt.value === (field.value ?? "") ? " selected" : ""}>${escapeHtml(opt.label ?? opt.value)}</option>`)
            .join("");
          control = `<select id="${escapeHtml(field.id)}" data-modal-field="${escapeHtml(field.id)}">${opts}</select>`;
        } else {
          control = `<input
              id="${escapeHtml(field.id)}"
              data-modal-field="${escapeHtml(field.id)}"
              type="${escapeHtml(field.type ?? "text")}"
              autocomplete="${escapeHtml(field.autocomplete ?? "off")}"
              value="${escapeHtml(field.value ?? "")}"
              placeholder="${escapeHtml(field.placeholder ?? "")}"
            />`;
        }
        return `
          <label class="modal-field">
            <span>${escapeHtml(field.label)}</span>
            ${control}
            ${field.hint ? `<small class="muted">${escapeHtml(field.hint)}</small>` : ""}
          </label>
        `;
      })
      .join("");
    const helpLinkHtml = helpLink?.url
      ? `<p class="small"><a href="${escapeHtml(helpLink.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(helpLink.label ?? helpLink.url)}</a></p>`
      : "";
    overlay.innerHTML = `
      <div class="modal-panel" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
        <h2 id="modalTitle">${escapeHtml(title)}</h2>
        ${body ? `<p class="muted">${escapeHtml(body)}</p>` : ""}
        ${helpLinkHtml}
        ${fieldHtml}
        <p class="error" data-modal-error hidden></p>
        <div class="modal-actions">
          ${allowCancel ? `<button class="secondary-button" type="button" data-modal-cancel>${escapeHtml(cancelText)}</button>` : ""}
          <button type="button" data-modal-submit${danger ? ' class="danger-button"' : ""}>${escapeHtml(submitText)}</button>
        </div>
      </div>
    `;
    document.body.append(overlay);
    const firstControl = overlay.querySelector("[data-modal-field]");
    const submit = () => {
      const values = Object.fromEntries(
        fields.map((field) => {
          const control = overlay.querySelector(`[data-modal-field="${field.id}"]`);
          if (control instanceof HTMLSelectElement) return [field.id, control.value];
          if (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement) return [field.id, control.value];
          return [field.id, ""];
        }),
      );
      const missingRequired = fields.find((field) => field.required && !values[field.id].trim());
      if (missingRequired) {
        const error = overlay.querySelector("[data-modal-error]");
        error.textContent = `${missingRequired.label} is required.`;
        error.hidden = false;
        return;
      }
      overlay.remove();
      resolve(fields.length ? values : true);
    };
    overlay.querySelector("[data-modal-submit]").addEventListener("click", submit);
    overlay.querySelector("[data-modal-cancel]")?.addEventListener("click", () => {
      overlay.remove();
      resolve(fields.length ? null : false);
    });
    overlay.addEventListener("keydown", (event) => {
      const inTextarea = event.target instanceof HTMLTextAreaElement;
      if (event.key === "Enter" && !inTextarea) submit();
      if (event.key === "Escape" && allowCancel) {
        overlay.remove();
        resolve(fields.length ? null : false);
      }
    });
    firstControl?.focus();
  });
}

function openUserDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 7);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      if (!db.objectStoreNames.contains(FILE_STORE)) db.createObjectStore(FILE_STORE);
      if (!db.objectStoreNames.contains(KEY_STORE)) db.createObjectStore(KEY_STORE);
      if (!db.objectStoreNames.contains(VOCABULARY_STORE)) db.createObjectStore(VOCABULARY_STORE);
      if (!db.objectStoreNames.contains(STUDY_EVENT_STORE)) db.createObjectStore(STUDY_EVENT_STORE);
      if (!db.objectStoreNames.contains(SPELLING_STORE)) db.createObjectStore(SPELLING_STORE);
      if (!db.objectStoreNames.contains(SPELLING_EVENT_STORE)) db.createObjectStore(SPELLING_EVENT_STORE);
      if (!db.objectStoreNames.contains(USER_DICTIONARY_STORE)) db.createObjectStore(USER_DICTIONARY_STORE);
      if (!db.objectStoreNames.contains(KNOWN_STORE)) db.createObjectStore(KNOWN_STORE);
      if (!db.objectStoreNames.contains(CHECKPOINT_STORE)) db.createObjectStore(CHECKPOINT_STORE);
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

async function loadAllRawValues(storeName) {
  const db = await getUserDb();
  const tx = db.transaction(storeName, "readonly");
  return requestToPromise(tx.objectStore(storeName).getAll());
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

function checksumText(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function snapshotIntegrity(snapshot) {
  const vocabularyCount = Array.isArray(snapshot.vocabularyItems) ? snapshot.vocabularyItems.length : 0;
  const studyEventCount = Array.isArray(snapshot.studyEvents) ? snapshot.studyEvents.length : 0;
  const spellingCount = Array.isArray(snapshot.spellingItems) ? snapshot.spellingItems.length : 0;
  const spellingEventCount = Array.isArray(snapshot.spellingEvents) ? snapshot.spellingEvents.length : 0;
  const historyCount = Array.isArray(snapshot.historyItems) ? snapshot.historyItems.length : 0;
  const knownCount = Array.isArray(snapshot.knownWords) ? snapshot.knownWords.length : 0;
  const normalizedTerms = (snapshot.vocabularyItems ?? [])
    .map((item) => item?.normalizedTerm ?? normalizeTerm(item?.term ?? ""))
    .filter(Boolean)
    .sort();
  const spellingTerms = (snapshot.spellingItems ?? [])
    .map((item) => item?.normalizedTerm ?? normalizeTerm(item?.term ?? ""))
    .filter(Boolean)
    .sort();
  return {
    vocabularyCount,
    studyEventCount,
    spellingCount,
    spellingEventCount,
    historyCount,
    knownCount,
    checksum: checksumText(JSON.stringify({ normalizedTerms, spellingTerms, studyEventCount, spellingEventCount, historyCount, knownCount })),
  };
}

function validateUserDataSnapshot(snapshot) {
  if (snapshot?.app !== "wordlover") throw new Error("This is not a WordFan user-data snapshot.");
  if (snapshot.userDataFormatVersion && snapshot.userDataFormatVersion !== USER_DATA_FORMAT_VERSION) {
    throw new Error(`User-data format ${snapshot.userDataFormatVersion} is not supported by this app format ${USER_DATA_FORMAT_VERSION}.`);
  }
  for (const item of snapshot.vocabularyItems ?? []) {
    if (!item?.term) throw new Error("Snapshot contains a vocabulary item without a term.");
  }
  return snapshotIntegrity(snapshot);
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

const DEFAULT_LOCAL_PASSPHRASE = "wordlover-localhost-development-passphrase";

async function getLocalDataPassphrase() {
  const configured = String(CONFIG.localDevelopmentPassphrase ?? "").trim();
  return configured || DEFAULT_LOCAL_PASSPHRASE;
}

function getLocalDataPassphraseSource() {
  return String(CONFIG.localDevelopmentPassphrase ?? "").trim()
    ? "configured-local-passphrase"
    : "default-local-development-passphrase";
}

function isUsingDefaultLocalDataPassphrase() {
  return getLocalDataPassphraseSource() === "default-local-development-passphrase";
}

function syncEncryptionNotice() {
  return isUsingDefaultLocalDataPassphrase()
    ? "Backup encryption: using the legacy default local passphrase; keep it stable until a migration or account-bound design exists."
    : "";
}

function showDataDecryptWarning() {
  if (!dataDecryptBlock || dataDecryptWarningOpen) return;
  dataDecryptWarningOpen = true;
  const where = dataDecryptBlock.storeName
    ? `${dataDecryptBlock.storeName}${dataDecryptBlock.key ? ` / ${dataDecryptBlock.key}` : ""}`
    : dataDecryptBlock.key ?? "local user data";
  void showModal({
    title: "Data cannot be decrypted",
    body: `WordFan could not decrypt ${where}. To avoid replacing your data with an empty set, saving, checkpointing, and sync are blocked on this device. Export diagnostics or restore a known-good backup before continuing.`,
    submitText: "OK",
    allowCancel: false,
    danger: true,
  }).finally(() => {
    dataDecryptWarningOpen = false;
  });
}

function blockUserDataAfterDecryptFailure(scope, error) {
  if (!dataDecryptBlock) {
    dataDecryptBlock = {
      at: nowIso(),
      ...scope,
      error: error instanceof Error ? error.message : String(error),
    };
    recordAuthDiag("local-decrypt-failure", dataDecryptBlock);
  }
  showDataDecryptWarning();
}

function clearDataDecryptBlock() {
  dataDecryptBlock = null;
  dataDecryptWarningOpen = false;
}

function assertUserDataWritable(action, { allowDuringDecryptBlock = false } = {}) {
  if (!dataDecryptBlock || allowDuringDecryptBlock) return;
  showDataDecryptWarning();
  throw new Error(`Data cannot be decrypted. ${action} is blocked until diagnostics are exported or a backup is restored.`);
}

async function getEncryptionKey() {
  if (!window.crypto?.subtle) {
    throw new Error("Web Crypto is required for encrypted local user data.");
  }
  encryptionKeyPromise ??= (async () => {
    const legacyRawKey = await loadRawValue(KEY_STORE, "localAesGcmKey");
    if (legacyRawKey) {
      return crypto.subtle.importKey("raw", new Uint8Array(legacyRawKey), { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
    }
    const wrapped = await loadRawValue(KEY_STORE, "wrappedDek");
    if (wrapped?.wrappedKey && wrapped?.salt && wrapped?.wrapIv) {
      try {
        const kek = await deriveKek(DEFAULT_LOCAL_PASSPHRASE, new Uint8Array(wrapped.salt));
        const dek = await crypto.subtle.unwrapKey(
          "raw",
          wrapped.wrappedKey,
          kek,
          { name: "AES-GCM", iv: new Uint8Array(wrapped.wrapIv) },
          { name: "AES-GCM", length: 256 },
          true,
          ["encrypt", "decrypt"],
        );
        const raw = new Uint8Array(await crypto.subtle.exportKey("raw", dek));
        await saveRawValue(KEY_STORE, "localAesGcmKey", raw);
        await deleteRawValue(KEY_STORE, "wrappedDek");
        return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
      } catch {
        await deleteRawValue(KEY_STORE, "wrappedDek");
      }
    }
    const newKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
    const raw = new Uint8Array(await crypto.subtle.exportKey("raw", newKey));
    await saveRawValue(KEY_STORE, "localAesGcmKey", raw);
    return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  })().catch((error) => {
    encryptionKeyPromise = null;
    throw error;
  });
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
  assertUserDataWritable(`Saving "${key}"`);
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
  } catch (error) {
    blockUserDataAfterDecryptFailure({ storeName: STORE, key }, error);
    return fallback;
  }
}

async function saveRecordValue(storeName, key, value) {
  assertUserDataWritable(`Saving "${key}"`);
  await saveRawValue(storeName, key, await encryptValue(value));
}

function withTimeout(promise, ms, label) {
  let timeoutId = 0;
  const timeout = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timeoutId));
}

async function deleteRecordValue(storeName, key) {
  assertUserDataWritable(`Deleting "${key}"`);
  await deleteRawValue(storeName, key);
}

async function loadAllRecordValues(storeName) {
  const db = await getUserDb();
  const tx = db.transaction(storeName, "readonly");
  const values = await requestToPromise(tx.objectStore(storeName).getAll());
  const results = [];
  for (const value of values) {
    if (!isEncryptedRecord(value)) {
      results.push(value);
      continue;
    }
    try {
      results.push(await decryptValue(value));
    } catch (error) {
      blockUserDataAfterDecryptFailure({ storeName }, error);
      return [];
    }
  }
  return results;
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

async function checkStorageBeforeInstall(requiredBytes) {
  if (!navigator.storage?.estimate) return { ok: true };
  const estimate = await navigator.storage.estimate();
  const quota = Number(estimate.quota ?? 0);
  const usage = Number(estimate.usage ?? 0);
  if (!quota) return { ok: true };
  const available = quota - usage;
  if (available < requiredBytes * 1.1) {
    return {
      ok: false,
      message: `Not enough browser storage for the dictionary. It needs about ${(requiredBytes / 1024 / 1024).toFixed(0)} MB plus headroom, but only ${(available / 1024 / 1024).toFixed(0)} MB is available.`,
    };
  }
  if (usage / quota > 0.8) {
    return {
      ok: true,
      warning: `Browser storage is already ${Math.round((usage / quota) * 100)}% full. The dictionary can continue, but exporting user data first is safer.`,
    };
  }
  return { ok: true };
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
  const signedInOrGranted = Boolean(googleAuth.accessToken) || hasGoogleGrant();
  syncStatus.textContent = !signedInOrGranted
    ? "Local only"
    : !navigator.onLine
      ? "Offline"
      : driveSyncState === "synced"
        ? "Synced"
        : driveSyncState === "error"
          ? "Sync error"
          : "Pending sync";
  if (syncDetails) {
    if (lastSyncSummary?.at) {
      const s = lastSyncSummary;
      const when = formatSyncTime(s.at);
      const lines = [
        `Last sync: ${when}`,
        `Vocabulary: ${s.vocabWords ?? s.words ?? 0} word(s) · ${formatBytes(s.vocabBytes)}`,
        `Spelling: ${s.spellingWords ?? 0} word(s) · ${formatBytes(s.spellingBytes)}`,
        `Known: ${s.knownWords ?? 0} word(s) · ${formatBytes(s.knownBytes)}`,
        `Drive backup: ${formatBytes(s.driveBytes ?? s.sizeBytes)} total`,
      ];
      if (driveSyncState === "error" && lastSyncInfo?.error) lines.push(`Last attempt failed: ${lastSyncInfo.error}`);
      if (syncEncryptionNotice()) lines.push(syncEncryptionNotice());
      syncDetails.innerHTML = lines.map((line) => escapeHtml(line)).join("<br>");
    } else if (signedInOrGranted) {
      const detail = driveSyncState === "error" && lastSyncInfo?.error
        ? `Not synced yet · last attempt failed: ${lastSyncInfo.error}`
        : "Not synced yet on this device. Tap Sync now.";
      syncDetails.textContent = [detail, syncEncryptionNotice()].filter(Boolean).join(" ");
    } else {
      syncDetails.textContent = syncEncryptionNotice();
    }
  }
  memoryNote.textContent = MEMORY_TARGET_NOTE;
  googleStatus.textContent = `This device's web origin is ${window.location.origin} — it must be listed under "Authorized JavaScript origins" on your Google OAuth client for sign-in to work. Offline dictionary and study features stay local.`;
  googleAccount.textContent = googleAuth.profile?.email ?? "Not signed in";
  googleAuthStatus.textContent = googleAuth.accessToken
    ? (googleAuth.profile?.email
        ? `Signed in as ${googleAuth.profile.email}. Drive sync and AI ready.`
        : "Signed in with Google. Drive sync and AI ready.")
    : hasGoogleGrant()
      ? "Google session expired. Reconnecting automatically..."
      : getGoogleClientId()
        ? "Ready to connect Google."
        : "Production OAuth client is not available.";
  googleSignInButton.disabled = Boolean(googleAuth.accessToken);
  // Sync/Restore stay available whenever an OAuth client is configured: clicking them will
  // silently refresh (or prompt) the Google session as needed, so the user never has to manually
  // re-sign-in first.
  const canSync = Boolean(getGoogleClientId());
  googleSyncNowButton.disabled = !canSync;
  googleRestoreButton.disabled = !canSync;
  googleSignOutButton.disabled = !(googleAuth.accessToken || hasGoogleGrant());
  themeSelect.value = theme;
  renderFontZoomControls();
  void listCheckpoints().then(([latest]) => {
    rollbackCheckpointButton.disabled = !latest;
    if (latest && !checkpointStatus.textContent) {
      checkpointStatus.textContent = `Latest checkpoint: ${latest.createdAt}, ${latest.integrity?.vocabularyCount ?? 0} words.`;
    }
  });
}

function applyTheme(nextTheme) {
  theme = THEME_IDS.includes(nextTheme) ? nextTheme : DEFAULT_THEME;
  document.documentElement.dataset.theme = theme;
}

function normalizeFontScale(nextScale) {
  const numeric = Number(nextScale);
  if (!Number.isFinite(numeric)) return DEFAULT_FONT_SCALE;
  return Math.round(clamp(numeric, FONT_SCALE_MIN, FONT_SCALE_MAX) * 10) / 10;
}

function renderFontZoomControls() {
  if (!fontZoomValue) return;
  const percent = Math.round(fontScale * 100);
  fontZoomValue.textContent = `${percent}%`;
  fontZoomOutButton.disabled = fontScale <= FONT_SCALE_MIN;
  fontZoomInButton.disabled = fontScale >= FONT_SCALE_MAX;
}

function applyFontScale(nextScale) {
  fontScale = normalizeFontScale(nextScale);
  document.documentElement.style.setProperty("--app-font-size", `${Math.round(fontScale * 100)}%`);
  renderFontZoomControls();
}

function getGoogleClientId() {
  const override = String(googleClientIdOverride ?? "").trim();
  if (override) return override;
  return PRODUCTION_GOOGLE_CLIENT_ID;
}

async function promptForGoogleClientId() {
  const current = getGoogleClientId();
  const values = await showModal({
    title: "Google OAuth client ID override",
    body: "WordFan uses the production OAuth client by default. Paste another Web-application OAuth client ID only for sign-in diagnostics or local project testing.",
    helpLink: {
      label: "Open Google Cloud Console -> Credentials",
      url: "https://console.cloud.google.com/apis/credentials",
    },
    fields: [
      {
        id: "clientId",
        label: "OAuth client ID",
        type: "text",
        value: current,
        placeholder: "1234567890-abc...apps.googleusercontent.com",
        hint: "For an override, add this app origin as an Authorized JavaScript origin on that OAuth client.",
        required: true,
      },
    ],
    submitText: "Save override",
    cancelText: "Cancel",
  });
  if (!values?.clientId) return null;
  const cleaned = String(values.clientId).trim();
  googleClientIdOverride = cleaned;
  await saveValue("googleClientIdOverride", cleaned);
  return cleaned;
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
  const removedSpelling = spellingItems.filter((item) => item.debugSessionId === sessionId);
  const removedSpellingEvents = spellingEvents.filter((event) => event.debugSessionId === sessionId);
  vocabularyItems = vocabularyItems.filter((item) => !item.debugSessionId || item.debugSessionId !== sessionId);
  studyEvents = studyEvents.filter((event) => !event.debugSessionId || event.debugSessionId !== sessionId);
  spellingItems = spellingItems.filter((item) => !item.debugSessionId || item.debugSessionId !== sessionId);
  spellingEvents = spellingEvents.filter((event) => !event.debugSessionId || event.debugSessionId !== sessionId);
  historyItems = historyItems.filter((item) => !item.debugSessionId || item.debugSessionId !== sessionId);
  await Promise.all(removedVocabulary.map((item) => deleteVocabularyRecord(item)));
  await Promise.all(removedEvents.map((event) => deleteRecordValue(STUDY_EVENT_STORE, event.id)));
  await Promise.all(removedSpelling.map((item) => deleteSpellingRecord(item)));
  await Promise.all(removedSpellingEvents.map((event) => deleteRecordValue(SPELLING_EVENT_STORE, event.id)));
  await persistVocabulary();
  await persistStudyEvents();
  await persistSpelling();
  await persistSpellingEvents();
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
    ? "For long-term offline use on iPhone, add WordFan to the Home Screen from Safari after the dictionary is installed."
    : "For iPhone offline install, open this address in Safari, then add WordFan to the Home Screen.";
}

function renderHistory() {
  historyList.innerHTML = historyItems.length
    ? historyItems
        .map((item) => `<li><button type="button" data-term="${escapeHtml(item.term)}">${escapeHtml(item.term)}</button></li>`)
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
    const typed = (data.term ?? "").trim();
    const normalizedTyped = typed ? normalizeTerm(typed) : "";
    const canSaveAnyway = Boolean(normalizedTyped) && TERM_RE.test(normalizedTyped);
    result.innerHTML = `
      <p class="muted">This word does not match any dictionary words.</p>
      ${data.alternatives?.length ? renderResultList(data.alternatives, "Closest matches") : ""}
      ${canSaveAnyway ? `
        <div class="result-actions">
          <button id="saveUnknownTerm" type="button" data-typed-term="${escapeHtml(typed)}">Save anyway with my own meaning</button>
          <button id="addToDictionary" class="secondary-button" type="button" data-typed-term="${escapeHtml(typed)}">Add to dictionary</button>
        </div>
      ` : ""}
    `;
    return;
  }
  if (data.status === "chinese_results") {
    currentResult = null;
    scheduleAutosave(null);
    result.innerHTML = `
      <p class="muted">Chinese to English matches for <strong>${escapeHtml(data.term)}</strong>.</p>
      ${renderResultList(data.matches, "English candidates")}
    `;
    return;
  }
  currentResult = data;
  const vocabularyItem = getVocabularyItem(data.term);
  const isActiveSaved = Boolean(vocabularyItem && !vocabularyItem.archivedAt);
  const spellingItem = getSpellingItem(data.term);
  const isInSpelling = Boolean(spellingItem && !spellingItem.archivedAt);
  result.innerHTML = `
    <div class="result-head">
      <div class="result-title-row">
        <h2>${escapeHtml(data.term)}</h2>
        ${data.phonetic ? `<span class="word-ipa">${escapeHtml(data.phonetic)}</span>` : ""}
        ${renderSpeakerButton(data.term)}
        ${renderAiChatButton(data.term)}
      </div>
      <p class="result-entry-type">${escapeHtml(data.entryType)}</p>
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
      <button id="addToSpelling" class="secondary-button" type="button" ${isInSpelling ? "disabled" : ""}>${isInSpelling ? "In spelling list" : "Add to spelling list"}</button>
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

// Wrap fetch with an abort timeout so an offline iOS request that never settles
// cannot hang the dictionary load (the request rejects and we fall back to the local copy).
async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Download the dictionary in a single request and verify its integrity BEFORE it is stored.
// (A previous chunked Range download corrupted the file on CDNs that honor 206 responses, e.g.
// GitHub Pages — the local test server only returns 200, so it went unnoticed. Single GET +
// checksum is simple and robust.)
async function downloadDictionaryFile(url, expected) {
  const storageCheck = await checkStorageBeforeInstall(Number(expected?.bytes) || DICTIONARY_ESTIMATED_BYTES);
  if (!storageCheck.ok) throw new Error(storageCheck.message);
  if (storageCheck.warning) result.innerHTML = `<p class="muted">${escapeHtml(storageCheck.warning)}</p>`;
  result.innerHTML = `<p class="muted">Downloading dictionary (one-time)…</p>`;
  const response = await fetchWithTimeout(url, { cache: "no-store" }, 120000);
  if (!response.ok) throw new Error(`Dictionary fetch failed: ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  await verifyDictionaryBytes(bytes, expected);
  return bytes;
}

// Validate downloaded bytes against the manifest (length + SHA-256) so a truncated/corrupted
// transfer is rejected instead of being saved and later failing to open ("malformed").
async function verifyDictionaryBytes(bytes, expected) {
  if (!expected) return;
  if (expected.bytes && bytes.byteLength !== Number(expected.bytes)) {
    throw new Error(`Dictionary download size mismatch (got ${bytes.byteLength}, expected ${expected.bytes}).`);
  }
  if (expected.sha256 && crypto?.subtle?.digest) {
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
    if (hex !== String(expected.sha256).toLowerCase()) {
      throw new Error("Dictionary download checksum mismatch (corrupt transfer).");
    }
  }
}

// Open + sanity-check a SQLite buffer. A corrupt buffer throws here ("database disk image is
// malformed"), which the caller uses to discard the bad copy and re-download.
async function openDictionaryFromBytes(bytes) {
  SQL ??= await initSqlJs({ locateFile: (file) => `/vendor/${file}` });
  dictionaryDb?.close();
  dictionaryDb = new SQL.Database(bytes);
  ftsSearchAvailable = null;
  return dictionaryDb.exec("SELECT count(*) AS count FROM dictionary_entries")[0].values[0][0];
}

async function fetchRemoteDictionaryManifest() {
  if (!navigator.onLine) return null;
  try {
    const response = await fetchWithTimeout(DICTIONARY_MANIFEST_URL, { cache: "no-store" }, 6000);
    if (!response.ok) return null;
    const manifest = await response.json();
    if (!manifest || typeof manifest.dictionaryDataVersion !== "string") return null;
    return manifest;
  } catch {
    return null;
  }
}

async function invalidateLocalDictionaryCopy() {
  await deleteRawValue(FILE_STORE, DICTIONARY_KEY).catch(() => {});
  if (navigator.storage?.getDirectory) {
    try {
      const root = await navigator.storage.getDirectory();
      await root.removeEntry(DICTIONARY_KEY).catch(() => {});
    } catch {
      /* ignore */
    }
  }
  const oldProgress = await loadRawValue(FILE_STORE, DICTIONARY_PROGRESS_KEY, null).catch(() => null);
  if (oldProgress?.totalBytes && oldProgress?.chunkSize) {
    const oldChunkCount = Math.ceil(oldProgress.totalBytes / oldProgress.chunkSize);
    await cleanupDictionaryChunks(oldChunkCount).catch(() => {});
  } else {
    await deleteRawValue(FILE_STORE, DICTIONARY_PROGRESS_KEY).catch(() => {});
  }
}

async function loadLocalDictionaryBytes() {
  return (await loadOpfsFile(DICTIONARY_KEY)) ?? (await loadFile(DICTIONARY_KEY));
}

async function loadDictionary() {
  const start = performance.now();
  const hasLocalCopy = await hasInstalledDictionary();
  // Best-effort, time-boxed update check. Skipped entirely when offline so a never-settling
  // request can't block loading the installed copy (the iOS offline-hang bug).
  const remoteManifest = await fetchRemoteDictionaryManifest();
  const localVersion = await loadValue(DICTIONARY_VERSION_KEY, null);
  const remoteVersion = remoteManifest?.dictionaryDataVersion ?? null;
  const versionChanged = Boolean(remoteVersion && localVersion && remoteVersion !== localVersion);

  let bytes = null;
  let count = null;
  let source = "offline copy";
  let fetchedMs = null;

  // 1) Local-first: open the installed copy directly (instant + offline-safe) unless a new
  // version is available. If it is corrupt, discard it and fall through to a fresh download.
  if (hasLocalCopy && !versionChanged) {
    const local = await loadLocalDictionaryBytes();
    if (local) {
      try {
        fetchedMs = performance.now();
        count = await openDictionaryFromBytes(local);
        bytes = local;
      } catch (error) {
        console.warn("Local dictionary is unreadable; re-downloading.", error);
        await invalidateLocalDictionaryCopy();
        await saveValue("dictionaryInstalled", false);
      }
    }
  }

  // 2) Download a fresh, verified copy (first install / version change / corrupt local copy).
  if (!bytes) {
    if (versionChanged) {
      result.innerHTML = `<p class="muted">Dictionary update detected (${escapeHtml(localVersion)} -> ${escapeHtml(remoteVersion)}). Replacing local copy.</p>`;
      await invalidateLocalDictionaryCopy();
      await saveValue("dictionaryInstalled", false);
    }
    let downloaded = null;
    try {
      downloaded = await downloadDictionaryFile("/dictionary.sqlite", remoteManifest?.sqlite ?? null);
    } catch (error) {
      // Network/integrity failure → fall back to any already-installed local copy.
      const local = await loadLocalDictionaryBytes();
      if (!local) {
        throw new Error(`Dictionary is unavailable online and no offline copy is installed yet. Connect to the internet to install it. ${error instanceof Error ? error.message : String(error)}`);
      }
      fetchedMs = performance.now();
      count = await openDictionaryFromBytes(local);
      bytes = local;
      source = "offline copy after failed download";
    }
    if (downloaded) {
      fetchedMs = performance.now();
      try {
        count = await openDictionaryFromBytes(downloaded);
      } catch (error) {
        // Downloaded bytes are unreadable — do not keep a bad copy.
        await invalidateLocalDictionaryCopy();
        await saveValue("dictionaryInstalled", false);
        throw new Error(`The dictionary could not be opened after download (it may be corrupt). Reload to retry. ${error instanceof Error ? error.message : String(error)}`);
      }
      // Persist only AFTER it opened cleanly.
      bytes = downloaded;
      source = "network";
      await saveFile(DICTIONARY_KEY, downloaded);
      await saveOpfsFile(DICTIONARY_KEY, downloaded);
      await saveValue("dictionaryInstalled", true);
      if (remoteVersion) await saveValue(DICTIONARY_VERSION_KEY, remoteVersion);
    }
  }

  const now = performance.now();
  lastMetrics = {
    fetchMs: (fetchedMs ?? now) - start,
    initMs: 0,
    openMs: now - (fetchedMs ?? now),
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
  // User dictionary overlay: words the user added themselves resolve without the sql.js DB.
  const userEntry = getUserDictionaryEntry(input);
  if (userEntry) return userDictionaryToResult(userEntry);
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
  return serializeFsrsCard(reviveFsrsCard(null, now));
}

function fallbackReviewDueAt(review = {}) {
  const existingDue = review.dueAt ?? review.fsrsCard?.due;
  if (existingDue && Number.isFinite(Date.parse(existingDue))) return existingDue;
  if (review.masteredAt || review.fsrsCard?.state === "mastered") {
    const basis = Date.parse(review.lastReviewedAt ?? review.masteredAt ?? nowIso());
    const preferred = Number.isFinite(basis) ? basis + 90 * NORMAL_DAY_MS : 0;
    const future = Math.max(preferred, appNowMs() + NORMAL_DAY_MS);
    return new Date(future).toISOString();
  }
  return nowIso();
}

function normalizeReviewState(review = {}) {
  const rawCard = review.fsrsCard && typeof review.fsrsCard === "object" ? { ...review.fsrsCard } : review.fsrsCard;
  if (rawCard && review.dueAt) rawCard.due = review.dueAt;
  const fsrsCard = serializeFsrsCard(reviveFsrsCard(rawCard, fallbackReviewDueAt(review)));
  return {
    ...review,
    lastRating: review.lastRating ?? "again",
    intervalDays: review.intervalDays ?? fsrsCard.scheduled_days ?? 0,
    dueAt: fsrsCard.due,
    reviewCount: review.reviewCount ?? 0,
    lastReviewedAt: review.lastReviewedAt ?? null,
    masteredAt: review.masteredAt ?? null,
    fsrsCard,
  };
}

function mergeVocabularySources(recordItems, legacyItems) {
  const byTerm = new Map();
  for (const item of [...(legacyItems ?? []), ...(recordItems ?? [])]) {
    if (!item?.term) continue;
    const normalizedTerm = item.normalizedTerm ?? normalizeTerm(item.term);
    const normalizedItem = {
      ...item,
      normalizedTerm,
      review: normalizeReviewState(item.review ?? { dueAt: item.savedAt ?? nowIso() }),
    };
    const existing = byTerm.get(normalizedTerm);
    if (!existing) {
      byTerm.set(normalizedTerm, normalizedItem);
      continue;
    }
    const existingUpdated = Date.parse(existing.updatedAt ?? existing.savedAt ?? 0) || 0;
    const incomingUpdated = Date.parse(normalizedItem.updatedAt ?? normalizedItem.savedAt ?? 0) || 0;
    byTerm.set(normalizedTerm, incomingUpdated >= existingUpdated ? { ...existing, ...normalizedItem } : { ...normalizedItem, ...existing });
  }
  return [...byTerm.values()].sort((left, right) => (right.savedAt ?? "").localeCompare(left.savedAt ?? ""));
}

function mergeStudyEventSources(recordEvents, legacyEvents) {
  const byId = new Map();
  for (const event of [...(legacyEvents ?? []), ...(recordEvents ?? [])]) {
    if (!event) continue;
    const id = event.id ?? `${event.type ?? "event"}-${event.normalizedTerm ?? event.term ?? "unknown"}-${event.occurredAt ?? nowIso()}`;
    byId.set(id, { ...event, id });
  }
  return [...byId.values()].sort((left, right) => (left.occurredAt ?? "").localeCompare(right.occurredAt ?? ""));
}

function mergeHistoryItems(localItems, remoteItems) {
  const byTerm = new Map();
  const timeOf = (item) => Date.parse(item?.queriedAt ?? item?.searchedAt ?? 0) || 0;
  for (const item of [...(remoteItems ?? []), ...(localItems ?? [])]) {
    if (!item?.term) continue;
    const at = item.queriedAt ?? item.searchedAt ?? null;
    const normalizedItem = at ? { ...item, queriedAt: item.queriedAt ?? at, searchedAt: item.searchedAt ?? at } : item;
    const existing = byTerm.get(item.term);
    if (!existing) {
      byTerm.set(item.term, normalizedItem);
      continue;
    }
    if (timeOf(normalizedItem) >= timeOf(existing)) byTerm.set(item.term, normalizedItem);
  }
  return [...byTerm.values()]
    .sort((left, right) => timeOf(right) - timeOf(left))
    .slice(0, 10);
}

function mergeKnownSources(localKnown, remoteKnown, activeTerms = new Set()) {
  const byTerm = new Map();
  for (const record of [...(remoteKnown ?? []), ...(localKnown ?? [])]) {
    if (!record?.term && !record?.normalizedTerm) continue;
    const normalizedTerm = record.normalizedTerm ?? normalizeTerm(record.term);
    if (!normalizedTerm || activeTerms.has(normalizedTerm)) continue;
    const knownAt = record.knownAt ?? record.updatedAt ?? nowIso();
    const incoming = {
      ...record,
      term: record.term ?? normalizedTerm,
      normalizedTerm,
      knownAt,
      updatedAt: record.updatedAt ?? knownAt,
      source: record.source ?? "study-one-more",
    };
    const existing = byTerm.get(normalizedTerm);
    if (!existing) {
      byTerm.set(normalizedTerm, incoming);
      continue;
    }
    const existingUpdated = Date.parse(existing.updatedAt ?? existing.knownAt ?? 0) || 0;
    const incomingUpdated = Date.parse(incoming.updatedAt ?? incoming.knownAt ?? 0) || 0;
    byTerm.set(normalizedTerm, incomingUpdated >= existingUpdated ? { ...existing, ...incoming } : { ...incoming, ...existing });
  }
  return [...byTerm.values()].sort((left, right) => (right.knownAt ?? "").localeCompare(left.knownAt ?? ""));
}

function activeStudyTermsFromItems(vocabulary = [], spelling = []) {
  const terms = new Set();
  for (const item of [...(vocabulary ?? []), ...(spelling ?? [])]) {
    if (item?.normalizedTerm && !item.archivedAt) terms.add(item.normalizedTerm);
  }
  return terms;
}

function rebuildReviewStateFromEvents(item, events = []) {
  const normalizedTerm = item?.normalizedTerm ?? normalizeTerm(item?.term ?? "");
  if (!normalizedTerm) return normalizeReviewState(item?.review ?? { dueAt: item?.savedAt ?? nowIso() });
  const reviewEvents = (events ?? [])
    .filter((event) => event?.type === "review" && event.normalizedTerm === normalizedTerm && event.rating && event.occurredAt)
    .slice()
    .sort((left, right) => (left.occurredAt ?? "").localeCompare(right.occurredAt ?? ""));
  if (!reviewEvents.length) return normalizeReviewState(item?.review ?? { dueAt: item?.savedAt ?? nowIso() });

  const createdAt = item?.savedAt ?? reviewEvents[0].occurredAt ?? nowIso();
  let review = normalizeReviewState({
    dueAt: createdAt,
    fsrsCard: createFsrsCard(createdAt),
  });
  for (const event of reviewEvents) {
    if (!isValidFsrsRating(event.rating)) {
      console.warn(`Skipping invalid FSRS review rating for "${normalizedTerm}": ${event.rating}`);
      continue;
    }
    const schedule = scheduleWithFsrs(review, event.rating, event.occurredAt);
    review = {
      ...review,
      lastRating: event.rating,
      intervalDays: schedule.intervalDays,
      dueAt: schedule.dueAt,
      masteredAt: schedule.masteredAt,
      lastReviewedAt: event.occurredAt,
      reviewCount: (review.reviewCount ?? 0) + 1,
      fsrsCard: schedule.fsrsCard,
    };
  }
  return normalizeReviewState(review);
}

function rebuildItemsReviewStateFromEvents(items = [], events = []) {
  return (items ?? []).map((item) => ({
    ...item,
    review: rebuildReviewStateFromEvents(item, events),
  }));
}

function mergeSnapshots(localSnapshot, remoteSnapshot) {
  const localUpdated = Date.parse(localSnapshot?.exportedAt ?? 0) || 0;
  const remoteUpdated = Date.parse(remoteSnapshot?.exportedAt ?? 0) || 0;
  const newer = remoteUpdated > localUpdated ? remoteSnapshot : localSnapshot;
  const mergedStudyEvents = mergeStudyEventSources(
    localSnapshot.studyEvents ?? [],
    remoteSnapshot?.studyEvents ?? [],
  );
  const mergedSpellingEvents = mergeStudyEventSources(
    localSnapshot.spellingEvents ?? [],
    remoteSnapshot?.spellingEvents ?? [],
  );
  const mergedVocabularyItems = rebuildItemsReviewStateFromEvents(mergeVocabularySources(
    localSnapshot.vocabularyItems ?? [],
    remoteSnapshot?.vocabularyItems ?? [],
  ), mergedStudyEvents);
  const mergedSpellingItems = rebuildItemsReviewStateFromEvents(mergeVocabularySources(
    localSnapshot.spellingItems ?? [],
    remoteSnapshot?.spellingItems ?? [],
  ), mergedSpellingEvents);
  const mergedKnownWords = mergeKnownSources(
    localSnapshot.knownWords ?? [],
    remoteSnapshot?.knownWords ?? [],
    activeStudyTermsFromItems(mergedVocabularyItems, mergedSpellingItems),
  );
  return {
    app: "wordlover",
    appVersion: localSnapshot.appVersion,
    userDataFormatVersion: localSnapshot.userDataFormatVersion,
    exportedAt: nowIso(),
    profile: localSnapshot.profile ?? remoteSnapshot?.profile ?? null,
    historyItems: mergeHistoryItems(localSnapshot.historyItems, remoteSnapshot?.historyItems),
    vocabularyItems: mergedVocabularyItems,
    studyEvents: mergedStudyEvents,
    spellingItems: mergedSpellingItems,
    spellingEvents: mergedSpellingEvents,
    userDictionary: mergeUserDictionarySources(
      localSnapshot.userDictionary ?? [],
      remoteSnapshot?.userDictionary ?? [],
    ),
    knownWords: mergedKnownWords,
    autosaveEnabled: newer.autosaveEnabled ?? localSnapshot.autosaveEnabled ?? true,
    onReturnAction: newer.onReturnAction ?? localSnapshot.onReturnAction ?? (newer.autosaveEnabled === false ? "none" : "vocabulary"),
    speakOnReturn: newer.speakOnReturn ?? localSnapshot.speakOnReturn ?? false,
    theme: newer.theme ?? localSnapshot.theme,
    uiPreferences: newer.uiPreferences ?? localSnapshot.uiPreferences ?? null,
    studyGoals: newer.studyGoals ?? localSnapshot.studyGoals ?? null,
    lastMetrics: newer.lastMetrics ?? localSnapshot.lastMetrics,
  };
}

function mergeUserDictionarySources(localEntries, remoteEntries) {
  const byTerm = new Map();
  for (const entry of [...(remoteEntries ?? []), ...(localEntries ?? [])]) {
    if (!entry?.normalizedTerm && !entry?.word) continue;
    const normalizedTerm = entry.normalizedTerm ?? normalizeTerm(entry.word);
    const incoming = { ...entry, normalizedTerm };
    const existing = byTerm.get(normalizedTerm);
    if (!existing) {
      byTerm.set(normalizedTerm, incoming);
      continue;
    }
    const existingUpdated = Date.parse(existing.updatedAt ?? existing.createdAt ?? 0) || 0;
    const incomingUpdated = Date.parse(incoming.updatedAt ?? incoming.createdAt ?? 0) || 0;
    byTerm.set(normalizedTerm, incomingUpdated >= existingUpdated ? incoming : existing);
  }
  return [...byTerm.values()];
}

async function persistVocabulary() {
  await Promise.all(vocabularyItems.map((item) => saveRecordValue(VOCABULARY_STORE, item.normalizedTerm, item)));
  renderVocabulary();
  renderStudyStats();
  renderHistoryChart();
}

async function persistVocabularyItem(item) {
  await saveRecordValue(VOCABULARY_STORE, item.normalizedTerm, item);
  renderVocabulary();
  renderStudyStats();
  renderHistoryChart();
}

async function deleteVocabularyRecord(item) {
  await deleteRecordValue(VOCABULARY_STORE, item.normalizedTerm);
}

async function persistStudyEvent(event) {
  await saveRecordValue(STUDY_EVENT_STORE, event.id, event);
  renderStudyStats();
}

async function saveReviewItemAndEvent({ itemStore, eventStore, itemKey, item, event }) {
  assertUserDataWritable(`Saving review for "${itemKey}"`);
  const encryptedItem = await encryptValue(item);
  const encryptedEvent = await encryptValue(event);
  const db = await getUserDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction([itemStore, eventStore], "readwrite");
    tx.objectStore(itemStore).put(encryptedItem, itemKey);
    tx.objectStore(eventStore).put(encryptedEvent, event.id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("Review transaction aborted."));
  });
}

// --- Spelling track persistence (mirrors the vocabulary track) ---
async function persistSpelling() {
  await Promise.all(spellingItems.map((item) => saveRecordValue(SPELLING_STORE, item.normalizedTerm, item)));
  renderSpellingViews();
}

async function persistSpellingItem(item) {
  await saveRecordValue(SPELLING_STORE, item.normalizedTerm, item);
  renderSpellingViews();
}

async function deleteSpellingRecord(item) {
  await deleteRecordValue(SPELLING_STORE, item.normalizedTerm);
}

// Hard-remove a word from a list (used by the "Undo" affordance right after a save).
async function removeVocabularyItemHard(term) {
  const item = getVocabularyItem(term);
  if (!item) return;
  vocabularyItems = vocabularyItems.filter((candidate) => candidate.normalizedTerm !== item.normalizedTerm);
  await deleteVocabularyRecord(item);
  renderVocabulary();
  renderStudyStats();
  renderHistoryChart();
  if (currentResult && normalizeTerm(currentResult.term) === item.normalizedTerm) renderResult(currentResult);
}

async function removeSpellingItemHard(term) {
  const item = getSpellingItem(term);
  if (!item) return;
  spellingItems = spellingItems.filter((candidate) => candidate.normalizedTerm !== item.normalizedTerm);
  await deleteSpellingRecord(item);
  renderSpellingViews();
  if (currentResult && normalizeTerm(currentResult.term) === item.normalizedTerm) renderResult(currentResult);
}

async function persistSpellingEvent(event) {
  await saveRecordValue(SPELLING_EVENT_STORE, event.id, event);
  renderSpellingViews();
}

async function persistSpellingEvents() {
  await Promise.all(spellingEvents.map((event) => saveRecordValue(SPELLING_EVENT_STORE, event.id, event)));
  renderSpellingViews();
}

// Re-render every spelling-aware surface after spelling data changes.
function renderSpellingViews() {
  renderStudyStats();
  renderVocabulary();
  renderHistoryChart();
}

function getSpellingItem(term) {
  const normalizedTerm = normalizeTerm(term);
  return spellingItems.find((item) => item.normalizedTerm === normalizedTerm) ?? null;
}

// --- User dictionary (additive overlay on the read-only sql.js dictionary) ---
async function persistUserDictionaryEntry(entry) {
  await saveRecordValue(USER_DICTIONARY_STORE, entry.normalizedTerm, entry);
}

async function persistKnownWord(record) {
  await saveRecordValue(KNOWN_STORE, record.normalizedTerm, record);
  renderStudyStats();
  renderHistoryChart();
}

async function deleteKnownWord(normalizedTerm) {
  if (!normalizedTerm) return;
  const before = knownWords.length;
  knownWords = knownWords.filter((record) => record.normalizedTerm !== normalizedTerm);
  if (knownWords.length !== before) {
    await deleteRecordValue(KNOWN_STORE, normalizedTerm);
    renderStudyStats();
    renderHistoryChart();
  }
}

function getUserDictionaryEntry(term) {
  const normalizedTerm = normalizeTerm(term);
  return userDictionaryEntries.find((entry) => entry.normalizedTerm === normalizedTerm) ?? null;
}

function userDictionaryToResult(entry, queryMs = 0) {
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

function resultToTrackItem(data) {
  // Spelling items share the vocabulary item shape so all FSRS/stat helpers work unchanged.
  return resultToVocabularyItem(data);
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
  await deleteKnownWord(normalizedTerm);
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
  prefetchAiChat(data.term);
  return getVocabularyItem(data.term);
}

// Add a dictionary (or user-dictionary) word to the separate spelling list.
async function saveSpellingItem(data, reason = "manual") {
  if (!data || data.status !== "found") return null;
  await getDeviceId();
  const normalizedTerm = normalizeTerm(data.term);
  await deleteKnownWord(normalizedTerm);
  const existing = getSpellingItem(data.term);
  const now = nowIso();
  if (existing) {
    existing.archivedAt = null;
    existing.updatedAt = now;
    existing.syncVersion = (existing.syncVersion ?? 0) + 1;
    existing.isSynced = false;
    existing.lastSaveReason = reason;
    existing.review = normalizeReviewState(existing.review ?? { dueAt: now });
  } else {
    const item = resultToTrackItem(data);
    item.lastSaveReason = reason;
    spellingItems = [item, ...spellingItems];
  }
  spellingItems = spellingItems
    .filter((item, index, all) => all.findIndex((candidate) => candidate.normalizedTerm === item.normalizedTerm) === index)
    .sort((left, right) => (right.savedAt ?? "").localeCompare(left.savedAt ?? ""));
  await persistSpelling();
  if (currentResult && normalizeTerm(currentResult.term) === normalizedTerm) renderResult(currentResult);
  return getSpellingItem(data.term);
}

async function showUnknownTermDialog(typedTerm) {
  const initial = (typedTerm ?? "").trim();
  const values = await showModal({
    title: "Save term without dictionary match?",
    body: "WordFan did not find an exact match. You can save anyway, edit the term, or cancel. Provide at least one meaning before saving.",
    fields: [
      { id: "term", label: "Term", value: initial, required: true, hint: "Letters, spaces, hyphens, apostrophes; up to 6 words." },
      { id: "english", label: "English meaning", type: "textarea", rows: 2, hint: "Use semicolons to separate multiple meanings.", value: "" },
      { id: "chinese", label: "Chinese meaning", type: "textarea", rows: 2, hint: "Use semicolons to separate multiple meanings.", value: "" },
      { id: "phonetic", label: "Pronunciation / IPA (optional)", value: "" },
    ],
    submitText: "Save anyway",
    cancelText: "Cancel",
  });
  if (!values) return null;
  const term = values.term.trim();
  const normalizedTerm = normalizeTerm(term);
  if (!normalizedTerm || !TERM_RE.test(normalizedTerm)) {
    await showModal({
      title: "Term cannot be saved",
      body: "The term must use English letters, spaces, hyphens, or apostrophes, and be no more than 6 words.",
      submitText: "OK",
      allowCancel: false,
    });
    return null;
  }
  const existing = getVocabularyItem(term);
  if (existing && !existing.archivedAt) {
    await showModal({
      title: "Already saved",
      body: `"${term}" is already in your vocabulary list. Edit it from the Word Lists panel instead.`,
      submitText: "OK",
      allowCancel: false,
    });
    return existing;
  }
  const english = values.english.split(";").map((line) => line.trim()).filter(Boolean);
  const chinese = values.chinese.split(";").map((line) => line.trim()).filter(Boolean);
  if (!english.length && !chinese.length) {
    await showModal({
      title: "At least one meaning is required",
      body: "Add an English or Chinese meaning before saving an unknown term.",
      submitText: "OK",
      allowCancel: false,
    });
    return null;
  }
  return saveManualVocabularyItem({
    term,
    normalizedTerm,
    english,
    chinese,
    phonetic: values.phonetic.trim(),
  });
}

// Add a brand-new word to the additive user dictionary (must not already exist in the dictionary).
async function showAddToDictionaryDialog(typedTerm) {
  const initial = (typedTerm ?? "").trim();
  const values = await showModal({
    title: "Add a word to the dictionary",
    body: "Add a new word so it becomes searchable and eligible for the spelling list. The word must not already exist in the dictionary.",
    fields: [
      { id: "term", label: "Word", value: initial, required: true, hint: "Letters, spaces, hyphens, apostrophes; up to 6 words." },
      { id: "phonetic", label: "Pronunciation / IPA (optional)", value: "" },
      { id: "english", label: "English meaning", type: "textarea", rows: 2, hint: "Use semicolons to separate multiple meanings.", value: "", required: true },
      { id: "chinese", label: "Chinese meaning", type: "textarea", rows: 2, hint: "Use semicolons to separate multiple meanings.", value: "" },
    ],
    submitText: "Add to dictionary",
    cancelText: "Cancel",
  });
  if (!values) return null;
  const term = values.term.trim();
  const normalizedTerm = normalizeTerm(term);
  if (!normalizedTerm || !TERM_RE.test(normalizedTerm)) {
    await showModal({ title: "Word cannot be added", body: "Use English letters, spaces, hyphens, or apostrophes, up to 6 words.", submitText: "OK", allowCancel: false });
    return null;
  }
  // Reject words that already exist (shipped dictionary or user dictionary).
  if (getUserDictionaryEntry(term) || (loaded && lookupTerm(term)?.status === "found")) {
    await showModal({ title: "Word already exists", body: `"${term}" is already in the dictionary. Search it directly.`, submitText: "OK", allowCancel: false });
    return null;
  }
  const english = values.english.split(";").map((line) => line.trim()).filter(Boolean);
  const chinese = values.chinese.split(";").map((line) => line.trim()).filter(Boolean);
  if (!english.length) {
    await showModal({ title: "English meaning required", body: "Add at least one English meaning.", submitText: "OK", allowCancel: false });
    return null;
  }
  const now = nowIso();
  const entry = {
    normalizedTerm,
    word: term,
    phonetic: values.phonetic.trim(),
    englishMeanings: english,
    chineseMeanings: chinese,
    createdAt: now,
    updatedAt: now,
    syncVersion: 1,
  };
  userDictionaryEntries = [entry, ...userDictionaryEntries.filter((e) => e.normalizedTerm !== normalizedTerm)];
  await persistUserDictionaryEntry(entry);
  // Show the freshly added word as a normal result.
  termInput.value = term;
  renderResult(userDictionaryToResult(entry));
  return entry;
}

async function saveManualVocabularyItem({ term, normalizedTerm, english, chinese, phonetic }) {
  await getDeviceId();
  const now = nowIso();
  const existing = getVocabularyItem(term);
  if (existing) {
    existing.archivedAt = null;
    existing.updatedAt = now;
    existing.user = {
      phonetic: phonetic ?? existing.user?.phonetic ?? "",
      englishMeanings: english.length ? english : existing.user?.englishMeanings ?? [],
      chineseMeanings: chinese.length ? chinese : existing.user?.chineseMeanings ?? [],
    };
    existing.syncVersion = (existing.syncVersion ?? 0) + 1;
    existing.isSynced = false;
    existing.lastSaveReason = "manual-unknown";
    existing.review = normalizeReviewState(existing.review ?? { dueAt: now });
  } else {
    const item = markDebugRecord({
      id: normalizedTerm,
      term,
      normalizedTerm,
      entryType: term.includes(" ") ? "phrase" : "word",
      savedAt: now,
      updatedAt: now,
      archivedAt: null,
      original: {
        phonetic: phonetic ?? "",
        englishMeanings: english,
        englishMeaningSource: "user_edited",
        chineseMeanings: chinese,
        tags: [],
      },
      user: {
        phonetic: phonetic ?? "",
        englishMeanings: english,
        chineseMeanings: chinese,
      },
      createdDeviceId: deviceId,
      syncVersion: 1,
      isSynced: false,
      lastSaveReason: "manual-unknown",
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
    vocabularyItems = [item, ...vocabularyItems];
  }
  vocabularyItems = vocabularyItems
    .filter((item, index, all) => all.findIndex((candidate) => candidate.normalizedTerm === item.normalizedTerm) === index)
    .sort((left, right) => (right.savedAt ?? "").localeCompare(left.savedAt ?? ""));
  await persistVocabulary();
  renderStudyStats();
  return getVocabularyItem(term);
}

// Dwell-based autosave was replaced by the explicit "On Return" setting (see handleReturnKey).
// Kept as a no-op so existing call sites stay simple.
function scheduleAutosave() {
  window.clearTimeout(autosaveHandle);
}

async function editVocabularyItem(term) {
  return editVocabularyItemGeneric(getVocabularyItem(term), persistVocabularyItem);
}

async function editVocabularyItemGeneric(item, persistFn) {
  if (!item) return;
  const values = await showModal({
    title: `Edit ${item.term}`,
    body: "Use semicolons to separate multiple meanings.",
    fields: [
      { id: "english", label: "English meaning", value: summarizeLines(item.user.englishMeanings), required: true },
      { id: "chinese", label: "Chinese meaning", value: summarizeLines(item.user.chineseMeanings), required: true },
      { id: "phonetic", label: "Pronunciation / IPA", value: item.user.phonetic ?? "" },
    ],
    submitText: "Save",
  });
  if (!values) return;
  item.user.englishMeanings = values.english.split(";").map((line) => line.trim()).filter(Boolean);
  item.user.chineseMeanings = values.chinese.split(";").map((line) => line.trim()).filter(Boolean);
  item.user.phonetic = values.phonetic.trim();
  item.updatedAt = nowIso();
  item.syncVersion = (item.syncVersion ?? 0) + 1;
  item.isSynced = false;
  await persistFn(item);
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

async function setSpellingArchived(term, archived) {
  const item = getSpellingItem(term);
  if (!item) return;
  item.archivedAt = archived ? nowIso() : null;
  item.updatedAt = nowIso();
  item.syncVersion = (item.syncVersion ?? 0) + 1;
  item.isSynced = false;
  await persistSpellingItem(item);
  if (currentResult && normalizeTerm(currentResult.term) === item.normalizedTerm) renderResult(currentResult);
}

// Browser action wrappers route to the track currently shown in the vocabulary panel.
function archiveBrowserItem(term, archived) {
  return vocabularyView.track === "spelling" ? setSpellingArchived(term, archived) : setVocabularyArchived(term, archived);
}

async function editBrowserItem(term) {
  if (vocabularyView.track !== "spelling") return editVocabularyItem(term);
  // Spelling items inherit the dictionary meaning; offer a light edit of the user meaning hint.
  return editVocabularyItemGeneric(getSpellingItem(term), persistSpellingItem);
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

function renderSpeakerButton(term) {
  return `<button type="button" class="speaker-button" data-speak-term="${escapeHtml(term)}" aria-label="Pronounce ${escapeHtml(term)}" title="Pronounce">🔊</button>`;
}

function renderAiChatButton(term) {
  return `<button type="button" class="ai-chat-button" data-ai-chat-term="${escapeHtml(term)}" aria-label="AI Chat about ${escapeHtml(term)}" title="AI Chat">AI Chat</button>`;
}

function renderIpaWithSpeaker(term, phonetic) {
  if (!term) return renderIpa(phonetic);
  return `${renderIpa(phonetic)}${renderSpeakerButton(term)}${renderAiChatButton(term)}`;
}

// Pick the most natural-sounding installed English voice. getVoices() is
// populated asynchronously, so we refresh on the voiceschanged event too.
let preferredVoice = null;
function pickPreferredVoice() {
  if (typeof window.speechSynthesis === "undefined") return null;
  const voices = window.speechSynthesis.getVoices() ?? [];
  if (!voices.length) return null;
  const english = voices.filter((v) => /^en\b|^en[-_]/i.test(v.lang ?? ""));
  const pool = english.length ? english : voices;
  const score = (v) => {
    const name = (v.name ?? "").toLowerCase();
    let s = 0;
    if (/enhanced|premium|natural|neural/.test(name)) s += 6; // iOS "Enhanced" / high-quality variants
    if (/samantha|ava|allison|serena|nicky|aaron|karen|moira|tessa|google us english/.test(name)) s += 3;
    if (v.localService) s += 1; // local = offline + lower latency (iPhone-first)
    if (/^en[-_]us/i.test(v.lang ?? "")) s += 1;
    return s;
  };
  return pool.slice().sort((a, b) => score(b) - score(a))[0] ?? null;
}
function refreshPreferredVoice() {
  preferredVoice = pickPreferredVoice();
}
if (typeof window.speechSynthesis !== "undefined") {
  refreshPreferredVoice();
  window.speechSynthesis.addEventListener?.("voiceschanged", refreshPreferredVoice);
}

function speakTerm(term) {
  if (!term || typeof window.speechSynthesis === "undefined") return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(String(term));
    utterance.lang = "en-US";
    utterance.rate = 0.6; // ~1.5x slower than the previous 0.9 so each word is clearer
    utterance.pitch = 1.15; // slightly brighter/friendlier tone (best the Web Speech API can do)
    utterance.volume = 1;
    if (!preferredVoice) refreshPreferredVoice();
    if (preferredVoice) utterance.voice = preferredVoice;
    window.speechSynthesis.speak(utterance);
  } catch {
    /* speech synthesis not available */
  }
}

// The vocabulary browser is shared by the vocabulary and spelling tracks.
function activeBrowserItems() {
  return vocabularyView.track === "spelling" ? spellingItems : vocabularyItems;
}

function getBrowserItem(term) {
  return vocabularyView.track === "spelling" ? getSpellingItem(term) : getVocabularyItem(term);
}

function getVocabularyStats(items = activeBrowserItems()) {
  const active = items.filter((item) => !item.archivedAt);
  const archived = items.filter((item) => item.archivedAt);
  const counts = Object.fromEntries(FSRS_RATINGS.map((rating) => [rating, 0]));
  active.forEach((item) => {
    counts[getVocabularyRating(item)] += 1;
  });
  return { active, archived, counts };
}

function getVocabularyViewTitle(filter) {
  const label = vocabularyView.track === "spelling" ? "spelling words" : "memorize words";
  if (filter === "all") return `All ${label}`;
  if (FSRS_RATING_LABELS[filter]) return `${FSRS_RATING_LABELS[filter]} words`;
  return vocabularyView.track === "spelling" ? "Spelling words" : "Memorize words";
}

function vocabularyItemMatchesQuery(item, query) {
  if (!query) return true;
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;
  const haystackParts = [
    item.term,
    item.normalizedTerm,
    ...(item.user?.englishMeanings ?? []),
    ...(item.user?.chineseMeanings ?? []),
    ...(item.original?.englishMeanings ?? []),
    ...(item.original?.chineseMeanings ?? []),
    getVocabularyPhonetic(item),
  ];
  return haystackParts.some((value) => String(value ?? "").toLowerCase().includes(normalizedQuery));
}

function dateOnly(value) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isDateInRange(value, from, to) {
  if (!from && !to) return true;
  const date = dateOnly(value);
  if (!date) return false;
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

function parseOptionalCount(value) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function hasVocabularyAdvancedFilters(view = vocabularyView) {
  return Boolean(
    view.addedFrom ||
    view.addedTo ||
    view.reviewedFrom ||
    view.reviewedTo ||
    view.reviewCountMin !== "" ||
    view.reviewCountMax !== "",
  );
}

function vocabularyItemMatchesAdvancedFilters(item, view = vocabularyView) {
  if (!isDateInRange(item.savedAt, view.addedFrom, view.addedTo)) return false;
  if (!isDateInRange(item.review?.lastReviewedAt, view.reviewedFrom, view.reviewedTo)) return false;
  let min = parseOptionalCount(view.reviewCountMin);
  let max = parseOptionalCount(view.reviewCountMax);
  if (min !== null && max !== null && min > max) [min, max] = [max, min];
  const reviewCount = Number(item.review?.reviewCount ?? 0);
  if (min !== null && reviewCount < min) return false;
  if (max !== null && reviewCount > max) return false;
  return true;
}

function getVocabularyViewItems(filter, active, query = "", view = vocabularyView) {
  const filteredByStatus = filter === "all" ? active : active.filter((item) => getVocabularyRating(item) === filter);
  const filteredByQuery = query ? filteredByStatus.filter((item) => vocabularyItemMatchesQuery(item, query)) : filteredByStatus;
  const filteredByAdvanced = filteredByQuery.filter((item) => vocabularyItemMatchesAdvancedFilters(item, view));
  return [...filteredByAdvanced].sort((left, right) => {
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
    <div class="vocab-stats" aria-label="Memorize status counts">
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

function renderVocabularyFilter(query, mode = "summary") {
  const hasAdvanced = hasVocabularyAdvancedFilters();
  const hasText = Boolean(query.trim());
  return `
    <div class="vocab-filter-panel" data-vocab-filter-mode="${escapeHtml(mode)}">
      <label class="vocab-filter-field vocab-filter-search">
        <span>Filter</span>
        <div class="vocab-search-row">
          <input
            id="vocabSearchInput"
            type="search"
            autocomplete="off"
            placeholder="Search by word, meaning, or pronunciation"
            value="${escapeHtml(query)}"
            aria-label="Filter saved words"
          />
          ${hasText ? `<button class="secondary-button" type="button" data-action="vocab-clear-query">Clear</button>` : ""}
        </div>
      </label>
      <div class="vocab-filter-grid" aria-label="Word list filters">
        <fieldset class="vocab-filter-group">
          <legend>Added date</legend>
          <label>
            <span>From</span>
            <input id="vocabAddedFrom" type="date" value="${escapeHtml(vocabularyView.addedFrom)}" data-vocab-filter-key="addedFrom" />
          </label>
          <label>
            <span>To</span>
            <input id="vocabAddedTo" type="date" value="${escapeHtml(vocabularyView.addedTo)}" data-vocab-filter-key="addedTo" />
          </label>
        </fieldset>
        <fieldset class="vocab-filter-group">
          <legend>Last review/practice</legend>
          <label>
            <span>From</span>
            <input id="vocabReviewedFrom" type="date" value="${escapeHtml(vocabularyView.reviewedFrom)}" data-vocab-filter-key="reviewedFrom" />
          </label>
          <label>
            <span>To</span>
            <input id="vocabReviewedTo" type="date" value="${escapeHtml(vocabularyView.reviewedTo)}" data-vocab-filter-key="reviewedTo" />
          </label>
        </fieldset>
        <fieldset class="vocab-filter-group">
          <legend>Review times</legend>
          <label>
            <span>Min</span>
            <input id="vocabReviewCountMin" type="number" min="0" inputmode="numeric" value="${escapeHtml(vocabularyView.reviewCountMin)}" data-vocab-filter-key="reviewCountMin" />
          </label>
          <label>
            <span>Max</span>
            <input id="vocabReviewCountMax" type="number" min="0" inputmode="numeric" value="${escapeHtml(vocabularyView.reviewCountMax)}" data-vocab-filter-key="reviewCountMax" />
          </label>
        </fieldset>
      </div>
      ${hasAdvanced ? `<button class="secondary-button vocab-clear-filters" type="button" data-action="vocab-clear-advanced-filters">Clear date/count filters</button>` : ""}
    </div>
  `;
}

function renderVocabularyDetail(item) {
  const english = summarizeLines(item.user?.englishMeanings ?? item.original?.englishMeanings);
  const chinese = summarizeLines(item.user?.chineseMeanings ?? item.original?.chineseMeanings);
  const aiAssist = Array.isArray(item.aiAssist) ? item.aiAssist : [];
  const latestAi = aiAssist[aiAssist.length - 1];
  const aiAssistBadge = aiAssist.length
    ? `<span class="ai-source-badge" title="AI assisted content saved ${escapeHtml(latestAi?.savedAt ?? "")}">AI assisted</span>`
    : "";
  const aiAssistDetail = aiAssist.length
    ? `<div class="vocab-ai-detail"><strong>AI insight (${escapeHtml(latestAi?.provider ?? "ai")} - ${escapeHtml(latestAi?.model ?? "")})</strong>${(latestAi?.structured?.meanings ?? [])
        .slice(0, 3)
        .map((meaning) => `<p>${escapeHtml(meaning.definition ?? "")}</p>`)
        .join("")}<p class="small muted">Saved ${escapeHtml(latestAi?.savedAt ?? "")}</p></div>`
    : "";
  const unknownTermBadge = item.lastSaveReason === "manual-unknown"
    ? `<span class="ai-source-badge" title="Saved without a dictionary match">User entered</span>`
    : "";
  return `
    <div class="vocab-detail">
      <p>${escapeHtml(chinese)} ${aiAssistBadge}${unknownTermBadge}</p>
      <p>${escapeHtml(english)}</p>
      <p class="vocab-meta">
        ${escapeHtml(getVocabularyPhonetic(item) || "No pronunciation")} - source ${escapeHtml(item.original?.englishMeaningSource ?? "unknown")} - saved ${escapeHtml(new Date(item.savedAt).toLocaleDateString())} - rating ${escapeHtml(FSRS_RATING_LABELS[getVocabularyRating(item)])}
      </p>
      ${aiAssistDetail}
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
  const query = vocabularyView.query ?? "";
  const items = getVocabularyViewItems(filter, stats.active, query);
  const hasAdvanced = hasVocabularyAdvancedFilters();
  const maxPage = Math.max(0, Math.ceil(items.length / VOCABULARY_PAGE_SIZE) - 1);
  if (vocabularyView.page > maxPage) vocabularyView.page = maxPage;
  if (vocabularyView.page < 0) vocabularyView.page = 0;
  const start = vocabularyView.page * VOCABULARY_PAGE_SIZE;
  const pageItems = items.slice(start, start + VOCABULARY_PAGE_SIZE);
  const selectedItem = vocabularyView.selectedTerm ? getBrowserItem(vocabularyView.selectedTerm) : null;
  const rangeStart = items.length ? start + 1 : 0;
  const rangeEnd = Math.min(start + VOCABULARY_PAGE_SIZE, items.length);
  const emptyMessage = query || hasAdvanced
    ? `No words match these filters.`
    : `No words in this status yet.`;

  return `
    <div class="vocab-browser">
      <div class="vocab-browser-head">
        <div>
          <strong>${escapeHtml(getVocabularyViewTitle(filter))}</strong>
          <p class="muted">${rangeStart}-${rangeEnd} of ${items.length}${query ? ` matching "${escapeHtml(query)}"` : ""}</p>
        </div>
        <button class="secondary-button" type="button" data-action="vocab-summary">Back</button>
      </div>
      ${renderVocabularyFilter(query, "list")}
      ${pageItems.length ? `
        <ol class="vocab-word-list" start="${start + 1}">
          ${pageItems.map((item) => {
            const selected = selectedItem?.normalizedTerm === item.normalizedTerm;
            return `
              <li class="${selected ? "selected" : ""}">
                <div class="vocab-row">
                  <button type="button" data-action="vocab-select" data-term="${escapeHtml(item.term)}">
                    <span class="vocab-term">${escapeHtml(item.term)}</span>
                    ${renderIpa(getVocabularyPhonetic(item))}
                  </button>
                  ${renderSpeakerButton(item.term)}
                  ${renderAiChatButton(item.term)}
                </div>
                ${selected ? renderVocabularyDetail(item) : ""}
              </li>
            `;
          }).join("")}
        </ol>
      ` : `<p class="muted">${emptyMessage}</p>`}
      <div class="vocab-pager">
        <button class="secondary-button" type="button" data-action="vocab-page" data-page="${vocabularyView.page - 1}" ${vocabularyView.page <= 0 ? "disabled" : ""}>Previous</button>
        <span>Page ${vocabularyView.page + 1} of ${maxPage + 1}</span>
        <button class="secondary-button" type="button" data-action="vocab-page" data-page="${vocabularyView.page + 1}" ${vocabularyView.page >= maxPage ? "disabled" : ""}>Next</button>
      </div>
    </div>
  `;
}

function preserveVocabSearchFocus() {
  const input = vocabularyList.querySelector("#vocabSearchInput");
  if (input instanceof HTMLInputElement) {
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }
}

function preserveVocabFilterFocus(id) {
  const input = id ? vocabularyList.querySelector(`#${CSS.escape(id)}`) : null;
  if (!(input instanceof HTMLInputElement)) return;
  input.focus();
  if (input.type === "search" || input.type === "number") {
    const position = input.value.length;
    input.setSelectionRange(position, position);
  }
}

function renderVocabulary() {
  for (const tab of vocabularyTrackTabs) {
    tab.setAttribute("aria-selected", String(tab.dataset.vocabTrack === vocabularyView.track));
  }
  const isSpelling = vocabularyView.track === "spelling";
  const stats = getVocabularyStats();
  const query = vocabularyView.query ?? "";
  if (!stats.active.length && !stats.archived.length) {
    vocabularySummary.textContent = isSpelling ? "No spelling words yet." : "No saved terms yet.";
    vocabularyList.innerHTML = isSpelling
      ? `${renderVocabularyFilter(query)}<p class="muted">Search a dictionary word and tap "Add to spelling list", or set On Return to "Save to spelling list".</p>`
      : `${renderVocabularyFilter(query)}<p class="muted">Search a word and save it here, or set On Return to "Save to vocabulary".</p>`;
    return;
  }
  if (vocabularyView.filter !== "summary" && vocabularyView.selectedTerm) {
    const selected = getBrowserItem(vocabularyView.selectedTerm);
    if (!selected || selected.archivedAt) vocabularyView.selectedTerm = null;
  }
  const statsHtml = renderVocabularyStats(stats);
  vocabularyList.innerHTML = vocabularyView.filter === "summary"
    ? `${renderVocabularyFilter(query)}${statsHtml}`
    : renderVocabularyBrowser(stats);
}

function getDueVocabularyItems() {
  const now = appNowMs();
  return vocabularyItems
    .filter((item) => {
      if (item.archivedAt) return false;
      return !item.review?.dueAt || Date.parse(item.review.dueAt) <= now;
    })
    .sort((left, right) => {
      const leftDue = Date.parse(left.review?.dueAt ?? "0") || 0;
      const rightDue = Date.parse(right.review?.dueAt ?? "0") || 0;
      return leftDue - rightDue;
    });
}

function getDueTodayVocabularyItems() {
  const end = startOfDay(new Date(appNowMs()));
  end.setDate(end.getDate() + 1);
  return vocabularyItems.filter((item) => !item.archivedAt && (!item.review?.dueAt || Date.parse(item.review.dueAt) < end.getTime()));
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

function getDueSpellingItems() {
  const now = appNowMs();
  return spellingItems
    .filter((item) => {
      if (item.archivedAt) return false;
      return !item.review?.dueAt || Date.parse(item.review.dueAt) <= now;
    })
    .sort((left, right) => (Date.parse(left.review?.dueAt ?? "0") || 0) - (Date.parse(right.review?.dueAt ?? "0") || 0));
}

function getDueTodaySpellingItems() {
  const end = startOfDay(new Date(appNowMs()));
  end.setDate(end.getDate() + 1);
  return spellingItems.filter((item) => !item.archivedAt && (!item.review?.dueAt || Date.parse(item.review.dueAt) < end.getTime()));
}

function getTodayStats() {
  const newSaved = vocabularyItems.filter((item) => isToday(item.savedAt)).length;
  const reviewed = studyEvents.filter((event) => event.type === "review" && isToday(event.occurredAt)).length;
  const mastered = vocabularyItems.filter((item) => isToday(item.review?.masteredAt)).length;
  const known = knownWords.filter((record) => isToday(record.knownAt)).length;
  return { newSaved, reviewed, mastered, known, dueCount: getDueVocabularyItems().length, dueTodayCount: getDueTodayVocabularyItems().length, activeCount: getPracticeVocabularyItems().length };
}

function getSpellingTodayStats() {
  const newSaved = spellingItems.filter((item) => isToday(item.savedAt)).length;
  const reviewed = spellingEvents.filter((event) => event.type === "review" && isToday(event.occurredAt)).length;
  const mastered = spellingItems.filter((item) => isToday(item.review?.masteredAt)).length;
  return { newSaved, reviewed, mastered, known: 0, dueCount: getDueSpellingItems().length, dueTodayCount: getDueTodaySpellingItems().length, activeCount: spellingItems.filter((item) => !item.archivedAt).length };
}

function renderStudyStats() {
  for (const tab of todayTrackTabs) {
    tab.setAttribute("aria-selected", String(tab.dataset.todayTrack === todayTrack));
  }
  const isSpelling = todayTrack === "spelling";
  const stats = isSpelling ? getSpellingTodayStats() : getTodayStats();
  statNewSaved.textContent = String(stats.newSaved);
  statReviewed.textContent = String(stats.reviewed);
  statMastered.textContent = String(stats.mastered);
  if (statKnown) statKnown.textContent = String(stats.known);

  startReviewButton.hidden = isSpelling;
  studyNewWordButton.hidden = isSpelling;
  if (studyOneMoreLevelSelect) studyOneMoreLevelSelect.hidden = isSpelling;
  if (studyOneMoreHint) studyOneMoreHint.hidden = isSpelling;
  if (startSpellingReviewButton) startSpellingReviewButton.hidden = !isSpelling;
  if (startSpellingPracticeMoreButton) {
    startSpellingPracticeMoreButton.hidden = !isSpelling;
    startSpellingPracticeMoreButton.disabled = !isSpelling || stats.activeCount === 0;
  }

  if (isSpelling) {
    if (startSpellingReviewButton) {
      startSpellingReviewButton.disabled = stats.dueCount === 0;
      startSpellingReviewButton.textContent = stats.dueCount ? `Spelling Review (${stats.dueCount})` : "No spelling due";
    }
    studySummary.textContent = stats.dueCount
      ? `${stats.dueCount} spelling word${stats.dueCount === 1 ? " is" : "s are"} due now.`
      : stats.activeCount
        ? (stats.dueTodayCount ? `${stats.dueTodayCount} spelling word${stats.dueTodayCount === 1 ? " is" : "s are"} due later today.` : "No spelling words are due right now.")
        : "Add words to the spelling list to start.";
  } else {
    startReviewButton.disabled = stats.activeCount === 0;
    startReviewButton.textContent = stats.dueCount ? `Review due (${stats.dueCount})` : stats.activeCount ? "Practice review" : "No review";
    studySummary.textContent = stats.dueCount
      ? `${stats.dueCount} saved ${stats.dueCount === 1 ? "term is" : "terms are"} due now.`
      : stats.activeCount
        ? (stats.dueTodayCount ? `${stats.dueTodayCount} saved ${stats.dueTodayCount === 1 ? "term is" : "terms are"} due later today. You can still practice saved words.` : "No words are due right now. You can still practice saved words.")
        : "No saved words to review yet.";
  }
  renderGoalsPanel();
}

function refreshReviewScheduleViews() {
  ensureVocabularyReviewStates();
  renderStudyStats();
  renderVocabulary();
  renderHistoryChart();
}

const HISTORY_RATING_LEVEL = { again: 1, hard: 2, good: 3, easy: 4 };

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function startOfWeekMonday(date) {
  const d = startOfDay(date);
  const dow = d.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  return addDays(d, diff);
}

function startOfMonth(date) {
  const d = startOfDay(date);
  d.setDate(1);
  return d;
}

function addMonths(date, n) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

function getHistoryAnchorDate() {
  if (Number.isFinite(historyView.anchorMs)) {
    return startOfDay(new Date(historyView.anchorMs));
  }
  return startOfDay(new Date(realNowMs()));
}

function isAnchorToday() {
  return getHistoryAnchorDate().getTime() === startOfDay(new Date(realNowMs())).getTime();
}

function computeHistoryBuckets(granularity, anchorDate) {
  const buckets = [];
  if (granularity === "days") {
    const count = 7;
    for (let i = count - 1; i >= 0; i--) {
      const start = addDays(anchorDate, -i);
      const end = addDays(start, 1);
      const label = `${start.getMonth() + 1}/${start.getDate()}`;
      buckets.push({ start, end, label });
    }
  } else if (granularity === "weeks") {
    const count = 6;
    const anchorWeek = startOfWeekMonday(anchorDate);
    for (let i = count - 1; i >= 0; i--) {
      const start = addDays(anchorWeek, -i * 7);
      const end = addDays(start, 7);
      const label = `${start.getMonth() + 1}/${start.getDate()}`;
      buckets.push({ start, end, label });
    }
  } else {
    const count = 6;
    const anchorMonth = startOfMonth(anchorDate);
    for (let i = count - 1; i >= 0; i--) {
      const start = addMonths(anchorMonth, -i);
      const end = addMonths(start, 1);
      const label = start.toLocaleString(undefined, { month: "short" });
      buckets.push({ start, end, label });
    }
  }
  return buckets;
}

function summarizeHistoryBuckets(buckets) {
  const isSpelling = historyView.track === "spelling";
  const events = isSpelling ? spellingEvents : studyEvents;
  const items = isSpelling ? spellingItems : vocabularyItems;
  const knownAt = isSpelling ? [] : knownWords.map((record) => Date.parse(record.knownAt)).filter(Number.isFinite);
  const previousRatingByTerm = new Map();
  const sortedReviews = events
    .filter((event) => event?.type === "review" && event.normalizedTerm && event.rating)
    .slice()
    .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));
  const newWordSavedAt = items.map((item) => Date.parse(item.savedAt)).filter(Number.isFinite);
  return buckets.map((bucket) => {
    const startMs = bucket.start.getTime();
    const endMs = bucket.end.getTime();
    let reviewed = 0;
    let leveledUp = 0;
    let leveledDown = 0;
    for (const event of sortedReviews) {
      const eventMs = Date.parse(event.occurredAt);
      if (!Number.isFinite(eventMs)) continue;
      const prev = previousRatingByTerm.get(event.normalizedTerm);
      if (eventMs >= startMs && eventMs < endMs) {
        reviewed += 1;
        if (prev != null) {
          const before = HISTORY_RATING_LEVEL[prev] ?? 0;
          const after = HISTORY_RATING_LEVEL[event.rating] ?? 0;
          if (after > before) leveledUp += 1;
          if (after < before) leveledDown += 1;
        }
      }
      previousRatingByTerm.set(event.normalizedTerm, event.rating);
    }
    const newWords = newWordSavedAt.filter((ms) => ms >= startMs && ms < endMs).length;
    const known = knownAt.filter((ms) => ms >= startMs && ms < endMs).length;
    return { ...bucket, newWords, reviewed, known, leveledUp, leveledDown };
  });
}

function renderHistoryChartSvg(rows) {
  const series = [
    { key: "newWords", cls: "h-bar-new" },
    { key: "reviewed", cls: "h-bar-reviewed" },
    { key: "known", cls: "h-bar-known" },
    { key: "leveledUp", cls: "h-bar-up" },
    { key: "leveledDown", cls: "h-bar-down" },
  ];
  const maxValue = Math.max(
    1,
    ...rows.flatMap((row) => series.map((s) => row[s.key] ?? 0)),
  );
  const width = 640;
  const height = 220;
  const margin = { top: 14, right: 12, bottom: 28, left: 28 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const groupCount = rows.length;
  const groupGap = 10;
  const seriesGap = 2;
  const groupWidth = (plotWidth - (groupCount - 1) * groupGap) / groupCount;
  const barWidth = Math.max(4, (groupWidth - (series.length - 1) * seriesGap) / series.length);
  const yScale = (v) => plotHeight - (v / maxValue) * plotHeight;
  const gridLines = 4;
  const gridSvg = Array.from({ length: gridLines + 1 }, (_, i) => {
    const y = margin.top + (plotHeight * i) / gridLines;
    const value = Math.round((maxValue * (gridLines - i)) / gridLines);
    return `
      <line class="h-grid" x1="${margin.left}" y1="${y}" x2="${margin.left + plotWidth}" y2="${y}"></line>
      <text class="h-value-label" x="${margin.left - 4}" y="${y + 3}" text-anchor="end">${value}</text>
    `;
  }).join("");
  const bars = rows
    .map((row, groupIndex) => {
      const groupX = margin.left + groupIndex * (groupWidth + groupGap);
      const barsSvg = series
        .map((s, sIdx) => {
          const value = row[s.key] ?? 0;
          const barHeight = (value / maxValue) * plotHeight;
          const x = groupX + sIdx * (barWidth + seriesGap);
          const y = margin.top + plotHeight - barHeight;
          return `<rect class="h-bar ${s.cls}" x="${x}" y="${y}" width="${barWidth}" height="${Math.max(0, barHeight)}"><title>${escapeHtml(`${row.label} - ${s.key}: ${value}`)}</title></rect>`;
        })
        .join("");
      const labelX = groupX + groupWidth / 2;
      const labelY = margin.top + plotHeight + 16;
      return `${barsSvg}<text class="h-axis-label" x="${labelX}" y="${labelY}" text-anchor="middle">${escapeHtml(row.label)}</text>`;
    })
    .join("");
  return `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="WordFan history chart" preserveAspectRatio="xMidYMid meet">
      <defs>
        <pattern id="h-hatch-down" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
          <rect width="6" height="6" fill="#d55e00"></rect>
          <line x1="0" y1="0" x2="0" y2="6" stroke="#7a3500" stroke-width="2"></line>
        </pattern>
      </defs>
      ${gridSvg}
      ${bars}
    </svg>
  `;
}

function describeHistoryRange(granularity, buckets, isToday) {
  if (!buckets.length) return "";
  const first = buckets[0].start;
  const last = new Date(buckets[buckets.length - 1].end.getTime() - 1);
  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  if (granularity === "days") {
    const range = `${fmt(first)} - ${fmt(last)}`;
    return isToday ? `Last 7 days (${range})` : range;
  }
  if (granularity === "weeks") {
    return `${fmt(first)} - ${fmt(last)}`;
  }
  return `${first.toLocaleString(undefined, { month: "long", year: "numeric" })} - ${last.toLocaleString(undefined, { month: "long", year: "numeric" })}`;
}

function toLocalDateInputValue(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function renderHistoryChart() {
  if (!historyChart) return;
  const anchorDate = getHistoryAnchorDate();
  const buckets = computeHistoryBuckets(historyView.granularity, anchorDate);
  const rows = summarizeHistoryBuckets(buckets);
  const totalActivity = rows.reduce((acc, row) => acc + row.newWords + row.reviewed + row.known, 0);
  if (totalActivity === 0) {
    historyChart.innerHTML = `<p class="h-empty muted">No activity in this period yet.</p>`;
  } else {
    historyChart.innerHTML = renderHistoryChartSvg(rows);
  }
  const todayMs = startOfDay(new Date(realNowMs())).getTime();
  const isToday = isAnchorToday();
  historyRangeLabel.textContent = describeHistoryRange(historyView.granularity, buckets, isToday);
  historyNextButton.disabled = anchorDate.getTime() >= todayMs;
  if (historyTodayButton) historyTodayButton.disabled = isToday;
  if (historyAnchorInput) {
    historyAnchorInput.value = toLocalDateInputValue(anchorDate);
    historyAnchorInput.max = toLocalDateInputValue(new Date(realNowMs()));
  }
  const totals = rows.reduce(
    (acc, row) => ({
      newWords: acc.newWords + row.newWords,
      reviewed: acc.reviewed + row.reviewed,
      known: acc.known + row.known,
      leveledUp: acc.leveledUp + row.leveledUp,
      leveledDown: acc.leveledDown + row.leveledDown,
    }),
    { newWords: 0, reviewed: 0, known: 0, leveledUp: 0, leveledDown: 0 },
  );
  historyChartSummary.textContent = `${totals.newWords} new, ${totals.reviewed} reviewed, ${totals.known} known, ${totals.leveledUp} level-up, ${totals.leveledDown} level-down.`;
  for (const button of historyGranularityButtons) {
    const selected = button.dataset.historyGranularity === historyView.granularity;
    button.setAttribute("aria-selected", String(selected));
  }
  for (const tab of historyTrackTabs) {
    tab.setAttribute("aria-selected", String(tab.dataset.historyTrack === historyView.track));
  }
}

function shiftHistoryAnchor(direction) {
  const anchor = getHistoryAnchorDate();
  let shifted;
  if (historyView.granularity === "days") {
    shifted = addDays(anchor, 7 * direction);
  } else if (historyView.granularity === "weeks") {
    shifted = addDays(anchor, 42 * direction);
  } else {
    shifted = addMonths(anchor, 6 * direction);
  }
  const today = startOfDay(new Date(realNowMs()));
  if (shifted.getTime() > today.getTime()) {
    historyView = { ...historyView, anchorMs: null };
  } else {
    historyView = { ...historyView, anchorMs: shifted.getTime() };
  }
  renderHistoryChart();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function scheduleFromFsrsRating(reviewState, rating) {
  return scheduleWithFsrs(normalizeReviewState(reviewState), rating, nowIso());
}

function daysBetweenMs(fromMs, toMs) {
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) return 0;
  return Math.max(0, (toMs - fromMs) / NORMAL_DAY_MS);
}

function applyReviewSchedulingPolicy({
  reviewState = {},
  rating = "again",
  reviewedAt = nowIso(),
  mode = "review",
  track = "vocabulary",
  hadMiss = false,
} = {}) {
  const normalized = normalizeReviewState(reviewState);
  const fullSchedule = scheduleWithFsrs(normalized, rating, reviewedAt);
  const reviewedAtMs = Date.parse(reviewedAt);
  const originalDueMs = Date.parse(normalized.dueAt);
  const earlyPractice = mode === "practice" && Number.isFinite(originalDueMs) && Number.isFinite(reviewedAtMs) && originalDueMs > reviewedAtMs;
  const earlyFailure = rating === "again" || hadMiss;
  if (!earlyPractice || earlyFailure) {
    return {
      ...fullSchedule,
      schedulingPolicy: earlyPractice ? "early-practice-full-failure" : "scheduled-review-full",
      originalDueAt: normalized.dueAt,
      fsrsDueAt: fullSchedule.dueAt,
      track,
      recordOnlyPractice: false,
    };
  }
  return {
    ...fullSchedule,
    fsrsCard: normalized.fsrsCard,
    intervalDays: normalized.intervalDays,
    dueAt: normalized.dueAt,
    masteredAt: normalized.masteredAt ?? null,
    schedulingPolicy: "early-practice-record-only",
    originalDueAt: normalized.dueAt,
    fsrsDueAt: fullSchedule.dueAt,
    track,
    recordOnlyPractice: true,
  };
}

const applyVocabularyReviewSchedulingPolicy = applyReviewSchedulingPolicy;

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

async function runReviewPersistence(operation, details) {
  if (reviewPersistenceBeforeSaveForTest) {
    await reviewPersistenceBeforeSaveForTest(details);
  }
  return operation();
}

async function recordReviewRating(item, rating, quizResult, responseMs, mode = "review", source = mode) {
  const reviewedAt = nowIso();
  let persistenceStatus = "saved";
  const schedule = applyReviewSchedulingPolicy({
    reviewState: item.review ?? {},
    rating,
    reviewedAt,
    mode,
    track: "vocabulary",
    hadMiss: rating === "again" || quizResult === "miss",
  });
  const event = markDebugRecord({
    id: crypto.randomUUID ? crypto.randomUUID() : `event-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type: schedule.recordOnlyPractice ? "practice" : "review",
    term: item.term,
    normalizedTerm: item.normalizedTerm,
    rating,
    responseMs,
    quizResult,
    source,
    mastered: Boolean(schedule.masteredAt),
    occurredAt: reviewedAt,
    fsrsLog: schedule.fsrsLog,
    schedulingPolicy: schedule.schedulingPolicy,
    originalDueAt: schedule.originalDueAt,
    fsrsDueAt: schedule.fsrsDueAt,
    appliedDueAt: schedule.dueAt,
    practiceMode: mode,
    deviceId,
  });
  studyEvents.push(event);
  if (schedule.recordOnlyPractice) {
    try {
      await withTimeout(
        runReviewPersistence(
          () => persistStudyEvent(event),
          { item, event, rating, mode, source, store: STUDY_EVENT_STORE },
        ),
        reviewPersistenceTimeoutMs,
        `Saving practice review for "${item.normalizedTerm}"`,
      );
    } catch (error) {
      persistenceStatus = error instanceof Error && /timed out/i.test(error.message) ? "timeout" : "error";
      recordReviewDebug("rating-persist-failed", {
        term: item.term,
        rating,
        status: persistenceStatus,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  } else {
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
    try {
      await withTimeout(
        runReviewPersistence(
          () => saveReviewItemAndEvent({
            itemStore: VOCABULARY_STORE,
            eventStore: STUDY_EVENT_STORE,
            itemKey: item.normalizedTerm,
            item,
            event,
          }),
          { item, event, rating, mode, source, store: VOCABULARY_STORE },
        ),
        reviewPersistenceTimeoutMs,
        `Saving review for "${item.normalizedTerm}"`,
      );
    } catch (error) {
      persistenceStatus = error instanceof Error && /timed out/i.test(error.message) ? "timeout" : "error";
      recordReviewDebug("rating-persist-failed", {
        term: item.term,
        rating,
        status: persistenceStatus,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    renderStudyStats();
  }
  hideQuiz({ preserveVocabularyReviewSession: true });
  renderHistoryChart();
  return { event, schedule, persistenceStatus };
}

function hideQuiz(options = {}) {
  clearVocabularyAutoRatingTimer();
  activeQuiz = null;
  activeStudyOneMoreEntry = null;
  if (!options.preserveVocabularyReviewSession) activeVocabularyReviewSession = null;
  quizPanel.hidden = true;
  quizPanel.innerHTML = "";
}

// --- Spelling review engine ---
// Spelling completion policy:
// - First try correct advances automatically after the feedback pause.
// - After any wrong answer, the same word must be typed correctly 3 times in a row before advance.
//   This is intentional extra practice, not a bug. Do not collapse it to one retry-correct.
// The session rating is derived from how many wrong attempts (retries) it took. Strict check:
// exact, case-sensitive, with accidental edge spaces ignored.
const SPELLING_FEEDBACK_PAUSE_MS = 1000;
const VOCABULARY_AUTO_RATING_PAUSE_MS = 5000;

function recordReviewDebug(stage, details = {}) {
  const event = {
    at: new Date().toISOString(),
    stage,
    activeTerm: activeQuiz?.entry?.term ?? null,
    activeMode: activeQuiz?.mode ?? null,
    activeQuizId: activeQuiz?.id ?? null,
    pending: Boolean(activeQuiz?.pendingResult),
    ratingSubmitted: Boolean(activeQuiz?.ratingSubmitted),
    autoTimer: Boolean(activeQuiz?.autoRatingTimer),
    sessionIndex: activeVocabularyReviewSession?.index ?? null,
    sessionLength: activeVocabularyReviewSession?.queue?.length ?? null,
    sessionMode: activeVocabularyReviewSession?.mode ?? null,
    overlayOpen: Boolean(document.querySelector(".modal-overlay")),
    topElementAtLastPointer: null,
    ...details,
  };
  reviewDebugEvents = [...reviewDebugEvents.slice(-79), event];
  renderReviewDebugPanel();
  if (new URLSearchParams(window.location.search).has("reviewDebug")) {
    console.info("[WordFan review]", event);
  }
  return event;
}

function reviewDebugEnabled() {
  return new URLSearchParams(window.location.search).has("reviewDebug");
}

function renderReviewDebugPanel() {
  if (!reviewDebugEnabled()) return;
  let panel = document.querySelector("#reviewDebugPanel");
  if (!panel) {
    panel = document.createElement("details");
    panel.id = "reviewDebugPanel";
    panel.className = "review-debug-panel";
    panel.open = true;
    panel.innerHTML = `<summary>Review debug</summary><pre></pre>`;
    document.body.append(panel);
  }
  const latest = reviewDebugEvents.slice(-10);
  const state = {
    activeTerm: activeQuiz?.entry?.term ?? null,
    pending: Boolean(activeQuiz?.pendingResult),
    submitted: Boolean(activeQuiz?.ratingSubmitted),
    timer: Boolean(activeQuiz?.autoRatingTimer),
    overlay: Boolean(document.querySelector(".modal-overlay")),
    buttons: [...quizPanel.querySelectorAll("[data-fsrs-rating]")].map((button) => ({
      rating: button.dataset.fsrsRating,
      disabled: button.disabled,
      topmost: isElementTopmost(button),
    })),
    latest,
  };
  panel.querySelector("pre").textContent = JSON.stringify(state, null, 2);
}

function isElementTopmost(element) {
  if (!(element instanceof Element)) return false;
  const rect = element.getBoundingClientRect();
  if (!rect.width || !rect.height) return false;
  const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
  return top === element || Boolean(top?.closest?.("[data-fsrs-rating]"));
}

function clearVocabularyAutoRatingTimer() {
  if (!activeQuiz?.autoRatingTimer) return;
  window.clearTimeout(activeQuiz.autoRatingTimer);
  recordReviewDebug("auto-rating-clear", { timerId: activeQuiz.autoRatingTimer });
  activeQuiz.autoRatingTimer = 0;
}

function spellingThreshold() {
  return (activeSpellingSession?.retries ?? 0) === 0 ? 1 : 3;
}

function ratingFromRetries(retries) {
  if (retries <= 0) return "easy";
  if (retries === 1) return "good";
  if (retries === 2) return "hard";
  return "again";
}

function spellingMeaningHint(item) {
  return {
    en: summarizeLines(item.user?.englishMeanings ?? item.original?.englishMeanings),
    zh: summarizeLines(item.user?.chineseMeanings ?? item.original?.chineseMeanings),
  };
}

function currentSpellingItem() {
  return activeSpellingSession?.queue[activeSpellingSession.index] ?? null;
}

function getPracticeSpellingItems() {
  return spellingItems
    .filter((item) => !item.archivedAt)
    .sort((left, right) => {
      const leftReviewed = left.review?.lastReviewedAt ?? "";
      const rightReviewed = right.review?.lastReviewedAt ?? "";
      if (leftReviewed !== rightReviewed) return leftReviewed.localeCompare(rightReviewed);
      return (left.savedAt ?? "").localeCompare(right.savedAt ?? "");
    });
}

function startSpellingSessionWith(queue, emptyMessage, mode = "review") {
  spellingReviewPanel.hidden = false;
  if (!queue.length) {
    activeSpellingSession = null;
    spellingReviewPanel.innerHTML = `<p class="muted">${escapeHtml(emptyMessage)}</p><div class="quiz-actions"><button class="secondary-button" type="button" data-spelling-close="1">Close</button></div>`;
    return;
  }
  activeSpellingSession = { queue, index: 0, retries: 0, consecutive: 0, completed: 0, awaitingRetry: false, mode };
  quizPanel.hidden = true;
  renderSpellingPrompt();
}

function startSpellingReview() {
  startSpellingSessionWith(getDueSpellingItems(), "No spelling words are due today.", "review");
}

// Practice mode: drill every active spelling word (least-recently-practiced first),
// regardless of whether it is due.
function startSpellingPractice() {
  startSpellingSessionWith(getPracticeSpellingItems(), "Add words to the spelling list to practice.", "practice");
}

function renderSpellingPrompt() {
  const item = currentSpellingItem();
  if (!item) {
    finishSpellingSession();
    return;
  }
  activeSpellingSession.awaitingRetry = false;
  const hint = spellingMeaningHint(item);
  spellingReviewPanel.hidden = false;
  spellingReviewPanel.innerHTML = `
    <div class="spelling-review">
      <p class="spelling-progress">${escapeHtml(spellingProgressText())}</p>
      <p class="spelling-hint-zh">${escapeHtml(hint.zh)}</p>
      <p class="spelling-hint-en">${escapeHtml(hint.en)}</p>
      <div class="spelling-controls">
        ${renderSpeakerButton(item.term)}
        <input type="text" id="spellingInput" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="type what you hear" />
      </div>
      <p class="spelling-feedback" id="spellingFeedback" aria-live="polite"></p>
      <div class="quiz-actions">
        <button class="secondary-button" type="button" data-spelling-close="1">End session</button>
      </div>
    </div>
  `;
  const input = spellingReviewPanel.querySelector("#spellingInput");
  input?.focus();
  speakTerm(item.term);
}

function spellingProgressText() {
  const s = activeSpellingSession;
  const base = `Word ${s.index + 1} of ${s.queue.length}`;
  return s.retries === 0
    ? `${base} · spell the word you hear`
    : `${base} · ${s.consecutive}/3 correct in a row (after a miss)`;
}

function updateSpellingProgress() {
  const progress = spellingReviewPanel.querySelector(".spelling-progress");
  if (progress && activeSpellingSession) progress.textContent = spellingProgressText();
}

function checkSpelling() {
  const item = currentSpellingItem();
  if (!item || !activeSpellingSession || activeSpellingSession.awaitingRetry || activeSpellingSession.pausing) return;
  const input = spellingReviewPanel.querySelector("#spellingInput");
  const feedback = spellingReviewPanel.querySelector("#spellingFeedback");
  if (!input || !feedback) return;
  const value = input.value.trim(); // Ignore accidental edge spaces; spelling remains case-sensitive.
  if (!value) return;
  if (value !== input.value) input.value = value;
  if (value === item.term) {
    activeSpellingSession.consecutive += 1;
    // Show the result (with the correct word) and keep the typed text on screen for a beat so the
    // user can see what they entered before it clears / advances.
    feedback.innerHTML = `<span class="spelling-correct-label">Correct!</span><span class="spelling-answer-correct">${escapeHtml(item.term)}</span>`;
    feedback.className = "spelling-feedback correct";
    input.classList.add("spelling-correct-flash");
    const reachedThreshold = activeSpellingSession.consecutive >= spellingThreshold();
    activeSpellingSession.pausing = true;
    window.setTimeout(() => {
      input.classList.remove("spelling-correct-flash");
      if (!activeSpellingSession) return;
      activeSpellingSession.pausing = false;
      // First-try correct completes immediately; after a miss, require 3 in a row by design.
      if (reachedThreshold) {
        void completeCurrentSpellingWord();
      } else {
        input.value = "";
        feedback.textContent = "";
        feedback.className = "spelling-feedback";
        updateSpellingProgress();
        input.focus();
        speakTerm(item.term);
      }
    }, SPELLING_FEEDBACK_PAUSE_MS);
  } else {
    activeSpellingSession.retries += 1;
    activeSpellingSession.consecutive = 0;
    activeSpellingSession.awaitingRetry = true;
    feedback.innerHTML = `<span class="spelling-wrong-label">Correct spelling:</span><span class="spelling-answer">${escapeHtml(item.term)}</span><span class="spelling-retry-hint">Press Return again (or Retry) to try once more.</span>`;
    feedback.className = "spelling-feedback wrong";
    // Keep the input enabled + focused so pressing Return again acts like Retry.
    input.focus();
    updateSpellingProgress();
    const actions = spellingReviewPanel.querySelector(".quiz-actions");
    if (actions && !actions.querySelector("[data-spelling-retry]")) {
      actions.insertAdjacentHTML("afterbegin", `<button type="button" data-spelling-retry="1">Retry</button>`);
    }
  }
}

function retrySpelling() {
  if (!currentSpellingItem()) return;
  renderSpellingPrompt();
}

function completeCurrentSpellingWord() {
  const session = activeSpellingSession;
  const item = currentSpellingItem();
  if (!item || !session) return;
  const rating = ratingFromRetries(session.retries);
  const retries = session.retries;
  const mode = session.mode ?? "review";
  session.completed += 1;
  session.index += 1;
  session.retries = 0;
  session.consecutive = 0;
  if (session.index >= session.queue.length) {
    finishSpellingSession();
  } else {
    // Advance the UI immediately after the feedback pause; persistence happens below so slow
    // IndexedDB/FSRS work cannot make a first-try-correct answer appear stuck.
    renderSpellingPrompt();
  }
  void recordSpellingReview(item, rating, retries, mode).catch((error) => {
    console.error("Failed to persist spelling review:", error);
  });
}

async function recordSpellingReview(item, rating, retries, mode = "review") {
  const reviewedAt = nowIso();
  const schedule = applyReviewSchedulingPolicy({
    reviewState: item.review ?? {},
    rating,
    reviewedAt,
    mode,
    track: "spelling",
    hadMiss: retries > 0,
  });
  const event = markDebugRecord({
    id: crypto.randomUUID ? crypto.randomUUID() : `spelling-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type: schedule.recordOnlyPractice ? "practice" : "review",
    term: item.term,
    normalizedTerm: item.normalizedTerm,
    rating,
    retries,
    mastered: Boolean(schedule.masteredAt),
    occurredAt: reviewedAt,
    fsrsLog: schedule.fsrsLog,
    schedulingPolicy: schedule.schedulingPolicy,
    originalDueAt: schedule.originalDueAt,
    fsrsDueAt: schedule.fsrsDueAt,
    appliedDueAt: schedule.dueAt,
    practiceMode: mode,
    deviceId,
  });
  spellingEvents.push(event);
  if (schedule.recordOnlyPractice) {
    await persistSpellingEvent(event);
    return;
  }
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
  await saveReviewItemAndEvent({
    itemStore: SPELLING_STORE,
    eventStore: SPELLING_EVENT_STORE,
    itemKey: item.normalizedTerm,
    item,
    event,
  });
  renderSpellingViews();
}

function finishSpellingSession() {
  const completed = activeSpellingSession?.completed ?? 0;
  activeSpellingSession = null;
  spellingReviewPanel.hidden = false;
  spellingReviewPanel.innerHTML = `<p class="muted">Spelling session done. ${completed} word${completed === 1 ? "" : "s"} reviewed.</p><div class="quiz-actions"><button class="secondary-button" type="button" data-spelling-close="1">Close</button></div>`;
  renderStudyStats();
}

function hideSpellingReview() {
  activeSpellingSession = null;
  spellingReviewPanel.hidden = true;
  spellingReviewPanel.innerHTML = "";
}

function meaningPreviewFromEntry(entry) {
  return topLines(entry.translation, 1)[0] ?? topLines(entry.definition, 1)[0] ?? "No meaning available";
}

function normalizeStudyOneMoreLevel(level) {
  return STUDY_ONE_MORE_LEVELS.some((item) => item.id === level) ? level : "very_easy";
}

function frequencyRankOf(candidate) {
  const frq = Number(candidate?.frq ?? candidate?.frequencyRank);
  if (Number.isFinite(frq) && frq > 0) return frq;
  const bnc = Number(candidate?.bnc);
  return Number.isFinite(bnc) && bnc > 0 ? bnc : Number.POSITIVE_INFINITY;
}

function hasToeflTag(candidate) {
  if (Number(candidate?.is_toefl ?? candidate?.isToefl) === 1) return true;
  const tags = Array.isArray(candidate?.tags)
    ? candidate.tags
    : String(candidate?.tag ?? "").split(/\s+/).filter(Boolean);
  return tags.some((tag) => tag.toLowerCase() === "toefl");
}

function fallbackStudyOneMoreLevel(candidate) {
  const rank = frequencyRankOf(candidate);
  const length = normalizeTerm(candidate?.normalized_word ?? candidate?.normalizedTerm ?? candidate?.word ?? candidate?.term).length;
  if (rank <= 3000 && length <= 8) return "very_easy";
  if (rank <= 8000 && length <= 12) return "easy";
  if (rank <= 20000) return "medium";
  if (rank <= 50000) return "hard";
  return "advanced";
}

function candidateMatchesStudyOneMoreLevel(candidate, level) {
  const normalizedLevel = normalizeStudyOneMoreLevel(level);
  if (normalizedLevel === "toefl") return hasToeflTag(candidate);
  return fallbackStudyOneMoreLevel(candidate) === normalizedLevel;
}

function introducedByStudyOneMore(event) {
  return ["study-one-more-introduced", "study-one-more-skipped", "new-word-first-pass"].includes(event?.type);
}

function buildStudyOneMoreExclusionSets({
  vocabulary = vocabularyItems,
  spelling = spellingItems,
  events = studyEvents,
  known = knownWords,
} = {}) {
  const memorizeTerms = new Set();
  const spellingTerms = new Set();
  const archivedIgnoredOrMastered = new Set();
  for (const item of vocabulary ?? []) {
    const term = item?.normalizedTerm;
    if (!term) continue;
    if (!item.archivedAt) memorizeTerms.add(term);
    if (item.archivedAt || item.ignoredAt || item.review?.masteredAt) archivedIgnoredOrMastered.add(term);
  }
  for (const item of spelling ?? []) {
    const term = item?.normalizedTerm;
    if (!term) continue;
    if (!item.archivedAt) spellingTerms.add(term);
    if (item.archivedAt || item.ignoredAt || item.review?.masteredAt) archivedIgnoredOrMastered.add(term);
  }
  const introducedToday = new Set();
  const firstTryPassed = new Set();
  for (const event of events ?? []) {
    if (!event?.normalizedTerm) continue;
    if (event.type === "new-word-first-pass") firstTryPassed.add(event.normalizedTerm);
    if (introducedByStudyOneMore(event) && isToday(event.occurredAt)) introducedToday.add(event.normalizedTerm);
  }
  const knownTerms = new Set(
    (known ?? [])
      .map((record) => record?.normalizedTerm)
      .filter(Boolean)
      .filter((term) => !memorizeTerms.has(term) && !spellingTerms.has(term)),
  );
  return { memorizeTerms, spellingTerms, introducedToday, firstTryPassed, knownTerms, archivedIgnoredOrMastered };
}

function pickStudyOneMoreCandidateFromRows(rows, level, exclusions = buildStudyOneMoreExclusionSets()) {
  const normalizedLevel = normalizeStudyOneMoreLevel(level);
  return [...(rows ?? [])]
    .map((row) => {
      const normalizedTerm = normalizeTerm(row.normalized_word ?? row.normalizedTerm ?? row.word ?? row.term);
      return {
        ...row,
        normalizedTerm,
        frequencyRank: frequencyRankOf(row),
        studyLevel: normalizedLevel === "toefl" ? "toefl" : fallbackStudyOneMoreLevel({ ...row, normalizedTerm }),
      };
    })
    .filter((row) => row.normalizedTerm)
    .filter((row) => candidateMatchesStudyOneMoreLevel(row, normalizedLevel))
    .filter((row) => !exclusions.memorizeTerms?.has(row.normalizedTerm))
    .filter((row) => !exclusions.spellingTerms?.has(row.normalizedTerm))
    .filter((row) => !exclusions.knownTerms?.has(row.normalizedTerm))
    .filter((row) => !exclusions.introducedToday?.has(row.normalizedTerm))
    .filter((row) => !exclusions.firstTryPassed?.has(row.normalizedTerm))
    .filter((row) => !exclusions.archivedIgnoredOrMastered?.has(row.normalizedTerm))
    .sort((left, right) => {
      const leftRank = Number.isFinite(left.frequencyRank) ? left.frequencyRank : Number.MAX_SAFE_INTEGER;
      const rightRank = Number.isFinite(right.frequencyRank) ? right.frequencyRank : Number.MAX_SAFE_INTEGER;
      if (leftRank !== rightRank) return leftRank - rightRank;
      return String(left.word ?? left.term).localeCompare(String(right.word ?? right.term));
    })[0] ?? null;
}

function studyOneMoreEntryFromRow(row, level) {
  const englishMeanings = topLines(row.definition);
  const chineseMeanings = topLines(row.translation);
  const exampleSentence = topLines(row.detail, 1).find((line) => /[.!?]$/.test(line)) ?? "";
  return {
    status: "found",
    term: row.word,
    normalizedTerm: row.normalizedTerm ?? row.normalized_word,
    entryType: "word",
    phonetic: row.phonetic ?? "",
    englishMeanings,
    englishMeaningSource: row.definition_source ?? "unknown",
    chineseMeanings,
    tags: row.tag ? String(row.tag).split(/\s+/).filter(Boolean) : [],
    frequencyRank: row.frequencyRank,
    studyLevel: level,
    exampleSentence,
    correct: meaningPreviewFromEntry(row),
  };
}

function renderStudyOneMoreMeaning(entry) {
  return `
    <div class="study-one-more-meaning" data-study-one-more-meaning="1">
      <div class="quiz-english">
        <span class="quiz-english-label">English</span>
        ${entry.englishMeanings.length ? entry.englishMeanings.map((line) => `<p>${escapeHtml(line)}</p>`).join("") : "<p>No English definition.</p>"}
      </div>
      <div class="quiz-english">
        <span class="quiz-english-label">Chinese</span>
        ${entry.chineseMeanings.length ? entry.chineseMeanings.map((line) => `<p>${escapeHtml(line)}</p>`).join("") : "<p>No Chinese meaning.</p>"}
      </div>
      ${entry.exampleSentence ? `<div class="quiz-english"><span class="quiz-english-label">Example</span><p>${escapeHtml(entry.exampleSentence)}</p></div>` : ""}
    </div>
  `;
}

function renderStudyOneMoreActions(passed) {
  const message = passed
    ? "Correct. Marked as Known, so WordFan will not suggest it again."
    : "Not quite. You can add it for review or skip it for today.";
  return `
    <div class="study-one-more-result">
      <p class="muted">${escapeHtml(message)}</p>
      <div class="quiz-actions">
        <button class="secondary-button" type="button" data-study-one-more-show="1">Show</button>
        <button type="button" data-study-one-more-add="memorize">Add to Memorize</button>
        <button class="secondary-button" type="button" data-study-one-more-add="spelling">Add to Spelling</button>
        ${passed
          ? `<button type="button" data-study-next="1">Study another</button><button class="secondary-button" type="button" data-quiz-close="1">Close</button>`
          : `<button class="secondary-button" type="button" data-study-one-more-skip="1">Skip</button>`}
      </div>
    </div>
  `;
}

function renderStudyOneMoreEntry(entry) {
  activeStudyOneMoreEntry = entry;
  activeQuiz = {
    id: crypto.randomUUID ? crypto.randomUUID() : `quiz-${Date.now()}`,
    mode: "study-one-more",
    entry,
    answered: false,
    startedAt: performance.now(),
    options: buildQuizOptions(entry),
    stepwise: true,
    optionsRevealed: false,
  };
  quizPanel.hidden = false;
  quizPanel.innerHTML = `
    <div class="study-one-more-card">
      ${renderQuizQuestionMarkup(entry, "study-one-more", false)}
      <div class="quiz-actions">
        <button type="button" data-quiz-reveal="1">Reveal options</button>
      </div>
    </div>
  `;
  quizPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

async function recordStudyOneMoreEvent(entry, type) {
  if (!entry?.normalizedTerm) return null;
  const event = markDebugRecord({
    id: crypto.randomUUID ? crypto.randomUUID() : `event-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type,
    term: entry.term,
    normalizedTerm: entry.normalizedTerm,
    level: entry.studyLevel,
    frequencyRank: entry.frequencyRank,
    occurredAt: nowIso(),
    deviceId,
  });
  studyEvents.push(event);
  await persistStudyEvent(event);
  return event;
}

async function recordKnownWord(entry, responseMs) {
  if (!entry?.normalizedTerm) return null;
  await getDeviceId();
  const knownAt = nowIso();
  const record = markDebugRecord({
    term: entry.term,
    normalizedTerm: entry.normalizedTerm,
    knownAt,
    updatedAt: knownAt,
    source: "study-one-more",
    level: entry.studyLevel,
    frequencyRank: entry.frequencyRank,
    responseMs,
    deviceId,
    syncVersion: 1,
  });
  const merged = mergeKnownSources([record], knownWords, activeStudyTermsFromItems(vocabularyItems, spellingItems));
  knownWords = merged;
  const saved = knownWords.find((item) => item.normalizedTerm === record.normalizedTerm) ?? record;
  await persistKnownWord(saved);
  return saved;
}

function quizEntryFromVocabulary(item) {
  const englishMeanings = item.user?.englishMeanings?.length
    ? item.user.englishMeanings
    : item.original?.englishMeanings ?? [];
  return {
    term: item.term,
    normalizedTerm: item.normalizedTerm,
    phonetic: getVocabularyPhonetic(item),
    correct: summarizeLines(item.user?.chineseMeanings?.length ? item.user.chineseMeanings : item.original?.chineseMeanings),
    englishMeanings,
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

function hasReviewedToday(normalizedTerm) {
  if (!normalizedTerm) return false;
  return studyEvents.some(
    (event) =>
      event?.type === "review"
      && event.normalizedTerm === normalizedTerm
      && isToday(event.occurredAt),
  );
}

function renderQuizEnglishMeaning(entry) {
  const lines = Array.isArray(entry.englishMeanings) ? entry.englishMeanings.filter(Boolean) : [];
  if (!lines.length) return "";
  return `
    <div class="quiz-english">
      <span class="quiz-english-label">English</span>
      ${lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
    </div>
  `;
}

function renderQuizQuestionMarkup(entry, mode, optionsRevealed) {
  return `
    <div class="quiz-question">
      <span>${mode === "review" ? "Review" : mode === "practice" ? "Practice" : mode === "study-one-more" ? "Study one more" : "First check"}</span>
      <div class="quiz-word-row">
        <strong>${escapeHtml(entry.term)}</strong>
        ${renderIpa(entry.phonetic)}
        ${renderSpeakerButton(entry.term)}
        ${renderAiChatButton(entry.term)}
      </div>
      ${optionsRevealed && mode !== "study-one-more" ? renderQuizEnglishMeaning(entry) : ""}
      <p class="muted">${mode === "study-one-more" ? "Choose the closest meaning before viewing the definition." : optionsRevealed ? "Choose the closest meaning." : "Try to recall the meaning. Tap when ready."}</p>
    </div>
  `;
}

function renderQuizOptionsMarkup(options) {
  return `
    <div class="quiz-options">
      ${options
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
}

function renderQuiz(entry, mode) {
  const stepwise = mode === "review" || mode === "practice";
  activeQuiz = {
    id: crypto.randomUUID ? crypto.randomUUID() : `quiz-${Date.now()}`,
    mode,
    entry,
    answered: false,
    startedAt: performance.now(),
    options: buildQuizOptions(entry),
    stepwise,
    optionsRevealed: !stepwise,
  };
  recordReviewDebug("render-quiz", { term: entry.term, mode, stepwise });
  quizPanel.hidden = false;
  if (stepwise) {
    quizPanel.innerHTML = `
      ${renderQuizQuestionMarkup(entry, mode, false)}
      <div class="quiz-actions">
        <button type="button" data-quiz-reveal="1">Reveal options</button>
      </div>
    `;
  } else {
    quizPanel.innerHTML = `
      ${renderQuizQuestionMarkup(entry, mode, true)}
      ${renderQuizOptionsMarkup(activeQuiz.options)}
    `;
  }
  quizPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function revealQuizOptions() {
  if (!activeQuiz || activeQuiz.optionsRevealed) return;
  activeQuiz.optionsRevealed = true;
  activeQuiz.startedAt = performance.now();
  const content = `
      ${renderQuizQuestionMarkup(activeQuiz.entry, activeQuiz.mode, true)}
      ${renderQuizOptionsMarkup(activeQuiz.options)}
    `;
  quizPanel.innerHTML = activeQuiz.mode === "study-one-more"
    ? `<div class="study-one-more-card">${content}</div>`
    : content;
}

function buildVocabularyReviewSession() {
  const dueQueue = getDueVocabularyItems();
  if (dueQueue.length) return { queue: dueQueue, index: 0, mode: "review" };
  const practiceQueue = getPracticeVocabularyItems();
  if (practiceQueue.length) return { queue: practiceQueue, index: 0, mode: "practice" };
  return null;
}

async function startDueReview(options = {}) {
  if (!(await ensureDictionaryLoaded())) return;
  const continueSession = Boolean(options.continueSession);
  if (!continueSession) activeVocabularyReviewSession = buildVocabularyReviewSession();
  const session = activeVocabularyReviewSession;
  const reviewItem = session?.queue?.[session.index] ?? null;
  recordReviewDebug("start-due-review", {
    continueSession,
    nextTerm: reviewItem?.term ?? null,
    dueCount: getDueVocabularyItems().length,
    practiceCount: getPracticeVocabularyItems().length,
  });
  if (!reviewItem) {
    activeVocabularyReviewSession = null;
    renderStudyStats();
    quizPanel.hidden = false;
    quizPanel.innerHTML = `<p class="muted">No saved words are available for review yet.</p>`;
    return;
  }
  renderQuiz(quizEntryFromVocabulary(reviewItem), session.mode);
}

function pickNewStudyEntry(level = studyOneMoreLevel) {
  if (!dictionaryDb) return null;
  const normalizedLevel = normalizeStudyOneMoreLevel(level);
  const statement = dictionaryDb.prepare(`
    SELECT word, normalized_word, phonetic, definition, definition_source, translation, tag, is_toefl, frq, bnc, detail
    FROM dictionary_entries
    WHERE translation IS NOT NULL
      AND definition IS NOT NULL
      AND instr(normalized_word, ' ') = 0
    ORDER BY frq IS NULL, frq, bnc IS NULL, bnc, length(word), word
  `);
  const rows = [];
  try {
    while (statement.step()) {
      const row = statement.getAsObject();
      rows.push(row);
    }
  } finally {
    statement.free();
  }
  const candidate = pickStudyOneMoreCandidateFromRows(rows, normalizedLevel);
  return candidate ? studyOneMoreEntryFromRow(candidate, normalizedLevel) : null;
}

async function startNewWordStudy() {
  if (!(await ensureDictionaryLoaded())) return;
  activeVocabularyReviewSession = null;
  const level = normalizeStudyOneMoreLevel(studyOneMoreLevelSelect?.value ?? studyOneMoreLevel);
  studyOneMoreLevel = level;
  const entry = pickNewStudyEntry(level);
  if (!entry) {
    quizPanel.hidden = false;
    const label = STUDY_ONE_MORE_LEVELS.find((item) => item.id === level)?.label ?? "Very Easy";
    quizPanel.innerHTML = `<p class="muted">No ${escapeHtml(label)} candidate found right now.</p>`;
    return;
  }
  await recordStudyOneMoreEvent(entry, "study-one-more-introduced");
  renderStudyOneMoreEntry(entry);
}

async function addStudyOneMoreCandidate(target) {
  if (!activeStudyOneMoreEntry) return;
  const entry = activeStudyOneMoreEntry;
  const pendingResult = activeQuiz?.pendingResult ?? null;
  const data = lookupTerm(entry.term);
  if (data.status !== "found") return;
  if (target === "spelling") {
    await saveSpellingItem(data, "study-one-more");
  } else {
    const item = await saveVocabularyItem(data, "study-one-more");
    if (pendingResult?.quizResult === "miss") {
      await recordReviewRating(item, "again", "miss", pendingResult.responseMs ?? 0, "review", "study-one-more-miss");
    }
  }
  activeStudyOneMoreEntry = null;
  activeQuiz = null;
  quizPanel.hidden = false;
  quizPanel.innerHTML = `
    <p class="muted">Added "${escapeHtml(entry.term)}" to ${target === "spelling" ? "Spelling" : "Memorize"}.</p>
    <div class="quiz-actions">
      <button class="secondary-button" type="button" data-quiz-close="1">Close</button>
      <button type="button" data-study-next="1">Study another</button>
    </div>
  `;
}

async function skipStudyOneMoreCandidate() {
  if (activeStudyOneMoreEntry) {
    await recordStudyOneMoreEvent(activeStudyOneMoreEntry, "study-one-more-skipped");
  }
  activeStudyOneMoreEntry = null;
  activeQuiz = null;
  quizPanel.hidden = false;
  quizPanel.innerHTML = `
    <p class="muted">Skipped. WordFan will avoid this word for the rest of today.</p>
    <div class="quiz-actions">
      <button class="secondary-button" type="button" data-quiz-close="1">Close</button>
      <button type="button" data-study-next="1">Study another</button>
    </div>
  `;
}

function showStudyOneMoreMeaning() {
  if (!activeStudyOneMoreEntry || quizPanel.querySelector("[data-study-one-more-meaning]")) return;
  const actions = quizPanel.querySelector(".study-one-more-result");
  if (actions) {
    actions.insertAdjacentHTML("beforebegin", renderStudyOneMoreMeaning(activeStudyOneMoreEntry));
  }
}

function renderFsrsRatingChoices(passed, inferredRating) {
  const hint = passed ? "Choose how well you remembered it." : "Choose Again unless you still remembered part of it.";
  const buttons = [
    ["again", "Again"],
    ["hard", "Hard"],
    ["good", "Good"],
    ["easy", "Easy"],
  ];
  quizPanel.insertAdjacentHTML(
    "beforeend",
    `
      <div class="fsrs-rating-panel">
        <p class="muted">${escapeHtml(hint)}</p>
        <p class="muted">Auto-recording ${escapeHtml(FSRS_RATING_LABELS[inferredRating] ?? "Good")} shortly.</p>
        <div class="quiz-actions fsrs-ratings" aria-label="Review rating">
          ${buttons.map(([value, label]) =>
            `<button class="${value === inferredRating ? "" : "secondary-button"}" type="button" data-fsrs-rating="${value}">${label}</button>`,
          ).join("")}
        </div>
      </div>
    `,
  );
  bindFsrsRatingButtons();
  recordReviewDebug("render-rating-buttons", {
    passed,
    inferredRating,
    buttonCount: quizPanel.querySelectorAll("[data-fsrs-rating]").length,
  });
}

function bindFsrsRatingButtons() {
  quizPanel.querySelectorAll("[data-fsrs-rating]").forEach((button) => {
    if (!(button instanceof HTMLButtonElement) || button.dataset.ratingBound === "1") return;
    button.dataset.ratingBound = "1";
    const activate = (event, source) => {
      event.preventDefault();
      event.stopPropagation();
      recordReviewDebug("rating-direct", {
        source,
        rating: button.dataset.fsrsRating,
        disabled: button.disabled,
        topmost: isElementTopmost(button),
      });
      if (!button.disabled) void handleFsrsRating(button.dataset.fsrsRating);
    };
    button.addEventListener("pointerdown", () => {
      recordReviewDebug("rating-pointerdown", {
        rating: button.dataset.fsrsRating,
        topmost: isElementTopmost(button),
      });
    }, { capture: true });
    button.addEventListener("pointerup", (event) => activate(event, "button-pointerup"), { capture: true });
    button.addEventListener("touchend", (event) => activate(event, "button-touchend"), { capture: true, passive: false });
    button.addEventListener("click", (event) => activate(event, "button-click"), { capture: true });
  });
}

function scheduleVocabularyAutoRating(rating) {
  if (!activeQuiz?.pendingResult) return;
  const quizId = activeQuiz.id;
  clearVocabularyAutoRatingTimer();
  recordReviewDebug("auto-rating-schedule", { rating, pauseMs: VOCABULARY_AUTO_RATING_PAUSE_MS });
  activeQuiz.autoRatingTimer = window.setTimeout(() => {
    recordReviewDebug("auto-rating-fire", {
      rating,
      quizId,
      currentQuizId: activeQuiz?.id ?? null,
      canSubmit: Boolean(activeQuiz?.id === quizId && activeQuiz.pendingResult && !activeQuiz.ratingSubmitted),
    });
    if (activeQuiz?.id === quizId && activeQuiz.pendingResult && !activeQuiz.ratingSubmitted) {
      void handleFsrsRating(rating);
    }
  }, VOCABULARY_AUTO_RATING_PAUSE_MS);
}

function ratingButtonFromEvent(event) {
  const target = event.target instanceof Element ? event.target : null;
  const button = target?.closest("[data-fsrs-rating]");
  return button instanceof HTMLButtonElement ? button : null;
}

function activateRatingButtonFromEvent(event, source) {
  const button = ratingButtonFromEvent(event);
  if (!button) return false;
  event.preventDefault();
  event.stopPropagation();
  recordReviewDebug("rating-activate", {
    source,
    rating: button.dataset.fsrsRating,
    disabled: button.disabled,
  });
  if (!button.disabled) void handleFsrsRating(button.dataset.fsrsRating);
  return true;
}

async function handleQuizAnswer(index) {
  if (!activeQuiz || activeQuiz.answered) return;
  const selected = activeQuiz.options[index];
  if (!selected) return;
  if (!activeQuiz.optionsRevealed && activeQuiz.stepwise) revealQuizOptions();
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
  recordReviewDebug("answer", { selectedIndex: index, passed, responseMs, inferredRating: rating });
  if (activeQuiz.mode === "new") {
    await handleNewWordQuizResult(passed, rating, responseMs);
    return;
  }
  if (activeQuiz.mode === "study-one-more") {
    activeQuiz.pendingResult = { passed, responseMs, quizResult: passed ? "pass" : "miss" };
    if (passed) await recordKnownWord(activeQuiz.entry, responseMs);
    quizPanel.querySelector(".study-one-more-card")?.insertAdjacentHTML("beforeend", renderStudyOneMoreActions(passed));
    return;
  }
  activeQuiz.pendingResult = { passed, responseMs, quizResult: passed ? "pass" : "miss" };
  renderFsrsRatingChoices(passed, rating);
  scheduleVocabularyAutoRating(rating);
}

async function handleFsrsRating(rating) {
  recordReviewDebug("rating-request", { rating, hasPending: Boolean(activeQuiz?.pendingResult) });
  if (!activeQuiz?.pendingResult || activeQuiz.ratingSubmitted || !FSRS_RATING_LABELS[rating]) {
    recordReviewDebug("rating-ignored", {
      rating,
      reason: !activeQuiz?.pendingResult ? "no-pending-result" : activeQuiz.ratingSubmitted ? "already-submitted" : "invalid-rating",
    });
    return;
  }
  activeQuiz.ratingSubmitted = true;
  clearVocabularyAutoRatingTimer();
  const { sourceItem } = activeQuiz.entry;
  const { quizResult, responseMs } = activeQuiz.pendingResult;
  const session = activeVocabularyReviewSession;
  const currentSessionItem = session?.queue?.[session.index] ?? null;
  recordReviewDebug("rating-record-start", {
    rating,
    sourceTerm: sourceItem?.term ?? null,
    currentSessionTerm: currentSessionItem?.term ?? null,
  });
  let reviewResult;
  try {
    reviewResult = await recordReviewRating(sourceItem, rating, quizResult, responseMs, activeQuiz.mode);
  } catch (error) {
    activeQuiz.ratingSubmitted = false;
    recordReviewDebug("rating-error", {
      rating,
      error: error instanceof Error ? error.message : String(error),
    });
    const panel = quizPanel.querySelector(".fsrs-rating-panel");
    panel?.insertAdjacentHTML("beforeend", `<p class="error">Could not record this rating. Try again.</p>`);
    return;
  }
  const shouldAdvanceSession = currentSessionItem?.normalizedTerm === sourceItem.normalizedTerm;
  if (shouldAdvanceSession && session) session.index += 1;
  recordReviewDebug("rating-recorded", {
    rating,
    shouldAdvanceSession,
    nextSessionIndex: session?.index ?? null,
    nextTerm: session?.queue?.[session.index]?.term ?? null,
    persistenceStatus: reviewResult?.persistenceStatus ?? "unknown",
  });
  quizPanel.hidden = false;
  quizPanel.innerHTML = `<p class="muted">Recorded as ${escapeHtml(FSRS_RATING_LABELS[rating])}. Loading next word...</p>`;
  activeQuiz = null;
  window.setTimeout(() => {
    if (shouldAdvanceSession && session.index < session.queue.length) {
      recordReviewDebug("advance-next", { nextTerm: session.queue[session.index]?.term ?? null });
      void startDueReview({ continueSession: true });
      return;
    }
    activeVocabularyReviewSession = null;
    recordReviewDebug("review-session-complete", { rating });
    quizPanel.innerHTML = `<p class="muted">All due reviews are done. ${escapeHtml(FSRS_RATING_LABELS[rating])} rating recorded.</p><div class="quiz-actions"><button class="secondary-button" type="button" data-quiz-close="1">Close</button></div>`;
  }, 350);
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
  const at = item.queriedAt ?? item.searchedAt ?? nowIso();
  const normalizedItem = markDebugRecord({
    ...item,
    searchedAt: item.searchedAt ?? at,
    queriedAt: item.queriedAt ?? at,
  });
  historyItems = [normalizedItem, ...historyItems.filter((entry) => entry.term !== normalizedItem.term)].slice(0, 10);
  await saveValue("history", historyItems);
  renderHistory();
  if (normalizedItem?.term) prefetchAiChat(normalizedItem.term);
}

async function runLookup({ commit = false } = {}) {
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
    if (commit && data.status === "found") {
      const at = nowIso();
      await addHistory({ term: data.term, searchedAt: at, queriedAt: at, queryMs: data.queryMs ?? 0 });
    }
    return data;
  } catch (error) {
    result.innerHTML = `<p class="error">${escapeHtml(error instanceof Error ? error.message : String(error))}</p>`;
    return null;
  }
}

function runLoadedLookupForReturn() {
  const value = termInput.value;
  try {
    const data = lookupTerm(value);
    renderResult(data);
    if (data.status === "found") {
      const at = nowIso();
      void addHistory({ term: data.term, searchedAt: at, queriedAt: at, queryMs: data.queryMs ?? 0 });
    }
    return data;
  } catch (error) {
    result.innerHTML = `<p class="error">${escapeHtml(error instanceof Error ? error.message : String(error))}</p>`;
    return null;
  }
}

let invalidFlagHandle = 0;
function flagSearchInputInvalid() {
  termInput.classList.add("input-invalid");
  window.clearTimeout(invalidFlagHandle);
  invalidFlagHandle = window.setTimeout(() => termInput.classList.remove("input-invalid"), 1500);
}

// Return key: always search; then apply the configured "On Return" save action + optional speak.
async function handleReturnKey() {
  const value = termInput.value;
  if (!value.trim()) return;
  let data = null;
  let spokeDuringKeypress = false;
  if (loaded) {
    data = runLoadedLookupForReturn();
    if (speakOnReturn && data?.status === "found") {
      speakTerm(data.term);
      spokeDuringKeypress = true;
    }
  } else {
    data = await runLookup({ commit: true });
  }
  if (!spokeDuringKeypress && speakOnReturn && data?.status === "found") speakTerm(data.term);
  if (onReturnAction === "vocabulary") {
    if (data?.status === "found") await saveWithUndo(data, ["vocabulary"], "return");
  } else if (onReturnAction === "spelling") {
    if (data?.status === "found") {
      await saveWithUndo(data, ["spelling"], "return");
    } else {
      // Non-dictionary word can't go to the spelling list (dictionary words only): flag it red.
      flagSearchInputInvalid();
    }
  } else if (onReturnAction === "both") {
    if (data?.status === "found") {
      await saveWithUndo(data, ["vocabulary", "spelling"], "return");
    } else {
      // Spelling requires a dictionary word, so "both" can't fully apply: flag it red.
      flagSearchInputInvalid();
    }
  }
}

// --- Undo-after-save -------------------------------------------------------
// Remember only the records a save just *created* (not re-saves of words the
// user already had) so a single Undo tap removes exactly the new ones.
let pendingUndo = null; // { term, entries: [{ list: "vocabulary" | "spelling" }] }

async function saveWithUndo(data, lists, reason) {
  const created = [];
  for (const list of lists) {
    const existed = list === "spelling" ? Boolean(getSpellingItem(data.term)) : Boolean(getVocabularyItem(data.term));
    if (list === "spelling") await saveSpellingItem(data, reason);
    else await saveVocabularyItem(data, reason);
    if (!existed) created.push({ list });
  }
  pendingUndo = created.length ? { term: data.term, entries: created } : null;
  updateUndoButton();
}

function updateUndoButton() {
  if (undoSaveButton) undoSaveButton.hidden = !pendingUndo;
}

function clearPendingUndo() {
  if (!pendingUndo) return;
  pendingUndo = null;
  updateUndoButton();
}

async function performUndoSave() {
  if (!pendingUndo) return;
  const { term, entries } = pendingUndo;
  pendingUndo = null;
  updateUndoButton();
  for (const entry of entries) {
    if (entry.list === "spelling") await removeSpellingItemHard(term);
    else await removeVocabularyItemHard(term);
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

function tokenCoversScopes(requestedScopes) {
  const have = new Set(googleAuth.scopes ?? []);
  return requestedScopes.every((scope) => have.has(scope));
}

async function persistGoogleAuth() {
  await saveValue("googleAuth", {
    accessToken: googleAuth.accessToken,
    expiresAt: googleAuth.expiresAt,
    scopes: googleAuth.scopes,
    profile: googleAuth.profile,
  });
}

function hasGoogleGrant() {
  return googleGrantGranted || Boolean(googleAuth.profile);
}

async function setGoogleGrant(granted) {
  googleGrantGranted = Boolean(granted);
  await saveValue("googleGrant", googleGrantGranted);
}

// iOS home-screen ("Add to Home Screen") apps run standalone and can block Google's
// first sign-in popup from delivering its token. Detect that so we can guide the user.
function isStandalonePwa() {
  return window.navigator?.standalone === true
    || Boolean(window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);
}

const STANDALONE_LOGIN_HINT =
  "On iPhone, the home-screen app can also block Google's first sign-in. Once the origin above is authorized, sign in once in Safari (the browser tab) with the same Google account, then reopen the home-screen app — it will reconnect automatically.";

function describeSignInError(error, {
  standalone = isStandalonePwa(),
  hasClientId = Boolean(getGoogleClientId()),
  origin = window.location.origin,
} = {}) {
  const base = error instanceof Error ? error.message : String(error);
  // Without a client ID this is a config gap, not an auth failure — show the raw message.
  if (!hasClientId) return base;
  // A blocked popup is a browser/activation problem, not an OAuth-config problem — give the
  // matching advice instead of the (misleading) origin guidance.
  if (/popup/i.test(base)) {
    return `${base} The sign-in popup was blocked. Reopen Settings (this reloads Google sign-in), make sure Safari is not blocking pop-ups for this site, then tap Sign in with Google again.`;
  }
  const parts = [base];
  // The most common cause of a silent sign-in failure is an origin that is not registered on
  // the OAuth client. Show the exact origin (including port) so the user can verify/add it.
  parts.push(`This app's web origin is ${origin} — open your Google Cloud OAuth client and make sure that EXACT value (scheme, host, and port) is listed under "Authorized JavaScript origins", then wait a minute and try again.`);
  if (standalone) parts.push(STANDALONE_LOGIN_HINT);
  return parts.join(" ");
}

// --- Sign-in diagnostics: capture exactly what happens during an OAuth attempt so failures
// can be triaged on-device (no Mac/Web Inspector needed) or sent to the server logs. ---
const authDiagnostics = [];

function recordAuthDiag(event, detail = {}) {
  authDiagnostics.push({ at: new Date().toISOString(), event, ...detail });
  if (authDiagnostics.length > 60) authDiagnostics.splice(0, authDiagnostics.length - 60);
}

function authDiagnosticsSnapshot() {
  return {
    appVersion: APP_VERSION,
    origin: window.location.origin,
    href: window.location.href,
    // crossOriginIsolated === true means COOP:same-origin is still in effect (the regression);
    // the OAuth-popup-safe COOP:same-origin-allow-popups makes this false.
    crossOriginIsolated: window.crossOriginIsolated === true,
    secureContext: window.isSecureContext === true,
    standalone: isStandalonePwa(),
    onLine: navigator.onLine,
    userAgent: navigator.userAgent,
    clientIdConfigured: Boolean(getGoogleClientId()),
    gisScriptLoaded: Boolean(window.google?.accounts?.oauth2),
    hasGrant: hasGoogleGrant(),
    hasToken: Boolean(googleAuth.accessToken),
    scopes: googleAuth.scopes ?? [],
    vocabularyCount: vocabularyItems.length,
    dataDecryptBlocked: dataDecryptBlock,
    syncEncryption: {
      passphraseSource: getLocalDataPassphraseSource(),
      warning: syncEncryptionNotice(),
    },
    lastSync: lastSyncInfo,
    events: authDiagnostics.slice(),
  };
}

function renderAuthDiagnostics() {
  if (!authDiagnosticsPre) return;
  authDiagnosticsPre.hidden = false;
  authDiagnosticsPre.textContent = JSON.stringify(authDiagnosticsSnapshot(), null, 2);
}

async function sendAuthDiagnostics() {
  const snapshot = authDiagnosticsSnapshot();
  renderAuthDiagnostics();
  if (window.location.protocol !== "https:") {
    return { sent: false, reason: "Diagnostics can only POST to the HTTPS server. Read them on-screen above instead." };
  }
  try {
    const response = await fetch("/__test_results", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "auth-diagnostics", completedAt: nowIso(), diagnostics: snapshot }),
    });
    return { sent: response.ok, status: response.status };
  } catch (error) {
    return { sent: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

// The token client's callbacks are fixed at initTokenClient time, so route them through a
// module-level pending settler. Each requestAccessToken call is serial (the user signs in once).
function settleGoogleToken(fn, value) {
  const settlers = pendingTokenSettlers;
  if (!settlers) return;
  pendingTokenSettlers = null;
  window.clearTimeout(settlers.timer);
  fn === "resolve" ? settlers.resolve(value) : settlers.reject(value);
}

// Create the GIS token client once (idempotent) so it is ready BEFORE the user taps Sign in.
// iOS Safari only allows the OAuth popup to open synchronously inside the tap's user-activation
// window; if we first await the GIS script over the network (~1.4s observed), the activation is
// gone and the popup is blocked ("popup_failed_to_open"). Pre-creating avoids that await.
function getOrCreateGoogleTokenClient() {
  const clientId = getGoogleClientId();
  const scope = getGoogleScopes(false);
  if (!clientId || !window.google?.accounts?.oauth2) return null;
  if (googleTokenClient && googleTokenClientClientId === clientId && googleTokenClientScope === scope) {
    return googleTokenClient;
  }
  googleTokenClient = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope,
    prompt: "",
    callback: (response) => {
      recordAuthDiag("callback", {
        hasToken: Boolean(response?.access_token),
        error: response?.error ?? null,
        errorDescription: response?.error_description ?? null,
        grantedScopes: response?.scope ?? null,
      });
      if (response?.error) settleGoogleToken("reject", new Error(response.error_description ?? response.error));
      else settleGoogleToken("resolve", response);
    },
    error_callback: (error) => {
      recordAuthDiag("error_callback", { type: error?.type ?? null, message: error?.message ?? null });
      settleGoogleToken("reject", new Error(error?.message || error?.type || "Google sign-in was closed before completing."));
    },
  });
  googleTokenClientClientId = clientId;
  googleTokenClientScope = scope;
  return googleTokenClient;
}

// Load GIS and pre-create the token client ahead of time (called at startup and when the menu
// opens) so the sign-in popup can open synchronously on tap.
function preloadGoogleIdentity() {
  if (!getGoogleClientId()) return;
  void loadScriptOnce(GOOGLE_IDENTITY_SCRIPT)
    .then(() => { getOrCreateGoogleTokenClient(); })
    .catch(() => {});
}

// One token request. `prompt:""` is a silent refresh (hidden iframe, no UI) and only works
// when the user already granted consent and has an active Google session; `prompt:"consent"`
// shows the interactive chooser. error_callback rejects on a closed/blocked popup so the promise
// never hangs.
async function requestGoogleAccessToken(clientId, scope, prompt, timeoutMs = 120000) {
  // Prefer the pre-created client so requestAccessToken runs with NO preceding await — this keeps
  // the popup inside the user-activation window on iOS. Only fall back to loading the script (and
  // losing activation) if it was never preloaded.
  let client = getOrCreateGoogleTokenClient();
  if (!client) {
    recordAuthDiag("gis-not-preloaded", { prompt: prompt || "(silent)" });
    try {
      await loadScriptOnce(GOOGLE_IDENTITY_SCRIPT);
    } catch (error) {
      recordAuthDiag("gis-script-load-failed", { message: error instanceof Error ? error.message : String(error) });
      throw error;
    }
    client = getOrCreateGoogleTokenClient();
    if (!client) throw new Error("Google Identity Services failed to initialize.");
  }
  recordAuthDiag("request-token", { prompt: prompt || "(silent)", timeoutMs, gisLoaded: true, preloaded: true });
  return new Promise((resolve, reject) => {
    // Safety net: if neither callback fires (e.g. popup closed without detection), time out so
    // the user always gets feedback instead of a silent hang.
    const timer = window.setTimeout(() => {
      recordAuthDiag("timeout", { prompt: prompt || "(silent)", afterMs: timeoutMs });
      settleGoogleToken("reject", new Error("Google did not return a sign-in response. The sign-in window may have been blocked or closed before completing."));
    }, timeoutMs);
    pendingTokenSettlers = { resolve, reject, timer };
    try {
      client.requestAccessToken({ prompt });
      recordAuthDiag("requestAccessToken-called", { prompt: prompt || "(silent)" });
    } catch (error) {
      recordAuthDiag("request-threw", { message: error instanceof Error ? error.message : String(error) });
      settleGoogleToken("reject", error instanceof Error ? error : new Error(String(error)));
    }
  });
}

function applyGoogleTokenResponse(tokenResponse, requestedScope) {
  googleAuth = {
    ...googleAuth,
    accessToken: tokenResponse.access_token,
    expiresAt: Date.now() + Number(tokenResponse.expires_in ?? 3600) * 1000,
    scopes: String(tokenResponse.scope ?? requestedScope).split(/\s+/).filter(Boolean),
  };
}

async function ensureGoogleToken(includeGemini = false, { interactive = true } = {}) {
  const clientId = getGoogleClientId();
  if (!clientId) throw new Error("Google OAuth client ID is not configured in wordlover-config.js.");
  const scope = getGoogleScopes(includeGemini);
  const requestedScopeList = scope.split(/\s+/).filter(Boolean);
  if (
    googleAuth.accessToken
    && googleAuth.expiresAt > Date.now() + 60_000
    && tokenCoversScopes(requestedScopeList)
  ) {
    return googleAuth.accessToken;
  }

  const needsConsent = !hasGoogleGrant() || (googleAuth.scopes?.length && !tokenCoversScopes(requestedScopeList));
  let tokenResponse = null;
  recordAuthDiag("ensure-token", { interactive, hasGrant: hasGoogleGrant(), needsConsent, crossOriginIsolated: window.crossOriginIsolated === true, standalone: isStandalonePwa() });

  // Stay logged in: when a grant already exists, try a silent refresh first (no popup, no UI).
  // Short timeout so a stalled silent attempt can't block the interactive fallback.
  if (hasGoogleGrant() && !needsConsent) {
    try {
      tokenResponse = await requestGoogleAccessToken(clientId, scope, "", 15000);
    } catch (silentError) {
      recordAuthDiag("silent-refresh-failed", { message: silentError instanceof Error ? silentError.message : String(silentError) });
      tokenResponse = null;
    }
  }

  if (!tokenResponse) {
    if (!interactive) throw new Error("Google session needs a refresh. Open Settings and tap Sign in with Google.");
    tokenResponse = await requestGoogleAccessToken(clientId, scope, "consent");
  }

  applyGoogleTokenResponse(tokenResponse, scope);
  recordAuthDiag("token-applied", { scopes: googleAuth.scopes });
  // Persist the token immediately so a later best-effort step (profile fetch) can't lose it.
  await setGoogleGrant(true);
  await persistGoogleAuth();
  try {
    await loadGoogleProfile();
    recordAuthDiag("profile-loaded", { email: googleAuth.profile?.email ?? null });
    await persistGoogleAuth();
  } catch (profileError) {
    recordAuthDiag("profile-failed", { message: profileError instanceof Error ? profileError.message : String(profileError) });
    /* profile is best-effort; the token is already saved */
  }
  renderAppMenu();
  startAutoSync();
  return googleAuth.accessToken;
}

// Periodic safety net for long-open sessions; the main triggers are app launch + focus/online.
const AUTO_SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000;
// Opportunistic (focus/online/visibility) syncs are throttled so active use doesn't spam Drive.
const OPPORTUNISTIC_SYNC_THROTTLE_MS = 5 * 60 * 1000;
let autoSyncTimer = 0;
let lastAutoSyncAt = 0;

function startAutoSync() {
  stopAutoSync();
  if (!googleAuth.accessToken) return;
  autoSyncTimer = window.setInterval(() => {
    void runAutoSync("interval");
  }, AUTO_SYNC_INTERVAL_MS);
}

function syncedToday() {
  const at = lastSyncSummary?.at ? Date.parse(lastSyncSummary.at) : 0;
  if (!at) return false;
  return startOfDay(new Date(at)).getTime() === startOfDay(new Date()).getTime();
}

function stopAutoSync() {
  if (autoSyncTimer) {
    window.clearInterval(autoSyncTimer);
    autoSyncTimer = 0;
  }
}

function canAutoReconnectGoogle() {
  return Boolean(getGoogleClientId() && hasGoogleGrant() && navigator.onLine && !googleAuth.accessToken);
}

function autoReconnectGoogleSession(reason = "background", { syncAfter = false, includeGemini = false } = {}) {
  if (!canAutoReconnectGoogle()) return Promise.resolve(null);
  if (googleReconnectPromise) return googleReconnectPromise;
  recordAuthDiag("auto-reconnect-start", { reason, includeGemini, syncAfter });
  renderAppMenu();
  googleReconnectPromise = ensureGoogleToken(includeGemini, { interactive: false })
    .then((token) => {
      recordAuthDiag("auto-reconnect-success", { reason });
      if (syncAfter) void runAutoSync(`reconnect-${reason}`);
      return token;
    })
    .catch((error) => {
      recordAuthDiag("auto-reconnect-failed", { reason, message: error instanceof Error ? error.message : String(error) });
      if (!appMenu.hidden && googleAuthStatus) {
        googleAuthStatus.textContent = "Google session expired. WordFan will keep trying to reconnect automatically when this device is online.";
      }
      return null;
    })
    .finally(() => {
      googleReconnectPromise = null;
      renderAppMenu();
    });
  return googleReconnectPromise;
}

async function runAutoSync(reason) {
  if (!navigator.onLine) return;
  if (!googleAuth.accessToken) {
    await autoReconnectGoogleSession(`autosync-${reason}`);
    if (!googleAuth.accessToken) return;
  }
  const now = Date.now();
  // Daily guarantee: startup/interval always run if we have not synced yet today.
  const dailyReason = reason === "startup" || reason === "interval";
  if (dailyReason) {
    if (syncedToday()) return;
  } else if (now - lastAutoSyncAt < OPPORTUNISTIC_SYNC_THROTTLE_MS) {
    // Opportunistic triggers (focus/online/visibility) are throttled.
    return;
  }
  lastAutoSyncAt = now;
  try {
    await syncToGoogleDrive();
    renderAppMenu();
  } catch (error) {
    console.warn(`Auto-sync (${reason}) failed:`, error);
  }
}

async function googleFetch(url, options = {}, includeGemini = false) {
  const token = await ensureGoogleToken(includeGemini);
  const headers = new Headers(options.headers ?? {});
  headers.set("Authorization", `Bearer ${token}`);
  return fetch(url, { ...options, headers });
}

async function loadGoogleProfile() {
  if (!googleAuth.accessToken) return null;
  const response = await fetchWithTimeout(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${googleAuth.accessToken}` },
  }, 8000);
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
    spellingItems,
    spellingEvents,
    userDictionary: userDictionaryEntries,
    knownWords,
    autosaveEnabled: onReturnAction === "vocabulary" || onReturnAction === "both",
    onReturnAction,
    speakOnReturn,
    theme,
    uiPreferences: currentUiPreferences(),
    studyGoals,
    lastMetrics,
  };
}

async function encryptSnapshotPayload(snapshot) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await derivePassphraseAesKey(await getLocalDataPassphrase(), salt, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(snapshot));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext));
  return {
    app: "wordlover",
    format: "wordlover-user-data-aes-gcm-v1",
    appVersion: APP_VERSION,
    userDataFormatVersion: USER_DATA_FORMAT_VERSION,
    encryptedAt: nowIso(),
    passphraseSource: getLocalDataPassphraseSource(),
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
  const key = await derivePassphraseAesKey(await getLocalDataPassphrase(), salt, ["decrypt"]);
  const iv = base64ToBytes(envelope.iv);
  const ciphertext = base64ToBytes(envelope.data);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return JSON.parse(new TextDecoder().decode(plaintext));
}

async function listCheckpoints() {
  const checkpoints = await loadAllRawValues(CHECKPOINT_STORE);
  return checkpoints
    .filter((checkpoint) => checkpoint?.id && checkpoint?.envelope)
    .sort((left, right) => (right.createdAt ?? "").localeCompare(left.createdAt ?? ""));
}

async function pruneOldCheckpoints() {
  const checkpoints = await listCheckpoints();
  await Promise.all(checkpoints.slice(MAX_CHECKPOINTS).map((checkpoint) => deleteRawValue(CHECKPOINT_STORE, checkpoint.id)));
  return checkpoints.slice(0, MAX_CHECKPOINTS);
}

async function createCheckpoint(reason = "manual") {
  assertUserDataWritable(`Creating checkpoint "${reason}"`);
  const snapshot = buildUserDataSnapshot();
  const integrity = validateUserDataSnapshot(snapshot);
  const envelope = await encryptSnapshotPayload(snapshot);
  const createdAt = nowIso();
  const id = `checkpoint-${createdAt.replace(/[:.]/g, "-")}-${reason.replace(/[^a-z0-9-]/gi, "-").toLowerCase()}`;
  const checkpoint = {
    id,
    reason,
    createdAt,
    appVersion: APP_VERSION,
    userDataFormatVersion: USER_DATA_FORMAT_VERSION,
    deviceId,
    integrity,
    envelope,
  };
  await saveRawValue(CHECKPOINT_STORE, id, checkpoint);
  await pruneOldCheckpoints();
  checkpointStatus.textContent = `Checkpoint saved: ${reason}, ${integrity.vocabularyCount} words.`;
  return checkpoint;
}

async function ensureDailyCheckpoint() {
  const checkpoints = await listCheckpoints();
  if (checkpoints.some((checkpoint) => checkpoint.reason === "daily" && isToday(checkpoint.createdAt))) return null;
  return createCheckpoint("daily");
}

async function rollbackLatestCheckpoint() {
  const [latest] = await listCheckpoints();
  if (!latest) {
    checkpointStatus.textContent = "No checkpoint is available yet.";
    return null;
  }
  const confirmed = await showModal({
    title: "Rollback to latest checkpoint?",
    body: `Restore checkpoint from ${latest.createdAt}. Current data will be checkpointed first.`,
    submitText: "Rollback",
    cancelText: "Cancel",
  });
  if (!confirmed) {
    checkpointStatus.textContent = "Rollback canceled.";
    return null;
  }
  await createCheckpoint("pre-rollback");
  const snapshot = await decryptSnapshotPayload(latest.envelope);
  await applyUserDataSnapshot(snapshot, { createPreRestoreCheckpoint: false });
  checkpointStatus.textContent = `Rolled back to checkpoint from ${latest.createdAt}.`;
  return latest;
}

async function deleteAllLocalUserData() {
  const confirmation = await showModal({
    title: "Delete all local WordFan data?",
    body: "This removes your vocabulary, study progress, history, checkpoints, encrypted keys, and the installed dictionary from this device. Cloud backups are not touched. Type DELETE to confirm.",
    fields: [{ id: "confirm", label: "Type DELETE to confirm", value: "", required: true }],
    submitText: "Delete everything",
    cancelText: "Cancel",
    danger: true,
  });
  if (!confirmation || confirmation.confirm.trim().toUpperCase() !== "DELETE") return false;

  checkpointStatus.textContent = "Deleting local WordFan data...";
  dictionaryDb?.close();
  dictionaryDb = null;
  loaded = false;
  vocabularyItems = [];
  studyEvents = [];
  historyItems = [];
  knownWords = [];

  try {
    const db = await getUserDb();
    db.close();
  } catch {
    /* ignore */
  }
  dbPromise = null;

  await new Promise((resolve) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });

  if (navigator.storage?.getDirectory) {
    try {
      const root = await navigator.storage.getDirectory();
      for await (const entry of root.values?.() ?? []) {
        await root.removeEntry(entry.name, { recursive: true }).catch(() => {});
      }
    } catch {
      /* ignore OPFS clear failures */
    }
  }

  if ("caches" in self) {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    } catch {
      /* ignore cache clear failures */
    }
  }

  if ("serviceWorker" in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    } catch {
      /* ignore SW unregister failures */
    }
  }

  encryptionKeyPromise = null;
  googleAuth = { accessToken: null, expiresAt: 0, profile: null, scopes: [] };
  googleGrantGranted = false;

  checkpointStatus.textContent = "All local data deleted. Reloading...";
  window.setTimeout(() => window.location.reload(), 400);
  return true;
}

async function replaceUserDataAtomically({
  nextVocabularyItems,
  nextStudyEvents,
  nextSpellingItems = [],
  nextSpellingEvents = [],
  nextUserDictionary = [],
  nextKnownWords = [],
  kvValues,
  allowDuringDecryptBlock = false,
}) {
  assertUserDataWritable("Replacing local user data", { allowDuringDecryptBlock });
  const encrypt = (records, keyOf) => Promise.all(records.map(async (record) => ({ key: keyOf(record), value: await encryptValue(record) })));
  const encryptedVocabulary = await encrypt(nextVocabularyItems, (item) => item.normalizedTerm);
  const encryptedEvents = await encrypt(nextStudyEvents, (event) => event.id);
  const encryptedSpelling = await encrypt(nextSpellingItems, (item) => item.normalizedTerm);
  const encryptedSpellingEvents = await encrypt(nextSpellingEvents, (event) => event.id);
  const encryptedUserDictionary = await encrypt(nextUserDictionary, (entry) => entry.normalizedTerm);
  const encryptedKnown = await encrypt(nextKnownWords, (record) => record.normalizedTerm);
  const encryptedKv = await Promise.all(
    Object.entries(kvValues).map(async ([key, value]) => ({
      key,
      value: await encryptValue(value),
    })),
  );
  const db = await getUserDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(
      [VOCABULARY_STORE, STUDY_EVENT_STORE, SPELLING_STORE, SPELLING_EVENT_STORE, USER_DICTIONARY_STORE, KNOWN_STORE, STORE],
      "readwrite",
    );
    const vocabularyStore = tx.objectStore(VOCABULARY_STORE);
    const eventStore = tx.objectStore(STUDY_EVENT_STORE);
    const spellingStore = tx.objectStore(SPELLING_STORE);
    const spellingEventStore = tx.objectStore(SPELLING_EVENT_STORE);
    const userDictStore = tx.objectStore(USER_DICTIONARY_STORE);
    const knownStore = tx.objectStore(KNOWN_STORE);
    const kvStore = tx.objectStore(STORE);
    vocabularyStore.clear();
    eventStore.clear();
    spellingStore.clear();
    spellingEventStore.clear();
    userDictStore.clear();
    knownStore.clear();
    encryptedVocabulary.forEach((record) => vocabularyStore.put(record.value, record.key));
    encryptedEvents.forEach((record) => eventStore.put(record.value, record.key));
    encryptedSpelling.forEach((record) => spellingStore.put(record.value, record.key));
    encryptedSpellingEvents.forEach((record) => spellingEventStore.put(record.value, record.key));
    encryptedUserDictionary.forEach((record) => userDictStore.put(record.value, record.key));
    encryptedKnown.forEach((record) => knownStore.put(record.value, record.key));
    encryptedKv.forEach((record) => kvStore.put(record.value, record.key));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("User data replace transaction aborted."));
  });
}

function driveNameQuery(fileName) {
  return encodeURIComponent(`name = '${String(fileName).replace(/'/g, "\\'")}' and trashed = false`);
}

function jsonByteLength(value) {
  try {
    return new TextEncoder().encode(JSON.stringify(value ?? [])).length;
  } catch {
    return 0;
  }
}

async function recordSyncSummary(driveResult) {
  const driveBytes = Number(driveResult?.size ?? 0) || 0;
  lastSyncSummary = {
    at: nowIso(),
    vocabWords: vocabularyItems.length,
    spellingWords: spellingItems.length,
    knownWords: knownWords.length,
    vocabBytes: jsonByteLength(vocabularyItems),
    spellingBytes: jsonByteLength(spellingItems),
    knownBytes: jsonByteLength(knownWords),
    driveBytes,
    driveModifiedTime: driveResult?.modifiedTime ?? null,
    // Legacy fields kept for back-compat with older readers.
    words: vocabularyItems.length,
    sizeBytes: driveBytes,
  };
  await saveValue("lastSyncSummary", lastSyncSummary).catch(() => {});
}

function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n <= 0) return "unknown size";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function formatSyncTime(iso) {
  if (!iso) return "never";
  const ms = Date.parse(iso);
  if (!ms) return "never";
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return iso;
  }
}

function explainDriveError(status, body) {
  const text = String(body ?? "");
  if (status === 403 && /accessNotConfigured|has not been used in project|Drive API/i.test(text)) {
    const project = text.match(/project[\s:"]*?(\d{6,})/i)?.[1];
    return `Google Drive API is not enabled for this sign-in's Cloud project${project ? ` (${project})` : ""}. In Google Cloud Console -> APIs & Services -> Library, enable "Google Drive API" for that project, wait ~1 minute, then Sync again.`;
  }
  if (status === 403) {
    return `Google Drive denied access (403). Make sure the Drive API is enabled for this project and the drive.appdata scope is granted (sign out and back in if you just changed it). Raw: ${text.slice(0, 200)}`;
  }
  if (status === 401) {
    return `Google Drive auth expired (401). Sign out and sign in again. Raw: ${text.slice(0, 200)}`;
  }
  return `Google Drive request failed: ${status} ${text.slice(0, 300)}`;
}

async function listGoogleDriveSnapshots() {
  const fileName = CONFIG.googleDriveFileName ?? "wordlover-user-data.json";
  const response = await googleFetch(
    `${GOOGLE_DRIVE_FILES_URL}?spaces=appDataFolder&fields=files(id,name,modifiedTime,headRevisionId)&orderBy=modifiedTime desc&q=${driveNameQuery(fileName)}`,
  );
  if (!response.ok) throw new Error(explainDriveError(response.status, await response.text()));
  const data = await response.json();
  return data.files ?? [];
}

async function getGoogleDriveSnapshotMetadata(fileId) {
  const response = await googleFetch(`${GOOGLE_DRIVE_FILES_URL}/${fileId}?fields=id,name,modifiedTime,headRevisionId,size`);
  if (!response.ok) throw new Error(explainDriveError(response.status, await response.text()));
  const data = await response.json();
  data.etag = response.headers.get("ETag");
  return data;
}

function assertDriveRevisionUnchanged(before, latest) {
  if (!before?.id || !latest?.id) return;
  if (before.headRevisionId && latest.headRevisionId && before.headRevisionId !== latest.headRevisionId) {
    throw new Error("Drive backup changed while sync was running. Sync again so WordFan can merge the latest revision safely.");
  }
  if (!before.headRevisionId && before.modifiedTime && latest.modifiedTime && before.modifiedTime !== latest.modifiedTime) {
    throw new Error("Drive backup changed while sync was running. Sync again so WordFan can merge the latest revision safely.");
  }
}

async function syncToGoogleDrive() {
  assertUserDataWritable("Google Drive sync");
  // Capture the error (and the stage it failed at) so a failed sync is diagnosable from the
  // diagnostics snapshot — the most common failure is the very first Drive list call (e.g. the
  // Drive API not enabled for the OAuth client's project -> 403).
  lastSyncInfo = {
    at: nowIso(),
    stage: "list",
    filesFound: null,
    localCountBefore: vocabularyItems.length,
    remoteCount: null,
    mergedCount: null,
    decrypted: null,
    action: null,
    error: null,
  };
  try {
    return await syncToGoogleDriveInner();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    lastSyncInfo.error = message;
    driveSyncState = "error";
    recordAuthDiag("sync-error", { stage: lastSyncInfo.stage, message });
    throw error;
  }
}

async function syncToGoogleDriveInner() {
  googleAuthStatus.textContent = "Checking Google Drive for existing backup...";
  const fileName = CONFIG.googleDriveFileName ?? "wordlover-user-data.json";
  const snapshots = await listGoogleDriveSnapshots();
  const existing = snapshots[0] ?? null;
  lastSyncInfo.filesFound = snapshots.length;
  lastSyncInfo.action = existing?.id ? "merge" : "create";

  let snapshotToUpload;
  let mergedSnapshotToApply = null;
  if (existing?.id) {
    lastSyncInfo.stage = "read";
    const readResponse = await googleFetch(`${GOOGLE_DRIVE_FILES_URL}/${existing.id}?alt=media`);
    if (!readResponse.ok) throw new Error(`Google Drive read failed: ${readResponse.status} ${await readResponse.text()}`);
    const remoteEnvelope = await readResponse.json();
    let remoteSnapshot = null;
    lastSyncInfo.stage = "decrypt";
    try {
      remoteSnapshot = await decryptSnapshotPayload(remoteEnvelope);
      lastSyncInfo.decrypted = true;
    } catch (error) {
      lastSyncInfo.decrypted = false;
      throw new Error("Could not decrypt the existing Drive backup. The local passphrase on this device does not match the device that wrote it.");
    }
    lastSyncInfo.remoteCount = Array.isArray(remoteSnapshot.vocabularyItems) ? remoteSnapshot.vocabularyItems.length : 0;
    googleAuthStatus.textContent = "Merging Drive backup with local data...";
    mergedSnapshotToApply = mergeSnapshots(buildUserDataSnapshot(), remoteSnapshot);
    snapshotToUpload = mergedSnapshotToApply;
    lastSyncInfo.mergedCount = Array.isArray(mergedSnapshotToApply.vocabularyItems) ? mergedSnapshotToApply.vocabularyItems.length : 0;
  } else {
    snapshotToUpload = buildUserDataSnapshot();
    lastSyncInfo.mergedCount = vocabularyItems.length;
  }

  googleAuthStatus.textContent = "Encrypting and uploading merged snapshot...";
  lastSyncInfo.stage = "upload";
  const encryptedSnapshot = await encryptSnapshotPayload(snapshotToUpload);
  if (existing?.id) {
    lastSyncInfo.stage = "revision-check";
    const latestMetadata = await getGoogleDriveSnapshotMetadata(existing.id);
    assertDriveRevisionUnchanged(existing, latestMetadata);
    lastSyncInfo.stage = "upload";
    const uploadHeaders = { "Content-Type": "application/json" };
    if (latestMetadata.etag) uploadHeaders["If-Match"] = latestMetadata.etag;
    const response = await googleFetch(`${GOOGLE_DRIVE_UPLOAD_URL}/${existing.id}?uploadType=media&fields=id,name,modifiedTime,size,headRevisionId`, {
      method: "PATCH",
      headers: uploadHeaders,
      body: JSON.stringify(encryptedSnapshot),
    });
    if (!response.ok) throw new Error(`Google Drive sync failed: ${response.status} ${await response.text()}`);
    const resultData = await response.json();
    if (mergedSnapshotToApply) {
      googleAuthStatus.textContent = "Checkpointing before applying merged Drive data...";
      lastSyncInfo.stage = "checkpoint";
      await createCheckpoint("pre-sync-merge");
      googleAuthStatus.textContent = "Applying merged Drive data locally...";
      lastSyncInfo.stage = "apply";
      await applyUserDataSnapshot(mergedSnapshotToApply, { createPreRestoreCheckpoint: false });
    }
    await recordSyncSummary(resultData);
    const notice = syncEncryptionNotice();
    googleAuthStatus.textContent = [
      `Synced. Found ${lastSyncInfo.filesFound} Drive backup(s); it had ${lastSyncInfo.remoteCount} word(s). After merge you have ${lastSyncInfo.mergedCount} word(s).`,
      notice,
    ].filter(Boolean).join(" ");
    driveSyncState = "synced";
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
  const response = await googleFetch(`${GOOGLE_DRIVE_UPLOAD_URL}?uploadType=multipart&fields=id,name,modifiedTime,size,headRevisionId`, {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  if (!response.ok) throw new Error(`Google Drive sync failed: ${response.status} ${await response.text()}`);
  const resultData = await response.json();
  await recordSyncSummary(resultData);
  const uploadMessage = lastSyncInfo.localCountBefore === 0
    ? `No existing Drive backup found in this account, and this device has 0 words — nothing to sync yet. Add words (or Sync on the device that has them) first. If the other device IS signed into the same Google account here, check both devices use the SAME OAuth client ID.`
    : `No existing Drive backup found — uploaded your ${lastSyncInfo.localCountBefore} local word(s) as the first backup.`;
  const notice = syncEncryptionNotice();
  googleAuthStatus.textContent = [uploadMessage, notice].filter(Boolean).join(" ");
  driveSyncState = "synced";
  syncStatus.textContent = "Synced";
  return resultData;
}

async function applyUserDataSnapshot(snapshot, options = {}) {
  const { createPreRestoreCheckpoint = true, allowDuringDecryptBlock = false } = options;
  assertUserDataWritable("Applying user-data snapshot", { allowDuringDecryptBlock });
  validateUserDataSnapshot(snapshot);
  if (createPreRestoreCheckpoint && !dataDecryptBlock) await createCheckpoint("pre-restore");
  const nextHistoryItems = Array.isArray(snapshot.historyItems) ? snapshot.historyItems : [];
  const nextStudyEvents = mergeStudyEventSources(Array.isArray(snapshot.studyEvents) ? snapshot.studyEvents : [], []);
  const nextSpellingEvents = mergeStudyEventSources(Array.isArray(snapshot.spellingEvents) ? snapshot.spellingEvents : [], []);
  const nextVocabularyItems = rebuildItemsReviewStateFromEvents(
    mergeVocabularySources(Array.isArray(snapshot.vocabularyItems) ? snapshot.vocabularyItems : [], []),
    nextStudyEvents,
  );
  const nextSpellingItems = rebuildItemsReviewStateFromEvents(
    mergeVocabularySources(Array.isArray(snapshot.spellingItems) ? snapshot.spellingItems : [], []),
    nextSpellingEvents,
  );
  const nextUserDictionary = mergeUserDictionarySources(Array.isArray(snapshot.userDictionary) ? snapshot.userDictionary : [], []);
  const nextKnownWords = mergeKnownSources(
    Array.isArray(snapshot.knownWords) ? snapshot.knownWords : [],
    [],
    activeStudyTermsFromItems(nextVocabularyItems, nextSpellingItems),
  );
  const nextOnReturnAction = normalizeOnReturnAction(snapshot.onReturnAction ?? (snapshot.autosaveEnabled === false ? "none" : "vocabulary"));
  const nextSpeakOnReturn = Boolean(snapshot.speakOnReturn ?? false);
  const nextTheme = THEME_IDS.includes(snapshot.theme) ? snapshot.theme : DEFAULT_THEME;
  const nextUiPreferences = normalizeUiPreferences(snapshot.uiPreferences ?? {});
  const nextLastMetrics = snapshot.lastMetrics ?? lastMetrics;

  await replaceUserDataAtomically({
    nextVocabularyItems,
    nextStudyEvents,
    nextSpellingItems,
    nextSpellingEvents,
    nextUserDictionary,
    nextKnownWords,
    allowDuringDecryptBlock,
    kvValues: {
      history: nextHistoryItems,
      onReturnAction: nextOnReturnAction,
      speakOnReturn: nextSpeakOnReturn,
      theme: nextTheme,
      uiPreferences: nextUiPreferences,
      lastMetrics: nextLastMetrics,
    },
  });

  historyItems = nextHistoryItems;
  vocabularyItems = nextVocabularyItems;
  studyEvents = nextStudyEvents;
  spellingItems = nextSpellingItems;
  spellingEvents = nextSpellingEvents;
  userDictionaryEntries = nextUserDictionary;
  knownWords = nextKnownWords;
  onReturnAction = nextOnReturnAction;
  speakOnReturn = nextSpeakOnReturn;
  theme = nextTheme;
  applyUiPreferences(nextUiPreferences);
  lastMetrics = nextLastMetrics;
  if (allowDuringDecryptBlock) clearDataDecryptBlock();

  syncSettingsControls();
  applyTheme(theme);
  renderHistory();
  renderVocabulary();
  renderStudyStats();
  renderHistoryChart();
  renderMetrics();
  renderAppMenu();
}

function normalizeOnReturnAction(value) {
  return ["vocabulary", "spelling", "both", "none"].includes(value) ? value : "vocabulary";
}

// Reflect current settings state into the menu controls (guarded — controls may not exist yet).
function syncSettingsControls() {
  if (onReturnSelect) onReturnSelect.value = onReturnAction;
  if (speakOnReturnToggle) speakOnReturnToggle.checked = speakOnReturn;
}

async function restoreFromGoogleDrive() {
  googleAuthStatus.textContent = "Looking for encrypted Drive backup...";
  const [latest] = await listGoogleDriveSnapshots();
  if (!latest?.id) {
    googleAuthStatus.textContent = "No Drive backup found for this app.";
    return null;
  }
  const confirmed = await showModal({
    title: "Restore Google Drive backup?",
    body: `Backup modified ${latest.modifiedTime ?? "recently"}. This replaces local vocabulary and study progress after an atomic write.`,
    submitText: "Restore",
    cancelText: "Cancel",
  });
  if (!confirmed) {
    googleAuthStatus.textContent = "Drive restore canceled.";
    return null;
  }
  const response = await googleFetch(`${GOOGLE_DRIVE_FILES_URL}/${latest.id}?alt=media`);
  if (!response.ok) throw new Error(`Google Drive restore failed: ${response.status} ${await response.text()}`);
  const envelope = await response.json();
  const snapshot = await decryptSnapshotPayload(envelope);
  await applyUserDataSnapshot(snapshot, { allowDuringDecryptBlock: true });
  googleAuthStatus.textContent = `Restored encrypted Drive backup from ${latest.modifiedTime ?? "Google Drive"}.`;
  syncStatus.textContent = navigator.onLine ? "Synced" : "Offline";
  return snapshot;
}

async function requestGeminiDetails(data) {
  if (!data || data.status !== "found") throw new Error("Search a dictionary term before asking Gemini.");
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new Error("No Gemini API key configured. Tap an AI Chat button to set one.");
  const model = getGeminiModel();
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const prompt = [
    `Explain the English term "${data.term}" for a Chinese-speaking TOEFL learner.`,
    "Return concise JSON with meanings, two example sentences per meaning, common phrases, word history, most common usage, and learner notes.",
    "For EVERY English paragraph also provide its simplified-Chinese translation: each meaning needs definitionZh (translation of definition) and examplesZh (translation of each example, same order); also wordHistoryZh, commonUsageZh, and learnerNotesZh.",
    `English meanings: ${summarizeLines(data.englishMeanings)}`,
    `Chinese meanings: ${summarizeLines(data.chineseMeanings)}`,
  ].join("\n");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: GEMINI_RESPONSE_SCHEMA,
      },
    }),
  });
  if (!response.ok) throw new Error(explainGeminiError(response.status, await response.text()));
  const payload = await response.json();
  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text).join("\n") ?? "";
  const structured = JSON.parse(text);
  if (!Array.isArray(structured.meanings)) throw new Error("Gemini returned an invalid detail payload.");
  return { provider: "gemini", model, generatedAt: nowIso(), structured };
}

const AI_CHAT_SCHEMA = {
  type: "object",
  properties: {
    definition: { type: "string" },
    definitionZh: { type: "string" },
    origin: { type: "string" },
    originZh: { type: "string" },
    morphology: {
      type: "object",
      properties: {
        prefix: { type: "string" },
        prefixMeaning: { type: "string" },
        root: { type: "string" },
        rootMeaning: { type: "string" },
        suffix: { type: "string" },
        suffixMeaning: { type: "string" },
        breakdown: { type: "string" },
        breakdownZh: { type: "string" },
      },
    },
    examples: { type: "array", items: { type: "string" } },
    examplesZh: { type: "array", items: { type: "string" } },
    synonyms: {
      type: "array",
      items: {
        type: "object",
        properties: {
          word: { type: "string" },
          comparison: { type: "string" },
          comparisonZh: { type: "string" },
        },
        required: ["word", "comparison"],
      },
    },
    antonyms: { type: "array", items: { type: "string" } },
    chineseMeaning: { type: "string" },
    fillBlankSentence: { type: "string" },
    sentenceCompletionPrefix: { type: "string" },
    sentenceCompletionFull: { type: "string" },
  },
  required: ["definition", "examples", "synonyms"],
};

const AI_CHAT_CACHE_LIMIT = 200;
// Insertion order doubles as LRU recency: read promotes, write appends, evict from the front.
const aiChatCache = new Map();
const aiChatPrefetchInFlight = new Set();
// Saved/looked-up terms waiting for a prefetch slot. A FIFO queue (not a hard
// drop) so a burst of saves all get warmed, just a couple at a time.
const aiChatPrefetchQueue = [];
const AI_CHAT_PREFETCH_CONCURRENCY = 2;
let aiChatCachePersistHandle = 0;
let aiChatState = { term: null, payload: null, tab: "explain", quizMode: "mcq", loading: false, error: null };

let geminiApiKeyOverride = "";
let geminiModelOverride = "";
let geminiModelChoices = null;

// Curated free-tier fallback used when the live ListModels call is unavailable.
const GEMINI_MODEL_FALLBACK = [
  { id: "gemini-2.5-flash", label: "gemini-2.5-flash (recommended)" },
  { id: "gemini-2.5-flash-lite", label: "gemini-2.5-flash-lite" },
  { id: "gemini-2.0-flash", label: "gemini-2.0-flash" },
  { id: "gemini-2.0-flash-lite", label: "gemini-2.0-flash-lite" },
  { id: "gemini-1.5-flash", label: "gemini-1.5-flash" },
  { id: "gemini-1.5-flash-8b", label: "gemini-1.5-flash-8b (smallest)" },
];
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

function getGeminiApiKey() {
  const override = String(geminiApiKeyOverride ?? "").trim();
  if (override) return override;
  return String(CONFIG.geminiApiKey ?? "").trim();
}

function getGeminiModel() {
  const override = String(geminiModelOverride ?? "").trim();
  if (override) return override;
  return String(CONFIG.geminiModel ?? "").trim() || DEFAULT_GEMINI_MODEL;
}

function aiChatCacheGet(term) {
  const key = String(term ?? "").trim().toLowerCase();
  if (!key || !aiChatCache.has(key)) return null;
  const value = aiChatCache.get(key);
  aiChatCache.delete(key);
  aiChatCache.set(key, value);
  return value;
}

function aiChatCacheSet(term, payload) {
  const key = String(term ?? "").trim().toLowerCase();
  if (!key) return;
  if (aiChatCache.has(key)) aiChatCache.delete(key);
  aiChatCache.set(key, payload);
  while (aiChatCache.size > AI_CHAT_CACHE_LIMIT) {
    const oldest = aiChatCache.keys().next().value;
    aiChatCache.delete(oldest);
  }
  scheduleAiChatCachePersist();
}

function aiChatCacheDelete(term) {
  const key = String(term ?? "").trim().toLowerCase();
  if (aiChatCache.delete(key)) scheduleAiChatCachePersist();
}

function scheduleAiChatCachePersist() {
  window.clearTimeout(aiChatCachePersistHandle);
  aiChatCachePersistHandle = window.setTimeout(() => {
    void saveValue("aiChatCache", [...aiChatCache.entries()]).catch(() => {});
  }, 800);
}

// Quietly warm the cache so the AI Chat panel opens instantly for committed/saved words.
function prefetchAiChat(term) {
  const clean = String(term ?? "").trim();
  if (!clean) return;
  const key = clean.toLowerCase();
  if (!getGeminiApiKey()) return;
  if (!navigator.onLine) return;
  if (aiChatCache.has(key) || aiChatPrefetchInFlight.has(key)) return;
  if (aiChatPrefetchQueue.some((entry) => entry.key === key)) return;
  aiChatPrefetchQueue.push({ key, term: clean });
  drainAiChatPrefetchQueue();
}

// Run at most AI_CHAT_PREFETCH_CONCURRENCY requests at once; the rest wait in
// aiChatPrefetchQueue and start as slots free up, so bursts of saves all warm.
function drainAiChatPrefetchQueue() {
  while (aiChatPrefetchInFlight.size < AI_CHAT_PREFETCH_CONCURRENCY && aiChatPrefetchQueue.length) {
    const next = aiChatPrefetchQueue.shift();
    if (!next || aiChatCache.has(next.key) || aiChatPrefetchInFlight.has(next.key)) continue;
    aiChatPrefetchInFlight.add(next.key);
    void requestAiChatPayload(next.term)
      .then((payload) => {
        aiChatCacheSet(next.term, payload);
        if (!aiChatPanel.hidden && aiChatState.term && aiChatState.term.toLowerCase() === next.key && !aiChatState.payload) {
          aiChatState.payload = payload;
          aiChatState.loading = false;
          renderAiChatPanel();
        }
      })
      .catch(() => {})
      .finally(() => {
        aiChatPrefetchInFlight.delete(next.key);
        drainAiChatPrefetchQueue();
      });
  }
}

function prettyGeminiModelLabel(id) {
  if (id === DEFAULT_GEMINI_MODEL) return `${id} (recommended)`;
  if (/8b/.test(id)) return `${id} (smallest)`;
  return id;
}

function sortGeminiModelChoices(choices) {
  const versionOf = (id) => {
    const match = id.match(/gemini-(\d+(?:\.\d+)?)/i);
    return match ? Number(match[1]) : 0;
  };
  return choices.slice().sort((left, right) => {
    if (left.id === DEFAULT_GEMINI_MODEL) return -1;
    if (right.id === DEFAULT_GEMINI_MODEL) return 1;
    return versionOf(right.id) - versionOf(left.id) || left.id.localeCompare(right.id);
  });
}

// Live ListModels lookup, filtered to free-tier flash models that support generateContent.
async function fetchFreeGeminiModels(apiKey) {
  const key = String(apiKey ?? "").trim();
  if (!key) return null;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}&pageSize=200`;
  const response = await fetch(endpoint);
  if (!response.ok) throw new Error(explainGeminiError(response.status, await response.text()));
  const payload = await response.json();
  const models = Array.isArray(payload.models) ? payload.models : [];
  const ids = models
    .filter((model) => Array.isArray(model.supportedGenerationMethods) && model.supportedGenerationMethods.includes("generateContent"))
    .map((model) => String(model.name ?? "").replace(/^models\//, ""))
    .filter((id) => /flash/i.test(id))
    .filter((id) => !/(pro|vision|embedding|aqa|imagen|veo|tts|audio|image|live|thinking|preview|exp)/i.test(id))
    .filter((id, index, all) => all.indexOf(id) === index);
  if (!ids.length) return null;
  return sortGeminiModelChoices(ids.map((id) => ({ id, label: prettyGeminiModelLabel(id) })));
}

function getCachedGeminiModelChoices() {
  if (Array.isArray(geminiModelChoices) && geminiModelChoices.length) return geminiModelChoices;
  return GEMINI_MODEL_FALLBACK;
}

// Refresh the live model list and, if the saved model is gone, hop to the best available one.
async function refreshGeminiModelChoices({ persist = true } = {}) {
  const apiKey = getGeminiApiKey();
  if (!apiKey || !navigator.onLine) return getCachedGeminiModelChoices();
  try {
    const choices = await fetchFreeGeminiModels(apiKey);
    if (choices && choices.length) {
      geminiModelChoices = choices;
      if (persist) void saveValue("geminiModelChoices", choices).catch(() => {});
      const ids = choices.map((choice) => choice.id);
      const current = getGeminiModel();
      if (!ids.includes(current)) {
        const next = ids.includes(DEFAULT_GEMINI_MODEL) ? DEFAULT_GEMINI_MODEL : ids[0];
        geminiModelOverride = next;
        if (persist) await saveValue("geminiModelOverride", next);
      }
      return choices;
    }
  } catch {
    // Fall through to cached/fallback list when offline or the key lacks ListModels access.
  }
  return getCachedGeminiModelChoices();
}

function explainGeminiError(status, bodyText) {
  if (status === 429) {
    let retryHint = "";
    try {
      const parsed = JSON.parse(bodyText);
      const retry = parsed?.error?.details?.find?.((d) => d["@type"]?.includes("RetryInfo"))?.retryDelay;
      if (retry) retryHint = ` Retry in ~${retry}.`;
    } catch {}
    return [
      "Gemini quota exceeded for this API key.",
      "If the limit is 0, this Cloud project never had free-tier quota — create the key in Google AI Studio (https://aistudio.google.com/app/apikey, 'Create API key in new project') to get one with quota, or enable billing.",
      "You can also try a different model via the picker below — each model has its own quota bucket.",
      retryHint,
    ].filter(Boolean).join(" ");
  }
  if (status === 403) {
    return `Gemini rejected the request (403). Make sure the Generative Language API is enabled for the Cloud project tied to this key, and that the key restrictions allow the generativelanguage.googleapis.com endpoint. Raw: ${bodyText.slice(0, 300)}`;
  }
  if (status === 400) {
    return `Gemini rejected the request body (400). The model name may be invalid for your project, or the schema is unsupported. Raw: ${bodyText.slice(0, 300)}`;
  }
  return `AI Chat request failed: ${status} ${bodyText.slice(0, 500)}`;
}

async function promptForGeminiApiKey() {
  const currentKey = getGeminiApiKey();
  // Refresh the live model list (with the existing key, if any) so new models appear automatically.
  const choices = await refreshGeminiModelChoices({ persist: true });
  let currentModel = getGeminiModel();
  const ids = choices.map((choice) => choice.id);
  if (!ids.includes(currentModel)) currentModel = ids.includes(DEFAULT_GEMINI_MODEL) ? DEFAULT_GEMINI_MODEL : ids[0];
  const values = await showModal({
    title: "Gemini API key & model",
    body: "AI Chat uses the Gemini API with a key. The model list below is fetched live from your key (free-tier flash models only). If you hit 429 quota errors, try a different model — each model has its own quota bucket. If a key shows limit=0, create a new key from AI Studio so the project gets free-tier quota.",
    helpLink: { label: "Open Google AI Studio - Get API key", url: "https://aistudio.google.com/app/apikey" },
    fields: [
      { id: "apiKey", label: "Gemini API key", type: "text", value: currentKey, placeholder: "AIza...", hint: "Stored encrypted on this device only.", required: true },
      { id: "model", label: "Gemini model", type: "select", value: currentModel, options: choices.map((c) => ({ value: c.id, label: c.label })), hint: "Free-tier flash models, refreshed from your key. Each has a separate quota." },
    ],
    submitText: "Save",
  });
  if (!values?.apiKey) return null;
  const cleanedKey = String(values.apiKey).trim();
  const cleanedModel = String(values.model ?? "").trim() || DEFAULT_GEMINI_MODEL;
  const keyChanged = cleanedKey !== currentKey;
  geminiApiKeyOverride = cleanedKey;
  geminiModelOverride = cleanedModel;
  await saveValue("geminiApiKeyOverride", cleanedKey);
  await saveValue("geminiModelOverride", cleanedModel);
  // A brand-new key may expose a different model set; refresh in the background.
  if (keyChanged) void refreshGeminiModelChoices({ persist: true });
  return cleanedKey;
}

async function requestAiChatPayload(term) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new Error("No Gemini API key configured. Tap 'Set Gemini key' in Settings or use the prompt that appears when AI Chat opens.");
  const model = getGeminiModel();
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const vocabItem = getVocabularyItem(term);
  const englishHint = vocabItem ? summarizeLines(vocabItem.englishMeanings ?? vocabItem.original?.englishMeanings ?? []) : "";
  const chineseHint = vocabItem ? summarizeLines(vocabItem.chineseMeanings ?? vocabItem.original?.chineseMeanings ?? []) : "";
  const prompt = [
    `You help a Chinese-speaking TOEFL learner study the English term "${term}".`,
    "Return JSON with these fields:",
    "- definition (1-2 sentences) and definitionZh (its simplified-Chinese translation).",
    "- origin (etymology, 1-2 sentences) and originZh (its simplified-Chinese translation).",
    "- morphology: an object with prefix, prefixMeaning, root, rootMeaning, suffix, suffixMeaning (leave a part empty string if the word has none), breakdown, and breakdownZh. In breakdown, briefly explain what a root, a prefix, and a suffix are, then explain why THIS word has this particular root, prefix, and suffix and how they build its meaning. breakdownZh is the simplified-Chinese translation of breakdown.",
    "- examples: 3 natural sentences using the term. examplesZh: the simplified-Chinese translation of each example, in the same order.",
    "- synonyms: 3-5 entries, each with word, comparison (nuance vs the target term), and comparisonZh (simplified-Chinese translation of comparison).",
    "- antonyms: 3 entries.",
    "- chineseMeaning: concise simplified-Chinese gloss of the term.",
    "- fillBlankSentence: one sentence with the term replaced by ____.",
    "- sentenceCompletionPrefix: the first half of a sentence the user must finish using the term, without the term.",
    "- sentenceCompletionFull: a model completion of that sentence including the term.",
    "All Chinese must be simplified Chinese.",
    englishHint ? `Known English meanings: ${englishHint}` : "",
    chineseHint ? `Known Chinese meanings: ${chineseHint}` : "",
  ].filter(Boolean).join("\n");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: AI_CHAT_SCHEMA,
      },
    }),
  });
  if (!response.ok) throw new Error(explainGeminiError(response.status, await response.text()));
  const payload = await response.json();
  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text).join("\n") ?? "";
  const structured = JSON.parse(text);
  return { ...structured, generatedAt: nowIso(), model };
}

function setAiChatOpen(open) {
  aiChatPanel.hidden = !open;
  document.body.dataset.aiChatOpen = open ? "true" : "false";
  if (open) window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
}

async function openAiChatPanel(term) {
  const clean = String(term ?? "").trim();
  if (!clean) return;
  aiChatTitle.textContent = `AI Chat — ${clean}`;
  aiChatState = { term: clean, payload: null, tab: "explain", quizMode: "mcq", loading: true, error: null };
  setAiChatOpen(true);
  renderAiChatPanel();
  const cached = aiChatCacheGet(clean);
  if (cached) {
    aiChatState.payload = cached;
    aiChatState.loading = false;
    renderAiChatPanel();
    return;
  }
  try {
    if (!getGeminiApiKey()) {
      const entered = await promptForGeminiApiKey();
      if (!entered) throw new Error("AI Chat needs a Gemini API key. Tap the AI Chat button again to set one.");
    }
    const payload = await requestAiChatPayload(clean);
    aiChatCacheSet(clean, payload);
    aiChatState.payload = payload;
  } catch (error) {
    aiChatState.error = error instanceof Error ? error.message : String(error);
  } finally {
    aiChatState.loading = false;
    renderAiChatPanel();
  }
}

function zhLine(text) {
  const value = String(text ?? "").trim();
  if (!value) return "";
  return `<p class="zh-text">中文：${escapeHtml(value)}</p>`;
}

function renderMorphologySection(morphology) {
  if (!morphology || typeof morphology !== "object") return "";
  const parts = [
    { label: "Prefix", morpheme: morphology.prefix, meaning: morphology.prefixMeaning },
    { label: "Root", morpheme: morphology.root, meaning: morphology.rootMeaning },
    { label: "Suffix", morpheme: morphology.suffix, meaning: morphology.suffixMeaning },
  ].filter((part) => String(part.morpheme ?? "").trim());
  const cards = parts
    .map((part) => `
      <div class="ai-morpheme">
        <span class="label">${escapeHtml(part.label)}</span>
        <span class="morpheme">${escapeHtml(part.morpheme)}</span>
        ${part.meaning ? `<span class="meaning"> — ${escapeHtml(part.meaning)}</span>` : ""}
      </div>
    `)
    .join("");
  const breakdown = String(morphology.breakdown ?? "").trim();
  if (!cards && !breakdown) return "";
  return `
    <section class="ai-chat-section">
      <h3>Word parts</h3>
      ${cards ? `<div class="ai-morphology-grid">${cards}</div>` : ""}
      ${breakdown ? `<p>${escapeHtml(breakdown)}</p>` : ""}
      ${zhLine(morphology.breakdownZh)}
    </section>
  `;
}

function renderAiChatPanel() {
  if (aiChatPanel.hidden) return;
  for (const tab of aiChatPanel.querySelectorAll("[data-ai-tab]")) {
    tab.setAttribute("aria-selected", String(tab.dataset.aiTab === aiChatState.tab));
  }
  if (aiChatState.loading) {
    aiChatContent.innerHTML = `<div class="ai-chat-loading">Asking Gemini about "${escapeHtml(aiChatState.term)}"...</div>`;
    return;
  }
  if (aiChatState.error) {
    aiChatContent.innerHTML = `
      <div class="ai-chat-error">${escapeHtml(aiChatState.error)}</div>
      <div class="ai-chat-section">
        <p class="small muted">Current model: ${escapeHtml(getGeminiModel())}.</p>
        <button id="aiChatChangeModel" type="button">Change API key / model</button>
        <button id="aiChatRetry" class="secondary-button" type="button">Retry</button>
      </div>
    `;
    aiChatContent.querySelector("#aiChatChangeModel")?.addEventListener("click", async () => {
      const entered = await promptForGeminiApiKey();
      if (entered && aiChatState.term) {
        aiChatCacheDelete(aiChatState.term);
        void openAiChatPanel(aiChatState.term);
      }
    });
    aiChatContent.querySelector("#aiChatRetry")?.addEventListener("click", () => {
      if (aiChatState.term) {
        aiChatCacheDelete(aiChatState.term);
        void openAiChatPanel(aiChatState.term);
      }
    });
    return;
  }
  const payload = aiChatState.payload;
  if (!payload) {
    aiChatContent.innerHTML = `<div class="ai-chat-loading">No AI content yet.</div>`;
    return;
  }
  if (aiChatState.tab === "explain") {
    aiChatContent.innerHTML = `
      <section class="ai-chat-section">
        <h3>Meaning</h3>
        <p>${escapeHtml(payload.definition ?? "")}</p>
        ${zhLine(payload.definitionZh ?? payload.chineseMeaning)}
      </section>
      <section class="ai-chat-section">
        <h3>Origin</h3>
        <p>${escapeHtml(payload.origin ?? "(No etymology provided.)")}</p>
        ${zhLine(payload.originZh)}
      </section>
      ${renderMorphologySection(payload.morphology)}
    `;
    return;
  }
  if (aiChatState.tab === "examples") {
    const examples = (payload.examples ?? []).slice(0, 3);
    const examplesZh = payload.examplesZh ?? [];
    const list = examples
      .map((ex, index) => `<li><p>${escapeHtml(ex)}</p>${zhLine(examplesZh[index])}</li>`)
      .join("");
    aiChatContent.innerHTML = `
      <section class="ai-chat-section">
        <h3>Example sentences</h3>
        <ol class="ai-example-list">${list || "<li>No examples available.</li>"}</ol>
      </section>
    `;
    return;
  }
  if (aiChatState.tab === "synonyms") {
    const rows = (payload.synonyms ?? []).slice(0, 5).map((entry) => `
      <div class="ai-synonym-row">
        <strong>${escapeHtml(entry.word ?? "")}</strong>
        <span>${escapeHtml(entry.comparison ?? "")}</span>
        ${zhLine(entry.comparisonZh)}
      </div>
    `).join("");
    const antonyms = (payload.antonyms ?? []).slice(0, 5).map((a) => escapeHtml(a)).join(", ");
    aiChatContent.innerHTML = `
      <section class="ai-chat-section">
        <h3>Synonyms</h3>
        ${rows || "<p>No synonyms available.</p>"}
      </section>
      ${antonyms ? `<section class="ai-chat-section"><h3>Antonyms</h3><p>${antonyms}</p></section>` : ""}
    `;
    return;
  }
  if (aiChatState.tab === "quiz") {
    aiChatContent.innerHTML = renderAiQuizMarkup(payload);
    bindAiQuizHandlers(payload);
    return;
  }
}

const AI_QUIZ_MODES = [
  { id: "mcq", label: "Multiple choice" },
  { id: "fill", label: "Fill in the blank" },
  { id: "zh2en", label: "ZH → EN recall" },
  { id: "en2zh", label: "EN → ZH recall" },
  { id: "synant", label: "Synonym / antonym" },
  { id: "complete", label: "Sentence completion" },
];

function renderAiQuizMarkup(payload) {
  const modePicker = AI_QUIZ_MODES.map((mode) => `
    <button type="button" data-ai-quiz-mode="${mode.id}" aria-pressed="${aiChatState.quizMode === mode.id}">${escapeHtml(mode.label)}</button>
  `).join("");
  return `
    <div class="ai-quiz-mode-picker" role="tablist">${modePicker}</div>
    <div id="aiQuizCard" class="ai-quiz-card">${renderAiQuizCard(payload)}</div>
  `;
}

function pickDistractors(targetTerm, count) {
  const pool = vocabularyItems
    .map((item) => item.term)
    .filter((t) => t && t.toLowerCase() !== targetTerm.toLowerCase());
  const seen = new Set();
  const result = [];
  while (result.length < count && pool.length > 0) {
    const pick = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    if (!seen.has(pick)) {
      seen.add(pick);
      result.push(pick);
    }
  }
  return result;
}

function shuffle(items) {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function renderAiQuizCard(payload) {
  const term = aiChatState.term;
  const mode = aiChatState.quizMode;
  if (mode === "mcq") {
    const correct = payload.definition ?? "";
    const distractors = (payload.synonyms ?? []).slice(0, 3).map((s) => s.comparison ?? s.word ?? "").filter(Boolean);
    while (distractors.length < 3) distractors.push(`A different word entirely (${distractors.length + 1})`);
    const options = shuffle([correct, ...distractors.slice(0, 3)]);
    return `
      <p class="ai-quiz-prompt">Which option best defines "${escapeHtml(term)}"?</p>
      <div class="ai-quiz-options">
        ${options.map((opt) => `<button type="button" data-ai-mcq-answer data-correct="${opt === correct ? "1" : "0"}">${escapeHtml(opt)}</button>`).join("")}
      </div>
      <p class="ai-quiz-feedback" hidden></p>
    `;
  }
  if (mode === "fill") {
    const sentence = payload.fillBlankSentence
      || (payload.examples ?? [])[0]?.replace(new RegExp(term, "i"), "____")
      || `She used ____ in a sentence.`;
    return `
      <p class="ai-quiz-prompt">Fill in the blank.</p>
      <p>${escapeHtml(sentence)}</p>
      <div class="ai-quiz-input-row">
        <input type="text" id="aiFillInput" autocomplete="off" placeholder="type the word" />
        <button type="button" id="aiFillCheck">Check</button>
      </div>
      <p class="ai-quiz-feedback" hidden></p>
    `;
  }
  if (mode === "zh2en") {
    return `
      <p class="ai-quiz-prompt">Recall the English term.</p>
      <p>${escapeHtml(payload.chineseMeaning ?? "(no Chinese meaning available)")}</p>
      <div class="ai-quiz-input-row">
        <input type="text" id="aiZhEnInput" autocomplete="off" placeholder="type the English word" />
        <button type="button" id="aiZhEnCheck">Check</button>
      </div>
      <p class="ai-quiz-feedback" hidden></p>
    `;
  }
  if (mode === "en2zh") {
    return `
      <p class="ai-quiz-prompt">Recall the Chinese meaning of "${escapeHtml(term)}".</p>
      <div class="ai-quiz-input-row">
        <input type="text" id="aiEnZhInput" autocomplete="off" placeholder="输入中文意思" />
        <button type="button" id="aiEnZhCheck">Check</button>
      </div>
      <p class="ai-quiz-feedback" hidden></p>
    `;
  }
  if (mode === "synant") {
    const synonyms = (payload.synonyms ?? []).map((s) => s.word).filter(Boolean);
    const antonyms = (payload.antonyms ?? []).slice(0, 3);
    const askSynonym = Math.random() < 0.5 && synonyms.length > 0;
    const correct = askSynonym ? synonyms[Math.floor(Math.random() * synonyms.length)] : (antonyms[0] ?? "");
    if (!correct) {
      return `<p>Not enough data for synonym/antonym questions on this word yet.</p>`;
    }
    const distractors = askSynonym ? antonyms.slice(0, 3) : synonyms.slice(0, 3);
    while (distractors.length < 3) distractors.push(...pickDistractors(term, 3 - distractors.length));
    const options = shuffle([correct, ...distractors.slice(0, 3)]);
    return `
      <p class="ai-quiz-prompt">Pick a ${askSynonym ? "synonym" : "antonym"} of "${escapeHtml(term)}".</p>
      <div class="ai-quiz-options">
        ${options.map((opt) => `<button type="button" data-ai-mcq-answer data-correct="${opt === correct ? "1" : "0"}">${escapeHtml(opt)}</button>`).join("")}
      </div>
      <p class="ai-quiz-feedback" hidden></p>
    `;
  }
  if (mode === "complete") {
    const prefix = payload.sentenceCompletionPrefix ?? (payload.examples ?? [])[0]?.split(term)[0] ?? "Try writing a sentence that uses";
    const model = payload.sentenceCompletionFull ?? (payload.examples ?? [])[0] ?? "";
    return `
      <p class="ai-quiz-prompt">Complete the sentence using "${escapeHtml(term)}".</p>
      <p><em>${escapeHtml(prefix)}…</em></p>
      <div class="ai-quiz-input-row">
        <input type="text" id="aiCompleteInput" autocomplete="off" placeholder="finish the sentence" />
        <button type="button" id="aiCompleteCheck">Check</button>
      </div>
      <p class="ai-quiz-feedback" hidden></p>
      <p class="small muted" id="aiCompleteModel" hidden>Model answer: ${escapeHtml(model)}</p>
    `;
  }
  return "";
}

function showQuizFeedback(ok, message) {
  const feedback = aiChatContent.querySelector(".ai-quiz-feedback");
  if (!feedback) return;
  feedback.hidden = false;
  feedback.textContent = message;
  feedback.classList.toggle("ok", ok);
  feedback.classList.toggle("bad", !ok);
}

function bindAiQuizHandlers(payload) {
  for (const button of aiChatContent.querySelectorAll("[data-ai-quiz-mode]")) {
    button.addEventListener("click", () => {
      const next = button.dataset.aiQuizMode;
      if (!next) return;
      aiChatState.quizMode = next;
      const card = aiChatContent.querySelector("#aiQuizCard");
      if (card) card.innerHTML = renderAiQuizCard(payload);
      for (const sibling of aiChatContent.querySelectorAll("[data-ai-quiz-mode]")) {
        sibling.setAttribute("aria-pressed", String(sibling.dataset.aiQuizMode === next));
      }
      bindAiQuizHandlers(payload);
    });
  }
  for (const option of aiChatContent.querySelectorAll("[data-ai-mcq-answer]")) {
    option.addEventListener("click", () => {
      const isCorrect = option.dataset.correct === "1";
      for (const sibling of aiChatContent.querySelectorAll("[data-ai-mcq-answer]")) {
        if (sibling.dataset.correct === "1") sibling.dataset.state = "correct";
      }
      if (!isCorrect) option.dataset.state = "wrong";
      showQuizFeedback(isCorrect, isCorrect ? "Correct." : "Not quite — the highlighted answer is the right one.");
    });
  }
  const fillCheck = aiChatContent.querySelector("#aiFillCheck");
  if (fillCheck) {
    fillCheck.addEventListener("click", () => {
      const value = (aiChatContent.querySelector("#aiFillInput").value ?? "").trim().toLowerCase();
      const ok = value === aiChatState.term.toLowerCase();
      showQuizFeedback(ok, ok ? "Correct." : `Expected: ${aiChatState.term}`);
    });
  }
  const zhEnCheck = aiChatContent.querySelector("#aiZhEnCheck");
  if (zhEnCheck) {
    zhEnCheck.addEventListener("click", () => {
      const value = (aiChatContent.querySelector("#aiZhEnInput").value ?? "").trim().toLowerCase();
      const ok = value === aiChatState.term.toLowerCase();
      showQuizFeedback(ok, ok ? "Correct." : `Expected: ${aiChatState.term}`);
    });
  }
  const enZhCheck = aiChatContent.querySelector("#aiEnZhCheck");
  if (enZhCheck) {
    enZhCheck.addEventListener("click", () => {
      const value = (aiChatContent.querySelector("#aiEnZhInput").value ?? "").trim();
      const expected = String(payload.chineseMeaning ?? "").trim();
      const ok = Boolean(expected) && (value === expected || expected.includes(value));
      showQuizFeedback(ok, ok ? "Correct." : `Expected: ${expected || "(no Chinese meaning available)"}`);
    });
  }
  const completeCheck = aiChatContent.querySelector("#aiCompleteCheck");
  if (completeCheck) {
    completeCheck.addEventListener("click", () => {
      const value = (aiChatContent.querySelector("#aiCompleteInput").value ?? "").trim().toLowerCase();
      const ok = value.includes(aiChatState.term.toLowerCase()) && value.length > aiChatState.term.length;
      const modelEl = aiChatContent.querySelector("#aiCompleteModel");
      if (modelEl) modelEl.hidden = false;
      showQuizFeedback(ok, ok ? "Looks good — your sentence uses the term." : "Your sentence should use the target word.");
    });
  }
}

let pendingAiDetail = null;

function renderAiDetailCards(detail, savedAt) {
  const meanings = detail.structured.meanings
    .map((meaning, index) => {
      const examplesZh = meaning.examplesZh ?? [];
      const examples = (meaning.examples ?? [])
        .slice(0, 2)
        .map((example, exampleIndex) => `<p class="example">${escapeHtml(example)}</p>${zhLine(examplesZh[exampleIndex])}`)
        .join("");
      return `
      <article class="ai-meaning-card">
        <h4>Meaning ${index + 1}</h4>
        <p>${escapeHtml(meaning.definition)}</p>
        ${zhLine(meaning.definitionZh)}
        ${examples}
        ${(meaning.commonPhrases ?? []).length ? `<p class="small">Phrases: ${escapeHtml(meaning.commonPhrases.join(", "))}</p>` : ""}
      </article>
    `;
    })
    .join("");
  return `
    <h3>Gemini details <span class="ai-source-badge">AI assisted</span></h3>
    <p class="small">${escapeHtml(detail.model)} - ${escapeHtml(detail.generatedAt)}</p>
    <div class="ai-card-grid">${meanings}</div>
    ${detail.structured.commonUsage ? `<h4>Common usage</h4><p>${escapeHtml(detail.structured.commonUsage)}</p>${zhLine(detail.structured.commonUsageZh)}` : ""}
    ${detail.structured.wordHistory ? `<h4>Word history</h4><p>${escapeHtml(detail.structured.wordHistory)}</p>${zhLine(detail.structured.wordHistoryZh)}` : ""}
    ${detail.structured.learnerNotes ? `<h4>Learner notes</h4><p>${escapeHtml(detail.structured.learnerNotes)}</p>${zhLine(detail.structured.learnerNotesZh)}` : ""}
    <div class="ai-detail-actions">
      <button id="saveAiInsight" type="button"${savedAt ? " disabled" : ""}>${savedAt ? `Saved ${escapeHtml(savedAt)}` : "Save AI insight to vocabulary"}</button>
      <p class="small muted">Saved AI content is tagged as AI-assisted so you can tell it apart from dictionary and user-entered meanings.</p>
    </div>
  `;
}

async function showAiDetails(data) {
  aiDetailPanel.hidden = false;
  aiDetailPanel.innerHTML = `<p class="muted">Opening Gemini details...</p>`;
  pendingAiDetail = null;
  try {
    const detail = await requestGeminiDetails(data);
    pendingAiDetail = { detail, term: data.term };
    aiDetailPanel.innerHTML = renderAiDetailCards(detail, null);
  } catch (error) {
    aiDetailPanel.innerHTML = `<p class="error">${escapeHtml(error instanceof Error ? error.message : String(error))}</p>`;
  }
}

async function saveAiInsightToVocabulary() {
  if (!pendingAiDetail) return null;
  const { detail, term } = pendingAiDetail;
  let item = getVocabularyItem(term);
  if (!item && currentResult && currentResult.status === "found" && normalizeTerm(currentResult.term) === normalizeTerm(term)) {
    item = await saveVocabularyItem(currentResult, "ai-detail");
  }
  if (!item) {
    aiDetailPanel.insertAdjacentHTML(
      "beforeend",
      `<p class="error">Save the term to your vocabulary first, then save the AI insight.</p>`,
    );
    return null;
  }
  const now = nowIso();
  const aiRecord = {
    provider: detail.provider ?? "gemini",
    model: detail.model,
    generatedAt: detail.generatedAt,
    savedAt: now,
    structured: detail.structured,
  };
  item.aiAssist = Array.isArray(item.aiAssist) ? [...item.aiAssist, aiRecord] : [aiRecord];
  item.updatedAt = now;
  item.syncVersion = (item.syncVersion ?? 0) + 1;
  item.isSynced = false;
  await persistVocabularyItem(item);
  aiDetailPanel.innerHTML = renderAiDetailCards(detail, now);
  return item;
}

async function runAutomatedSearchSmoke(term, shouldReport) {
  termInput.value = term;
  const ready = await ensureDictionaryLoaded();
  if (!ready) return;
  const data = lookupTerm(term);
  renderResult(data);
  if (data.status === "found") {
    const at = nowIso();
    await addHistory({ term: data.term, searchedAt: at, queriedAt: at, queryMs: data.queryMs ?? 0 });
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
    spellingItems,
    spellingEvents,
    userDictionary: userDictionaryEntries,
    onReturnAction,
    speakOnReturn,
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

async function waitForRegistrationWaiting(registration, timeoutMs = 4000) {
  if (registration.waiting) return registration.waiting;
  const installing = registration.installing;
  if (!installing) return null;
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      installing.removeEventListener("statechange", onChange);
      resolve(registration.waiting ?? null);
    }, timeoutMs);
    const onChange = () => {
      if (installing.state === "installed" || installing.state === "redundant") {
        clearTimeout(timer);
        installing.removeEventListener("statechange", onChange);
        resolve(registration.waiting ?? null);
      }
    };
    installing.addEventListener("statechange", onChange);
  });
}

async function checkForAppUpdate() {
  applyUpdateButton.disabled = true;
  pendingAppReloadUrl = null;
  if (!("serviceWorker" in navigator)) {
    updateStatus.textContent = "Service worker is unavailable on this device.";
    return { status: "unsupported", deviceVersion: APP_VERSION, serverVersion: null };
  }
  updateStatus.textContent = "Checking for an app update...";
  let latestVersion = null;
  let versionCheckError = null;
  try {
    const response = await fetch(`/app.js?update-check=${Date.now()}`, { cache: "reload" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const scriptText = await response.text();
    latestVersion = scriptText.match(/const APP_VERSION = "([^"]+)"/)?.[1] ?? null;
  } catch (error) {
    versionCheckError = error instanceof Error ? error.message : String(error);
  }
  const registration = await navigator.serviceWorker.getRegistration() ?? await navigator.serviceWorker.register("/sw.js");
  if (!registration) {
    updateStatus.textContent = "Offline shell is not registered yet. Reopen the app and try again.";
    return { status: "no-registration", deviceVersion: APP_VERSION, serverVersion: latestVersion };
  }
  try {
    await registration.update();
  } catch (error) {
    const updateError = error instanceof Error ? error.message : String(error);
    updateStatus.textContent = `Could not reach the app server for updates (${versionCheckError ?? updateError}). Keep the Windows server running, then open /?fresh=latest.`;
    return { status: "network-error", deviceVersion: APP_VERSION, serverVersion: latestVersion, error: updateError };
  }
  const waitingWorker = await waitForRegistrationWaiting(registration);
  const deviceLabel = `Device: ${APP_VERSION}`;
  const serverLabel = latestVersion ? `Server: ${latestVersion}` : "Server: (unknown)";
  if (waitingWorker) {
    applyUpdateButton.disabled = false;
    updateStatus.textContent = `${deviceLabel}. ${serverLabel}. Update is ready — tap Apply update.`;
    return { status: "update-waiting", deviceVersion: APP_VERSION, serverVersion: latestVersion };
  }
  if (latestVersion && latestVersion !== APP_VERSION) {
    pendingAppReloadUrl = `/?fresh=${encodeURIComponent(latestVersion)}-${Date.now()}`;
    applyUpdateButton.disabled = false;
    updateStatus.textContent = `${deviceLabel}. ${serverLabel}. Update available — tap Apply update.`;
    return { status: "update-available", deviceVersion: APP_VERSION, serverVersion: latestVersion };
  }
  if (versionCheckError) {
    updateStatus.textContent = `${deviceLabel}. Could not check server (${versionCheckError}). Keep the Windows server running, then open /?fresh=latest.`;
    return { status: "check-error", deviceVersion: APP_VERSION, serverVersion: null, error: versionCheckError };
  }
  pendingAppReloadUrl = `/?fresh=${encodeURIComponent(latestVersion ?? APP_VERSION)}-${Date.now()}`;
  applyUpdateButton.disabled = false;
  updateStatus.textContent = `${deviceLabel}. ${serverLabel}. Up to date — tap Apply update to force-reload from server.`;
  return { status: "up-to-date", deviceVersion: APP_VERSION, serverVersion: latestVersion };
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
  const waitForStudyEventAfter = (count) => new Promise((resolve) => {
    const startedAt = performance.now();
    const timer = window.setInterval(() => {
      if (studyEvents.length > count || performance.now() - startedAt > VOCABULARY_AUTO_RATING_PAUSE_MS + 2000) {
        window.clearInterval(timer);
        resolve(studyEvents.at(-1));
      }
    }, 50);
  });
  const correctIndex = activeQuiz?.options.findIndex((option) => option.correct) ?? -1;
  if (correctIndex < 0) {
    debugStatus.textContent = "Automation failed: no correct quiz option.";
    return null;
  }
  const beforeFirstEventCount = studyEvents.length;
  await handleQuizAnswer(correctIndex);
  const latestEvent = await waitForStudyEventAfter(beforeFirstEventCount);
  const firstRating = latestEvent?.rating;
  item.review.dueAt = nowIso();
  await persistVocabulary();
  await startDueReview();
  const wrongIndex = activeQuiz?.options.findIndex((option) => !option.correct) ?? -1;
  if (wrongIndex >= 0) {
    const beforeSecondEventCount = studyEvents.length;
    await handleQuizAnswer(wrongIndex);
    await waitForStudyEventAfter(beforeSecondEventCount);
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

async function showLoginGateIfNeeded() {
  const acknowledged = await loadValue("loginGateAcknowledged", false);
  if (acknowledged) return;
  if (googleAuth.profile?.email) {
    await saveValue("loginGateAcknowledged", true);
    return;
  }
  const body = "Sign in with your Google account so WordFan can sync your vocabulary to Drive and unlock Gemini AI example sentences. You can skip and use the app locally only.";
  const choice = await showModal({
    title: "Welcome to WordFan",
    body,
    submitText: "Sign in with Google",
    cancelText: "Skip sign-in for now",
    allowCancel: true,
  });
  await saveValue("loginGateAcknowledged", true);
  if (choice) {
    try {
      if (!getGoogleClientId()) {
        const entered = await promptForGoogleClientId();
        if (!entered) {
          renderAppMenu();
          return;
        }
      }
      googleAuthStatus.textContent = "Opening Google sign-in...";
      await ensureGoogleToken(true);
      googleAuthStatus.textContent = "Signed in with Google.";
    } catch (error) {
      googleAuthStatus.textContent = error instanceof Error ? error.message : String(error);
    }
    renderAppMenu();
  }
}

async function init() {
  renderInstallContext();
  await getDeviceId();
  const previousOpenedAt = await loadValue("lastOpenedAt", null);
  await saveValue("lastOpenedAt", nowIso());
  theme = await loadValue("theme", DEFAULT_THEME);
  applyTheme(theme);
  fontScale = normalizeFontScale(await loadValue("fontScale", DEFAULT_FONT_SCALE));
  applyFontScale(fontScale);
  applyUiPreferences(await loadValue("uiPreferences", {}));
  debugMode = await loadValue("debugMode", debugMode);
  googleClientIdOverride = String(await loadValue("googleClientIdOverride", "") ?? "").trim();
  geminiApiKeyOverride = String(await loadValue("geminiApiKeyOverride", "") ?? "").trim();
  geminiModelOverride = String(await loadValue("geminiModelOverride", "") ?? "").trim();
  const savedModelChoices = await loadValue("geminiModelChoices", null);
  if (Array.isArray(savedModelChoices) && savedModelChoices.length) geminiModelChoices = savedModelChoices;
  const savedAiChatCache = await loadValue("aiChatCache", null);
  if (Array.isArray(savedAiChatCache)) {
    for (const entry of savedAiChatCache.slice(-AI_CHAT_CACHE_LIMIT)) {
      if (Array.isArray(entry) && entry.length === 2 && entry[0]) aiChatCache.set(String(entry[0]), entry[1]);
    }
  }
  studyGoals = normalizeStudyGoals(await loadValue("studyGoals", null));
  // Refresh the free-tier model list and auto-migrate off a deprecated saved model.
  void refreshGeminiModelChoices({ persist: true });
  googleGrantGranted = Boolean(await loadValue("googleGrant", false));
  lastSyncSummary = await loadValue("lastSyncSummary", null);
  const savedAuth = await loadValue("googleAuth", null);
  if (savedAuth && typeof savedAuth === "object") {
    const stillValid = savedAuth.accessToken && Number(savedAuth.expiresAt ?? 0) > Date.now() + 60_000;
    googleAuth = {
      accessToken: stillValid ? savedAuth.accessToken : null,
      expiresAt: stillValid ? Number(savedAuth.expiresAt) : 0,
      scopes: Array.isArray(savedAuth.scopes) ? savedAuth.scopes : [],
      profile: savedAuth.profile ?? null,
    };
    if (savedAuth.profile) googleGrantGranted = true;
    if (stillValid) {
      startAutoSync();
      // Daily auto-sync: sync once on launch if we have not synced yet today.
      void runAutoSync("startup");
    } else if (hasGoogleGrant() && navigator.onLine) {
      // Token expired but the user already consented on this device: refresh silently in the
      // background so the session stays alive without forcing a re-login, then auto-sync.
      void autoReconnectGoogleSession("startup", { syncAfter: true });
    }
  } else {
    googleAuth.profile = await loadValue("googleProfile", null);
    if (googleAuth.profile) googleGrantGranted = true;
  }
  // Preload Google Identity now so the sign-in popup can open synchronously on tap (iOS).
  preloadGoogleIdentity();
  if (hasGoogleGrant() && !googleAuth.accessToken && navigator.onLine) {
    void autoReconnectGoogleSession("startup-legacy", { syncAfter: true });
  }
  renderDebugState();
  renderAppMenu();
  historyItems = await loadValue("history", []);
  const vocabularyRecords = await loadAllRecordValues(VOCABULARY_STORE);
  const legacyVocabularyItems = await loadValue("vocabularyItems", []);
  vocabularyItems = mergeVocabularySources(vocabularyRecords, legacyVocabularyItems);
  const studyEventRecords = await loadAllRecordValues(STUDY_EVENT_STORE);
  const legacyStudyEvents = await loadValue("studyEvents", []);
  studyEvents = mergeStudyEventSources(studyEventRecords, legacyStudyEvents);
  vocabularyItems = rebuildItemsReviewStateFromEvents(vocabularyItems, studyEvents);
  if (vocabularyItems.length > vocabularyRecords.length || legacyVocabularyItems.length || studyEvents.length) await persistVocabulary();
  if (studyEvents.length > studyEventRecords.length || legacyStudyEvents.length) await persistStudyEvents();
  spellingItems = mergeVocabularySources(await loadAllRecordValues(SPELLING_STORE), []);
  spellingEvents = mergeStudyEventSources(await loadAllRecordValues(SPELLING_EVENT_STORE), []);
  spellingItems = rebuildItemsReviewStateFromEvents(spellingItems, spellingEvents);
  if (spellingEvents.length) await persistSpelling();
  userDictionaryEntries = mergeUserDictionarySources(await loadAllRecordValues(USER_DICTIONARY_STORE), []);
  knownWords = mergeKnownSources(await loadAllRecordValues(KNOWN_STORE), [], activeStudyTermsFromItems(vocabularyItems, spellingItems));
  // Migrate the old autosave toggle into the new On Return action.
  const storedOnReturn = await loadValue("onReturnAction", null);
  if (storedOnReturn) {
    onReturnAction = normalizeOnReturnAction(storedOnReturn);
  } else {
    const legacyAutosave = await loadValue("autosaveEnabled", true);
    onReturnAction = legacyAutosave ? "vocabulary" : "none";
    await saveValue("onReturnAction", onReturnAction);
  }
  speakOnReturn = Boolean(await loadValue("speakOnReturn", false));
  autosaveEnabled = onReturnAction === "vocabulary" || onReturnAction === "both";
  syncSettingsControls();
  lastMetrics = await loadValue("lastMetrics", null);
  await ensureDailyCheckpoint();
  renderHistory();
  renderVocabulary();
  renderStudyStats();
  renderHistoryChart();
  renderMetrics();
  window.setInterval(refreshReviewScheduleViews, REVIEW_REFRESH_INTERVAL_MS);
  const installed = await hasInstalledDictionary();
  if (previousOpenedAt && Date.now() - Date.parse(previousOpenedAt) > 30 * NORMAL_DAY_MS && !installed) {
    installBanner.hidden = false;
    installBanner.textContent = "Local dictionary storage is missing after a long gap. iOS or the browser may have cleared site data; reinstall the dictionary while online.";
  }
  if (installed && !lastMetrics) {
    dictionaryState.textContent = "Installed";
    dictionarySource.textContent = "Opening local copy";
  }
  // Auto-install/load: open the local copy if present, or download it automatically when online.
  // The manual button only appears as a fallback (offline on a device that never installed).
  const canAutoLoad = installed || navigator.onLine;
  result.innerHTML = canAutoLoad
    ? `<p class="muted">${installed ? "Opening dictionary…" : "Installing dictionary (one-time download)…"}</p>`
    : `<p class="muted">Connect to the internet once to install the dictionary. After that it works offline.</p>`;
  loadButton.hidden = canAutoLoad;
  if (canAutoLoad) setSearchLoading(true);

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
  const isAutomatedContext = ["q", "autorun", "suite-main-smoke", "suite-study-smoke", "suite-upgrade-merge", "suite-checkpoint-rollback"]
    .some((key) => params.has(key));
  if (!isAutomatedContext) {
    void showLoginGateIfNeeded();
  }
  const smokeTerm = params.get("q");
  if (canAutoLoad && !smokeTerm) {
    void ensureDictionaryLoaded().then((ok) => {
      if (!ok) return;
      termInput.focus();
      // Clear the transient "Opening dictionary…" placeholder once it's ready;
      // otherwise it lingers under the search box even though nothing is loading.
      if (termInput.value.trim()) void runLookup();
      else result.innerHTML = `<p class="muted">${DEFAULT_RESULT_HINT}</p>`;
    });
  }

  if (smokeTerm) {
    void runAutomatedSearchSmoke(smokeTerm, params.get("report") === "1");
  }
}

loadButton.addEventListener("click", async () => {
  if (await ensureDictionaryLoaded()) await runLookup();
});

// Only word-input characters are accepted; stray symbol presses (assumed
// mistaken touches) are dropped. Space and apostrophe are kept so phrases
// ("take off") and contractions ("o'clock") still work. The CJK range mirrors
// HAN_RE exactly so any character that routes to the Chinese→English lookup is
// also accepted here (Chinese terms can be typed and translated).
const DISALLOWED_TERM_CHARS = /[^A-Za-z0-9 '\-㐀-鿿]/g;
function sanitizeTermInput() {
  const before = termInput.value;
  const cleaned = before.replace(DISALLOWED_TERM_CHARS, "");
  if (cleaned === before) return;
  const caret = termInput.selectionStart ?? cleaned.length;
  const keptBeforeCaret = before.slice(0, caret).replace(DISALLOWED_TERM_CHARS, "").length;
  termInput.value = cleaned;
  try {
    termInput.setSelectionRange(keptBeforeCaret, keptBeforeCaret);
  } catch {
    /* setSelectionRange not available in this state */
  }
}

const DISALLOWED_SPELLING_CHARS = /[^A-Za-z0-9-]/g;
function sanitizeSpellingInput(input) {
  const before = input.value;
  const cleaned = before.replace(DISALLOWED_SPELLING_CHARS, "");
  if (cleaned === before) return;
  const caret = input.selectionStart ?? cleaned.length;
  const keptBeforeCaret = before.slice(0, caret).replace(DISALLOWED_SPELLING_CHARS, "").length;
  input.value = cleaned;
  try {
    input.setSelectionRange(keptBeforeCaret, keptBeforeCaret);
  } catch {
    /* setSelectionRange not available in this state */
  }
}

// A second Return on unchanged text clears the field (set in the keydown handler).
let lastReturnValue = null;

function clearSearchField() {
  termInput.value = "";
  renderSuggestions([]);
  currentResult = null;
  scheduleAutosave(null);
  result.innerHTML = `<p class="muted">${DEFAULT_RESULT_HINT}</p>`;
  aiDetailPanel.hidden = true;
  aiDetailPanel.innerHTML = "";
  pendingAiDetail = null;
  lastReturnValue = null;
  clearPendingUndo();
  renderRecentSearchPopover();
}

termInput.addEventListener("input", () => {
  sanitizeTermInput();
  lastReturnValue = null; // any edit re-arms first-Return (save) behavior
  clearPendingUndo(); // editing means we've moved on from the just-saved word
  hideRecentSearchPopover();
  window.clearTimeout(debounceHandle);
  window.clearTimeout(suggestionHandle);
  suggestionHandle = window.setTimeout(runSuggestions, 75);
  debounceHandle = window.setTimeout(() => void runLookup({ commit: false }), 150);
});

termInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    window.clearTimeout(debounceHandle);
    hideRecentSearchPopover();
    renderSuggestions([]);
    const value = termInput.value;
    if (lastReturnValue !== null && value === lastReturnValue && value.trim()) {
      // Second consecutive Return on unchanged text: clear, ready for the next word.
      clearSearchField();
      return;
    }
    lastReturnValue = value;
    void handleReturnKey();
  }
});

termInput.addEventListener("input", () => {
  termInput.classList.remove("input-invalid");
});

undoSaveButton?.addEventListener("click", () => {
  void performUndoSave();
  termInput.focus();
});

termInput.addEventListener("focus", () => {
  if (!termInput.value.trim()) renderRecentSearchPopover();
});

historyList.addEventListener("click", (event) => {
  if (!(event.target instanceof HTMLButtonElement)) return;
  termInput.value = event.target.dataset.term ?? "";
  void runLookup({ commit: true });
});

suggestions.addEventListener("click", (event) => {
  if (!(event.target instanceof HTMLButtonElement)) return;
  termInput.value = event.target.dataset.term ?? "";
  renderSuggestions([]);
  hideRecentSearchPopover();
  void runLookup({ commit: true });
});

recentSearchPopover.addEventListener("click", (event) => {
  if (!(event.target instanceof HTMLButtonElement)) return;
  termInput.value = event.target.dataset.term ?? "";
  hideRecentSearchPopover();
  void runLookup({ commit: true });
});

result.addEventListener("click", (event) => {
  if (event.target instanceof HTMLButtonElement && event.target.id === "saveCurrentTerm" && currentResult) {
    void saveWithUndo(currentResult, ["vocabulary"], "manual");
    return;
  }
  if (event.target instanceof HTMLButtonElement && event.target.id === "addToSpelling" && currentResult) {
    void saveWithUndo(currentResult, ["spelling"], "manual");
    return;
  }
  if (event.target instanceof HTMLButtonElement && event.target.id === "addToDictionary") {
    const typed = event.target.dataset.typedTerm ?? termInput.value;
    void showAddToDictionaryDialog(typed);
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
  if (event.target instanceof HTMLButtonElement && event.target.id === "saveUnknownTerm") {
    const typed = event.target.dataset.typedTerm ?? termInput.value;
    void (async () => {
      const saved = await showUnknownTermDialog(typed);
      if (saved) {
        result.innerHTML = `<p class="muted">Saved <strong>${escapeHtml(saved.term)}</strong> with your meaning. Open it from the Word Lists panel to review or edit.</p>`;
      }
    })();
    return;
  }
  const button = event.target instanceof Element ? event.target.closest("button[data-term]") : null;
  if (!(button instanceof HTMLButtonElement)) return;
  termInput.value = button.dataset.term ?? "";
  renderSuggestions([]);
  void runLookup({ commit: true });
});

vocabularyList.addEventListener("click", (event) => {
  const button = event.target instanceof Element ? event.target.closest("button[data-action]") : null;
  if (!(button instanceof HTMLButtonElement)) return;
  const term = button.dataset.term ?? "";
  const action = button.dataset.action;
  if (action === "vocab-filter") {
    vocabularyView = {
      ...vocabularyView,
      filter: button.dataset.filter ?? "all",
      page: 0,
      selectedTerm: null,
      query: vocabularyView.query ?? "",
    };
    renderVocabulary();
    return;
  }
  if (action === "vocab-summary") {
    vocabularyView = {
      ...vocabularyView,
      filter: "summary",
      page: 0,
      selectedTerm: null,
      query: "",
      addedFrom: "",
      addedTo: "",
      reviewedFrom: "",
      reviewedTo: "",
      reviewCountMin: "",
      reviewCountMax: "",
    };
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
  if (action === "vocab-clear-query") {
    vocabularyView.query = "";
    vocabularyView.page = 0;
    renderVocabulary();
    preserveVocabSearchFocus();
    return;
  }
  if (action === "vocab-clear-advanced-filters") {
    vocabularyView = {
      ...vocabularyView,
      addedFrom: "",
      addedTo: "",
      reviewedFrom: "",
      reviewedTo: "",
      reviewCountMin: "",
      reviewCountMax: "",
      page: 0,
      selectedTerm: null,
    };
    renderVocabulary();
    return;
  }
  if (action === "open") {
    termInput.value = term;
    renderSuggestions([]);
    void runLookup({ commit: true });
  }
  if (action === "edit") void editBrowserItem(term);
  if (action === "archive") {
    vocabularyView.selectedTerm = null;
    void archiveBrowserItem(term, true);
  }
  if (action === "restore") void archiveBrowserItem(term, false);
});

function handleVocabularyFilterInput(event) {
  if (!(event.target instanceof HTMLInputElement)) return;
  const target = event.target;
  if (target.id === "vocabSearchInput") {
    vocabularyView.query = target.value;
  } else if (target.dataset.vocabFilterKey) {
    const key = target.dataset.vocabFilterKey;
    if (!["addedFrom", "addedTo", "reviewedFrom", "reviewedTo", "reviewCountMin", "reviewCountMax"].includes(key)) return;
    vocabularyView[key] = target.value;
  } else {
    return;
  }
  vocabularyView.page = 0;
  vocabularyView.selectedTerm = null;
  if (vocabularyView.filter === "summary" && (vocabularyView.query.trim() || hasVocabularyAdvancedFilters())) vocabularyView.filter = "all";
  renderVocabulary();
  preserveVocabFilterFocus(target.id);
}

vocabularyList.addEventListener("input", handleVocabularyFilterInput);
vocabularyList.addEventListener("change", handleVocabularyFilterInput);

clearSearchButton.addEventListener("click", () => {
  clearSearchField();
  termInput.focus();
});

onReturnSelect?.addEventListener("change", async () => {
  onReturnAction = normalizeOnReturnAction(onReturnSelect.value);
  autosaveEnabled = onReturnAction === "vocabulary" || onReturnAction === "both";
  await saveValue("onReturnAction", onReturnAction);
});

speakOnReturnToggle?.addEventListener("change", async () => {
  speakOnReturn = speakOnReturnToggle.checked;
  await saveValue("speakOnReturn", speakOnReturn);
});

startReviewButton.addEventListener("click", () => {
  void startDueReview();
});

studyNewWordButton.addEventListener("click", () => {
  void startNewWordStudy();
});

studyOneMoreLevelSelect?.addEventListener("change", () => {
  studyOneMoreLevel = normalizeStudyOneMoreLevel(studyOneMoreLevelSelect.value);
});

startSpellingReviewButton?.addEventListener("click", () => {
  startSpellingReview();
});

startSpellingPracticeMoreButton?.addEventListener("click", () => {
  startSpellingPractice();
});

for (const tab of todayTrackTabs) {
  tab.addEventListener("click", () => {
    const next = tab.dataset.todayTrack;
    if (!next || next === todayTrack) return;
    todayTrack = next;
    hideQuiz();
    hideSpellingReview();
    renderStudyStats();
    void persistUiPreferences();
  });
}

for (const tab of vocabularyTrackTabs) {
  tab.addEventListener("click", () => {
    const next = tab.dataset.vocabTrack;
    if (!next || next === vocabularyView.track) return;
    vocabularyView = {
      ...vocabularyView,
      track: next,
      filter: "summary",
      page: 0,
      selectedTerm: null,
      query: "",
      addedFrom: "",
      addedTo: "",
      reviewedFrom: "",
      reviewedTo: "",
      reviewCountMin: "",
      reviewCountMax: "",
    };
    renderVocabulary();
    void persistUiPreferences();
  });
}

spellingReviewPanel.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && event.target instanceof HTMLInputElement && event.target.id === "spellingInput") {
    event.preventDefault();
    // After a wrong answer, a second Return acts like the Retry button.
    if (activeSpellingSession?.awaitingRetry) retrySpelling();
    else checkSpelling();
  }
});

spellingReviewPanel.addEventListener("input", (event) => {
  if (event.target instanceof HTMLInputElement && event.target.id === "spellingInput") {
    sanitizeSpellingInput(event.target);
  }
});

spellingReviewPanel.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;
  if (target.closest("[data-spelling-retry]")) {
    retrySpelling();
    return;
  }
  if (target.closest("[data-spelling-close]")) {
    hideSpellingReview();
  }
});

quizPanel.addEventListener("pointerup", (event) => {
  activateRatingButtonFromEvent(event, "pointerup");
}, { capture: true });

quizPanel.addEventListener("touchend", (event) => {
  activateRatingButtonFromEvent(event, "touchend");
}, { capture: true, passive: false });

quizPanel.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;
  recordReviewDebug("quiz-panel-click", {
    targetTag: target.tagName,
    targetText: target.textContent?.trim().slice(0, 80) ?? "",
    hasRatingTarget: Boolean(target.closest("[data-fsrs-rating]")),
    hasQuizOptionTarget: Boolean(target.closest("[data-quiz-option]")),
  });
  const ratingButton = target.closest("[data-fsrs-rating]");
  if (ratingButton instanceof HTMLButtonElement) {
    recordReviewDebug("rating-click", { rating: ratingButton.dataset.fsrsRating });
    void handleFsrsRating(ratingButton.dataset.fsrsRating);
    return;
  }
  if (target.closest("[data-quiz-reveal]")) {
    revealQuizOptions();
    return;
  }
  const optionButton = target.closest("[data-quiz-option]");
  if (optionButton instanceof HTMLButtonElement) {
    void handleQuizAnswer(Number(optionButton.dataset.quizOption));
    return;
  }
  const studyOneMoreAdd = target.closest("[data-study-one-more-add]");
  if (studyOneMoreAdd instanceof HTMLButtonElement) {
    void addStudyOneMoreCandidate(studyOneMoreAdd.dataset.studyOneMoreAdd === "spelling" ? "spelling" : "memorize");
    return;
  }
  if (target.closest("[data-study-one-more-show]")) {
    showStudyOneMoreMeaning();
    return;
  }
  if (target.closest("[data-study-one-more-skip]")) {
    void skipStudyOneMoreCandidate();
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

exportButton.addEventListener("click", () => {
  exportState();
});

function setAppMenuOpen(open) {
  appMenu.hidden = !open;
  appMenuButton.setAttribute("aria-expanded", String(open));
  document.body.dataset.menuOpen = open ? "true" : "false";
  if (open) {
    renderAppMenu();
    // Warm up Google Identity so a Sign-in tap opens the popup synchronously (iOS activation).
    preloadGoogleIdentity();
    void autoReconnectGoogleSession("settings-open");
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  }
}

appMenuButton.addEventListener("click", () => {
  setAppMenuOpen(appMenu.hidden);
});

appMenuBackButton.addEventListener("click", () => {
  setAppMenuOpen(false);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !appMenu.hidden && !document.querySelector(".modal-overlay")) {
    setAppMenuOpen(false);
  }
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

createCheckpointButton.addEventListener("click", async () => {
  try {
    await createCheckpoint("manual");
  } catch (error) {
    checkpointStatus.textContent = error instanceof Error ? error.message : String(error);
  }
});

rollbackCheckpointButton.addEventListener("click", async () => {
  try {
    await rollbackLatestCheckpoint();
  } catch (error) {
    checkpointStatus.textContent = error instanceof Error ? error.message : String(error);
  }
  renderAppMenu();
});

deleteLocalDataButton.addEventListener("click", async () => {
  try {
    await deleteAllLocalUserData();
  } catch (error) {
    checkpointStatus.textContent = `Delete failed: ${error instanceof Error ? error.message : String(error)}`;
  }
});

aiDetailPanel.addEventListener("click", (event) => {
  if (event.target instanceof HTMLButtonElement && event.target.id === "saveAiInsight") {
    void saveAiInsightToVocabulary();
  }
});

themeSelect.addEventListener("change", async () => {
  applyTheme(themeSelect.value);
  await saveValue("theme", theme);
});

fontZoomOutButton.addEventListener("click", async () => {
  applyFontScale(fontScale - FONT_SCALE_STEP);
  await saveValue("fontScale", fontScale);
});

fontZoomInButton.addEventListener("click", async () => {
  applyFontScale(fontScale + FONT_SCALE_STEP);
  await saveValue("fontScale", fontScale);
});

googleSignInButton.addEventListener("click", async () => {
  try {
    if (!getGoogleClientId()) {
      const entered = await promptForGoogleClientId();
      if (!entered) {
        renderAppMenu();
        return;
      }
    }
    // Already signed in with a live token — just confirm status, don't re-prompt.
    if (googleAuth.accessToken && googleAuth.expiresAt > Date.now() + 60_000) {
      googleAuthStatus.textContent = googleAuth.profile?.email
        ? `Signed in as ${googleAuth.profile.email}.`
        : "Already signed in with Google.";
      renderAppMenu();
      return;
    }
    googleAuthStatus.textContent = hasGoogleGrant()
      ? "Reconnecting your Google session..."
      : "Opening Google sign-in...";
    await ensureGoogleToken(false);
    googleAuthStatus.textContent = googleAuth.profile?.email
      ? `Signed in as ${googleAuth.profile.email}.`
      : "Signed in with Google.";
  } catch (error) {
    googleAuthStatus.textContent = describeSignInError(error);
    renderAuthDiagnostics();
  }
  renderAppMenu();
});

googleClientIdConfigButton.addEventListener("click", async () => {
  const entered = await promptForGoogleClientId();
  if (entered) {
    // A new client ID needs a fresh token client; rebuild and preload it.
    googleTokenClient = null;
    googleTokenClientClientId = null;
    preloadGoogleIdentity();
    googleAuthStatus.textContent = "Saved OAuth client ID override. Tap Sign in with Google to authenticate.";
  }
  renderAppMenu();
});

geminiApiKeyConfigButton.addEventListener("click", async () => {
  const entered = await promptForGeminiApiKey();
  if (entered) {
    googleAuthStatus.textContent = "Saved Gemini API key. AI Chat will use it on the next open.";
  }
  renderAppMenu();
});

googleSyncNowButton.addEventListener("click", async () => {
  let message = "";
  try {
    await syncToGoogleDrive();
    message = googleAuthStatus.textContent; // set by syncToGoogleDrive (counts / "no backup")
  } catch (error) {
    driveSyncState = "error";
    message = error instanceof Error ? error.message : String(error);
  }
  // renderAppMenu() resets googleAuthStatus, so re-apply the sync result LAST so it stays visible.
  renderAppMenu();
  if (message) googleAuthStatus.textContent = message;
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
  if (googleAuth.accessToken && window.google?.accounts?.oauth2?.revoke) {
    try {
      google.accounts.oauth2.revoke(googleAuth.accessToken, () => {});
    } catch {
      /* revoke is best-effort */
    }
  }
  googleAuth = { accessToken: null, expiresAt: 0, profile: null, scopes: [] };
  googleGrantGranted = false;
  await saveValue("googleProfile", null);
  await saveValue("googleAuth", null);
  await saveValue("googleGrant", false);
  stopAutoSync();
  renderAppMenu();
});

authDiagnosticsToggleButton.addEventListener("click", () => {
  if (authDiagnosticsPre.hidden) {
    renderAuthDiagnostics();
  } else {
    authDiagnosticsPre.hidden = true;
  }
});

authDiagnosticsSendButton.addEventListener("click", async () => {
  const result = await sendAuthDiagnostics();
  googleAuthStatus.textContent = result.sent
    ? "Sign-in diagnostics sent to the server (received-results folder)."
    : `Could not send diagnostics: ${result.reason ?? result.status ?? "unknown"}. Read them on-screen above instead.`;
});

for (const button of historyGranularityButtons) {
  button.addEventListener("click", () => {
    const next = button.dataset.historyGranularity;
    if (!next || next === historyView.granularity) return;
    historyView = { ...historyView, granularity: next };
    renderHistoryChart();
  });
}

for (const tab of historyTrackTabs) {
  tab.addEventListener("click", () => {
    const next = tab.dataset.historyTrack;
    if (!next || next === historyView.track) return;
    historyView = { ...historyView, track: next };
    renderHistoryChart();
    void persistUiPreferences();
  });
}

historyPrevButton.addEventListener("click", () => {
  shiftHistoryAnchor(-1);
});

historyNextButton.addEventListener("click", () => {
  shiftHistoryAnchor(1);
});

historyTodayButton.addEventListener("click", () => {
  historyView = { ...historyView, anchorMs: null };
  renderHistoryChart();
});

historyAnchorInput.addEventListener("change", () => {
  const value = historyAnchorInput.value;
  if (!value) {
    historyView = { ...historyView, anchorMs: null };
  } else {
    const [year, month, day] = value.split("-").map(Number);
    if (Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)) {
      const picked = new Date(year, month - 1, day);
      const today = startOfDay(new Date(realNowMs()));
      const clamped = picked.getTime() > today.getTime() ? null : startOfDay(picked).getTime();
      historyView = { ...historyView, anchorMs: clamped };
    }
  }
  renderHistoryChart();
});

debugModeToggle.addEventListener("click", () => {
  void setDebugMode(!debugMode.enabled);
});

runReviewAutomationButton.addEventListener("click", () => {
  void runReviewAutomation();
});

window.addEventListener("online", () => {
  renderAppMenu();
  void autoReconnectGoogleSession("online", { syncAfter: true });
  void runAutoSync("online");
  // If the dictionary never installed (first run was offline), install it now that we're online.
  if (!loaded) void ensureDictionaryLoaded();
});
window.addEventListener("offline", renderAppMenu);
window.addEventListener("focus", () => {
  refreshReviewScheduleViews();
  void autoReconnectGoogleSession("focus");
  void runAutoSync("focus");
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    refreshReviewScheduleViews();
    void autoReconnectGoogleSession("visibility");
    void runAutoSync("visibility");
  }
});

document.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target.closest("[data-speak-term]") : null;
  if (!target) return;
  event.preventDefault();
  event.stopPropagation();
  speakTerm(target.getAttribute("data-speak-term"));
});

document.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target.closest("[data-ai-chat-term]") : null;
  if (!target) return;
  event.preventDefault();
  event.stopPropagation();
  void openAiChatPanel(target.getAttribute("data-ai-chat-term"));
});

aiChatBackButton.addEventListener("click", () => {
  setAiChatOpen(false);
});

for (const tab of aiChatPanel.querySelectorAll("[data-ai-tab]")) {
  tab.addEventListener("click", () => {
    const next = tab.dataset.aiTab;
    if (!next) return;
    aiChatState.tab = next;
    renderAiChatPanel();
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !aiChatPanel.hidden && !document.querySelector(".modal-overlay")) {
    setAiChatOpen(false);
  }
});

// --- Study goals & suggestions ------------------------------------------------
// Quantified, user-set targets (vocabulary track) plus derived coaching tips.
// Only the targets are persisted (key "studyGoals", carried in the sync
// snapshot); all progress and suggestions are computed at render time from
// vocabularyItems + studyEvents, so there is no extra state to keep consistent.
const GOALS_PERIODS = ["day", "week", "month"];
const STARTER_GOALS = { newPerDay: 5, reviewsPerDay: 15, masteredPerWeek: 5, masteredPerMonth: 20 };
let studyGoals = null;
let goalsPeriod = "day";

const goalsPanel = document.querySelector("#goalsPanel");
const goalsSummary = document.querySelector("#goalsSummary");
const goalsPeriodTabsWrap = document.querySelector("#goalsPeriodTabs");
const goalsPeriodTabs = document.querySelectorAll("[data-goals-period]");
const goalsProgressEl = document.querySelector("#goalsProgress");
const goalsSuggestionsEl = document.querySelector("#goalsSuggestions");
const setGoalsButton = document.querySelector("#setGoalsButton");

function clampInt(value, min, max, fallback) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function normalizeStudyGoals(raw) {
  if (!raw || typeof raw !== "object") return null;
  return {
    version: 1,
    track: "vocabulary",
    newPerDay: clampInt(raw.newPerDay, 1, 100, STARTER_GOALS.newPerDay),
    reviewsPerDay: clampInt(raw.reviewsPerDay, 1, 300, STARTER_GOALS.reviewsPerDay),
    masteredPerWeek: clampInt(raw.masteredPerWeek, 1, 200, STARTER_GOALS.masteredPerWeek),
    masteredPerMonth: clampInt(raw.masteredPerMonth, 1, 800, STARTER_GOALS.masteredPerMonth),
    createdAt: raw.createdAt ?? nowIso(),
    updatedAt: raw.updatedAt ?? nowIso(),
    source: raw.source ?? "wizard",
  };
}

// Median of the per-day counts over the last `days` calendar days that had any
// activity, so the wizard's suggested defaults reflect the learner's own rhythm.
function medianDailyCount(timestamps, days = 14) {
  const now = appNowMs();
  const buckets = new Map();
  for (const ts of timestamps) {
    const t = Date.parse(ts ?? "");
    if (!Number.isFinite(t) || now - t > days * NORMAL_DAY_MS) continue;
    const key = new Date(t).toISOString().slice(0, 10);
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  const counts = [...buckets.values()].sort((a, b) => a - b);
  if (!counts.length) return 0;
  const mid = Math.floor(counts.length / 2);
  return counts.length % 2 ? counts[mid] : Math.round((counts[mid - 1] + counts[mid]) / 2);
}

function goalDefaults() {
  const newPerDay = clampInt(medianDailyCount(vocabularyItems.map((i) => i.savedAt)), 3, 20, 0) || STARTER_GOALS.newPerDay;
  const reviewsPerDay = clampInt(medianDailyCount(studyEvents.filter((e) => e.type === "review").map((e) => e.occurredAt)), 5, 40, 0) || STARTER_GOALS.reviewsPerDay;
  const masteredPerWeek = Math.max(3, Math.round(newPerDay * 5 * 0.7));
  return { newPerDay, reviewsPerDay, masteredPerWeek, masteredPerMonth: masteredPerWeek * 4 };
}

// [startMs, endMs) bounds for the active period, anchored to app (debug-aware) now.
function periodRange(period) {
  const now = new Date(appNowMs());
  if (period === "week") {
    const start = startOfWeekMonday(now);
    return { startMs: start.getTime(), endMs: addDays(start, 7).getTime(), days: 7 };
  }
  if (period === "month") {
    const start = startOfMonth(now);
    const end = addMonths(start, 1);
    return { startMs: start.getTime(), endMs: end.getTime(), days: Math.round((end.getTime() - start.getTime()) / NORMAL_DAY_MS) };
  }
  const start = startOfDay(now);
  return { startMs: start.getTime(), endMs: addDays(start, 1).getTime(), days: 1 };
}

function inRange(value, startMs, endMs) {
  const t = Date.parse(value ?? "");
  return Number.isFinite(t) && t >= startMs && t < endMs;
}

function vocabStatsForRange(startMs, endMs) {
  return {
    newSaved: vocabularyItems.filter((i) => inRange(i.savedAt, startMs, endMs)).length,
    reviewed: studyEvents.filter((e) => e.type === "review" && inRange(e.occurredAt, startMs, endMs)).length,
    mastered: vocabularyItems.filter((i) => inRange(i.review?.masteredAt, startMs, endMs)).length,
  };
}

function goalTargetsForPeriod(period) {
  if (!studyGoals) return null;
  if (period === "week") {
    return { new: studyGoals.newPerDay * 7, reviews: studyGoals.reviewsPerDay * 7, mastered: studyGoals.masteredPerWeek };
  }
  if (period === "month") {
    const days = periodRange("month").days;
    return { new: studyGoals.newPerDay * days, reviews: studyGoals.reviewsPerDay * days, mastered: studyGoals.masteredPerMonth };
  }
  return { new: studyGoals.newPerDay, reviews: studyGoals.reviewsPerDay, mastered: Math.max(1, Math.round(studyGoals.masteredPerWeek / 7)) };
}

// Hour-of-day (0-23) with the most past reviews, or null if there isn't enough
// data or no hour clearly stands out.
function bestReviewHour(minSample = 20) {
  const hours = new Array(24).fill(0);
  let total = 0;
  for (const e of studyEvents) {
    if (e.type !== "review") continue;
    const t = Date.parse(e.occurredAt ?? "");
    if (!Number.isFinite(t)) continue;
    hours[new Date(t).getHours()] += 1;
    total += 1;
  }
  if (total < minSample) return null;
  let best = 0;
  for (let h = 1; h < 24; h += 1) if (hours[h] > hours[best]) best = h;
  if (hours[best] < (total / 24) * 1.5) return null;
  return best;
}

function formatHour(h) {
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}${h < 12 ? "am" : "pm"}`;
}

// One short, specific, numeric tip per applicable rule, ranked by impact.
function computeGoalSuggestions() {
  if (!studyGoals) return [];
  const out = [];
  const period = goalsPeriod;
  const { startMs, days } = periodRange(period);
  const range = periodRange(period);
  const stats = vocabStatsForRange(range.startMs, range.endMs);
  const targets = goalTargetsForPeriod(period);
  const now = appNowMs();
  const elapsedDays = Math.min(days, Math.max(1, Math.ceil((now - startMs) / NORMAL_DAY_MS)));
  const remainingDays = Math.max(0, days - elapsedDays);
  const label = period === "day" ? "today" : period === "week" ? "this week" : "this month";
  const gap = (done, target) => Math.max(0, target - done);

  const newGap = gap(stats.newSaved, targets.new);
  if (newGap > 0) {
    const perDay = remainingDays > 0 ? Math.ceil(newGap / remainingDays) : newGap;
    out.push(period === "day"
      ? `Add ${newGap} more new word${newGap === 1 ? "" : "s"} ${label} to hit your goal.`
      : `Add ${newGap} more new words ${label} — about ${perDay}/day for the next ${remainingDays} day${remainingDays === 1 ? "" : "s"}.`);
  }
  const reviewGap = gap(stats.reviewed, targets.reviews);
  if (reviewGap > 0) {
    const perDay = remainingDays > 0 ? Math.ceil(reviewGap / remainingDays) : reviewGap;
    out.push(period === "day"
      ? `Do ${reviewGap} more review${reviewGap === 1 ? "" : "s"} ${label} to hit your goal.`
      : `Do ${reviewGap} more reviews ${label} — about ${perDay}/day for the next ${remainingDays} day${remainingDays === 1 ? "" : "s"}.`);
  }
  if (targets.mastered > 0 && period !== "day") {
    const expectedByNow = targets.mastered * (elapsedDays / days);
    if (stats.mastered + 0.5 < expectedByNow) {
      const behind = Math.ceil(expectedByNow - stats.mastered);
      out.push(`You're ${behind} behind the mastery pace ${label}; extra reviews now will catch you up.`);
    } else if (stats.mastered >= targets.mastered) {
      out.push(`Mastery goal for ${label} reached — nice work.`);
    }
  }
  const due = getDueVocabularyItems().length;
  if (due > studyGoals.reviewsPerDay * 1.5) {
    out.push(`${due} reviews are due. Clearing the backlog matters more than adding new words right now.`);
  }
  const hour = bestReviewHour();
  if (hour !== null) {
    out.push(`You review most around ${formatHour(hour)} — that's a good time to do reviews or add words.`);
  }
  if (!out.length) out.push(`You're on track for ${label}. Keep it up!`);
  return out;
}

function renderGoalBar(label, done, target) {
  const pct = target > 0 ? Math.min(100, Math.round((done / target) * 100)) : 0;
  const met = target > 0 && done >= target;
  return `
    <div class="goal-metric${met ? " met" : ""}">
      <div class="goal-metric-head"><span>${escapeHtml(label)}</span><strong>${done} / ${target}</strong></div>
      <div class="goal-bar"><span style="width:${pct}%"></span></div>
    </div>`;
}

function renderGoalsPanel() {
  if (!goalsPanel) return;
  for (const tab of goalsPeriodTabs) {
    tab.setAttribute("aria-selected", String(tab.dataset.goalsPeriod === goalsPeriod));
  }
  if (!studyGoals) {
    if (goalsPeriodTabsWrap) goalsPeriodTabsWrap.hidden = true;
    if (setGoalsButton) setGoalsButton.textContent = "Set goals";
    goalsSummary.textContent = "Set a daily goal and get tips to reach it.";
    goalsProgressEl.innerHTML = `<p class="muted goals-cta">No goals yet — tap “Set goals”. Takes about 20 seconds.</p>`;
    goalsSuggestionsEl.innerHTML = "";
    return;
  }
  if (goalsPeriodTabsWrap) goalsPeriodTabsWrap.hidden = false;
  if (setGoalsButton) setGoalsButton.textContent = "Edit goals";
  const { startMs, endMs } = periodRange(goalsPeriod);
  const stats = vocabStatsForRange(startMs, endMs);
  const targets = goalTargetsForPeriod(goalsPeriod);
  goalsSummary.textContent = `Targets: ${studyGoals.newPerDay} new + ${studyGoals.reviewsPerDay} reviews/day, ${studyGoals.masteredPerWeek} mastered/week.`;
  goalsProgressEl.innerHTML =
    renderGoalBar("New words", stats.newSaved, targets.new) +
    renderGoalBar("Reviews", stats.reviewed, targets.reviews) +
    renderGoalBar("Mastered", stats.mastered, targets.mastered);
  const suggestions = computeGoalSuggestions();
  goalsSuggestionsEl.innerHTML = `<h3 class="goals-tips-title">Suggestions</h3><ul>${suggestions.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul>`;
}

async function saveStudyGoals(next, source = "wizard") {
  const now = nowIso();
  const created = studyGoals?.createdAt ?? now;
  studyGoals = normalizeStudyGoals({ ...next, createdAt: created, updatedAt: now, source });
  await saveValue("studyGoals", studyGoals);
  renderGoalsPanel();
  return studyGoals;
}

async function openGoalsWizard() {
  const base = studyGoals ?? goalDefaults();
  const suggested = goalDefaults();
  const values = await showModal({
    title: studyGoals ? "Edit your goals" : "Set your study goals",
    body: `Pick targets you can keep. Based on your recent activity we suggest about ${suggested.newPerDay} new words and ${suggested.reviewsPerDay} reviews per day.`,
    submitText: "Save goals",
    fields: [
      { id: "newPerDay", label: "New words per day", type: "number", value: String(base.newPerDay), hint: `Suggested: ${suggested.newPerDay}` },
      { id: "reviewsPerDay", label: "Reviews per day", type: "number", value: String(base.reviewsPerDay), hint: `Suggested: ${suggested.reviewsPerDay}` },
      { id: "masteredPerWeek", label: "Words mastered per week", type: "number", value: String(base.masteredPerWeek), hint: `Suggested: ${suggested.masteredPerWeek}` },
      { id: "masteredPerMonth", label: "Words mastered per month", type: "number", value: String(base.masteredPerMonth), hint: `Suggested: ${suggested.masteredPerMonth}` },
    ],
  });
  if (!values) return null;
  return saveStudyGoals(values, "wizard");
}

setGoalsButton?.addEventListener("click", () => { void openGoalsWizard(); });
for (const tab of goalsPeriodTabs) {
  tab.addEventListener("click", () => {
    goalsPeriod = GOALS_PERIODS.includes(tab.dataset.goalsPeriod) ? tab.dataset.goalsPeriod : "day";
    renderGoalsPanel();
  });
}

window.WordLoverApp = {
  ensureDictionaryLoaded,
  lookupTerm,
  suggestTerms,
  lookupChineseTerm,
  saveVocabularyItem,
  saveManualVocabularyItem,
  showUnknownTermDialog,
  getVocabulary: () => vocabularyItems,
  getStudyEvents: () => studyEvents,
  getKnownWords: () => knownWords,
  buildUserDataSnapshot,
  mergeSnapshots,
  startDueReview,
  startNewWordStudy,
  studyOneMore: {
    levels: () => STUDY_ONE_MORE_LEVELS.map((level) => ({ ...level })),
    levelFor: fallbackStudyOneMoreLevel,
    matchesLevel: candidateMatchesStudyOneMoreLevel,
    pickFromCandidates: pickStudyOneMoreCandidateFromRows,
    current: () => activeStudyOneMoreEntry,
    setLevel: (level) => {
      studyOneMoreLevel = normalizeStudyOneMoreLevel(level);
      if (studyOneMoreLevelSelect) studyOneMoreLevelSelect.value = studyOneMoreLevel;
      return studyOneMoreLevel;
    },
  },
  reviewScheduling: {
    applyPolicy: applyVocabularyReviewSchedulingPolicy,
  },
  reviewDebug: {
    events: () => reviewDebugEvents.map((event) => ({ ...event })),
    clear: () => {
      reviewDebugEvents = [];
    },
    setPersistenceHookForTest: (hook, timeoutMs = 4000) => {
      reviewPersistenceBeforeSaveForTest = typeof hook === "function" ? hook : null;
      reviewPersistenceTimeoutMs = Number.isFinite(Number(timeoutMs)) ? Math.max(50, Number(timeoutMs)) : 4000;
    },
    state: () => ({
      activeQuiz: activeQuiz ? {
        id: activeQuiz.id,
        mode: activeQuiz.mode,
        term: activeQuiz.entry?.term ?? null,
        answered: activeQuiz.answered,
        pending: Boolean(activeQuiz.pendingResult),
        ratingSubmitted: Boolean(activeQuiz.ratingSubmitted),
        autoTimer: Boolean(activeQuiz.autoRatingTimer),
      } : null,
      session: activeVocabularyReviewSession ? {
        mode: activeVocabularyReviewSession.mode,
        index: activeVocabularyReviewSession.index,
        length: activeVocabularyReviewSession.queue?.length ?? 0,
        currentTerm: activeVocabularyReviewSession.queue?.[activeVocabularyReviewSession.index]?.term ?? null,
      } : null,
      ratingButtons: [...quizPanel.querySelectorAll("[data-fsrs-rating]")].map((button) => ({
        rating: button.dataset.fsrsRating,
        text: button.textContent?.trim() ?? "",
        disabled: button.disabled,
        topmost: isElementTopmost(button),
      })),
      overlayOpen: Boolean(document.querySelector(".modal-overlay")),
    }),
  },
  dateKeys: {
    localDateKey,
    isToday,
  },
  validateSnapshot: validateUserDataSnapshot,
  getActiveQuiz: () => activeQuiz,
  checkForAppUpdate,
  refreshReviewScheduleViews,
  runReviewAutomation,
  createCheckpoint,
  listCheckpoints,
  rollbackLatestCheckpoint,
  deleteAllLocalUserData,
  setDebugMode,
  getDueVocabularyItems,
  setAutosaveEnabled: async (enabled) => {
    onReturnAction = enabled ? "vocabulary" : "none";
    autosaveEnabled = Boolean(enabled);
    syncSettingsControls();
    await saveValue("onReturnAction", onReturnAction);
  },
  setOnReturnAction: async (action) => {
    onReturnAction = normalizeOnReturnAction(action);
    autosaveEnabled = onReturnAction === "vocabulary" || onReturnAction === "both";
    syncSettingsControls();
    await saveValue("onReturnAction", onReturnAction);
  },
  setSpeakOnReturn: async (enabled) => {
    speakOnReturn = Boolean(enabled);
    syncSettingsControls();
    await saveValue("speakOnReturn", speakOnReturn);
  },
  saveSpellingItem,
  getSpelling: () => spellingItems,
  getSpellingEvents: () => spellingEvents,
  getUserDictionary: () => userDictionaryEntries,
  addUserDictionaryEntry: showAddToDictionaryDialog,
  addUserDictionaryEntryForTest: async (word, english, chinese) => {
    const now = nowIso();
    const entry = {
      normalizedTerm: normalizeTerm(word),
      word,
      phonetic: "",
      englishMeanings: [english ?? ("meaning of " + word)],
      chineseMeanings: [chinese ?? ("中文" + word)],
      createdAt: now,
      updatedAt: now,
      syncVersion: 1,
    };
    userDictionaryEntries = [entry, ...userDictionaryEntries.filter((e) => e.normalizedTerm !== entry.normalizedTerm)];
    await persistUserDictionaryEntry(entry);
    return entry;
  },
  getDueSpellingItems,
  spelling: {
    ratingFromRetries,
    getDue: getDueSpellingItems,
    getPractice: getPracticeSpellingItems,
    start: startSpellingReview,
    startPractice: startSpellingPractice,
    retry: retrySpelling,
    close: hideSpellingReview,
    // Test/programmatic answer: types into the field and submits a strict check.
    answer: (text) => {
      const input = spellingReviewPanel.querySelector("#spellingInput");
      if (!input || input.disabled) return false;
      input.value = String(text);
      checkSpelling();
      return true;
    },
    state: () => activeSpellingSession ? {
      index: activeSpellingSession.index,
      retries: activeSpellingSession.retries,
      consecutive: activeSpellingSession.consecutive,
      completed: activeSpellingSession.completed,
      mode: activeSpellingSession.mode,
      queueLength: activeSpellingSession.queue.length,
      currentTerm: currentSpellingItem()?.term ?? null,
      awaitingRetry: activeSpellingSession.awaitingRetry,
      pausing: Boolean(activeSpellingSession.pausing),
    } : null,
    // Directly seed a spelling item for tests (bypasses dictionary lookup).
    addItemForTest: async (term, english, chinese) => {
      await saveSpellingItem({
        status: "found",
        term,
        entryType: term.includes(" ") ? "phrase" : "word",
        phonetic: "",
        englishMeanings: [english ?? ("meaning of " + term)],
        englishMeaningSource: "test",
        chineseMeanings: [chinese ?? ("中文" + term)],
        tags: [],
      }, "test");
      return getSpellingItem(term);
    },
    setTodayTrack: (track) => {
      todayTrack = normalizeTrack(track);
      renderStudyStats();
      void persistUiPreferences();
    },
  },
  uiPreferences: {
    state: () => currentUiPreferences(),
    set: async (preferences = {}) => {
      applyUiPreferences(preferences);
      await persistUiPreferences();
      renderVocabulary();
      renderStudyStats();
      renderHistoryChart();
      return currentUiPreferences();
    },
  },
  runAutomatedSearchSmoke,
  applyTheme: (next) => {
    applyTheme(next);
    themeSelect.value = theme;
    void saveValue("theme", theme);
    return theme;
  },
  getThemeIds: () => THEME_IDS.slice(),
  getGoals: () => studyGoals,
  setGoals: (goals) => saveStudyGoals(goals ?? {}, "test"),
  goalDefaults,
  goalSuggestions: () => computeGoalSuggestions(),
  openGoalsWizard,
  setGoalsPeriod: (period) => {
    goalsPeriod = GOALS_PERIODS.includes(period) ? period : "day";
    renderGoalsPanel();
    return goalsPeriod;
  },
  aiChat: {
    cacheGet: aiChatCacheGet,
    cacheSet: aiChatCacheSet,
    cacheDelete: aiChatCacheDelete,
    cacheSize: () => aiChatCache.size,
    cacheKeys: () => [...aiChatCache.keys()],
    limit: AI_CHAT_CACHE_LIMIT,
    renderExplain: (term, payload) => {
      aiChatState = { term, payload, tab: "explain", quizMode: "mcq", loading: false, error: null };
      setAiChatOpen(true);
      renderAiChatPanel();
    },
    setTab: (tab) => {
      aiChatState.tab = tab;
      renderAiChatPanel();
    },
    close: () => setAiChatOpen(false),
    renderDetails: (detail) => {
      aiDetailPanel.hidden = false;
      aiDetailPanel.innerHTML = renderAiDetailCards(detail, null);
    },
  },
  getGeminiModel,
  getGeminiModelChoices: getCachedGeminiModelChoices,
  auth: {
    ensureToken: (options) => ensureGoogleToken(false, options ?? {}),
    state: () => ({
      hasToken: Boolean(googleAuth.accessToken),
      tokenValid: Boolean(googleAuth.accessToken && googleAuth.expiresAt > Date.now() + 60_000),
      expiresAt: googleAuth.expiresAt,
      hasGrant: hasGoogleGrant(),
      email: googleAuth.profile?.email ?? null,
      scopes: googleAuth.scopes ?? [],
    }),
    expireToken: () => {
      googleAuth.expiresAt = Date.now() - 1000;
      googleAuth.accessToken = null;
      renderAppMenu();
    },
    setGrantForTest: async (granted) => {
      await setGoogleGrant(Boolean(granted));
      renderAppMenu();
    },
    statusText: () => googleAuthStatus?.textContent ?? "",
    autoReconnect: (reason = "test") => autoReconnectGoogleSession(reason),
    canAutoReconnect: canAutoReconnectGoogle,
    clearTokenForTest: () => {
      googleAuth.accessToken = null;
      googleAuth.expiresAt = 0;
      renderAppMenu();
    },
    describeSignInError: (message, options) => describeSignInError(new Error(String(message)), options),
    isStandalone: isStandalonePwa,
    diagnostics: authDiagnosticsSnapshot,
  },
  sync: {
    now: syncToGoogleDrive,
    restore: restoreFromGoogleDrive,
    lastInfo: () => lastSyncInfo,
    lastSummary: () => lastSyncSummary,
  },
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
    aiChatCacheSize: aiChatCache.size,
    geminiModel: getGeminiModel(),
    encryptedUserStore: true,
    persistentIndexedDbConnection: Boolean(dbPromise),
  }),
};

void init();
