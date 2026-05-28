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
const autosaveToggle = document.querySelector("#autosaveToggle");
const onReturnSelect = document.querySelector("#onReturnSelect");
const speakOnReturnToggle = document.querySelector("#speakOnReturnToggle");
const vocabularySummary = document.querySelector("#vocabularySummary");
const vocabularyList = document.querySelector("#vocabularyList");
const studySummary = document.querySelector("#studySummary");
const statNewSaved = document.querySelector("#statNewSaved");
const statReviewed = document.querySelector("#statReviewed");
const statMastered = document.querySelector("#statMastered");
const startReviewButton = document.querySelector("#startReview");
const studyNewWordButton = document.querySelector("#studyNewWord");
const quizPanel = document.querySelector("#quizPanel");
const historyChart = document.querySelector("#historyChart");
const historyChartSummary = document.querySelector("#historyChartSummary");
const historyRangeLabel = document.querySelector("#historyRangeLabel");
const historyPrevButton = document.querySelector("#historyPrev");
const historyNextButton = document.querySelector("#historyNext");
const historyTodayButton = document.querySelector("#historyToday");
const historyAnchorInput = document.querySelector("#historyAnchorInput");
const historyGranularityButtons = Array.from(document.querySelectorAll("[data-history-granularity]"));
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
const CHECKPOINT_STORE = "checkpoints";
const DICTIONARY_KEY = "dictionary.sqlite";
const DICTIONARY_PROGRESS_KEY = "dictionary.sqlite.downloadProgress";
const DICTIONARY_CHUNK_PREFIX = "dictionary.sqlite.chunk.";
const DICTIONARY_CHUNK_SIZE = 4 * 1024 * 1024;
const TERM_RE = /^[a-z]+(?:[ '-][a-z]+){0,5}$/;
const HAN_RE = /[\u3400-\u9fff]/;
const DEFAULT_PLACEHOLDER = "abandon, take off, in terms of";
const AUTOSAVE_DWELL_MS = 5000;
const APP_VERSION = "0.6.2-product.20260527-v51";
const USER_DATA_FORMAT_VERSION = "0.3";
const SHELL_CACHE_VERSION = "wordlover-shell-v51";
const DICTIONARY_ENGINE = "Slim 100k-entry dictionary in OPFS; sql.js read engine; wa-sqlite OPFS engine pending bundle install";
const MEMORY_TARGET_NOTE =
  "Memory target: iPhone normal-use DRAM <= 50 MB. This build ships the slim 100k-entry dictionary (~32 MB) so sql.js can hold it in memory; the wa-sqlite OPFS engine remains the production gate for a fuller dictionary.";
const CONFIG = window.WORDLOVER_CONFIG ?? {};
const THEME_IDS = ["sunrise", "candy", "calm", "ink", "sky", "rose"];
const DEFAULT_THEME = "sunrise";
const DEBUG_DAY_MS = 20 * 1000;
const NORMAL_DAY_MS = 24 * 60 * 60 * 1000;
const DEBUG_TIME_SCALE = NORMAL_DAY_MS / DEBUG_DAY_MS;
const REVIEW_REFRESH_INTERVAL_MS = 3 * 60 * 60 * 1000;
const REVIEW_GRACE_WINDOW_MS = 12 * 60 * 60 * 1000;
const DICTIONARY_ESTIMATED_BYTES = 40 * 1024 * 1024;
const DICTIONARY_MANIFEST_URL = "/dictionary-manifest.json";
const DICTIONARY_VERSION_KEY = "dictionaryDataVersion";
const MAX_CHECKPOINTS = 5;
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
let autosaveEnabled = true;
// "vocabulary" | "spelling" | "none" — what pressing Return saves (replaces the autosave toggle).
let onReturnAction = "vocabulary";
let speakOnReturn = false;
let deviceId = null;
let activeQuiz = null;
let activeSpellingSession = null;
let theme = DEFAULT_THEME;
let vocabularyView = {
  filter: "summary",
  page: 0,
  selectedTerm: null,
  query: "",
  track: "vocabulary",
};
let todayTrack = "vocabulary";
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
    const request = indexedDB.open(DB_NAME, 6);
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
  const historyCount = Array.isArray(snapshot.historyItems) ? snapshot.historyItems.length : 0;
  const normalizedTerms = (snapshot.vocabularyItems ?? [])
    .map((item) => item?.normalizedTerm ?? normalizeTerm(item?.term ?? ""))
    .filter(Boolean)
    .sort();
  return {
    vocabularyCount,
    studyEventCount,
    historyCount,
    checksum: checksumText(JSON.stringify({ normalizedTerms, studyEventCount, historyCount })),
  };
}

function validateUserDataSnapshot(snapshot) {
  if (snapshot?.app !== "wordlover") throw new Error("This is not a WordLover user-data snapshot.");
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
  const results = await Promise.allSettled(
    values.map((value) => (isEncryptedRecord(value) ? decryptValue(value) : value)),
  );
  return results
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value);
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
  syncStatus.textContent = !googleAuth.accessToken
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
      syncDetails.textContent =
        `Last sync ${formatSyncTime(lastSyncSummary.at)} · ${lastSyncSummary.words} word(s) · ${formatBytes(lastSyncSummary.sizeBytes)} on Drive` +
        (driveSyncState === "error" && lastSyncInfo?.error ? ` · last attempt failed: ${lastSyncInfo.error}` : "");
    } else if (googleAuth.accessToken) {
      syncDetails.textContent = driveSyncState === "error" && lastSyncInfo?.error
        ? `Not synced yet · last attempt failed: ${lastSyncInfo.error}`
        : "Not synced yet on this device.";
    } else {
      syncDetails.textContent = "";
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
      ? "Session expired. Tap Sign in with Google to reconnect."
      : getGoogleClientId()
        ? "Ready to connect Google."
        : "Tap Sign in with Google to add your OAuth client ID.";
  googleSignInButton.disabled = Boolean(googleAuth.accessToken);
  googleSyncNowButton.disabled = !googleAuth.accessToken;
  googleRestoreButton.disabled = !googleAuth.accessToken;
  googleSignOutButton.disabled = !googleAuth.accessToken;
  themeSelect.value = theme;
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

function getGoogleClientId() {
  const override = String(googleClientIdOverride ?? "").trim();
  if (override) return override;
  return String(CONFIG.googleClientId ?? "").trim();
}

async function promptForGoogleClientId() {
  const current = getGoogleClientId();
  const values = await showModal({
    title: "Google OAuth client ID",
    body: "Paste your Google Cloud OAuth 2.0 client ID (Web application). It is stored locally on this device. Tap the link below to create one in Google Cloud Console under APIs & Services -> Credentials.",
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
        hint: "Add your app origin (e.g. http://127.0.0.1:4173 or https://your-lan-ip) as an Authorized JavaScript origin.",
        required: true,
      },
    ],
    submitText: "Save and sign in",
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
      <p class="muted">No exact dictionary match found.</p>
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

async function fetchDictionaryWithResume(url) {
  let totalBytes = 0;
  try {
    const head = await fetchWithTimeout(url, { method: "HEAD", cache: "no-store" }, 8000);
    totalBytes = Number(head.headers.get("content-length") ?? 0);
  } catch {
    totalBytes = 0;
  }

  const storageCheck = await checkStorageBeforeInstall(totalBytes || DICTIONARY_ESTIMATED_BYTES);
  if (!storageCheck.ok) throw new Error(storageCheck.message);
  if (storageCheck.warning) result.innerHTML = `<p class="muted">${escapeHtml(storageCheck.warning)}</p>`;

  if (!totalBytes) {
    const response = await fetchWithTimeout(url, { cache: "no-store" }, 120000);
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
    const response = await fetchWithTimeout(url, {
      cache: "no-store",
      headers: { Range: `bytes=${start}-${end}` },
    }, 60000);
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
  let source = "offline copy";
  let bytes = null;

  const hasLocalCopy = await hasInstalledDictionary();
  // Best-effort, time-boxed update check. Skipped entirely when offline so a never-settling
  // request can't block loading the installed copy (the iOS offline-hang bug).
  const remoteManifest = await fetchRemoteDictionaryManifest();
  const localVersion = await loadValue(DICTIONARY_VERSION_KEY, null);
  const remoteVersion = remoteManifest?.dictionaryDataVersion ?? null;
  const versionChanged = Boolean(remoteVersion && localVersion && remoteVersion !== localVersion);

  // Local-first: if an installed copy exists and there is no confirmed update, use it with
  // no network body fetch at all. This makes offline launches load instantly and reliably.
  if (hasLocalCopy && !versionChanged) {
    bytes = await loadLocalDictionaryBytes();
  }

  if (!bytes) {
    if (versionChanged) {
      result.innerHTML = `<p class="muted">Dictionary update detected (${escapeHtml(localVersion)} -> ${escapeHtml(remoteVersion)}). Replacing local copy.</p>`;
      await invalidateLocalDictionaryCopy();
      await saveValue("dictionaryInstalled", false);
    }
    try {
      bytes = await fetchDictionaryWithResume("/dictionary.sqlite");
      source = "network";
      await saveOpfsFile(DICTIONARY_KEY, bytes);
      await saveValue("dictionaryInstalled", true);
      if (remoteVersion) await saveValue(DICTIONARY_VERSION_KEY, remoteVersion);
    } catch (error) {
      bytes = await loadLocalDictionaryBytes();
      source = "offline copy after failed download";
      if (!bytes) {
        throw new Error(
          `Dictionary is unavailable online and no offline copy is installed yet. Load it once while online first. ${error instanceof Error ? error.message : String(error)}`,
        );
      }
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
  for (const item of [...(remoteItems ?? []), ...(localItems ?? [])]) {
    if (!item?.term) continue;
    const existing = byTerm.get(item.term);
    if (!existing) {
      byTerm.set(item.term, item);
      continue;
    }
    const existingAt = Date.parse(existing.queriedAt ?? 0) || 0;
    const incomingAt = Date.parse(item.queriedAt ?? 0) || 0;
    if (incomingAt >= existingAt) byTerm.set(item.term, item);
  }
  return [...byTerm.values()]
    .sort((left, right) => (right.queriedAt ?? "").localeCompare(left.queriedAt ?? ""))
    .slice(0, 10);
}

function mergeSnapshots(localSnapshot, remoteSnapshot) {
  const localUpdated = Date.parse(localSnapshot?.exportedAt ?? 0) || 0;
  const remoteUpdated = Date.parse(remoteSnapshot?.exportedAt ?? 0) || 0;
  const newer = remoteUpdated > localUpdated ? remoteSnapshot : localSnapshot;
  return {
    app: "wordlover",
    appVersion: localSnapshot.appVersion,
    userDataFormatVersion: localSnapshot.userDataFormatVersion,
    exportedAt: nowIso(),
    profile: localSnapshot.profile ?? remoteSnapshot?.profile ?? null,
    historyItems: mergeHistoryItems(localSnapshot.historyItems, remoteSnapshot?.historyItems),
    vocabularyItems: mergeVocabularySources(
      localSnapshot.vocabularyItems ?? [],
      remoteSnapshot?.vocabularyItems ?? [],
    ),
    studyEvents: mergeStudyEventSources(
      localSnapshot.studyEvents ?? [],
      remoteSnapshot?.studyEvents ?? [],
    ),
    spellingItems: mergeVocabularySources(
      localSnapshot.spellingItems ?? [],
      remoteSnapshot?.spellingItems ?? [],
    ),
    spellingEvents: mergeStudyEventSources(
      localSnapshot.spellingEvents ?? [],
      remoteSnapshot?.spellingEvents ?? [],
    ),
    userDictionary: mergeUserDictionarySources(
      localSnapshot.userDictionary ?? [],
      remoteSnapshot?.userDictionary ?? [],
    ),
    autosaveEnabled: newer.autosaveEnabled ?? localSnapshot.autosaveEnabled ?? true,
    onReturnAction: newer.onReturnAction ?? localSnapshot.onReturnAction ?? (newer.autosaveEnabled === false ? "none" : "vocabulary"),
    speakOnReturn: newer.speakOnReturn ?? localSnapshot.speakOnReturn ?? false,
    theme: newer.theme ?? localSnapshot.theme,
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
    body: "WordLover did not find an exact match. You can save anyway, edit the term, or cancel. Provide at least one meaning before saving.",
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
      body: `"${term}" is already in your vocabulary list. Edit it from the Vocabulary panel instead.`,
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
  const item = getVocabularyItem(term);
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

function speakTerm(term) {
  if (!term || typeof window.speechSynthesis === "undefined") return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(String(term));
    utterance.lang = "en-US";
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  } catch {
    /* speech synthesis not available */
  }
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

function getVocabularyViewItems(filter, active, query = "") {
  const filteredByStatus = filter === "all" ? active : active.filter((item) => getVocabularyRating(item) === filter);
  const filteredByQuery = query ? filteredByStatus.filter((item) => vocabularyItemMatchesQuery(item, query)) : filteredByStatus;
  return [...filteredByQuery].sort((left, right) => {
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
  const maxPage = Math.max(0, Math.ceil(items.length / VOCABULARY_PAGE_SIZE) - 1);
  if (vocabularyView.page > maxPage) vocabularyView.page = maxPage;
  if (vocabularyView.page < 0) vocabularyView.page = 0;
  const start = vocabularyView.page * VOCABULARY_PAGE_SIZE;
  const pageItems = items.slice(start, start + VOCABULARY_PAGE_SIZE);
  const selectedItem = vocabularyView.selectedTerm ? getVocabularyItem(vocabularyView.selectedTerm) : null;
  const rangeStart = items.length ? start + 1 : 0;
  const rangeEnd = Math.min(start + VOCABULARY_PAGE_SIZE, items.length);
  const emptyMessage = query
    ? `No matches for "${escapeHtml(query)}" in this status.`
    : `No words in this status yet.`;

  return `
    <div class="vocab-browser">
      <div class="vocab-browser-head">
        <div>
          <strong>${escapeHtml(getVocabularyViewTitle(filter))}</strong>
          <p class="muted">${rangeStart}-${rangeEnd} of ${items.length}${query ? ` matching "${escapeHtml(query)}"` : ""}</p>
        </div>
        <button class="secondary-button" type="button" data-action="vocab-summary">Stats</button>
      </div>
      <div class="vocab-search-row">
        <input
          id="vocabSearchInput"
          type="search"
          autocomplete="off"
          placeholder="Filter by term, meaning, or pronunciation"
          value="${escapeHtml(query)}"
          aria-label="Filter saved vocabulary"
        />
        ${query ? `<button class="secondary-button" type="button" data-action="vocab-clear-query">Clear</button>` : ""}
      </div>
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
  const cutoff = now + REVIEW_GRACE_WINDOW_MS;
  return vocabularyItems
    .filter((item) => {
      if (item.archivedAt || item.review?.masteredAt) return false;
      return !item.review?.dueAt || Date.parse(item.review.dueAt) <= cutoff;
    })
    .sort((left, right) => {
      const leftDue = Date.parse(left.review?.dueAt ?? "0") || 0;
      const rightDue = Date.parse(right.review?.dueAt ?? "0") || 0;
      return leftDue - rightDue;
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
  const previousRatingByTerm = new Map();
  const sortedReviews = studyEvents
    .filter((event) => event?.type === "review" && event.normalizedTerm && event.rating)
    .slice()
    .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));
  const newWordSavedAt = vocabularyItems.map((item) => Date.parse(item.savedAt)).filter(Number.isFinite);
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
    return { ...bucket, newWords, reviewed, leveledUp, leveledDown };
  });
}

function renderHistoryChartSvg(rows) {
  const series = [
    { key: "newWords", cls: "h-bar-new" },
    { key: "reviewed", cls: "h-bar-reviewed" },
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
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="WordLover history chart" preserveAspectRatio="xMidYMid meet">
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
  const totalActivity = rows.reduce((acc, row) => acc + row.newWords + row.reviewed, 0);
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
      leveledUp: acc.leveledUp + row.leveledUp,
      leveledDown: acc.leveledDown + row.leveledDown,
    }),
    { newWords: 0, reviewed: 0, leveledUp: 0, leveledDown: 0 },
  );
  historyChartSummary.textContent = `${totals.newWords} new, ${totals.reviewed} reviewed, ${totals.leveledUp} level-up, ${totals.leveledDown} level-down.`;
  for (const button of historyGranularityButtons) {
    const selected = button.dataset.historyGranularity === historyView.granularity;
    button.setAttribute("aria-selected", String(selected));
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
  renderHistoryChart();
}

function hideQuiz() {
  activeQuiz = null;
  quizPanel.hidden = true;
  quizPanel.innerHTML = "";
}


function meaningPreviewFromEntry(entry) {
  return topLines(entry.translation, 1)[0] ?? topLines(entry.definition, 1)[0] ?? "No meaning available";
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
  const todayPrefix = nowIso().slice(0, 10);
  return studyEvents.some(
    (event) =>
      event?.type === "review"
      && event.normalizedTerm === normalizedTerm
      && typeof event.occurredAt === "string"
      && event.occurredAt.startsWith(todayPrefix),
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
      <span>${mode === "review" ? "Review" : mode === "practice" ? "Practice" : "First check"}</span>
      <div class="quiz-word-row">
        <strong>${escapeHtml(entry.term)}</strong>
        ${renderIpa(entry.phonetic)}
        ${renderSpeakerButton(entry.term)}
        ${renderAiChatButton(entry.term)}
      </div>
      ${optionsRevealed ? renderQuizEnglishMeaning(entry) : ""}
      <p class="muted">${optionsRevealed ? "Choose the closest meaning." : "Try to recall the meaning. Tap when ready."}</p>
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
  quizPanel.innerHTML = `
    ${renderQuizQuestionMarkup(activeQuiz.entry, activeQuiz.mode, true)}
    ${renderQuizOptionsMarkup(activeQuiz.options)}
  `;
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
          englishMeanings: topLines(row.definition),
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
  if (!activeQuiz.optionsRevealed) revealQuizOptions();
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
  const wasPracticeMode = activeQuiz.mode === "practice";
  await recordReviewRating(sourceItem, rating, quizResult, responseMs);
  quizPanel.hidden = false;
  quizPanel.innerHTML = `<p class="muted">Recorded as ${escapeHtml(FSRS_RATING_LABELS[rating])}. Loading next word...</p>`;
  activeQuiz = null;
  window.setTimeout(() => {
    const [nextDue] = getDueVocabularyItems();
    if (nextDue || wasPracticeMode) {
      void startDueReview();
      return;
    }
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
  markDebugRecord(item);
  historyItems = [item, ...historyItems.filter((entry) => entry.term !== item.term)].slice(0, 10);
  await saveValue("history", historyItems);
  renderHistory();
  if (item?.term) prefetchAiChat(item.term);
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
      await addHistory({ term: data.term, searchedAt: nowIso(), queryMs: data.queryMs ?? 0 });
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
  const data = await runLookup({ commit: true });
  if (speakOnReturn) speakTerm(data?.status === "found" ? data.term : value);
  if (onReturnAction === "vocabulary") {
    if (data?.status === "found") await saveVocabularyItem(data, "return");
  } else if (onReturnAction === "spelling") {
    if (data?.status === "found") {
      await saveSpellingItem(data, "return");
    } else {
      // Non-dictionary word can't go to the spelling list (dictionary words only): flag it red.
      flagSearchInputInvalid();
    }
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

async function runAutoSync(reason) {
  if (!googleAuth.accessToken) return;
  if (!navigator.onLine) return;
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
    autosaveEnabled: onReturnAction === "vocabulary",
    onReturnAction,
    speakOnReturn,
    theme,
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
  if (checkpoints.some((checkpoint) => checkpoint.reason === "daily" && checkpoint.createdAt?.startsWith(todayPrefix()))) return null;
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
    title: "Delete all local WordLover data?",
    body: "This removes your vocabulary, study progress, history, checkpoints, encrypted keys, and the installed dictionary from this device. Cloud backups are not touched. Type DELETE to confirm.",
    fields: [{ id: "confirm", label: "Type DELETE to confirm", value: "", required: true }],
    submitText: "Delete everything",
    cancelText: "Cancel",
    danger: true,
  });
  if (!confirmation || confirmation.confirm.trim().toUpperCase() !== "DELETE") return false;

  checkpointStatus.textContent = "Deleting local WordLover data...";
  dictionaryDb?.close();
  dictionaryDb = null;
  loaded = false;
  vocabularyItems = [];
  studyEvents = [];
  historyItems = [];

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
  kvValues,
}) {
  const encrypt = (records, keyOf) => Promise.all(records.map(async (record) => ({ key: keyOf(record), value: await encryptValue(record) })));
  const encryptedVocabulary = await encrypt(nextVocabularyItems, (item) => item.normalizedTerm);
  const encryptedEvents = await encrypt(nextStudyEvents, (event) => event.id);
  const encryptedSpelling = await encrypt(nextSpellingItems, (item) => item.normalizedTerm);
  const encryptedSpellingEvents = await encrypt(nextSpellingEvents, (event) => event.id);
  const encryptedUserDictionary = await encrypt(nextUserDictionary, (entry) => entry.normalizedTerm);
  const encryptedKv = await Promise.all(
    Object.entries(kvValues).map(async ([key, value]) => ({
      key,
      value: await encryptValue(value),
    })),
  );
  const db = await getUserDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(
      [VOCABULARY_STORE, STUDY_EVENT_STORE, SPELLING_STORE, SPELLING_EVENT_STORE, USER_DICTIONARY_STORE, STORE],
      "readwrite",
    );
    const vocabularyStore = tx.objectStore(VOCABULARY_STORE);
    const eventStore = tx.objectStore(STUDY_EVENT_STORE);
    const spellingStore = tx.objectStore(SPELLING_STORE);
    const spellingEventStore = tx.objectStore(SPELLING_EVENT_STORE);
    const userDictStore = tx.objectStore(USER_DICTIONARY_STORE);
    const kvStore = tx.objectStore(STORE);
    vocabularyStore.clear();
    eventStore.clear();
    spellingStore.clear();
    spellingEventStore.clear();
    userDictStore.clear();
    encryptedVocabulary.forEach((record) => vocabularyStore.put(record.value, record.key));
    encryptedEvents.forEach((record) => eventStore.put(record.value, record.key));
    encryptedSpelling.forEach((record) => spellingStore.put(record.value, record.key));
    encryptedSpellingEvents.forEach((record) => spellingEventStore.put(record.value, record.key));
    encryptedUserDictionary.forEach((record) => userDictStore.put(record.value, record.key));
    encryptedKv.forEach((record) => kvStore.put(record.value, record.key));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("User data replace transaction aborted."));
  });
}

function driveNameQuery(fileName) {
  return encodeURIComponent(`name = '${String(fileName).replace(/'/g, "\\'")}' and trashed = false`);
}

async function recordSyncSummary(driveResult) {
  lastSyncSummary = {
    at: nowIso(),
    words: vocabularyItems.length,
    sizeBytes: Number(driveResult?.size ?? 0) || 0,
    driveModifiedTime: driveResult?.modifiedTime ?? null,
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
    `${GOOGLE_DRIVE_FILES_URL}?spaces=appDataFolder&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc&q=${driveNameQuery(fileName)}`,
  );
  if (!response.ok) throw new Error(explainDriveError(response.status, await response.text()));
  const data = await response.json();
  return data.files ?? [];
}

async function syncToGoogleDrive() {
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
    const merged = mergeSnapshots(buildUserDataSnapshot(), remoteSnapshot);
    await applyUserDataSnapshot(merged, { createPreRestoreCheckpoint: false });
    snapshotToUpload = buildUserDataSnapshot();
    lastSyncInfo.mergedCount = vocabularyItems.length;
  } else {
    snapshotToUpload = buildUserDataSnapshot();
    lastSyncInfo.mergedCount = vocabularyItems.length;
  }

  googleAuthStatus.textContent = "Encrypting and uploading merged snapshot...";
  lastSyncInfo.stage = "upload";
  const encryptedSnapshot = await encryptSnapshotPayload(snapshotToUpload);
  if (existing?.id) {
    const response = await googleFetch(`${GOOGLE_DRIVE_UPLOAD_URL}/${existing.id}?uploadType=media&fields=id,name,modifiedTime,size`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(encryptedSnapshot),
    });
    if (!response.ok) throw new Error(`Google Drive sync failed: ${response.status} ${await response.text()}`);
    const resultData = await response.json();
    await recordSyncSummary(resultData);
    googleAuthStatus.textContent = `Synced. Found ${lastSyncInfo.filesFound} Drive backup(s); it had ${lastSyncInfo.remoteCount} word(s). After merge you have ${lastSyncInfo.mergedCount} word(s).`;
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
  const response = await googleFetch(`${GOOGLE_DRIVE_UPLOAD_URL}?uploadType=multipart&fields=id,name,modifiedTime,size`, {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  if (!response.ok) throw new Error(`Google Drive sync failed: ${response.status} ${await response.text()}`);
  const resultData = await response.json();
  await recordSyncSummary(resultData);
  googleAuthStatus.textContent = lastSyncInfo.localCountBefore === 0
    ? `No existing Drive backup found in this account, and this device has 0 words — nothing to sync yet. Add words (or Sync on the device that has them) first. If the other device IS signed into the same Google account here, check both devices use the SAME OAuth client ID.`
    : `No existing Drive backup found — uploaded your ${lastSyncInfo.localCountBefore} local word(s) as the first backup.`;
  driveSyncState = "synced";
  syncStatus.textContent = "Synced";
  return resultData;
}

async function applyUserDataSnapshot(snapshot, options = {}) {
  const { createPreRestoreCheckpoint = true } = options;
  validateUserDataSnapshot(snapshot);
  if (createPreRestoreCheckpoint) await createCheckpoint("pre-restore");
  const nextHistoryItems = Array.isArray(snapshot.historyItems) ? snapshot.historyItems : [];
  const nextVocabularyItems = mergeVocabularySources(Array.isArray(snapshot.vocabularyItems) ? snapshot.vocabularyItems : [], []);
  const nextStudyEvents = mergeStudyEventSources(Array.isArray(snapshot.studyEvents) ? snapshot.studyEvents : [], []);
  const nextSpellingItems = mergeVocabularySources(Array.isArray(snapshot.spellingItems) ? snapshot.spellingItems : [], []);
  const nextSpellingEvents = mergeStudyEventSources(Array.isArray(snapshot.spellingEvents) ? snapshot.spellingEvents : [], []);
  const nextUserDictionary = mergeUserDictionarySources(Array.isArray(snapshot.userDictionary) ? snapshot.userDictionary : [], []);
  const nextOnReturnAction = normalizeOnReturnAction(snapshot.onReturnAction ?? (snapshot.autosaveEnabled === false ? "none" : "vocabulary"));
  const nextSpeakOnReturn = Boolean(snapshot.speakOnReturn ?? false);
  const nextTheme = THEME_IDS.includes(snapshot.theme) ? snapshot.theme : DEFAULT_THEME;
  const nextLastMetrics = snapshot.lastMetrics ?? lastMetrics;

  await replaceUserDataAtomically({
    nextVocabularyItems,
    nextStudyEvents,
    nextSpellingItems,
    nextSpellingEvents,
    nextUserDictionary,
    kvValues: {
      history: nextHistoryItems,
      onReturnAction: nextOnReturnAction,
      speakOnReturn: nextSpeakOnReturn,
      theme: nextTheme,
      lastMetrics: nextLastMetrics,
    },
  });

  historyItems = nextHistoryItems;
  vocabularyItems = nextVocabularyItems;
  studyEvents = nextStudyEvents;
  spellingItems = nextSpellingItems;
  spellingEvents = nextSpellingEvents;
  userDictionaryEntries = nextUserDictionary;
  onReturnAction = nextOnReturnAction;
  speakOnReturn = nextSpeakOnReturn;
  theme = nextTheme;
  lastMetrics = nextLastMetrics;

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
  return ["vocabulary", "spelling", "none"].includes(value) ? value : "vocabulary";
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
  await applyUserDataSnapshot(snapshot);
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
  if (aiChatPrefetchInFlight.size >= 2) return;
  aiChatPrefetchInFlight.add(key);
  void requestAiChatPayload(clean)
    .then((payload) => {
      aiChatCacheSet(clean, payload);
      if (!aiChatPanel.hidden && aiChatState.term && aiChatState.term.toLowerCase() === key && !aiChatState.payload) {
        aiChatState.payload = payload;
        aiChatState.loading = false;
        renderAiChatPanel();
      }
    })
    .catch(() => {})
    .finally(() => aiChatPrefetchInFlight.delete(key));
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

async function showLoginGateIfNeeded() {
  const acknowledged = await loadValue("loginGateAcknowledged", false);
  if (acknowledged) return;
  if (googleAuth.profile?.email) {
    await saveValue("loginGateAcknowledged", true);
    return;
  }
  const body = "Sign in with your Google account so WordLover can sync your vocabulary to Drive and unlock Gemini AI example sentences. You can skip and use the app locally only.";
  const choice = await showModal({
    title: "Welcome to WordLover",
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
      void ensureGoogleToken(false, { interactive: false })
        .then(() => { renderAppMenu(); void runAutoSync("startup"); })
        .catch(() => {});
    }
  } else {
    googleAuth.profile = await loadValue("googleProfile", null);
    if (googleAuth.profile) googleGrantGranted = true;
  }
  // Preload Google Identity now so the sign-in popup can open synchronously on tap (iOS).
  preloadGoogleIdentity();
  renderDebugState();
  renderAppMenu();
  historyItems = await loadValue("history", []);
  const vocabularyRecords = await loadAllRecordValues(VOCABULARY_STORE);
  const legacyVocabularyItems = await loadValue("vocabularyItems", []);
  vocabularyItems = mergeVocabularySources(vocabularyRecords, legacyVocabularyItems);
  if (vocabularyItems.length > vocabularyRecords.length || legacyVocabularyItems.length) await persistVocabulary();
  const studyEventRecords = await loadAllRecordValues(STUDY_EVENT_STORE);
  const legacyStudyEvents = await loadValue("studyEvents", []);
  studyEvents = mergeStudyEventSources(studyEventRecords, legacyStudyEvents);
  if (studyEvents.length > studyEventRecords.length || legacyStudyEvents.length) await persistStudyEvents();
  spellingItems = mergeVocabularySources(await loadAllRecordValues(SPELLING_STORE), []);
  spellingEvents = mergeStudyEventSources(await loadAllRecordValues(SPELLING_EVENT_STORE), []);
  userDictionaryEntries = mergeUserDictionarySources(await loadAllRecordValues(USER_DICTIONARY_STORE), []);
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
  autosaveEnabled = onReturnAction === "vocabulary";
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
  const isAutomatedContext = ["q", "autorun", "suite-main-smoke", "suite-study-smoke", "suite-upgrade-merge", "suite-checkpoint-rollback"]
    .some((key) => params.has(key));
  if (!isAutomatedContext) {
    void showLoginGateIfNeeded();
  }
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
  debounceHandle = window.setTimeout(() => void runLookup({ commit: false }), 150);
});

termInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    window.clearTimeout(debounceHandle);
    hideRecentSearchPopover();
    renderSuggestions([]);
    void handleReturnKey();
  }
});

termInput.addEventListener("input", () => {
  termInput.classList.remove("input-invalid");
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
  if (event.target instanceof HTMLButtonElement && event.target.id === "saveCurrentTerm") {
    void saveVocabularyItem(currentResult, "manual");
    return;
  }
  if (event.target instanceof HTMLButtonElement && event.target.id === "addToSpelling" && currentResult) {
    void saveSpellingItem(currentResult, "manual");
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
        result.innerHTML = `<p class="muted">Saved <strong>${escapeHtml(saved.term)}</strong> with your meaning. Open it from the Vocabulary panel to review or edit.</p>`;
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
      filter: button.dataset.filter ?? "all",
      page: 0,
      selectedTerm: null,
      query: vocabularyView.query ?? "",
    };
    renderVocabulary();
    return;
  }
  if (action === "vocab-summary") {
    vocabularyView = { filter: "summary", page: 0, selectedTerm: null, query: "" };
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
  if (action === "open") {
    termInput.value = term;
    renderSuggestions([]);
    void runLookup({ commit: true });
  }
  if (action === "edit") void editVocabularyItem(term);
  if (action === "archive") {
    vocabularyView.selectedTerm = null;
    void setVocabularyArchived(term, true);
  }
  if (action === "restore") void setVocabularyArchived(term, false);
});

vocabularyList.addEventListener("input", (event) => {
  if (!(event.target instanceof HTMLInputElement) || event.target.id !== "vocabSearchInput") return;
  vocabularyView.query = event.target.value;
  vocabularyView.page = 0;
  vocabularyView.selectedTerm = null;
  renderVocabulary();
  preserveVocabSearchFocus();
});

clearSearchButton.addEventListener("click", () => {
  termInput.value = "";
  renderSuggestions([]);
  currentResult = null;
  scheduleAutosave(null);
  result.innerHTML = `<p class="muted">Type a term to search.</p>`;
  aiDetailPanel.hidden = true;
  aiDetailPanel.innerHTML = "";
  pendingAiDetail = null;
  termInput.focus();
  renderRecentSearchPopover();
});

onReturnSelect?.addEventListener("change", async () => {
  onReturnAction = normalizeOnReturnAction(onReturnSelect.value);
  autosaveEnabled = onReturnAction === "vocabulary";
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

quizPanel.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;
  if (target.closest("[data-quiz-reveal]")) {
    revealQuizOptions();
    return;
  }
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
    googleAuthStatus.textContent = "Saved Google client ID. Tap Sign in with Google to authenticate.";
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
  void runAutoSync("online");
});
window.addEventListener("offline", renderAppMenu);
window.addEventListener("focus", () => {
  refreshReviewScheduleViews();
  void runAutoSync("focus");
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    refreshReviewScheduleViews();
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
  startDueReview,
  startNewWordStudy,
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
    autosaveEnabled = onReturnAction === "vocabulary";
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
  runAutomatedSearchSmoke,
  applyTheme: (next) => {
    applyTheme(next);
    themeSelect.value = theme;
    void saveValue("theme", theme);
    return theme;
  },
  getThemeIds: () => THEME_IDS.slice(),
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
