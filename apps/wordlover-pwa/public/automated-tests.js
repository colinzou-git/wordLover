import {
  State,
  ratingToFsrs,
  reviveFsrsCard,
  scheduleFromFsrsRating,
} from "./fsrs-scheduler.js?v=20260615-2";

import { bytesToBase64, base64ToBytes, checksumText, isEncryptedRecord } from "./persistence.js?v=20260615-2";
import { ratingFromRetries, spellingThreshold } from "./spelling.js?v=20260615-2";
import {
  normalizeTrack,
  normalizeHistoryGranularity,
  normalizeGoalsPeriod,
  normalizeStudyOneMoreLevel,
  normalizeFontScale,
  normalizeUiPreferences,
  STUDY_ONE_MORE_LEVELS,
  DEFAULT_FONT_SCALE,
} from "./ui-preferences.js?v=20260615-2";
import {
  studyEventTrack,
  computeStudyEventKey,
  mergeStudyEventSources,
  mergeHistoryItems,
  mergeKnownSources,
  activeStudyTermsFromItems,
  mergeVocabularySources,
  mergeUserDictionarySources,
  mergeLearningTracksBackups,
} from "./sync.js?v=20260615-2";
import {
  fallbackStudyOneMoreLevel,
  buildStudyOneMoreExclusionSets,
  studyOneMoreLevelSql,
} from "./study-one-more.js?v=20260615-2";
import {
  forecastGoalWorkload,
  predictRating,
  normalizeForecastInput,
} from "./goal-forecast.js?v=20260615-2";
import {
  BACKUP_SCHEMA_VERSION,
  migrateLegacyToRoot,
  buildBackup,
  serializeTrack,
  trackRecords,
  validateBackup,
  dedupeTrackName,
  planImport,
  canDeleteTrack,
} from "./tracks.js?v=20260615-2";

const runButton = document.querySelector("#runSuite");
const downloadButton = document.querySelector("#downloadResults");
const sendButton = document.querySelector("#sendResults");
const statusPill = document.querySelector("#suiteStatus");
const progressList = document.querySelector("#progressList");
const summary = document.querySelector("#summary");
const rawResults = document.querySelector("#rawResults");

const AUTOMATION_DB = "wordlover-product-tests";
const KV_STORE = "kv";
const FILE_STORE = "files";
const DICTIONARY_KEY = "dictionary.sqlite";
const SHELL_CACHE_NAME = "wordlover-shell-v131";
const APP_DB = "wordlover-user";
const APP_DB_VERSION = 7;
const APP_KV_STORE = "kv";
const APP_VOCABULARY_STORE = "vocabularyRecords";
const APP_STUDY_EVENT_STORE = "studyEventRecords";
const APP_KNOWN_STORE = "knownRecords";
const APP_FILE_STORE = "files";
const APP_KEY_STORE = "keys";
const APP_SPELLING_STORE = "spellingRecords";
const APP_SPELLING_EVENT_STORE = "spellingEventRecords";
const APP_USER_DICTIONARY_STORE = "userDictionary";
const APP_CHECKPOINT_STORE = "checkpoints";
const TERM_RE = /^[a-z]+(?:[ '-][a-z]+){0,5}$/;
const BENCHMARK_TERMS = ["abandon", "take off", "in terms of", "abundant", "accurate"];
const SHELL_ASSETS = [
  "/",
  "/app.js?v=20260615-2",
  "/full-dictionary.js?v=20260615-2",
  "/persistence.js?v=20260615-2",
  "/spelling.js?v=20260615-2",
  "/ui-preferences.js?v=20260615-2",
  "/review-state.js?v=20260615-2",
  "/study-one-more.js?v=20260615-2",
  "/sync.js?v=20260615-2",
  "/fsrs-scheduler.js?v=20260615-2",
  "/goal-forecast.js?v=20260615-2",
  "/tracks.js?v=20260615-2",
  "/styles.css?v=20260615-2",
  "/wordlover-config.js?v=20260615-2",
  "/manifest.webmanifest",
  "/icon.svg",
  "/vendor/sql-wasm.js",
  "/vendor/sql-wasm.wasm",
  "/vendor/ts-fsrs/index.mjs",
  "/wa-sqlite-opfs-worker.js",
  "/vendor/wa-sqlite/LICENSE",
  "/vendor/wa-sqlite/dist/wa-sqlite-async.mjs",
  "/vendor/wa-sqlite/dist/wa-sqlite-async.wasm",
  "/vendor/wa-sqlite/src/sqlite-api.js",
  "/vendor/wa-sqlite/src/sqlite-constants.js",
  "/vendor/wa-sqlite/src/VFS.js",
  "/vendor/wa-sqlite/src/examples/OriginPrivateFileSystemVFS.js",
  "/vendor/wa-sqlite/src/examples/WebLocks.js",
  "/automated-tests.html",
  "/automated-tests.js?v=20260615-2",
];

let lastResults = null;
let SQL = null;

function addProgress(text) {
  const item = document.createElement("li");
  item.textContent = text;
  progressList.appendChild(item);
}

function setStatus(text) {
  statusPill.textContent = text;
}

function isAutorun() {
  const params = new URLSearchParams(window.location.search);
  return params.get("autorun") === "1";
}

function canSendResults() {
  return window.location.protocol === "https:";
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function unlockMainAppFrame(frame) {
  const passphraseInput = frame.contentDocument?.querySelector("#passphrase");
  if (passphraseInput) passphraseInput.value = "wordlover-localhost-development-passphrase";
  const submit = frame.contentDocument?.querySelector("[data-modal-submit]");
  if (!submit) return false;
  submit.click();
  return true;
}

function openAutomationDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(AUTOMATION_DB, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(KV_STORE)) db.createObjectStore(KV_STORE);
      if (!db.objectStoreNames.contains(FILE_STORE)) db.createObjectStore(FILE_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveStoreValue(storeName, key, value) {
  const db = await openAutomationDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function loadStoreValue(storeName, key, fallback = null) {
  const db = await openAutomationDb();
  const tx = db.transaction(storeName, "readonly");
  const value = await requestToPromise(tx.objectStore(storeName).get(key));
  db.close();
  return value ?? fallback;
}

function openAppDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(APP_DB, APP_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(APP_KV_STORE)) db.createObjectStore(APP_KV_STORE);
      if (!db.objectStoreNames.contains(APP_FILE_STORE)) db.createObjectStore(APP_FILE_STORE);
      if (!db.objectStoreNames.contains(APP_KEY_STORE)) db.createObjectStore(APP_KEY_STORE);
      if (!db.objectStoreNames.contains(APP_VOCABULARY_STORE)) db.createObjectStore(APP_VOCABULARY_STORE);
      if (!db.objectStoreNames.contains(APP_STUDY_EVENT_STORE)) db.createObjectStore(APP_STUDY_EVENT_STORE);
      if (!db.objectStoreNames.contains(APP_SPELLING_STORE)) db.createObjectStore(APP_SPELLING_STORE);
      if (!db.objectStoreNames.contains(APP_SPELLING_EVENT_STORE)) db.createObjectStore(APP_SPELLING_EVENT_STORE);
      if (!db.objectStoreNames.contains(APP_USER_DICTIONARY_STORE)) db.createObjectStore(APP_USER_DICTIONARY_STORE);
      if (!db.objectStoreNames.contains(APP_KNOWN_STORE)) db.createObjectStore(APP_KNOWN_STORE);
      if (!db.objectStoreNames.contains(APP_CHECKPOINT_STORE)) db.createObjectStore(APP_CHECKPOINT_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function runAppDbSchemaTest() {
  const REQUIRED_STORES = [
    APP_KV_STORE, APP_FILE_STORE, APP_KEY_STORE,
    APP_VOCABULARY_STORE, APP_STUDY_EVENT_STORE,
    APP_SPELLING_STORE, APP_SPELLING_EVENT_STORE,
    APP_USER_DICTIONARY_STORE, APP_KNOWN_STORE, APP_CHECKPOINT_STORE,
  ];
  try {
    const db = await openAppDb();
    const missing = REQUIRED_STORES.filter((name) => !db.objectStoreNames.contains(name));
    db.close();
    return { passed: missing.length === 0, missing, checked: REQUIRED_STORES };
  } catch (error) {
    return { passed: false, error: String(error), missing: REQUIRED_STORES, checked: REQUIRED_STORES };
  }
}

async function putAppStoreValue(storeName, key, value) {
  const db = await openAppDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function getAppStoreValue(storeName, key, fallback = null) {
  const db = await openAppDb();
  const tx = db.transaction(storeName, "readonly");
  const value = await requestToPromise(tx.objectStore(storeName).get(key));
  db.close();
  return value ?? fallback;
}

async function deleteAppStoreValue(storeName, key) {
  const db = await openAppDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

// Keep in lockstep with app.js normalizeTerm / APOSTROPHE_VARIANTS_RE. Folds every
// apostrophe-like glyph (\u2018 \u2019 \u02bc ` \uff07) to ASCII "'" so contractions compare identically.
const APOSTROPHE_VARIANTS_RE = /[\u2018\u2019\u02bc`\uff07]/g;

function normalizeTerm(term) {
  return String(term ?? "").replace(APOSTROPHE_VARIANTS_RE, "'").trim().replace(/\s+/g, " ").toLowerCase();
}

function sampleChecksum(bytes) {
  let value = bytes.length;
  const sampleSize = Math.min(4096, bytes.length);
  for (let i = 0; i < sampleSize; i += 1) {
    value = (value + bytes[i] * (i + 1)) >>> 0;
  }
  for (let i = Math.max(0, bytes.length - sampleSize); i < bytes.length; i += 1) {
    value = (value + bytes[i] * ((bytes.length - i) + 1)) >>> 0;
  }
  return value.toString(16).padStart(8, "0");
}

async function initSql() {
  SQL ??= await initSqlJs({ locateFile: (file) => `/vendor/${file}` });
  return SQL;
}

async function openDictionary(bytes) {
  const start = performance.now();
  const sql = await initSql();
  const initialized = performance.now();
  const db = new sql.Database(bytes);
  const opened = performance.now();
  const count = db.exec("SELECT count(*) AS count FROM dictionary_entries")[0].values[0][0];
  return {
    db,
    metrics: {
      initMs: initialized - start,
      openMs: opened - initialized,
      rows: count,
    },
  };
}

function lookupTerm(db, input) {
  const normalized = normalizeTerm(input);
  if (!TERM_RE.test(normalized)) return { status: "invalid_input", term: input, queryMs: 0 };
  const start = performance.now();
  const statement = db.prepare(`
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
    if (!statement.step()) return { status: "not_found", term: input, queryMs: performance.now() - start };
    const row = statement.getAsObject();
    return {
      status: "found",
      term: row.word ?? input,
      entryType: row.word?.includes(" ") ? "phrase" : "word",
      queryMs: performance.now() - start,
      hasEnglish: Boolean(row.definition),
      hasChinese: Boolean(row.translation),
      source: row.definition_source ?? "unknown",
    };
  } finally {
    statement.free();
  }
}

function percentile(values, percentileRank) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((percentileRank / 100) * sorted.length) - 1);
  return sorted[index] ?? 0;
}

function summarizeTiming(values) {
  return {
    count: values.length,
    minMs: Math.min(...values),
    medianMs: percentile(values, 50),
    p95Ms: percentile(values, 95),
    maxMs: Math.max(...values),
  };
}

function inferFsrsRatingForTest(passed, responseMs) {
  if (!passed) return "again";
  if (responseMs <= 5000) return "easy";
  if (responseMs <= 15000) return "good";
  return "hard";
}

function runReviewQuizRatingTests() {
  const baseNow = "2026-06-02T12:00:00.000Z";
  const nowMs = Date.parse(baseNow);
  const minutesUntilDue = (schedule) => (Date.parse(schedule.dueAt) - nowMs) / 60_000;
  const daysUntilDue = (schedule) => (Date.parse(schedule.dueAt) - nowMs) / (24 * 60 * 60 * 1000);
  const ratings = [
    { name: "wrong answer maps to Again", actual: inferFsrsRatingForTest(false, 700), expected: "again" },
    { name: "fast correct answer maps to Easy", actual: inferFsrsRatingForTest(true, 2500), expected: "easy" },
    { name: "medium correct answer maps to Good", actual: inferFsrsRatingForTest(true, 9000), expected: "good" },
    { name: "slow correct answer maps to Hard", actual: inferFsrsRatingForTest(true, 20000), expected: "hard" },
  ];
  const again = scheduleFromFsrsRating({}, "again", baseNow);
  const hard = scheduleFromFsrsRating({}, "hard", baseNow);
  const good = scheduleFromFsrsRating({}, "good", baseNow);
  const easy = scheduleFromFsrsRating({}, "easy", baseNow);
  let repeatedAgain = scheduleFromFsrsRating({}, "again", baseNow);
  for (let i = 0; i < 5; i += 1) {
    repeatedAgain = scheduleFromFsrsRating({
      fsrsCard: repeatedAgain.fsrsCard,
      dueAt: repeatedAgain.dueAt,
      reviewCount: i + 1,
      lastRating: "again",
    }, "again", new Date(Date.parse(repeatedAgain.dueAt) + 1000).toISOString());
  }
  const migratedMastered = scheduleFromFsrsRating({
    masteredAt: "2026-01-01T00:00:00.000Z",
    dueAt: "2026-06-02T12:00:00.000Z",
    fsrsCard: {
      due: "2026-06-02T12:00:00.000Z",
      stability: 120,
      difficulty: 3,
      elapsedDays: 90,
      scheduledDays: 90,
      reps: 3,
      lapses: 0,
      state: "mastered",
      lastReview: "2026-03-01T12:00:00.000Z",
    },
  }, "good", baseNow);
  const revivedOldCard = reviveFsrsCard({
    due: "2026-06-02T12:00:00.000Z",
    elapsedDays: 2,
    scheduledDays: 5,
    lastReview: "2026-06-01T12:00:00.000Z",
    state: "review",
  }, baseNow);
  let invalidRatingRejected = false;
  try {
    ratingToFsrs("easyy");
  } catch {
    invalidRatingRejected = true;
  }
  const scheduleChecks = [
    { name: "Again schedules soon but not immediately", pass: minutesUntilDue(again) > 0 && minutesUntilDue(again) <= 2 },
    { name: "Hard <= Good <= Easy interval ordering", pass: daysUntilDue(hard) <= daysUntilDue(good) && daysUntilDue(good) <= daysUntilDue(easy) },
    { name: "Mastered cards still have future dueAt", pass: Boolean(migratedMastered.masteredAt) && Date.parse(migratedMastered.dueAt) > nowMs },
    { name: "repeated Again creates valid dates", pass: Number.isFinite(Date.parse(repeatedAgain.dueAt)) && Date.parse(repeatedAgain.dueAt) > nowMs },
    { name: "old camelCase FSRS card migrates to Date fields", pass: revivedOldCard.due instanceof Date && revivedOldCard.last_review instanceof Date && revivedOldCard.state === State.Review },
    { name: "invalid FSRS rating is rejected", pass: invalidRatingRejected },
  ];
  const ratingPass = ratings.every((item) => item.actual === item.expected);
  const schedulePass = scheduleChecks.every((item) => item.pass);
  return {
    passed: ratingPass && schedulePass,
    ratings,
    scheduleChecks,
  };
}

async function fetchDictionary() {
  const start = performance.now();
  const dictionaryUrl = new URL("/dictionary.sqlite", window.location.href).toString();
  let response;
  try {
    response = await fetch(dictionaryUrl, { cache: "no-store" });
  } catch (error) {
    throw new Error(
      `Dictionary fetch failed before an HTTP response from ${dictionaryUrl}. Start the WordLover static server from apps/wordlover-pwa/public, reload this page, and run the suite again. Original error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!response.ok) throw new Error(`Dictionary fetch failed: ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  return {
    bytes,
    metrics: {
      fetchMs: performance.now() - start,
      bytes: bytes.byteLength,
      sampleChecksum: sampleChecksum(bytes),
    },
  };
}

async function saveDictionaryToIndexedDb(bytes) {
  const start = performance.now();
  await saveStoreValue(FILE_STORE, DICTIONARY_KEY, bytes);
  return performance.now() - start;
}

async function loadDictionaryFromIndexedDb() {
  const start = performance.now();
  const bytes = await loadStoreValue(FILE_STORE, DICTIONARY_KEY);
  if (!bytes) throw new Error("Dictionary was not found in IndexedDB.");
  return {
    bytes: bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes),
    loadMs: performance.now() - start,
  };
}

async function saveDictionaryToOpfs(bytes) {
  if (!navigator.storage?.getDirectory) {
    return { supported: false, saveMs: null, loadMs: null, bytes: null, sampleChecksum: null };
  }
  const root = await navigator.storage.getDirectory();
  const startSave = performance.now();
  const handle = await root.getFileHandle(DICTIONARY_KEY, { create: true });
  const writable = await handle.createWritable();
  await writable.write(bytes);
  await writable.close();
  const saveMs = performance.now() - startSave;

  const startLoad = performance.now();
  const file = await handle.getFile();
  const restored = new Uint8Array(await file.arrayBuffer());
  const loadMs = performance.now() - startLoad;
  return {
    supported: true,
    saveMs,
    loadMs,
    bytes: restored.byteLength,
    sampleChecksum: sampleChecksum(restored),
  };
}

function callWaSqliteWorker(worker, message, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID ? crypto.randomUUID() : `wa-${Date.now()}-${Math.random()}`;
    const timer = window.setTimeout(() => {
      worker.removeEventListener("message", onMessage);
      reject(new Error(`wa-sqlite worker timed out for ${message.type}`));
    }, timeoutMs);
    function onMessage(event) {
      if (event.data?.id !== id) return;
      window.clearTimeout(timer);
      worker.removeEventListener("message", onMessage);
      if (event.data.ok) resolve(event.data.result);
      else reject(new Error(event.data.error ?? "wa-sqlite worker failed"));
    }
    worker.addEventListener("message", onMessage);
    worker.postMessage({ ...message, id });
  });
}

async function runWaSqliteOpfsSmoke() {
  if (!navigator.storage?.getDirectory || typeof Worker === "undefined") {
    return { supported: false, passed: false, reason: "OPFS worker support is unavailable." };
  }
  const worker = new Worker("/wa-sqlite-opfs-worker.js", { type: "module" });
  try {
    const openStartedAt = performance.now();
    await callWaSqliteWorker(worker, { type: "open" }, 10000);
    const openMs = performance.now() - openStartedAt;
    const lookup = await callWaSqliteWorker(worker, { type: "lookup", term: "abandon" }, 10000);
    return {
      supported: true,
      passed: lookup.status === "found",
      openMs,
      lookup,
      note: "wa-sqlite opened the OPFS dictionary from a worker without copying the full SQLite file into the main JS heap.",
    };
  } catch (error) {
    return {
      supported: true,
      passed: false,
      error: error instanceof Error ? error.message : String(error),
      note: "wa-sqlite OPFS worker is bundled but did not pass smoke validation yet; sql.js remains the active fallback.",
    };
  } finally {
    worker.terminate();
  }
}

async function benchmarkDictionary(db) {
  const lookups = [];
  for (let round = 0; round < 20; round += 1) {
    for (const term of BENCHMARK_TERMS) {
      lookups.push(lookupTerm(db, term));
    }
  }
  const timings = lookups.map((item) => item.queryMs);
  return {
    terms: BENCHMARK_TERMS,
    allFound: lookups.every((item) => item.status === "found"),
    timing: summarizeTiming(timings),
    samples: BENCHMARK_TERMS.map((term) => lookupTerm(db, term)),
  };
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return { available: false, ready: false };
  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  return {
    available: true,
    ready: Boolean(registration.active || registration.waiting || registration.installing),
    scope: registration.scope,
    controller: Boolean(navigator.serviceWorker.controller),
  };
}

async function checkOfflineShellCache() {
  if (!("caches" in window)) return { supported: false, allShellAssetsCached: false, missing: SHELL_ASSETS };
  const keys = await caches.keys();
  let missing = [];
  for (const asset of SHELL_ASSETS) {
    const match = await caches.match(asset);
    if (!match) missing.push(asset);
  }
  if (missing.length && navigator.onLine) {
    const cache = await caches.open(SHELL_CACHE_NAME);
    await Promise.allSettled(missing.map((asset) => cache.add(asset)));
    missing = [];
    for (const asset of SHELL_ASSETS) {
      const match = await caches.match(asset);
      if (!match) missing.push(asset);
    }
  }
  return {
    supported: true,
    cacheNames: await caches.keys(),
    allShellAssetsCached: missing.length === 0,
    missing,
    note: "This verifies shell cache readiness. A true network-off launch still requires device/browser offline mode.",
  };
}

function utf8Bytes(text) {
  return new TextEncoder().encode(text);
}

function utf8Text(bytes) {
  return new TextDecoder().decode(bytes);
}

function concatBytes(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function writeAscii(target, offset, length, value) {
  const text = String(value);
  for (let i = 0; i < Math.min(length, text.length); i += 1) {
    target[offset + i] = text.charCodeAt(i) & 0x7f;
  }
}

function tarChecksum(header) {
  let sum = 0;
  for (let i = 0; i < header.length; i += 1) {
    sum += i >= 148 && i < 156 ? 32 : header[i];
  }
  return sum;
}

function createTar(files) {
  const chunks = [];
  for (const file of files) {
    const data = file.data instanceof Uint8Array ? file.data : utf8Bytes(file.data);
    const header = new Uint8Array(512);
    writeAscii(header, 0, 100, file.name);
    writeAscii(header, 100, 8, "0000644");
    writeAscii(header, 108, 8, "0000000");
    writeAscii(header, 116, 8, "0000000");
    writeAscii(header, 124, 12, data.length.toString(8).padStart(11, "0"));
    writeAscii(header, 136, 12, Math.floor(Date.now() / 1000).toString(8).padStart(11, "0"));
    writeAscii(header, 148, 8, "        ");
    header[156] = "0".charCodeAt(0);
    writeAscii(header, 257, 6, "ustar");
    writeAscii(header, 263, 2, "00");
    writeAscii(header, 148, 8, tarChecksum(header).toString(8).padStart(6, "0") + "\0 ");
    chunks.push(header, data);
    const padding = (512 - (data.length % 512)) % 512;
    if (padding) chunks.push(new Uint8Array(padding));
  }
  chunks.push(new Uint8Array(1024));
  return concatBytes(chunks);
}

function parseTar(bytes) {
  const files = {};
  let offset = 0;
  while (offset + 512 <= bytes.length) {
    const header = bytes.slice(offset, offset + 512);
    if (header.every((value) => value === 0)) break;
    const name = utf8Text(header.slice(0, 100)).replace(/\0.*$/, "");
    const sizeText = utf8Text(header.slice(124, 136)).replace(/\0.*$/, "").trim();
    const size = Number.parseInt(sizeText || "0", 8);
    const dataStart = offset + 512;
    files[name] = bytes.slice(dataStart, dataStart + size);
    offset = dataStart + size + ((512 - (size % 512)) % 512);
  }
  return files;
}

async function deriveKey(passphrase, salt) {
  const material = await crypto.subtle.importKey("raw", utf8Bytes(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 120000, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function randomBytes(length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

async function encryptJson(value, passphrase) {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = await deriveKey(passphrase, salt);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, utf8Bytes(JSON.stringify(value))));
  return { salt, iv, ciphertext };
}

async function decryptJson(envelope, passphrase) {
  const key = await deriveKey(passphrase, envelope.salt);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: envelope.iv }, key, envelope.ciphertext);
  return JSON.parse(utf8Text(new Uint8Array(plaintext)));
}

async function runExportImportPoc() {
  const userData = {
    app: "wordlover",
    dataFormatVersion: "test-1",
    exportedAt: new Date().toISOString(),
    vocabulary: [
      { term: "abandon", rating: "Again", source: "ECDICT" },
      { term: "take off", rating: "Hard", source: "ECDICT" },
    ],
    stats: { newSavedToday: 2, reviewedToday: 1, masteredToday: 0 },
  };
  const passphrase = "wordlover-product-test-recovery-passphrase";
  const encrypted = await encryptJson(userData, passphrase);
  const manifest = {
    app: "wordlover",
    exportFormat: "encrypted-tar-test",
    dataFormatVersion: userData.dataFormatVersion,
    createdAt: userData.exportedAt,
    encryption: {
      algorithm: "AES-GCM",
      kdf: "PBKDF2-SHA256",
      iterations: 120000,
      saltHex: Array.from(encrypted.salt, (byte) => byte.toString(16).padStart(2, "0")).join(""),
      ivHex: Array.from(encrypted.iv, (byte) => byte.toString(16).padStart(2, "0")).join(""),
    },
  };
  const archive = createTar([
    { name: "manifest.json", data: JSON.stringify(manifest, null, 2) },
    { name: "user-data.enc", data: encrypted.ciphertext },
  ]);
  const parsed = parseTar(archive);
  const parsedManifest = JSON.parse(utf8Text(parsed["manifest.json"]));
  const restored = await decryptJson(
    {
      salt: encrypted.salt,
      iv: encrypted.iv,
      ciphertext: parsed["user-data.enc"],
    },
    passphrase,
  );
  const matches = JSON.stringify(restored) === JSON.stringify(userData);
  return {
    archiveBytes: archive.byteLength,
    files: Object.keys(parsed),
    manifestValid: parsedManifest.app === "wordlover" && parsedManifest.encryption.algorithm === "AES-GCM",
    roundTripMatches: matches,
  };
}

async function runMockGoogleDriveSyncPoc(exportImportResult) {
  const stages = [];
  const localSnapshot = { vocabularyItems: [{ term: "local", normalizedTerm: "local" }] };
  const remoteSnapshot = { vocabularyItems: [{ term: "remote", normalizedTerm: "remote" }] };
  stages.push("merge-in-memory");
  const mergedSnapshot = {
    vocabularyItems: [...localSnapshot.vocabularyItems, ...remoteSnapshot.vocabularyItems],
  };
  stages.push("revision-check");
  stages.push("upload");
  const uploadedSnapshot = mergedSnapshot;
  stages.push("checkpoint");
  stages.push("apply-local");
  const snapshot = {
    provider: "mock-google-drive",
    statusSequence: ["pending", "synced"],
    appVersion: "product-test",
    dataFormatVersion: "test-1",
    createdAt: new Date().toISOString(),
    encryptedArchiveBytes: exportImportResult.archiveBytes,
    stages,
  };
  await saveStoreValue(KV_STORE, "mockDriveManifest", snapshot);
  const restored = await loadStoreValue(KV_STORE, "mockDriveManifest");
  const expectedStages = ["merge-in-memory", "revision-check", "upload", "checkpoint", "apply-local"];
  const stageOrderSafe = JSON.stringify(restored?.stages ?? []) === JSON.stringify(expectedStages);
  return {
    mode: "mock",
    oauthPerformed: false,
    synced: restored?.statusSequence?.at(-1) === "synced" && stageOrderSafe && uploadedSnapshot.vocabularyItems.length === 2,
    statusSequence: restored?.statusSequence ?? [],
    stageOrderSafe,
    stages: restored?.stages ?? [],
    note: "Real Google Drive OAuth/upload needs user account authorization and cannot be completed silently by automation.",
  };
}

async function runMainAppDictionarySmoke() {
  const terms = ["abandon", "take off"];
  const results = [];
  for (const term of terms) {
    const frame = document.createElement("iframe");
    frame.hidden = true;
    frame.src = `/?q=${encodeURIComponent(term)}&suite-main-smoke=${Date.now()}`;
    document.body.append(frame);
    try {
      const result = await new Promise((resolve, reject) => {
        const startedAt = performance.now();
        const timer = window.setInterval(() => {
        const frameWindow = frame.contentWindow;
        const frameDocument = frame.contentDocument;
        unlockMainAppFrame(frame);
        const text = frameDocument?.querySelector("#result")?.textContent ?? "";
          const input = frameDocument?.querySelector("#termInput");
          const failed = /Dictionary is unavailable|Failed to fetch|No exact dictionary match|Invalid input/i.test(text);
          const loaded = Boolean(frameWindow?.WordLoverApp?.getState?.().loaded);
          if (failed) {
            window.clearInterval(timer);
            reject(new Error(`Main app search failed for "${term}": ${text.slice(0, 500)}`));
            return;
          }
          if (loaded && input && !input.disabled && text.toLowerCase().includes(term.toLowerCase().split(" ")[0])) {
            window.clearInterval(timer);
            resolve({
              term,
              loaded,
              textPreview: text.trim().slice(0, 500),
              appVersion: frameWindow.WordLoverApp.getState().appVersion,
            });
            return;
          }
          if (performance.now() - startedAt > 60000) {
            window.clearInterval(timer);
            reject(new Error(`Main app search timed out for "${term}". Last result text: ${text.slice(0, 500)}`));
          }
        }, 250);
      });
      results.push(result);
    } finally {
      frame.remove();
    }
  }
  return {
    passed: results.length === terms.length,
    results,
  };
}

async function runMainAppStudySmoke() {
  const frame = document.createElement("iframe");
  frame.hidden = true;
  frame.src = `/?suite-study-smoke=${Date.now()}`;
  document.body.append(frame);
  try {
    await new Promise((resolve, reject) => {
      const startedAt = performance.now();
      const timer = window.setInterval(() => {
        const frameWindow = frame.contentWindow;
        unlockMainAppFrame(frame);
        const input = frame.contentDocument?.querySelector("#termInput");
        const failedText = frame.contentDocument?.querySelector("#result")?.textContent ?? "";
        if (/Dictionary is unavailable|Failed to fetch/i.test(failedText)) {
          window.clearInterval(timer);
          reject(new Error(`Main app study smoke could not load dictionary: ${failedText.slice(0, 500)}`));
          return;
        }
        if (frameWindow?.WordLoverApp?.getState?.().loaded && input && !input.disabled) {
          window.clearInterval(timer);
          resolve();
          return;
        }
        if (performance.now() - startedAt > 60000) {
          window.clearInterval(timer);
          reject(new Error("Main app study smoke timed out waiting for dictionary load."));
        }
      }, 250);
    });

    let frameWindow = frame.contentWindow;
    let frameDocument = frame.contentDocument;
    const click = (selector) => {
      const button = frameDocument.querySelector(selector);
      if (!button) throw new Error(`Main app study smoke missing button: ${selector}`);
      button.click();
    };
    const waitForStudyOneMoreCard = async (previousTerm = null) =>
      new Promise((resolve, reject) => {
        const startedAt = performance.now();
        const timer = window.setInterval(() => {
          const term = frameDocument.querySelector("#quizPanel .study-one-more-card .quiz-question strong")?.textContent?.trim();
          if (term && term !== previousTerm) {
            window.clearInterval(timer);
            resolve(term);
            return;
          }
          const panelText = frameDocument.querySelector("#quizPanel")?.textContent ?? "";
          if (/No .* candidate found/i.test(panelText)) {
            window.clearInterval(timer);
            reject(new Error(`Main app study smoke found no new candidate after ${previousTerm ?? "start"}.`));
            return;
          }
          if (performance.now() - startedAt > 10000) {
            window.clearInterval(timer);
            reject(new Error(`Main app study smoke timed out waiting for next quiz. Panel: ${panelText.slice(0, 500)}`));
          }
        }, 100);
      });

    // WCAG-style contrast ratio between two computed CSS colors, used to verify quiz result text
    // stays legible on its highlight background across themes (notably Ink, whose --text is light).
    const parseRgb = (value) => {
      const match = String(value).match(/rgba?\(([^)]+)\)/);
      if (!match) return null;
      const parts = match[1].split(",").map((n) => parseFloat(n.trim()));
      return parts.length >= 3 && parts.every((n) => Number.isFinite(n)) ? parts.slice(0, 3) : null;
    };
    const relativeLuminance = ([r, g, b]) => {
      const channel = (c) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
    };
    const contrastRatio = (fg, bg) => {
      const f = parseRgb(fg);
      const b = parseRgb(bg);
      if (!f || !b) return 0;
      const l1 = relativeLuminance(f);
      const l2 = relativeLuminance(b);
      const hi = Math.max(l1, l2);
      const lo = Math.min(l1, l2);
      return (hi + 0.05) / (lo + 0.05);
    };

    const candidateRows = [
      { word: "alpha", normalized_word: "alpha", frq: 100, bnc: 100, definition: "alpha definition", translation: "alpha" },
      { word: "bravo", normalized_word: "bravo", frq: 90, bnc: 90, definition: "bravo definition", translation: "bravo" },
      { word: "charlie", normalized_word: "charlie", frq: 80, bnc: 80, definition: "charlie definition", translation: "charlie" },
      { word: "delta", normalized_word: "delta", frq: 70, bnc: 70, definition: "delta definition", translation: "delta" },
      { word: "echo", normalized_word: "echo", frq: 60, bnc: 60, definition: "echo definition", translation: "echo" },
      { word: "zulu", normalized_word: "zulu", frq: 500, bnc: 500, definition: "zulu definition", translation: "zulu" },
    ];
    const fakeSets = ({
      memorize = [],
      spelling = [],
      introducedToday = [],
      firstTryPassed = [],
      known = [],
      archivedIgnoredOrMastered = [],
      skippedRecently = [],
    } = {}) => ({
      memorizeTerms: new Set(memorize),
      spellingTerms: new Set(spelling),
      introducedToday: new Set(introducedToday),
      firstTryPassed: new Set(firstTryPassed),
      knownTerms: new Set(known),
      archivedIgnoredOrMastered: new Set(archivedIgnoredOrMastered),
      skippedRecently: new Set(skippedRecently),
    });
    const studyOneMoreTests = {
      excludesMemorizeWords: frameWindow.WordLoverApp.studyOneMore.pickFromCandidates(candidateRows, "very_easy", fakeSets({ memorize: ["echo"] })).normalizedTerm === "delta",
      excludesSpellingWords: frameWindow.WordLoverApp.studyOneMore.pickFromCandidates(candidateRows, "very_easy", fakeSets({ spelling: ["echo"] })).normalizedTerm === "delta",
      excludesKnownWords: frameWindow.WordLoverApp.studyOneMore.pickFromCandidates(candidateRows, "very_easy", fakeSets({ known: ["echo"] })).normalizedTerm === "delta",
      excludesWordsStudiedToday: frameWindow.WordLoverApp.studyOneMore.pickFromCandidates(candidateRows, "very_easy", fakeSets({ introducedToday: ["echo"] })).normalizedTerm === "delta",
      excludesWordsSkippedToday: frameWindow.WordLoverApp.studyOneMore.pickFromCandidates(candidateRows, "very_easy", fakeSets({ introducedToday: ["echo"] })).normalizedTerm === "delta",
      choosesLowestFrequencyRankCandidate: frameWindow.WordLoverApp.studyOneMore.pickFromCandidates(candidateRows, "very_easy", fakeSets()).normalizedTerm === "echo",
      fallsBackWhenNoCefrExists: frameWindow.WordLoverApp.studyOneMore.levelFor({ word: "fallback", normalized_word: "fallback", frq: 2500 }) === "very_easy"
        && frameWindow.WordLoverApp.studyOneMore.levelFor({ word: "intermediate", normalized_word: "intermediate", frq: 9000 }) === "medium",
    };
    const orderedStats = { rowsVisited: 0 };
    const orderedCandidate = frameWindow.WordLoverApp.studyOneMore.pickFromOrderedCandidates(
      [
        { word: "swift", normalized_word: "swift", frq: 10, bnc: 10, definition: "swift definition", translation: "swift" },
        { word: "slower", normalized_word: "slower", frq: 20, bnc: 20, definition: "slower definition", translation: "slower" },
        { word: "slowest", normalized_word: "slowest", frq: 30, bnc: 30, definition: "slowest definition", translation: "slowest" },
      ],
      "very_easy",
      fakeSets(),
      orderedStats,
    );
    studyOneMoreTests.orderedCandidateStopsAtFirstAllowed =
      orderedCandidate?.normalizedTerm === "swift" && orderedStats.rowsVisited === 1;
    studyOneMoreTests.levelSqlPushesFiltersToDictionary =
      /<= 3000/.test(frameWindow.WordLoverApp.studyOneMore.levelSql("very_easy"))
      && /NOT/.test(frameWindow.WordLoverApp.studyOneMore.levelSql("easy"))
      && /is_toefl|tag/i.test(frameWindow.WordLoverApp.studyOneMore.levelSql("toefl"));
    studyOneMoreTests.dictionaryCandidateQueryIsLimited =
      frameWindow.WordLoverApp.studyOneMore.queryCandidates({}, 7).length <= 7;
    const manyCandidates = Array.from({ length: 300 }, (_, index) => ({
      word: `bulkword${index + 1}`,
      normalized_word: `bulkword${index + 1}`,
      frq: 20001 + index,
      bnc: 20001 + index,
      definition: `bulk definition ${index + 1}`,
      translation: `bulk ${index + 1}`,
    }));
    const manyStats = { rowsScanned: 0, exclusionCounts: {} };
    const manyCandidate = frameWindow.WordLoverApp.studyOneMore.pickFromOrderedCandidates(
      manyCandidates,
      "hard",
      fakeSets({ memorize: manyCandidates.slice(0, 240).map((row) => row.normalized_word) }),
      manyStats,
    );
    studyOneMoreTests.scansPastExcludedFirstBatch =
      manyCandidate?.normalizedTerm === "bulkword241" && manyStats.rowsScanned === 241 && manyStats.exclusionCounts.memorize === 240;
    const toeflCandidate = frameWindow.WordLoverApp.studyOneMore.pickFromCandidates(
      [
        { word: "plain", normalized_word: "plain", frq: 1, definition: "plain definition", translation: "plain" },
        { word: "academic", normalized_word: "academic", frq: 5000, definition: "academic definition", translation: "academic", tag: "TOEFL", is_toefl: 1 },
      ],
      "toefl",
      fakeSets(),
    );
    studyOneMoreTests.toeflOnlyReturnsTagged = toeflCandidate?.normalizedTerm === "academic";
    studyOneMoreTests.excludesRecentlySkippedWords =
      frameWindow.WordLoverApp.studyOneMore.pickFromCandidates(candidateRows, "very_easy", fakeSets({ skippedRecently: ["echo"] })).normalizedTerm === "delta";
    studyOneMoreTests.skippedCooldownDaysIsPositive =
      (frameWindow.WordLoverApp.studyOneMore.SKIP_COOLDOWN_DAYS ?? 0) > 0;
    if (!Object.values(studyOneMoreTests).every(Boolean)) {
      throw new Error(`Study One More selection tests failed: ${JSON.stringify(studyOneMoreTests)}`);
    }
    const earlyPracticeReviewedAt = "2026-06-02T12:00:00.000Z";
    const earlyPracticeOriginalDue = "2026-06-12T12:00:00.000Z";
    const futureReviewState = {
      dueAt: earlyPracticeOriginalDue,
      masteredAt: null,
      fsrsCard: {
        due: earlyPracticeOriginalDue,
        stability: 90,
        difficulty: 3,
        elapsed_days: 30,
        scheduled_days: 30,
        reps: 5,
        lapses: 0,
        state: 2,
        last_review: "2026-05-01T12:00:00.000Z",
      },
    };
    const dueReviewState = {
      ...futureReviewState,
      dueAt: earlyPracticeReviewedAt,
      fsrsCard: { ...futureReviewState.fsrsCard, due: earlyPracticeReviewedAt },
    };
    const dueGood = frameWindow.WordLoverApp.reviewScheduling.applyPolicy({
      reviewState: dueReviewState,
      rating: "good",
      reviewedAt: earlyPracticeReviewedAt,
      mode: "review",
    });
    const earlyAgain = frameWindow.WordLoverApp.reviewScheduling.applyPolicy({
      reviewState: futureReviewState,
      rating: "again",
      reviewedAt: earlyPracticeReviewedAt,
      mode: "practice",
    });
    const earlyHard = frameWindow.WordLoverApp.reviewScheduling.applyPolicy({
      reviewState: futureReviewState,
      rating: "hard",
      reviewedAt: earlyPracticeReviewedAt,
      mode: "practice",
    });
    const earlyGood = frameWindow.WordLoverApp.reviewScheduling.applyPolicy({
      reviewState: futureReviewState,
      rating: "good",
      reviewedAt: earlyPracticeReviewedAt,
      mode: "practice",
    });
    const earlyEasy = frameWindow.WordLoverApp.reviewScheduling.applyPolicy({
      reviewState: futureReviewState,
      rating: "easy",
      reviewedAt: earlyPracticeReviewedAt,
      mode: "practice",
    });
    const spellingEarlyGood = frameWindow.WordLoverApp.reviewScheduling.applyPolicy({
      reviewState: futureReviewState,
      rating: "good",
      reviewedAt: earlyPracticeReviewedAt,
      mode: "practice",
      track: "spelling",
    });
    const spellingEarlyMiss = frameWindow.WordLoverApp.reviewScheduling.applyPolicy({
      reviewState: futureReviewState,
      rating: "good",
      reviewedAt: earlyPracticeReviewedAt,
      mode: "practice",
      track: "spelling",
      hadMiss: true,
    });
    const originalDueMs = Date.parse(earlyPracticeOriginalDue);
    const reviewSchedulingTests = {
      dueReviewUsesFullFsrs: dueGood.schedulingPolicy === "scheduled-review-full" && dueGood.dueAt === dueGood.fsrsDueAt,
      earlyAgainUsesFullFsrs: earlyAgain.schedulingPolicy === "early-practice-full-failure" && earlyAgain.dueAt === earlyAgain.fsrsDueAt,
      earlyHardIsRecordOnly: earlyHard.schedulingPolicy === "early-practice-record-only" && earlyHard.recordOnlyPractice === true,
      earlyCorrectKeepsRealDueAndCard: [earlyHard, earlyGood, earlyEasy].every((schedule) =>
        schedule.dueAt === earlyPracticeOriginalDue
        && schedule.fsrsCard.reps === futureReviewState.fsrsCard.reps
        && schedule.fsrsCard.stability === futureReviewState.fsrsCard.stability
      ),
      spellingEarlyPracticeUsesSamePolicy: spellingEarlyGood.schedulingPolicy === "early-practice-record-only" && spellingEarlyGood.recordOnlyPractice === true,
      spellingEarlyMissUsesFullFsrs: spellingEarlyMiss.schedulingPolicy === "early-practice-full-failure" && spellingEarlyMiss.recordOnlyPractice === false,
    };
    if (!Object.values(reviewSchedulingTests).every(Boolean)) {
      throw new Error(`Early practice scheduling tests failed: ${JSON.stringify({ reviewSchedulingTests, dueGood, earlyAgain, earlyHard, earlyGood, earlyEasy, spellingEarlyGood, spellingEarlyMiss })}`);
    }

    const localDateProbeMs = Date.parse("2026-06-03T00:30:00.000Z");
    const localDateProbe = new Date(localDateProbeMs);
    const expectedLocalDateKey = `${localDateProbe.getFullYear()}-${String(localDateProbe.getMonth() + 1).padStart(2, "0")}-${String(localDateProbe.getDate()).padStart(2, "0")}`;
    const localTodayKey = frameWindow.WordLoverApp.dateKeys.localDateKey(localDateProbeMs);
    const localDateKeyUsesLocalTime = localTodayKey === expectedLocalDateKey;
    if (!localDateKeyUsesLocalTime) {
      throw new Error(`localDateKey should use the browser's local date. Got ${localTodayKey}, expected ${expectedLocalDateKey}.`);
    }

    const tookLookup = frameWindow.WordLoverApp.lookupTerm("took");
    const hurriesLookup = frameWindow.WordLoverApp.lookupTerm("hurries");
    const inflectionFallbackWorks =
      tookLookup.status === "found"
      && tookLookup.term === "took"
      && tookLookup.baseTerm === "take"
      && /past tense/i.test(tookLookup.entryType)
      && hurriesLookup.status === "found"
      && hurriesLookup.term === "hurries"
      && hurriesLookup.baseTerm === "hurry"
      && /third-person singular/i.test(hurriesLookup.entryType);
    if (!inflectionFallbackWorks) {
      throw new Error(`Inflected dictionary lookup should fall back to base exchange metadata: ${JSON.stringify({ tookLookup, hurriesLookup })}`);
    }

    await frameWindow.WordLoverApp.runAutomatedSearchSmoke("abandon", false);
    const savedHistoryEntry = frameWindow.WordLoverApp.getState().historyItems.find((item) => item.term === "abandon");
    const historyWritesBothTimestampFields = Boolean(savedHistoryEntry?.searchedAt && savedHistoryEntry?.queriedAt);
    const historyMergeSnapshot = frameWindow.WordLoverApp.mergeSnapshots(
      {
        ...frameWindow.WordLoverApp.buildUserDataSnapshot(),
        historyItems: [{ term: "history timestamp test", searchedAt: "2026-06-01T00:00:00.000Z" }],
      },
      {
        ...frameWindow.WordLoverApp.buildUserDataSnapshot(),
        historyItems: [{ term: "history timestamp test", searchedAt: "2026-06-02T00:00:00.000Z" }],
      },
    );
    const mergedHistoryEntry = historyMergeSnapshot.historyItems.find((item) => item.term === "history timestamp test");
    const historyMergeUsesSearchedAtFallback =
      mergedHistoryEntry?.searchedAt === "2026-06-02T00:00:00.000Z"
      && mergedHistoryEntry?.queriedAt === "2026-06-02T00:00:00.000Z";
    if (!historyWritesBothTimestampFields || !historyMergeUsesSearchedAtFallback) {
      throw new Error(`Recent history timestamps should write and merge both fields: ${JSON.stringify({ savedHistoryEntry, mergedHistoryEntry })}`);
    }

    const restoredGoalTargets = { newPerDay: 7, reviewsPerDay: 22, masteredPerWeek: 9, masteredPerMonth: 36, desiredRetention: 0.95, forecastDays: 60, maxStudyMinutesPerDay: 18 };
    await frameWindow.WordLoverApp.setGoals(restoredGoalTargets);
    const goalsAfterSet = frameWindow.WordLoverApp.getGoals();
    const goalSettingsPersistNewFields =
      goalsAfterSet?.desiredRetention === 0.95
      && goalsAfterSet?.forecastDays === 60
      && goalsAfterSet?.maxStudyMinutesPerDay === 18
      && goalsAfterSet?.goalMode === "new_words_first";
    const goalForecastComputed = frameWindow.WordLoverApp.goalForecast();
    const goalForecastUsesFsrs =
      goalForecastComputed != null
      && Array.isArray(goalForecastComputed.forecast?.dailyBreakdown)
      && goalForecastComputed.forecast.dailyBreakdown.length === 60
      && typeof goalForecastComputed.forecast.avgReviews30Days === "number"
      && ["easy", "good", "heavy", "too_heavy"].includes(goalForecastComputed.forecast.sustainability);
    if (!goalSettingsPersistNewFields || !goalForecastUsesFsrs) {
      throw new Error(`Goal forecast settings should persist and produce an FSRS forecast: ${JSON.stringify({ goalsAfterSet, sustainability: goalForecastComputed?.forecast?.sustainability, breakdown: goalForecastComputed?.forecast?.dailyBreakdown?.length })}`);
    }
    const goalsSnapshot = frameWindow.WordLoverApp.buildUserDataSnapshot();
    const goalPanelText = () => frameDocument.querySelector("#goalsPanel")?.textContent ?? "";
    const localOlderGoalsSnapshot = {
      ...goalsSnapshot,
      exportedAt: "2026-06-01T00:00:00.000Z",
      studyGoals: { ...goalsSnapshot.studyGoals, newPerDay: 3, updatedAt: "2026-06-01T00:00:00.000Z" },
    };
    const remoteNewerGoalsSnapshot = {
      ...goalsSnapshot,
      exportedAt: "2026-06-01T00:00:00.000Z",
      studyGoals: { ...goalsSnapshot.studyGoals, newPerDay: 11, updatedAt: "2026-06-02T00:00:00.000Z" },
    };
    const mergedGoalsByUpdatedAt = frameWindow.WordLoverApp.mergeSnapshots(localOlderGoalsSnapshot, remoteNewerGoalsSnapshot);
    const goalsMergeUsesNewerUpdatedAt = mergedGoalsByUpdatedAt.studyGoals?.newPerDay === 11;
    const localNoGoalTimestampSnapshot = {
      ...goalsSnapshot,
      exportedAt: "2026-06-01T00:00:00.000Z",
      studyGoals: { ...goalsSnapshot.studyGoals, newPerDay: 4, updatedAt: undefined },
    };
    const remoteNoGoalTimestampSnapshot = {
      ...goalsSnapshot,
      exportedAt: "2026-06-03T00:00:00.000Z",
      studyGoals: { ...goalsSnapshot.studyGoals, newPerDay: 13, updatedAt: undefined },
    };
    const mergedGoalsBySnapshotDate = frameWindow.WordLoverApp.mergeSnapshots(localNoGoalTimestampSnapshot, remoteNoGoalTimestampSnapshot);
    const goalsMergeFallsBackToNewerSnapshot = mergedGoalsBySnapshotDate.studyGoals?.newPerDay === 13;
    if (!goalsMergeUsesNewerUpdatedAt || !goalsMergeFallsBackToNewerSnapshot) {
      throw new Error(`Study goals merge should use updatedAt, then snapshot date: ${JSON.stringify({ mergedGoalsByUpdatedAt: mergedGoalsByUpdatedAt.studyGoals, mergedGoalsBySnapshotDate: mergedGoalsBySnapshotDate.studyGoals })}`);
    }

    const snapshotWithoutGoals = { ...goalsSnapshot };
    delete snapshotWithoutGoals.studyGoals;
    await frameWindow.WordLoverApp.applySnapshotForTest(snapshotWithoutGoals);
    const olderSnapshotWithoutGoalsStable =
      frameWindow.WordLoverApp.getGoals() === null
      && /No goals yet/i.test(goalPanelText());
    if (!olderSnapshotWithoutGoalsStable) {
      throw new Error(`Applying an older snapshot without studyGoals should keep the app stable with no goals: ${goalPanelText()}`);
    }

    await frameWindow.WordLoverApp.applySnapshotForTest(goalsSnapshot);
    const goalsRestoredImmediately =
      frameWindow.WordLoverApp.getGoals()?.newPerDay === restoredGoalTargets.newPerDay
      && /Targets: 7 new \+ 22 reviews\/day, 9 mastered\/week/i.test(goalPanelText());
    if (!goalsRestoredImmediately) {
      throw new Error(`Applying a snapshot should restore study goals and rerender the Goals panel immediately: ${goalPanelText()}`);
    }
    frame.src = `/?suite-study-smoke=${Date.now()}&goals-reload=1`;
    await new Promise((resolve, reject) => {
      const startedAt = performance.now();
      const timer = window.setInterval(() => {
        const reloadedWindow = frame.contentWindow;
        unlockMainAppFrame(frame);
        const input = frame.contentDocument?.querySelector("#termInput");
        const reloadedGoals = reloadedWindow?.WordLoverApp?.getGoals?.();
        const text = frame.contentDocument?.querySelector("#goalsPanel")?.textContent ?? "";
        if (reloadedWindow?.WordLoverApp?.getState?.().loaded && input && !input.disabled && reloadedGoals?.newPerDay === 7 && /Targets: 7 new \+ 22 reviews\/day, 9 mastered\/week/i.test(text)) {
          window.clearInterval(timer);
          resolve();
          return;
        }
        if (performance.now() - startedAt > 30000) {
          window.clearInterval(timer);
          reject(new Error(`Timed out waiting for restored study goals after reload. Goals panel: ${text}`));
        }
      }, 250);
    });
    frameWindow = frame.contentWindow;
    frameDocument = frame.contentDocument;
    const reloadedGoalsState = frameWindow.WordLoverApp.getGoals();
    const goalsRestoreSurvivesReload =
      reloadedGoalsState?.newPerDay === restoredGoalTargets.newPerDay
      && reloadedGoalsState?.desiredRetention === restoredGoalTargets.desiredRetention
      && reloadedGoalsState?.forecastDays === restoredGoalTargets.forecastDays;

    // Google Drive backups are plain JSON learning-tracks data — never encrypted, never a
    // passphrase. The envelope must use the new format with a readable payload and no ciphertext
    // fields, must round-trip, and legacy encrypted backups must be rejected as "legacy" (so sync
    // offers overwrite) without ever rendering a #passphrase prompt.
    const cloudBackup = await frameWindow.WordLoverApp.sync.backup.buildForTest();
    const cloudEnvelope = frameWindow.WordLoverApp.sync.backup.wrapForTest(cloudBackup);
    const cloudEnvelopeKeys = JSON.stringify(cloudEnvelope).toLowerCase();
    const cloudBackupIsPlainJson =
      cloudEnvelope.format === "wordfan-learning-tracks-plain-v1"
      && cloudEnvelope.payload !== undefined
      && cloudEnvelope.payload.app === "WordFan"
      && cloudEnvelope.payload.tracks !== undefined
      && cloudEnvelope.data === undefined
      && cloudEnvelope.iv === undefined
      && cloudEnvelope.salt === undefined
      && cloudEnvelope.tag === undefined
      && !cloudEnvelopeKeys.includes("ciphertext");
    const reUnwrapped = frameWindow.WordLoverApp.sync.backup.unwrapForTest(cloudEnvelope);
    const plainCloudBackupRoundTrips =
      reUnwrapped.app === "WordFan"
      && Object.keys(reUnwrapped.tracks).length === Object.keys(cloudBackup.tracks).length;
    // Legacy v1 (default-passphrase) and v2 (user-passphrase) encrypted backups must be rejected as
    // legacy without prompting, so sync can offer overwrite and restore can warn.
    const legacyV1Envelope = frameWindow.WordLoverApp.sync.backup.makeLegacyEncryptedEnvelopeForTest("wordlover-user-data-aes-gcm-v1");
    const legacyV2Envelope = frameWindow.WordLoverApp.sync.backup.makeLegacyEncryptedEnvelopeForTest("wordlover-cloud-backup-aes-gcm-v2");
    let legacyV1RejectedAsLegacy = false;
    let legacyV2RejectedAsLegacy = false;
    try {
      frameWindow.WordLoverApp.sync.backup.unwrapForTest(legacyV1Envelope);
    } catch (error) {
      legacyV1RejectedAsLegacy = /legacy encrypted backup/i.test(error.message) && error.legacyEncryptedBackup === true;
    }
    try {
      frameWindow.WordLoverApp.sync.backup.unwrapForTest(legacyV2Envelope);
    } catch (error) {
      legacyV2RejectedAsLegacy = /legacy encrypted backup/i.test(error.message) && error.legacyEncryptedBackup === true;
    }
    // No passphrase UI may exist anywhere in the app document.
    const noPassphraseElement = frameDocument.querySelector("#passphrase") === null;
    if (!cloudBackupIsPlainJson || !plainCloudBackupRoundTrips || !legacyV1RejectedAsLegacy || !legacyV2RejectedAsLegacy || !noPassphraseElement) {
      throw new Error(`Cloud backup must be plain JSON learning-tracks data and never prompt for a passphrase: ${JSON.stringify({ cloudBackupIsPlainJson, plainCloudBackupRoundTrips, legacyV1RejectedAsLegacy, legacyV2RejectedAsLegacy, noPassphraseElement, format: cloudEnvelope.format })}`);
    }
    const currentSnapshotValidates = Boolean(frameWindow.WordLoverApp.validateSnapshot(frameWindow.WordLoverApp.buildUserDataSnapshot()).checksum);
    const oldSnapshot = { ...frameWindow.WordLoverApp.buildUserDataSnapshot() };
    delete oldSnapshot.uiPreferences;
    delete oldSnapshot.studyGoals;
    delete oldSnapshot.knownWords;
    const oldSnapshotValidates = Boolean(frameWindow.WordLoverApp.validateSnapshot(oldSnapshot).checksum);
    let wrongAppRejected = false;
    let dangerousEventRejected = false;
    let restoreFailurePreservesLocalData = false;
    try {
      frameWindow.WordLoverApp.validateSnapshot({ ...oldSnapshot, app: "not-wordlover" });
    } catch {
      wrongAppRejected = true;
    }
    const badSnapshot = {
      ...frameWindow.WordLoverApp.buildUserDataSnapshot(),
      studyEvents: [{ id: "bad", type: "review", normalizedTerm: "bad", rating: "easyy", occurredAt: "not-a-date" }],
    };
    try {
      frameWindow.WordLoverApp.validateSnapshot(badSnapshot);
    } catch {
      dangerousEventRejected = true;
    }
    const beforeBadRestoreVocabCount = frameWindow.WordLoverApp.getVocabulary().length;
    try {
      await frameWindow.WordLoverApp.applySnapshotForTest(badSnapshot);
    } catch {
      restoreFailurePreservesLocalData = frameWindow.WordLoverApp.getVocabulary().length === beforeBadRestoreVocabCount;
    }
    if (!currentSnapshotValidates || !oldSnapshotValidates || !wrongAppRejected || !dangerousEventRejected || !restoreFailurePreservesLocalData) {
      throw new Error(`Snapshot validation tests failed: ${JSON.stringify({ currentSnapshotValidates, oldSnapshotValidates, wrongAppRejected, dangerousEventRejected, restoreFailurePreservesLocalData })}`);
    }

    const replayBase = await frameWindow.WordLoverApp.addUserDictionaryEntryForTest("event sourced fsrs test", "event sourced meaning", "event sourced");
    const replayLookup = frameWindow.WordLoverApp.lookupTerm(replayBase.word);
    const replayItem = await frameWindow.WordLoverApp.saveVocabularyItem(replayLookup, "event-source-test");
    const replaySnapshotBase = frameWindow.WordLoverApp.buildUserDataSnapshot();
    const replayEvents = [
      {
        id: "replay-local-good",
        type: "review",
        term: replayItem.term,
        normalizedTerm: replayItem.normalizedTerm,
        rating: "good",
        occurredAt: "2026-06-01T08:00:00.000Z",
      },
      {
        id: "replay-remote-again",
        type: "review",
        term: replayItem.term,
        normalizedTerm: replayItem.normalizedTerm,
        rating: "again",
        occurredAt: "2026-06-02T08:00:00.000Z",
      },
      {
        id: "replay-practice-easy",
        type: "practice",
        term: replayItem.term,
        normalizedTerm: replayItem.normalizedTerm,
        rating: "easy",
        occurredAt: "2026-06-02T09:00:00.000Z",
      },
      {
        id: "replay-invalid-rating",
        type: "review",
        term: replayItem.term,
        normalizedTerm: replayItem.normalizedTerm,
        rating: "easyy",
        occurredAt: "2026-06-03T08:00:00.000Z",
      },
    ];
    const staleLocalItem = {
      ...replayItem,
      savedAt: "2026-06-01T07:00:00.000Z",
      updatedAt: "2026-06-03T00:00:00.000Z",
      review: { ...replayItem.review, reviewCount: 99, lastRating: "easy" },
    };
    const staleRemoteItem = {
      ...replayItem,
      savedAt: "2026-06-01T07:00:00.000Z",
      updatedAt: "2026-06-01T00:00:00.000Z",
      review: { ...replayItem.review, reviewCount: 1, lastRating: "good" },
    };
    const replayMerged = frameWindow.WordLoverApp.mergeSnapshots(
      { ...replaySnapshotBase, vocabularyItems: [staleLocalItem], studyEvents: [replayEvents[0], replayEvents[2]] },
      { ...replaySnapshotBase, vocabularyItems: [staleRemoteItem], studyEvents: [replayEvents[1], replayEvents[3]] },
    );
    const replayMergedItem = replayMerged.vocabularyItems.find((item) => item.normalizedTerm === replayItem.normalizedTerm);
    const eventSourcedMergeRebuiltFsrs =
      replayMergedItem?.review?.reviewCount === 2
      && replayMergedItem.review.lastRating === "again"
      && replayMerged.studyEvents.length === 4;
    if (!eventSourcedMergeRebuiltFsrs) {
      throw new Error(`Merged FSRS state should replay review events and ignore practice events: ${JSON.stringify(replayMergedItem?.review)}`);
    }
    const logicalEventBase = {
      type: "review",
      track: "vocabulary",
      term: replayItem.term,
      normalizedTerm: replayItem.normalizedTerm,
      rating: "good",
      source: "review",
      practiceMode: "review",
      occurredAt: "2026-06-04T08:00:00.000Z",
    };
    const duplicateEventMerge = frameWindow.WordLoverApp.mergeSnapshots(
      { ...replaySnapshotBase, vocabularyItems: [replayItem], studyEvents: [{ ...logicalEventBase, id: "same-logical-a" }] },
      { ...replaySnapshotBase, vocabularyItems: [replayItem], studyEvents: [{ ...logicalEventBase, id: "same-logical-b" }] },
    );
    const distinctEventMerge = frameWindow.WordLoverApp.mergeSnapshots(
      { ...replaySnapshotBase, vocabularyItems: [replayItem], studyEvents: [{ ...logicalEventBase, id: "distinct-a", occurredAt: "2026-06-04T08:00:00.000Z" }] },
      { ...replaySnapshotBase, vocabularyItems: [replayItem], studyEvents: [{ ...logicalEventBase, id: "distinct-b", occurredAt: "2026-06-04T08:05:00.000Z" }] },
    );
    const spellingDuplicateMerge = frameWindow.WordLoverApp.mergeSnapshots(
      { ...replaySnapshotBase, spellingItems: [replayItem], spellingEvents: [{ ...logicalEventBase, track: "spelling", id: "same-spelling-a" }] },
      { ...replaySnapshotBase, spellingItems: [replayItem], spellingEvents: [{ ...logicalEventBase, track: "spelling", id: "same-spelling-b" }] },
    );
    const eventDeduplicationWorks =
      duplicateEventMerge.studyEvents.length === 1
      && distinctEventMerge.studyEvents.length === 2
      && spellingDuplicateMerge.spellingEvents.length === 1;
    if (!eventDeduplicationWorks) {
      throw new Error(`Study/spelling event dedupe failed: ${JSON.stringify({ duplicate: duplicateEventMerge.studyEvents, distinct: distinctEventMerge.studyEvents, spelling: spellingDuplicateMerge.spellingEvents })}`);
    }
    const vocabularyBeforeRewrite = frameWindow.WordLoverApp.getVocabulary().map((item) => ({ ...item }));
    frameWindow.WordLoverApp.storageDebugForTest.resetWriteStats();
    const singleSaveLookup = frameWindow.WordLoverApp.lookupTerm(replayBase.word);
    await frameWindow.WordLoverApp.saveVocabularyItem(singleSaveLookup, "single-record-persist-test");
    const singleSaveStats = frameWindow.WordLoverApp.storageDebugForTest.writeStats();
    const normalSaveUsesSingleRecord =
      singleSaveStats.rewrites === 0
      && singleSaveStats.puts.vocabularyRecords === 1;
    const rewriteA = await frameWindow.WordLoverApp.saveVocabularyItem(frameWindow.WordLoverApp.lookupTerm(replayBase.word), "rewrite-stale-test-a");
    const rewriteB = { ...rewriteA, term: "rewrite stale b", normalizedTerm: "rewrite stale b", savedAt: "2026-06-01T00:00:00.000Z", updatedAt: "2026-06-01T00:00:00.000Z" };
    const archivedRewriteB = { ...rewriteB, archivedAt: "2026-06-02T00:00:00.000Z" };
    await frameWindow.WordLoverApp.rewriteVocabularyForTest([rewriteA, rewriteB]);
    const afterDropRecords = await frameWindow.WordLoverApp.rewriteVocabularyForTest([rewriteA]);
    const persistAllDeletesStaleRecords = !afterDropRecords.some((item) => item.normalizedTerm === rewriteB.normalizedTerm);
    const afterArchiveRecords = await frameWindow.WordLoverApp.rewriteVocabularyForTest([rewriteA, archivedRewriteB]);
    const persistAllPreservesArchivedRecords = afterArchiveRecords.some((item) => item.normalizedTerm === rewriteB.normalizedTerm && item.archivedAt);
    await frameWindow.WordLoverApp.rewriteVocabularyForTest(vocabularyBeforeRewrite);
    if (!normalSaveUsesSingleRecord || !persistAllDeletesStaleRecords || !persistAllPreservesArchivedRecords) {
      throw new Error(`Persist-all rewrite should be explicit while normal saves stay single-record: ${JSON.stringify({ singleSaveStats, afterDropRecords, afterArchiveRecords })}`);
    }

    await frameWindow.WordLoverApp.uiPreferences.set({
      todayTrack: "spelling",
      vocabularyTrack: "spelling",
      historyTrack: "spelling",
      historyGranularity: "weeks",
      fontScale: 1.3,
      goalsPeriod: "week",
      studyOneMoreFilter: { includeFreqMin: 20001, includeFreqMax: 50000 },
    });
    const uiPreferenceSnapshot = frameWindow.WordLoverApp.buildUserDataSnapshot();
    const uiPreferencesIncludedInSnapshot =
      uiPreferenceSnapshot.uiPreferences?.todayTrack === "spelling"
      && uiPreferenceSnapshot.uiPreferences?.vocabularyTrack === "spelling"
      && uiPreferenceSnapshot.uiPreferences?.historyTrack === "spelling"
      && uiPreferenceSnapshot.uiPreferences?.historyGranularity === "weeks"
      && uiPreferenceSnapshot.uiPreferences?.fontScale === 1.3
      && uiPreferenceSnapshot.uiPreferences?.goalsPeriod === "week"
      && uiPreferenceSnapshot.uiPreferences?.studyOneMoreFilter?.includeFreqMin === 20001
      && uiPreferenceSnapshot.uiPreferences?.studyOneMoreFilter?.includeFreqMax === 50000;
    frame.src = `/?suite-study-smoke=${Date.now()}&prefs-reload=1`;
    await new Promise((resolve, reject) => {
      const startedAt = performance.now();
      const timer = window.setInterval(() => {
        const reloadedWindow = frame.contentWindow;
        unlockMainAppFrame(frame);
        const input = frame.contentDocument?.querySelector("#termInput");
        const loaded = Boolean(reloadedWindow?.WordLoverApp?.getState?.().loaded && input && !input.disabled);
        if (loaded) {
          window.clearInterval(timer);
          resolve();
          return;
        }
        if (performance.now() - startedAt > 30000) {
          window.clearInterval(timer);
          reject(new Error("Timed out waiting for UI preference reload."));
        }
      }, 250);
    });
    frameWindow = frame.contentWindow;
    frameDocument = frame.contentDocument;
    const reloadedUiPreferences = frameWindow.WordLoverApp.uiPreferences.state();
    const uiPreferencesSurviveReload =
      reloadedUiPreferences.todayTrack === "spelling"
      && reloadedUiPreferences.vocabularyTrack === "spelling"
      && reloadedUiPreferences.historyTrack === "spelling"
      && reloadedUiPreferences.historyGranularity === "weeks"
      && reloadedUiPreferences.fontScale === 1.3
      && reloadedUiPreferences.goalsPeriod === "week"
      && reloadedUiPreferences.studyOneMoreFilter?.includeFreqMin === 20001
      && reloadedUiPreferences.studyOneMoreFilter?.includeFreqMax === 50000
      && uiPreferencesIncludedInSnapshot;
    if (!uiPreferencesSurviveReload) {
      throw new Error(`UI preferences should survive app reload/update: ${JSON.stringify({ reloadedUiPreferences, uiPreferenceSnapshot: uiPreferenceSnapshot.uiPreferences })}`);
    }

    // Regression: filter set via API must survive a full page reload
    await frameWindow.WordLoverApp.studyOneMore.setFilter({ includeFreqMin: 5000, includeFreqMax: 30000 });
    frame.src = `/?suite-study-smoke=${Date.now()}&filter-persist-reload=1`;
    await new Promise((resolve, reject) => {
      const startedAt = performance.now();
      const timer = window.setInterval(() => {
        unlockMainAppFrame(frame);
        const input = frame.contentDocument?.querySelector("#termInput");
        const loaded = Boolean(frame.contentWindow?.WordLoverApp?.getState?.().loaded && input && !input.disabled);
        if (loaded) { window.clearInterval(timer); resolve(); return; }
        if (performance.now() - startedAt > 30000) {
          window.clearInterval(timer);
          reject(new Error("Timed out waiting for filter-persist-reload."));
        }
      }, 250);
    });
    frameWindow = frame.contentWindow;
    frameDocument = frame.contentDocument;
    const filterAfterReload = frameWindow.WordLoverApp.uiPreferences.state().studyOneMoreFilter;
    if (filterAfterReload?.includeFreqMin !== 5000 || filterAfterReload?.includeFreqMax !== 30000) {
      throw new Error(`studyOneMoreFilter must survive reload: ${JSON.stringify(filterAfterReload)}`);
    }
    let filterCapturedByPick = null;
    frameWindow.WordLoverApp.studyOneMore.setBeforePickHookForTest(({ filter }) => { filterCapturedByPick = filter; });
    frameDocument.querySelector("#studyNewWord")?.click();
    await new Promise((resolve, reject) => {
      const startedAt = performance.now();
      const timer = window.setInterval(() => {
        if (filterCapturedByPick !== null) { window.clearInterval(timer); resolve(); return; }
        if (performance.now() - startedAt > 5000) {
          window.clearInterval(timer);
          reject(new Error("Timed out waiting for startNewWordStudy hook after filter-persist reload."));
        }
      }, 50);
    });
    frameWindow.WordLoverApp.studyOneMore.setBeforePickHookForTest(null);
    if (filterCapturedByPick?.includeFreqMin !== 5000 || filterCapturedByPick?.includeFreqMax !== 30000) {
      throw new Error(`startNewWordStudy must use persisted filter after reload, got ${JSON.stringify(filterCapturedByPick)}`);
    }
    await frameWindow.WordLoverApp.studyOneMore.setFilter({});

    await frameWindow.WordLoverApp.auth.setGrantForTest(true);
    frameWindow.WordLoverApp.auth.clearTokenForTest();
    const expiredAuthStatus = frameWindow.WordLoverApp.auth.statusText();
    const googleExpiredSessionAutoReconnectMessage =
      /Reconnecting automatically/i.test(expiredAuthStatus)
      && !/Tap Sign in with Google/i.test(expiredAuthStatus);
    if (!googleExpiredSessionAutoReconnectMessage) {
      throw new Error(`Expired Google auth should auto-reconnect without manual Sign-in copy: ${expiredAuthStatus}`);
    }
    await frameWindow.WordLoverApp.auth.setGrantForTest(false);

    let releaseStudyOneMorePick = null;
    frameWindow.WordLoverApp.studyOneMore.setBeforePickHookForTest(() => new Promise((resolve) => {
      releaseStudyOneMorePick = resolve;
    }));
    click("#studyNewWord");
    await new Promise((resolve, reject) => {
      const startedAt = performance.now();
      const timer = window.setInterval(() => {
        const text = frameDocument.querySelector("#quizPanel")?.textContent ?? "";
        const disabled = frameDocument.querySelector("#studyNewWord")?.disabled;
        if (/Finding a word/i.test(text) && disabled) {
          window.clearInterval(timer);
          resolve();
          return;
        }
        if (performance.now() - startedAt > 3000) {
          window.clearInterval(timer);
          reject(new Error(`Study One More did not show immediate loading feedback. Text: ${text}`));
        }
      }, 50);
    });
    const studyOneMoreShowsImmediateLoading = true;
    releaseStudyOneMorePick?.();
    frameWindow.WordLoverApp.studyOneMore.setBeforePickHookForTest(null);
    const firstTerm = await waitForStudyOneMoreCard();
    const firstCandidate = frameWindow.WordLoverApp.studyOneMore.current();
    const answerStudyOneMore = (wantCorrect = true) => {
      const quiz = frameWindow.WordLoverApp.getActiveQuiz();
      if (!quiz || quiz.mode !== "study-one-more") throw new Error("Study One More did not start a quiz.");
      const correctIndex = quiz.options.findIndex((option) => option.correct);
      if (correctIndex < 0) throw new Error("Study One More quiz did not include a correct option.");
      const wrongIndex = quiz.options.findIndex((option) => !option.correct);
      const index = wantCorrect ? correctIndex : (wrongIndex >= 0 ? wrongIndex : correctIndex);
      click(`#quizPanel [data-quiz-option="${index}"]`);
    };
    const firstQuizIpa = frameDocument.querySelector("#quizPanel .word-ipa")?.textContent?.trim() ?? "";
    if (!firstQuizIpa) throw new Error("Main app study smoke did not show IPA in the Study One More card.");
    if (!firstCandidate || firstCandidate.studyLevel !== "very_easy") throw new Error("Study One More did not default to a Very Easy candidate.");
    if (frameDocument.querySelector("#quizPanel [data-quiz-option]")) throw new Error("Study One More showed meaning choices before Reveal options.");
    if (frameDocument.querySelector("[data-study-one-more-meaning]")) throw new Error("Study One More disclosed the full meaning before the quiz.");
    // The initial card offers both Reveal options and Add to Known, without exposing options/meaning.
    if (!frameDocument.querySelector("#quizPanel .study-one-more-card [data-quiz-reveal]")) throw new Error("Study One More initial card is missing Reveal options.");
    if (!frameDocument.querySelector("#quizPanel .study-one-more-card [data-study-one-more-known]")) throw new Error("Study One More initial card is missing Add to Known beside Reveal options.");
    const studyOneMoreInitialAddToKnownPresent = true;
    click("[data-quiz-reveal]");
    if (!frameDocument.querySelector("#quizPanel [data-quiz-option]")) throw new Error("Study One More did not show quiz options after Reveal options.");
    if (frameDocument.querySelector("[data-study-one-more-meaning]")) throw new Error("Study One More disclosed the full meaning after Reveal options.");
    answerStudyOneMore();
    await new Promise((resolve, reject) => {
      const startedAt = performance.now();
      const timer = window.setInterval(() => {
        if (frameDocument.querySelector("[data-study-one-more-show]")) {
          window.clearInterval(timer);
          resolve();
          return;
        }
        if (performance.now() - startedAt > 10000) {
          window.clearInterval(timer);
          reject(new Error("Study One More did not show actions after finishing the quiz."));
        }
      }, 100);
    });
    // Ink theme readability: the selected correct option must keep legible text on its highlight
    // background. Regression for the hard-coded light-green bg + light Ink --text combination.
    const themeBeforeInk = frameWindow.WordLoverApp.getState().theme;
    frameWindow.WordLoverApp.applyTheme("ink");
    const inkCorrectOption = frameDocument.querySelector("#quizPanel .quiz-options button.correct");
    if (!inkCorrectOption) throw new Error("Study One More correct option missing after answering, cannot check Ink readability.");
    const inkCorrectStyle = frameWindow.getComputedStyle(inkCorrectOption);
    const inkCorrectContrast = contrastRatio(inkCorrectStyle.color, inkCorrectStyle.backgroundColor);
    if (inkCorrectContrast < 3) {
      throw new Error(`Ink theme correct option text is not readable (contrast ${inkCorrectContrast.toFixed(2)}): ${inkCorrectStyle.color} on ${inkCorrectStyle.backgroundColor}`);
    }
    const inkQuizCorrectReadable = true;
    frameWindow.WordLoverApp.applyTheme(themeBeforeInk);

    const knownBeforeUserChoice = frameWindow.WordLoverApp
      .getKnownWords()
      .some((record) => record.normalizedTerm === firstCandidate.normalizedTerm);
    if (knownBeforeUserChoice) throw new Error("Correct first-try Study One More should wait for Add to Known before creating a Known record.");
    if (!frameDocument.querySelector("[data-study-one-more-known]")) throw new Error("Study One More did not offer Add to Known after a correct first try.");
    if ((frameDocument.querySelector("#quizPanel")?.textContent ?? "").includes("Mastered")) {
      throw new Error("Study One More Known result should not be labeled Mastered.");
    }
    const masteredBeforeManualAdd = frameWindow.WordLoverApp
      .getVocabulary()
      .filter((item) => item.review?.masteredAt).length;
    if (frameDocument.querySelector("[data-study-one-more-meaning]")) throw new Error("Study One More disclosed the full meaning before tapping Show.");
    click("[data-study-one-more-show]");
    if (!frameDocument.querySelector("[data-study-one-more-meaning]") || !/English/i.test(frameDocument.querySelector("#quizPanel")?.textContent ?? "")) {
      throw new Error("Study One More did not show the full meaning after tapping Show.");
    }
    click("[data-study-one-more-known]");
    const knownAfterCorrect = await new Promise((resolve, reject) => {
      const startedAt = performance.now();
      const timer = window.setInterval(() => {
        const record = frameWindow.WordLoverApp
          .getKnownWords()
          .find((item) => item.normalizedTerm === firstCandidate.normalizedTerm);
        if (record) {
          window.clearInterval(timer);
          resolve(record);
          return;
        }
        if (performance.now() - startedAt > 10000) {
          window.clearInterval(timer);
          reject(new Error("Add to Known did not create a Known record."));
        }
      }, 100);
    });
    if (knownAfterCorrect.review || knownAfterCorrect.fsrsCard) throw new Error("Known record should not include FSRS review state.");
    // Add to Known auto-advances to the next word — no "Study another" click required.
    const secondTerm = await waitForStudyOneMoreCard(firstTerm);
    const secondCandidate = frameWindow.WordLoverApp.studyOneMore.current();
    if (!secondCandidate || secondCandidate.normalizedTerm === firstCandidate.normalizedTerm) {
      throw new Error("Study One More did not auto-advance to a new word after Add to Known.");
    }
    const studyOneMoreAddToKnownAutoAdvances = true;
    const snapshotWithKnown = frameWindow.WordLoverApp.buildUserDataSnapshot();
    if (!snapshotWithKnown.knownWords?.some((record) => record.normalizedTerm === firstCandidate.normalizedTerm)) {
      throw new Error("Sync snapshot did not include Known records.");
    }
    const olderKnownAt = "2026-01-01T00:00:00.000Z";
    const newerKnownAt = "2026-02-01T00:00:00.000Z";
    const mergedKnownSnapshot = frameWindow.WordLoverApp.mergeSnapshots(
      { ...snapshotWithKnown, knownWords: [{ ...knownAfterCorrect, knownAt: olderKnownAt, updatedAt: olderKnownAt }] },
      { ...snapshotWithKnown, knownWords: [{ ...knownAfterCorrect, knownAt: newerKnownAt, updatedAt: newerKnownAt }] },
    );
    const mergedKnown = mergedKnownSnapshot.knownWords.find((record) => record.normalizedTerm === firstCandidate.normalizedTerm);
    if (mergedKnown?.knownAt !== newerKnownAt) throw new Error("Known merge should keep the newest knownAt/updatedAt record.");
    click('[data-vocab-track="known"]');
    click('[data-action="vocab-filter"][data-filter="all"]');
    const knownListText = frameDocument.querySelector("#vocabularyList")?.textContent ?? "";
    if (!knownListText.toLowerCase().includes(firstCandidate.term.toLowerCase())) {
      throw new Error("Known tab did not show the word added from Study One More.");
    }
    if (!knownListText.includes("Known")) throw new Error("Known tab did not render the Known count/card.");
    click('[data-vocab-track="vocabulary"]');
    const firstLookup = await frameWindow.WordLoverApp.lookupTerm(firstCandidate.term);
    if (!firstLookup) throw new Error("Could not look up first Study One More candidate for manual Memorize add.");
    await frameWindow.WordLoverApp.saveVocabularyItem(firstLookup, "known-manual-test");
    const savedAfterKnown = frameWindow.WordLoverApp
      .getVocabulary()
      .some((item) => item.normalizedTerm === firstCandidate.normalizedTerm);
    const knownClearedAfterManualAdd = !frameWindow.WordLoverApp
      .getKnownWords()
      .some((record) => record.normalizedTerm === firstCandidate.normalizedTerm);
    if (!savedAfterKnown || !knownClearedAfterManualAdd) throw new Error("Manual Memorize add should save the Known word and clear its Known blocker.");
    const masteredAfterManualAdd = frameWindow.WordLoverApp
      .getVocabulary()
      .filter((item) => item.review?.masteredAt).length;
    if (masteredAfterManualAdd !== masteredBeforeManualAdd) throw new Error("Known should not count as Mastered.");
    const todayStatsPrefix = `stats-${Date.now()}`;
    const readTodayStats = () => ({
      reviewed: Number(frameDocument.querySelector("#statReviewed")?.textContent ?? "0"),
      practiced: Number(frameDocument.querySelector("#statPracticed")?.textContent ?? "0"),
    });
    frameWindow.WordLoverApp.spelling.setTodayTrack("vocabulary");
    const vocabStatsBefore = readTodayStats();
    frameWindow.WordLoverApp.getStudyEvents().push(
      { id: `${todayStatsPrefix}-v1`, type: "review", track: "vocabulary", term: "today stats vocab", normalizedTerm: "today stats vocab", rating: "good", occurredAt: new Date().toISOString() },
      { id: `${todayStatsPrefix}-v2`, type: "review", track: "vocabulary", term: "today stats vocab", normalizedTerm: "today stats vocab", rating: "easy", occurredAt: new Date().toISOString() },
      { id: `${todayStatsPrefix}-v3`, type: "practice", track: "vocabulary", term: "today stats vocab", normalizedTerm: "today stats vocab", rating: "hard", occurredAt: new Date().toISOString() },
    );
    frameWindow.WordLoverApp.refreshReviewScheduleViews();
    const vocabStatsAfter = readTodayStats();
    const todayMemorizeStatsSplit = vocabStatsAfter.reviewed === vocabStatsBefore.reviewed + 1
      && vocabStatsAfter.practiced === vocabStatsBefore.practiced + 2;
    if (!todayMemorizeStatsSplit) {
      throw new Error(`Today Memorize stats should split unique reviewed from extra practice: ${JSON.stringify({ vocabStatsBefore, vocabStatsAfter })}`);
    }
    frameWindow.WordLoverApp.spelling.setTodayTrack("spelling");
    const spellingStatsBefore = readTodayStats();
    frameWindow.WordLoverApp.getSpellingEvents().push(
      { id: `${todayStatsPrefix}-s1`, type: "review", track: "spelling", term: "today stats spelling", normalizedTerm: "today stats spelling", rating: "good", occurredAt: new Date().toISOString() },
      { id: `${todayStatsPrefix}-s2`, type: "review", track: "spelling", term: "today stats spelling", normalizedTerm: "today stats spelling", rating: "easy", occurredAt: new Date().toISOString() },
      { id: `${todayStatsPrefix}-s3`, type: "practice", track: "spelling", term: "today stats spelling", normalizedTerm: "today stats spelling", rating: "hard", occurredAt: new Date().toISOString() },
    );
    frameWindow.WordLoverApp.spelling.setTodayTrack("spelling");
    const spellingStatsAfter = readTodayStats();
    const todaySpellingStatsSplit = spellingStatsAfter.reviewed === spellingStatsBefore.reviewed + 1
      && spellingStatsAfter.practiced === spellingStatsBefore.practiced + 2;
    if (!todaySpellingStatsSplit) {
      throw new Error(`Today Spelling stats should split unique reviewed from extra practice: ${JSON.stringify({ spellingStatsBefore, spellingStatsAfter })}`);
    }
    frameWindow.WordLoverApp.spelling.setTodayTrack("vocabulary");
    // The second card came from the Add-to-Known auto-advance; it must not repeat the first word.
    click("[data-quiz-reveal]");
    answerStudyOneMore(false);
    await new Promise((resolve, reject) => {
      const startedAt = performance.now();
      const timer = window.setInterval(() => {
        if (frameDocument.querySelector("[data-study-one-more-add=\"spelling\"]")) {
          window.clearInterval(timer);
          resolve();
          return;
        }
        if (performance.now() - startedAt > 10000) {
          window.clearInterval(timer);
          reject(new Error("Study One More did not keep add buttons after the second quiz."));
        }
      }, 100);
    });
    const knownAfterWrong = frameWindow.WordLoverApp
      .getKnownWords()
      .some((record) => record.normalizedTerm === secondCandidate.normalizedTerm);
    if (knownAfterWrong) throw new Error("Incorrect Study One More answer should not create a Known record.");
    // Ink theme readability for the missed-answer highlight.
    frameWindow.WordLoverApp.applyTheme("ink");
    const inkIncorrectOption = frameDocument.querySelector("#quizPanel .quiz-options button.incorrect");
    if (!inkIncorrectOption) throw new Error("Study One More incorrect option missing after a wrong answer, cannot check Ink readability.");
    const inkIncorrectStyle = frameWindow.getComputedStyle(inkIncorrectOption);
    const inkIncorrectContrast = contrastRatio(inkIncorrectStyle.color, inkIncorrectStyle.backgroundColor);
    if (inkIncorrectContrast < 3) {
      throw new Error(`Ink theme incorrect option text is not readable (contrast ${inkIncorrectContrast.toFixed(2)}): ${inkIncorrectStyle.color} on ${inkIncorrectStyle.backgroundColor}`);
    }
    const inkQuizIncorrectReadable = true;
    frameWindow.WordLoverApp.applyTheme(themeBeforeInk);
    click('[data-study-one-more-add="spelling"]');
    await new Promise((resolve, reject) => {
      const startedAt = performance.now();
      const timer = window.setInterval(() => {
        const saved = frameWindow.WordLoverApp
          .getSpelling()
          .some((item) => item.normalizedTerm === secondCandidate.normalizedTerm);
        if (saved) {
          window.clearInterval(timer);
          resolve();
          return;
        }
        if (performance.now() - startedAt > 10000) {
          window.clearInterval(timer);
          reject(new Error(`Main app study smoke did not save Study One More word "${secondTerm}" to Spelling.`));
        }
      }, 100);
    });

    // Add to Spelling auto-advances to the next word — no "Study another" click required.
    const thirdTerm = await waitForStudyOneMoreCard(secondTerm);
    const thirdCandidate = frameWindow.WordLoverApp.studyOneMore.current();
    if (!thirdCandidate || thirdCandidate.normalizedTerm === secondCandidate.normalizedTerm) {
      throw new Error("Study One More did not auto-advance to a new word after Add to Spelling.");
    }
    const studyOneMoreAddToSpellingAutoAdvances = true;
    click("[data-quiz-reveal]");
    answerStudyOneMore(false);
    await new Promise((resolve, reject) => {
      const startedAt = performance.now();
      const timer = window.setInterval(() => {
        if (frameDocument.querySelector("[data-study-one-more-add=\"memorize\"]")) {
          window.clearInterval(timer);
          resolve();
          return;
        }
        if (performance.now() - startedAt > 10000) {
          window.clearInterval(timer);
          reject(new Error("Study One More did not keep Memorize add button after a missed quiz."));
        }
      }, 100);
    });
    click('[data-study-one-more-add="memorize"]');
    const studyOneMoreMissCreatesAgainReview = await new Promise((resolve, reject) => {
      const startedAt = performance.now();
      const timer = window.setInterval(() => {
        const saved = frameWindow.WordLoverApp
          .getVocabulary()
          .some((item) => item.normalizedTerm === thirdCandidate.normalizedTerm);
        const reviewEvent = frameWindow.WordLoverApp
          .getStudyEvents()
          .find((event) =>
            event.normalizedTerm === thirdCandidate.normalizedTerm
            && event.type === "review"
            && event.rating === "again"
            && event.source === "study-one-more-miss"
          );
        if (saved && reviewEvent) {
          window.clearInterval(timer);
          resolve(true);
          return;
        }
        if (performance.now() - startedAt > 10000) {
          window.clearInterval(timer);
          reject(new Error(`Missed Study One More word "${thirdTerm}" did not create an immediate Again review.`));
        }
      }, 100);
    });

    // Add to Memorize auto-advances to the next word — no "Study another" click required.
    const fourthTerm = await waitForStudyOneMoreCard(thirdTerm);
    const fourthCandidate = frameWindow.WordLoverApp.studyOneMore.current();
    if (!fourthCandidate || fourthCandidate.normalizedTerm === thirdCandidate.normalizedTerm) {
      throw new Error("Study One More did not auto-advance to a new word after Add to Memorize.");
    }
    const studyOneMoreAddToMemorizeAutoAdvances = true;

    // Initial Add to Known (no reveal): the freshly auto-advanced card lets the user mark a word
    // Known without revealing options or meaning, then auto-advances again.
    if (frameDocument.querySelector("#quizPanel [data-quiz-option]")) {
      throw new Error("Auto-advanced Study One More card showed options before Reveal.");
    }
    if (frameDocument.querySelector("[data-study-one-more-meaning]")) {
      throw new Error("Auto-advanced Study One More card disclosed the meaning before Reveal.");
    }
    if (!frameDocument.querySelector("#quizPanel .study-one-more-card [data-study-one-more-known]")) {
      throw new Error("Auto-advanced Study One More card is missing the initial Add to Known button.");
    }
    if (frameWindow.WordLoverApp.getKnownWords().some((record) => record.normalizedTerm === fourthCandidate.normalizedTerm)) {
      throw new Error("Word should not be Known before clicking the initial Add to Known.");
    }
    click("#quizPanel .study-one-more-card [data-study-one-more-known]");
    const knownFromInitialAdd = await new Promise((resolve, reject) => {
      const startedAt = performance.now();
      const timer = window.setInterval(() => {
        const record = frameWindow.WordLoverApp
          .getKnownWords()
          .find((item) => item.normalizedTerm === fourthCandidate.normalizedTerm);
        if (record) {
          window.clearInterval(timer);
          resolve(record);
          return;
        }
        if (performance.now() - startedAt > 10000) {
          window.clearInterval(timer);
          reject(new Error("Initial Add to Known did not create a Known record."));
        }
      }, 100);
    });
    if (knownFromInitialAdd.review || knownFromInitialAdd.fsrsCard) {
      throw new Error("Initial Add to Known record should not include FSRS review state.");
    }
    const fifthTerm = await waitForStudyOneMoreCard(fourthTerm);
    const fifthCandidate = frameWindow.WordLoverApp.studyOneMore.current();
    if (!fifthCandidate || fifthCandidate.normalizedTerm === fourthCandidate.normalizedTerm) {
      throw new Error("Initial Add to Known did not auto-advance to a new word.");
    }
    const studyOneMoreInitialAddToKnownWorks = true;

    const statsButtons = [...frameDocument.querySelectorAll(".vocab-stat")];
    const againButton = frameDocument.querySelector('[data-action="vocab-filter"][data-filter="again"]');
    if (!statsButtons.length || !againButton) throw new Error("Main app study smoke did not render vocabulary status stats.");
    const againCount = Number(againButton.querySelector("strong")?.textContent ?? 0);
    if (againCount < 1) throw new Error(`Main app study smoke expected at least one Again word, found ${againCount}.`);
    const listTextBefore = frameDocument.querySelector("#vocabularyList")?.textContent ?? "";
    if (listTextBefore.includes("Missed on the first try")) {
      throw new Error("Vocabulary summary should not expose quiz or meaning details before browsing.");
    }
    if (listTextBefore.includes("Browse other words")) {
      throw new Error("Vocabulary summary should not show the removed Browse other words button.");
    }
    againButton.click();
    const wordButtons = [...frameDocument.querySelectorAll('.vocab-word-list [data-action="vocab-select"]')];
    if (!wordButtons.length) throw new Error("Main app study smoke did not list Again words after clicking the Again count.");
    if (wordButtons.length > 10) throw new Error(`Vocabulary page listed ${wordButtons.length} words; expected at most 10.`);
    const visibleIpaCount = frameDocument.querySelectorAll(".vocab-word-list .word-ipa").length;
    if (visibleIpaCount !== wordButtons.length) {
      throw new Error(`Vocabulary list should show IPA for every displayed word. Found ${visibleIpaCount} IPA labels for ${wordButtons.length} words.`);
    }
    const detailBefore = frameDocument.querySelector(".vocab-detail");
    if (detailBefore) throw new Error("Vocabulary word details should stay hidden until a word is clicked.");
    wordButtons[0].click();
    const detailAfter = await new Promise((resolve, reject) => {
      const startedAt = performance.now();
      const timer = window.setInterval(() => {
        const text = frameDocument.querySelector(".vocab-detail")?.textContent ?? "";
        if (text.trim()) {
          window.clearInterval(timer);
          resolve(text);
          return;
        }
        if (performance.now() - startedAt > 5000) {
          window.clearInterval(timer);
          reject(new Error("Vocabulary word detail did not appear after clicking a word."));
        }
      }, 100);
    });
    if (!String(detailAfter).trim()) throw new Error("Vocabulary word detail did not appear after clicking a word.");

    const dueTestEntry = await frameWindow.WordLoverApp.addUserDictionaryEntryForTest("fsrs due queue test", "due queue meaning", "due queue");
    const dueLookup = frameWindow.WordLoverApp.lookupTerm(dueTestEntry.word);
    const dueVocab = await frameWindow.WordLoverApp.saveVocabularyItem(dueLookup, "debug-fsrs-due-test");
    const duePast = new Date(Date.now() - 60_000).toISOString();
    dueVocab.review.dueAt = duePast;
    dueVocab.review.fsrsCard = { ...(dueVocab.review.fsrsCard ?? {}), due: duePast };
    dueVocab.archivedAt = new Date().toISOString();
    const archivedExcluded = !frameWindow.WordLoverApp.getDueVocabularyItems().some((item) => item.normalizedTerm === dueVocab.normalizedTerm);
    dueVocab.archivedAt = null;
    dueVocab.review.masteredAt = new Date().toISOString();
    const masteredDueIncluded = frameWindow.WordLoverApp.getDueVocabularyItems().some((item) => item.normalizedTerm === dueVocab.normalizedTerm);
    if (!archivedExcluded) throw new Error("Archived cards should be excluded from the active due queue.");
    if (!masteredDueIncluded) throw new Error("Mastered cards should still be reviewed when dueAt arrives.");

    frame.hidden = false;
    frame.style.cssText = "position:fixed;left:0;top:0;width:520px;height:760px;z-index:9999;background:white;border:0;";
    let reviewDueRatingButtonsVisible = false;
    let reviewDueWaitsForManualRating = false;
    let reviewDueRevealAutoFocus = false;
    let reviewDueOptionKeyboardLabels = false;
    let reviewDueKeyboardOptionSelects = false;
    let reviewDueRecommendedRatingFocus = false;
    let reviewDueArrowRatingNavigation = false;
    let reviewDueButtonCountDecreases = false;
    const vocabularyReviewManualOne = await frameWindow.WordLoverApp.addUserDictionaryEntryForTest("review due manual one", "review due manual one meaning", "review due manual one");
    const vocabularyReviewManualTwo = await frameWindow.WordLoverApp.addUserDictionaryEntryForTest("review due manual two", "review due manual two meaning", "review due manual two");
    const vocabularyReviewManualThree = await frameWindow.WordLoverApp.addUserDictionaryEntryForTest("review due manual three", "review due manual three meaning", "review due manual three");
    const vocabularyReviewManualItems = [];
    for (const [index, entry] of [vocabularyReviewManualOne, vocabularyReviewManualTwo, vocabularyReviewManualThree].entries()) {
      const lookup = frameWindow.WordLoverApp.lookupTerm(entry.word);
      const item = await frameWindow.WordLoverApp.saveVocabularyItem(lookup, "debug-review-due-manual-rating");
      const dueAt = new Date(Date.now() - 1_800_000 + index * 60_000).toISOString();
      item.review.dueAt = dueAt;
      item.review.fsrsCard = { ...(item.review.fsrsCard ?? {}), due: dueAt };
      item.review.masteredAt = null;
      item.archivedAt = null;
      vocabularyReviewManualItems.push(item);
    }
    const waitForVocabularyQuizTerm = (previousTerm = null) => new Promise((resolve, reject) => {
      const startedAt = performance.now();
      const timer = window.setInterval(() => {
        const quiz = frameWindow.WordLoverApp.getActiveQuiz();
        const term = quiz?.entry?.term ?? "";
        if (term && term !== previousTerm) {
          window.clearInterval(timer);
          resolve(term);
          return;
        }
        const panelText = frameDocument.querySelector("#quizPanel")?.textContent ?? "";
        if (performance.now() - startedAt > 10000) {
          window.clearInterval(timer);
          reject(new Error(`Vocabulary Review due did not advance from ${previousTerm ?? "empty"}. Panel: ${panelText.slice(0, 500)}`));
        }
      }, 100);
    });
    const waitForQuizFocus = (predicate, message) => new Promise((resolve, reject) => {
      const startedAt = performance.now();
      const timer = window.setInterval(() => {
        if (predicate()) {
          window.clearInterval(timer);
          resolve(true);
          return;
        }
        if (performance.now() - startedAt > 1500) {
          window.clearInterval(timer);
          reject(new Error(message));
        }
      }, 50);
    });
    const answerActiveVocabularyQuiz = async ({ useKeyboard = false } = {}) => {
      const quizBefore = frameWindow.WordLoverApp.getActiveQuiz();
      if (!quizBefore?.entry?.term) throw new Error("Vocabulary Review due auto-advance test has no active quiz.");
      await waitForQuizFocus(
        () => frameDocument.activeElement?.matches?.("[data-quiz-reveal]"),
        `Reveal options button should receive focus for ${quizBefore.entry.term}. Active: ${frameDocument.activeElement?.outerHTML}`,
      );
      reviewDueRevealAutoFocus = true;
      click("[data-quiz-reveal]");
      const revealedQuiz = frameWindow.WordLoverApp.getActiveQuiz();
      const correctIndex = revealedQuiz.options.findIndex((option) => option.correct);
      if (correctIndex < 0) throw new Error(`Vocabulary quiz for ${revealedQuiz.entry.term} has no correct option.`);
      const optionKeys = [...frameDocument.querySelectorAll("[data-quiz-option] .quiz-option-key")].map((node) => node.textContent?.trim()).join("");
      reviewDueOptionKeyboardLabels = optionKeys === "ABCD";
      if (!reviewDueOptionKeyboardLabels) throw new Error(`Vocabulary quiz options should be labeled A/B/C/D. Labels: ${optionKeys}`);
      if (useKeyboard) {
        const key = ["a", "b", "c", "d"][correctIndex];
        frameDocument.querySelector("#quizPanel")?.dispatchEvent(new frameWindow.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
        reviewDueKeyboardOptionSelects = Boolean(frameWindow.WordLoverApp.getActiveQuiz()?.answered);
        if (!reviewDueKeyboardOptionSelects) throw new Error(`Vocabulary quiz should accept ${key.toUpperCase()} as an answer shortcut.`);
      } else {
        click(`[data-quiz-option="${correctIndex}"]`);
      }
      await new Promise((resolve, reject) => {
        const startedAt = performance.now();
        const timer = window.setInterval(() => {
          const buttons = [...frameDocument.querySelectorAll("[data-fsrs-rating]")];
          buttons[0]?.scrollIntoView({ block: "center", inline: "center" });
          const labels = buttons.map((button) => button.textContent?.trim()).join("|");
          const allTopmost = buttons.every((button) => {
            const rect = button.getBoundingClientRect();
            const top = frameDocument.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
            return top === button || Boolean(top?.closest?.("[data-fsrs-rating]"));
          });
          if (buttons.length === 4 && allTopmost && /Again/.test(labels) && /Hard/.test(labels) && /Good/.test(labels) && /Easy/.test(labels)) {
            reviewDueRatingButtonsVisible = true;
            window.clearInterval(timer);
            resolve();
            return;
          }
          if (performance.now() - startedAt > 1000) {
            window.clearInterval(timer);
            reject(new Error(`Vocabulary Review due should show clickable Again/Hard/Good/Easy buttons after answering ${revealedQuiz.entry.term}. Debug: ${JSON.stringify(frameWindow.WordLoverApp.reviewDebug?.state?.())}`));
          }
        }, 50);
      });
      const panelText = frameDocument.querySelector("#quizPanel")?.textContent ?? "";
      const debugState = frameWindow.WordLoverApp.reviewDebug?.state?.();
      const inferredRating = debugState?.latest?.findLast?.((event) => event.stage === "answer")?.inferredRating ?? "easy";
      const focusedRating = frameDocument.activeElement?.closest?.("[data-fsrs-rating]")?.dataset?.fsrsRating;
      reviewDueRecommendedRatingFocus = focusedRating === inferredRating;
      if (!reviewDueRecommendedRatingFocus) {
        throw new Error(`Recommended FSRS rating should receive focus. Expected ${inferredRating}, focused ${focusedRating ?? "none"}.`);
      }
      frameDocument.activeElement?.dispatchEvent(new frameWindow.KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true, cancelable: true }));
      const movedRating = frameDocument.activeElement?.closest?.("[data-fsrs-rating]")?.dataset?.fsrsRating;
      reviewDueArrowRatingNavigation = Boolean(movedRating && movedRating !== focusedRating);
      if (!reviewDueArrowRatingNavigation) {
        throw new Error(`Arrow keys should move between FSRS rating buttons. Before ${focusedRating}, after ${movedRating ?? "none"}.`);
      }
      reviewDueWaitsForManualRating =
        !/Auto-recording/i.test(panelText)
        && debugState?.activeQuiz?.pending === true
        && debugState.activeQuiz.ratingSubmitted === false
        && debugState.activeQuiz.autoTimer === false;
      if (!reviewDueWaitsForManualRating) {
        throw new Error(`Vocabulary Review due must wait for a manual Again/Hard/Good/Easy click. Debug: ${JSON.stringify({ panelText, debugState })}`);
      }
      return quizBefore.entry.term;
    };
    const clickFsrsRating = (rating = "good") => {
      click(`[data-fsrs-rating="${rating}"]`);
    };
    await frameWindow.WordLoverApp.startDueReview();
    const reviewDueFirstTerm = await waitForVocabularyQuizTerm();
    const reviewDueButtonTextBefore = frameDocument.querySelector("#startReview")?.textContent ?? "";
    const reviewDueCountBefore = frameWindow.WordLoverApp.getDueVocabularyItems().length;
    await answerActiveVocabularyQuiz({ useKeyboard: true });
    clickFsrsRating("good");
    const reviewDueSecondTerm = await waitForVocabularyQuizTerm(reviewDueFirstTerm);
    const reviewDueButtonTextAfter = frameDocument.querySelector("#startReview")?.textContent ?? "";
    const reviewDueCountAfter = frameWindow.WordLoverApp.getDueVocabularyItems().length;
    reviewDueButtonCountDecreases =
      reviewDueCountAfter === reviewDueCountBefore - 1
      && reviewDueButtonTextBefore !== reviewDueButtonTextAfter
      && reviewDueButtonTextAfter.includes(String(reviewDueCountAfter));
    if (!reviewDueButtonCountDecreases) {
      const dueAfterDebug = frameWindow.WordLoverApp.getDueVocabularyItems().map((item) => ({
        term: item.term,
        dueAt: item.review?.dueAt ?? null,
        lastRating: item.review?.lastRating ?? null,
        reviewCount: item.review?.reviewCount ?? null,
      }));
      throw new Error(`Review due button count should update immediately after a saved review. ${JSON.stringify({ reviewDueFirstTerm, reviewDueSecondTerm, reviewDueButtonTextBefore, reviewDueButtonTextAfter, reviewDueCountBefore, reviewDueCountAfter, dueAfterDebug, reviewDebug: frameWindow.WordLoverApp.reviewDebug?.events?.().slice(-20) })}`);
    }
    await answerActiveVocabularyQuiz();
    clickFsrsRating("good");
    const reviewDueThirdTerm = await waitForVocabularyQuizTerm(reviewDueSecondTerm);
    const reviewDueManualRatingAdvancesPastSecondWord =
      reviewDueThirdTerm
      && reviewDueThirdTerm !== reviewDueFirstTerm
      && reviewDueThirdTerm !== reviewDueSecondTerm;
    if (!reviewDueManualRatingAdvancesPastSecondWord) {
      throw new Error(`Review due should advance past the second answered word. Terms: ${JSON.stringify({ reviewDueFirstTerm, reviewDueSecondTerm, reviewDueThirdTerm })}`);
    }
    for (const item of vocabularyReviewManualItems) item.archivedAt = new Date().toISOString();

    const stalledReviewOne = await frameWindow.WordLoverApp.addUserDictionaryEntryForTest("review due stalled save one", "review due stalled save one meaning", "review due stalled save one");
    const stalledReviewTwo = await frameWindow.WordLoverApp.addUserDictionaryEntryForTest("review due stalled save two", "review due stalled save two meaning", "review due stalled save two");
    const stalledReviewItems = [];
    for (const entry of [stalledReviewOne, stalledReviewTwo]) {
      const item = await frameWindow.WordLoverApp.saveVocabularyItem(frameWindow.WordLoverApp.lookupTerm(entry.word), "debug-review-due-stalled-save");
      const dueAt = new Date(Date.now() - 2_400_000).toISOString();
      item.review.dueAt = dueAt;
      item.review.fsrsCard = { ...(item.review.fsrsCard ?? {}), due: dueAt };
      item.review.masteredAt = null;
      item.archivedAt = null;
      stalledReviewItems.push(item);
    }
    let reviewDuePersistenceFailureSafe = false;
    let reviewDuePersistenceTimeoutDebug = null;
    try {
      frameWindow.WordLoverApp.reviewDebug.clear();
      frameWindow.WordLoverApp.reviewDebug.setPersistenceHookForTest(() => new Promise(() => {}), 150);
      await frameWindow.WordLoverApp.startDueReview();
      const stalledFirstTerm = await waitForVocabularyQuizTerm();
      const stalledItem = stalledReviewItems.find((item) => item.term === stalledFirstTerm);
      const beforeReview = JSON.stringify(stalledItem?.review ?? null);
      const beforeEventCount = frameWindow.WordLoverApp.getStudyEvents().length;
      const beforeDueCount = frameWindow.WordLoverApp.getDueVocabularyItems().length;
      await answerActiveVocabularyQuiz();
      clickFsrsRating("good");
      await new Promise((resolve) => setTimeout(resolve, 350));
      reviewDuePersistenceTimeoutDebug = frameWindow.WordLoverApp.reviewDebug.events().slice(-20);
      const afterTerm = frameWindow.WordLoverApp.getActiveQuiz()?.entry?.term ?? null;
      reviewDuePersistenceFailureSafe =
        afterTerm === stalledFirstTerm
        && JSON.stringify(stalledItem?.review ?? null) === beforeReview
        && frameWindow.WordLoverApp.getStudyEvents().length === beforeEventCount
        && frameWindow.WordLoverApp.getDueVocabularyItems().length === beforeDueCount
        && /Could not record this rating/i.test(frameDocument.querySelector("#quizPanel")?.textContent ?? "")
        && reviewDuePersistenceTimeoutDebug.some((event) => event.stage === "rating-persist-failed" && event.status === "timeout")
    } finally {
      frameWindow.WordLoverApp.reviewDebug.setPersistenceHookForTest(null);
    }
    for (const item of stalledReviewItems) item.archivedAt = new Date().toISOString();
    if (!reviewDuePersistenceFailureSafe) {
      throw new Error(`Review due should not advance or mutate state when persistence stalls. Debug: ${JSON.stringify(reviewDuePersistenceTimeoutDebug)}`);
    }

    const repairedReviewOne = await frameWindow.WordLoverApp.addUserDictionaryEntryForTest("review due repaired fsrs one", "review due repaired fsrs one meaning", "review due repaired fsrs one");
    const repairedReviewTwo = await frameWindow.WordLoverApp.addUserDictionaryEntryForTest("review due repaired fsrs two", "review due repaired fsrs two meaning", "review due repaired fsrs two");
    const repairedReviewItems = [];
    for (const entry of [repairedReviewOne, repairedReviewTwo]) {
      const item = await frameWindow.WordLoverApp.saveVocabularyItem(frameWindow.WordLoverApp.lookupTerm(entry.word), "debug-review-due-fsrs-repair");
      const dueAt = new Date(Date.now() - 3_000_000).toISOString();
      item.review.dueAt = dueAt;
      item.review.fsrsCard = { ...(item.review.fsrsCard ?? {}), due: dueAt };
      item.review.masteredAt = null;
      item.archivedAt = null;
      repairedReviewItems.push(item);
    }
    let reviewDueFsrsRepairStillAdvances = false;
    let reviewDueFsrsRepairDebug = null;
    let forcedScheduleFailures = 0;
    try {
      frameWindow.WordLoverApp.reviewDebug.clear();
      frameWindow.WordLoverApp.reviewDebug.setScheduleHookForTest(() => {
        forcedScheduleFailures += 1;
        if (forcedScheduleFailures === 1) throw new Error("forced FSRS scheduler failure");
      });
      await frameWindow.WordLoverApp.startDueReview();
      const repairedFirstTerm = await waitForVocabularyQuizTerm();
      await answerActiveVocabularyQuiz();
      clickFsrsRating("good");
      const repairedSecondTerm = await waitForVocabularyQuizTerm(repairedFirstTerm);
      reviewDueFsrsRepairDebug = frameWindow.WordLoverApp.reviewDebug.events().slice(-24);
      reviewDueFsrsRepairStillAdvances =
        Boolean(repairedSecondTerm && repairedSecondTerm !== repairedFirstTerm)
        && reviewDueFsrsRepairDebug.some((event) => event.stage === "fsrs-schedule-repair" && /forced FSRS scheduler failure/.test(event.error ?? ""))
        && reviewDueFsrsRepairDebug.some((event) => event.stage === "rating-recorded" && event.rating === "good");
    } finally {
      frameWindow.WordLoverApp.reviewDebug.setScheduleHookForTest(null);
    }
    for (const item of repairedReviewItems) item.archivedAt = new Date().toISOString();
    if (!reviewDueFsrsRepairStillAdvances) {
      throw new Error(`Review due should repair FSRS scheduling failures and advance. Debug: ${JSON.stringify(reviewDueFsrsRepairDebug)}`);
    }

    const dueSpelling = await frameWindow.WordLoverApp.saveSpellingItem(dueLookup, "debug-fsrs-due-test");
    dueSpelling.review.dueAt = duePast;
    dueSpelling.review.fsrsCard = { ...(dueSpelling.review.fsrsCard ?? {}), due: duePast };
    const spellingDueIncluded = frameWindow.WordLoverApp.getDueSpellingItems().some((item) => item.normalizedTerm === dueSpelling.normalizedTerm);
    if (!spellingDueIncluded) throw new Error("Spelling due queue should use the same dueAt scheduler semantics as vocabulary.");

    const waitForSpellingState = (predicate, message) => new Promise((resolve, reject) => {
      const startedAt = performance.now();
      const timer = window.setInterval(() => {
        const state = frameWindow.WordLoverApp.spelling.state();
        if (predicate(state)) {
          window.clearInterval(timer);
          resolve(state);
          return;
        }
        if (performance.now() - startedAt > 5000) {
          window.clearInterval(timer);
          reject(new Error(`${message}. State: ${JSON.stringify(state)}`));
        }
      }, 100);
    });
    const spellingFirstTryOne = await frameWindow.WordLoverApp.spelling.addItemForTest("spellingfirsttryone", "first try one meaning", "first try one");
    const spellingFirstTryTwo = await frameWindow.WordLoverApp.spelling.addItemForTest("spellingfirsttrytwo", "first try two meaning", "first try two");
    for (const item of [spellingFirstTryOne, spellingFirstTryTwo]) {
      item.review.dueAt = duePast;
      item.review.fsrsCard = { ...(item.review.fsrsCard ?? {}), due: duePast };
    }
    frameWindow.WordLoverApp.spelling.start();
    const spellingFirstTryBefore = frameWindow.WordLoverApp.spelling.state();
    if (!spellingFirstTryBefore?.currentTerm || spellingFirstTryBefore.queueLength < 2) throw new Error("Spelling first-try auto-advance test did not start a multi-word session.");
    if (!frameWindow.WordLoverApp.spelling.answerMatches(spellingFirstTryBefore.currentTerm.toUpperCase(), spellingFirstTryBefore.currentTerm)) {
      throw new Error("Spelling answer comparison should accept uppercase/lowercase variants.");
    }
    frameWindow.WordLoverApp.spelling.answer(spellingFirstTryBefore.currentTerm.toUpperCase());
    const spellingFirstTryAfter = await waitForSpellingState(
      (state) => state && state.completed >= 1 && state.currentTerm !== spellingFirstTryBefore.currentTerm,
      "Spelling did not auto-advance after a first-try correct answer with different capitalization",
    );
    frameWindow.WordLoverApp.spelling.close();

    const spellingRetryOne = await frameWindow.WordLoverApp.spelling.addItemForTest("spellingretryone", "retry one meaning", "retry one");
    const spellingRetryTwo = await frameWindow.WordLoverApp.spelling.addItemForTest("spellingretrytwo", "retry two meaning", "retry two");
    for (const item of [spellingRetryOne, spellingRetryTwo]) {
      item.review.dueAt = duePast;
      item.review.fsrsCard = { ...(item.review.fsrsCard ?? {}), due: duePast };
    }
    frameWindow.WordLoverApp.spelling.start();
    const spellingRetryBefore = frameWindow.WordLoverApp.spelling.state();
    if (!spellingRetryBefore?.currentTerm || spellingRetryBefore.queueLength < 2) throw new Error("Spelling retry design test did not start a multi-word session.");
    frameWindow.WordLoverApp.spelling.answer(`${spellingRetryBefore.currentTerm}-wrong`);
    if (!frameWindow.WordLoverApp.spelling.state()?.awaitingRetry) throw new Error("Spelling retry design test did not enter retry state after a wrong answer.");
    const strictWrongText = frameDocument.querySelector("#spellingFeedback")?.textContent ?? "";
    const spellingWrongHidesAnswer = !strictWrongText.includes(spellingRetryBefore.currentTerm) && /Try again/i.test(strictWrongText);
    click("[data-spelling-show-answer]");
    const spellingShowAnswerReveals = (frameDocument.querySelector("#spellingFeedback")?.textContent ?? "").includes(spellingRetryBefore.currentTerm);
    if (!spellingWrongHidesAnswer || !spellingShowAnswerReveals) {
      throw new Error(`Strict spelling feedback should hide answer until Show answer. Text: ${strictWrongText}`);
    }
    frameWindow.WordLoverApp.spelling.retry();
    frameWindow.WordLoverApp.spelling.answer(spellingRetryBefore.currentTerm);
    const spellingAfterOneRetryCorrect = await waitForSpellingState(
      (state) => state && !state.pausing && state.currentTerm === spellingRetryBefore.currentTerm && state.completed === 0 && state.consecutive === 1,
      "Spelling should require 3 correct answers in a row after a miss",
    );
    frameWindow.WordLoverApp.spelling.answer(spellingRetryBefore.currentTerm);
    await waitForSpellingState(
      (state) => state && !state.pausing && state.currentTerm === spellingRetryBefore.currentTerm && state.completed === 0 && state.consecutive === 2,
      "Spelling should still stay on the word after 2 retry-correct answers",
    );
    frameWindow.WordLoverApp.spelling.answer(spellingRetryBefore.currentTerm);
    const spellingRetryAfter = await waitForSpellingState(
      (state) => state && state.completed >= 1 && state.currentTerm !== spellingRetryBefore.currentTerm,
      "Spelling did not advance after 3 retry-correct answers",
    );
    const spellingRetryEvent = frameWindow.WordLoverApp
      .getSpellingEvents()
      .find((event) => event.normalizedTerm === spellingRetryBefore.currentTerm && event.type === "review");
    if (!spellingRetryEvent || spellingRetryEvent.rating !== "good") {
      throw new Error(`Spelling retry completion should record retry-based rating. Event: ${JSON.stringify(spellingRetryEvent)}`);
    }

    const spellingPersistFailOne = await frameWindow.WordLoverApp.spelling.addItemForTest("spellingpersistfailone", "persist fail one meaning", "persist fail one");
    const spellingPersistFailTwo = await frameWindow.WordLoverApp.spelling.addItemForTest("spellingpersistfailtwo", "persist fail two meaning", "persist fail two");
    for (const item of [spellingPersistFailOne, spellingPersistFailTwo]) {
      item.review.dueAt = duePast;
      item.review.fsrsCard = { ...(item.review.fsrsCard ?? {}), due: duePast };
    }
    let spellingPersistenceFailureSafe = false;
    try {
      frameWindow.WordLoverApp.reviewDebug.setPersistenceHookForTest((details) => {
        if (details?.track === "spelling") throw new Error("forced spelling persistence failure");
      }, 150);
      frameWindow.WordLoverApp.spelling.start();
      const before = frameWindow.WordLoverApp.spelling.state();
      const beforeSpellingEvents = frameWindow.WordLoverApp.getSpellingEvents().length;
      const beforeReview = JSON.stringify(frameWindow.WordLoverApp.getSpelling().find((item) => item.term === before.currentTerm)?.review ?? null);
      frameWindow.WordLoverApp.spelling.answer(before.currentTerm);
      await new Promise((resolve) => setTimeout(resolve, 1300));
      const after = frameWindow.WordLoverApp.spelling.state();
      const afterReview = JSON.stringify(frameWindow.WordLoverApp.getSpelling().find((item) => item.term === before.currentTerm)?.review ?? null);
      spellingPersistenceFailureSafe =
        after?.currentTerm === before.currentTerm
        && after?.completed === 0
        && frameWindow.WordLoverApp.getSpellingEvents().length === beforeSpellingEvents
        && afterReview === beforeReview
        && /Could not save this spelling review/i.test(frameDocument.querySelector("#spellingFeedback")?.textContent ?? "");
    } finally {
      frameWindow.WordLoverApp.reviewDebug.setPersistenceHookForTest(null);
      frameWindow.WordLoverApp.spelling.close();
    }
    if (!spellingPersistenceFailureSafe) {
      throw new Error("Spelling persistence failure should not advance, count completion, or mutate review state.");
    }

    const snapshotIntegrity = frameWindow.WordLoverApp.validateSnapshot(frameWindow.WordLoverApp.buildUserDataSnapshot());
    const snapshotIntegrityIncludesSpelling =
      snapshotIntegrity.spellingCount === frameWindow.WordLoverApp.getSpelling().length
      && snapshotIntegrity.spellingEventCount === frameWindow.WordLoverApp.getSpellingEvents().length
      && typeof snapshotIntegrity.checksum === "string"
      && snapshotIntegrity.checksum.length > 0;
    if (!snapshotIntegrityIncludesSpelling) {
      throw new Error(`Snapshot integrity should include spelling data: ${JSON.stringify(snapshotIntegrity)}`);
    }

    frameWindow.WordLoverApp.refreshReviewScheduleViews();
    const refreshedReviewText = frameDocument.querySelector("#startReview")?.textContent ?? "";
    if (!refreshedReviewText) throw new Error("Review schedule refresh did not leave a valid review button state.");
    const applyBeforeCheck = await frameWindow.WordLoverApp.applyAppUpdate({ reload: false });
    const applyBeforeCheckStatusText = frameDocument.querySelector("#updateStatus")?.textContent ?? "";
    if (applyBeforeCheck?.status !== "no-update" || !/Check update first/i.test(applyBeforeCheckStatusText)) {
      throw new Error(`Apply before Check update should show the no-update guidance: ${JSON.stringify({ applyBeforeCheck, applyBeforeCheckStatusText })}`);
    }
    const updateCheckResult = await frameWindow.WordLoverApp.checkForAppUpdate();
    const updateStatusText = frameDocument.querySelector("#updateStatus")?.textContent ?? "";
    if (/Failed to fetch|Could not check the server app version/i.test(updateStatusText)) {
      throw new Error(`App update check failed in main app smoke: ${updateStatusText}`);
    }
    const expectedAppVersion = frameWindow.WordLoverApp.getState().appVersion;
    if (!updateStatusText.includes(expectedAppVersion) && updateCheckResult?.deviceVersion !== expectedAppVersion) {
      throw new Error(`App update check did not expose the current shell version: ${JSON.stringify({ expectedAppVersion, updateCheckResult, updateStatusText })}`);
    }
    const applyAfterCheck = await frameWindow.WordLoverApp.applyAppUpdate({ reload: false });
    if (!["reload", "skip-waiting"].includes(applyAfterCheck?.status)) {
      throw new Error(`Apply after Check update should be actionable, not stuck: ${JSON.stringify({ applyAfterCheck, updateStatusText })}`);
    }

    return {
      passed: Boolean(firstTerm && secondTerm && firstTerm !== secondTerm),
      firstTerm,
      secondTerm,
      studyOneMoreMemorizeSaved: true,
      studyOneMoreSpellingSaved: true,
      studyOneMoreTests,
      studyOneMoreShowsImmediateLoading,
      reviewSchedulingTests,
      eventSourcedMergeRebuiltFsrs,
      eventDeduplicationWorks,
      persistAllDeletesStaleRecords,
      persistAllPreservesArchivedRecords,
      uiPreferencesSurviveReload,
      googleExpiredSessionAutoReconnectMessage,
      localDateKeyUsesLocalTime,
      historyWritesBothTimestampFields,
      historyMergeUsesSearchedAtFallback,
      goalsMergeUsesNewerUpdatedAt,
      goalsMergeFallsBackToNewerSnapshot,
      goalsRestoredImmediately,
      goalsRestoreSurvivesReload,
      goalSettingsPersistNewFields,
      goalForecastUsesFsrs,
      olderSnapshotWithoutGoalsStable,
      cloudBackupIsPlainJson,
      plainCloudBackupRoundTrips,
      legacyV1RejectedAsLegacy,
      legacyV2RejectedAsLegacy,
      noPassphraseElement,
      currentSnapshotValidates,
      oldSnapshotValidates,
      wrongAppRejected,
      dangerousEventRejected,
      restoreFailurePreservesLocalData,
      applyBeforeCheckStatus: applyBeforeCheck?.status,
      applyAfterCheckStatus: applyAfterCheck?.status,
      updateCheckStatus: updateCheckResult?.status,
      studyOneMoreMissCreatesAgainReview,
      studyOneMoreInitialAddToKnownPresent,
      studyOneMoreAddToKnownAutoAdvances,
      studyOneMoreAddToSpellingAutoAdvances,
      studyOneMoreAddToMemorizeAutoAdvances,
      studyOneMoreInitialAddToKnownWorks,
      inkQuizCorrectReadable,
      inkQuizIncorrectReadable,
      studyOneMoreFilterPersists: true,
      todayMemorizeStatsSplit,
      todaySpellingStatsSplit,
      firstQuizIpa,
      vocabularyStatsRendered: true,
      againCount,
      pageWordCount: wordButtons.length,
      visibleIpaCount,
      archivedExcluded,
      masteredDueIncluded,
      reviewDueRatingButtonsVisible,
      reviewDueWaitsForManualRating,
      reviewDueRevealAutoFocus,
      reviewDueOptionKeyboardLabels,
      reviewDueKeyboardOptionSelects,
      reviewDueRecommendedRatingFocus,
      reviewDueArrowRatingNavigation,
      reviewDueButtonCountDecreases,
      reviewDueManualRatingAdvancesPastSecondWord,
      reviewDuePersistenceFailureSafe,
      reviewDueFsrsRepairStillAdvances,
      spellingDueIncluded,
      snapshotIntegrityIncludesSpelling,
      spellingAutoAdvanceAfterFirstTry: Boolean(spellingFirstTryAfter),
      spellingRequiresThreeCorrectAfterMiss: Boolean(spellingAfterOneRetryCorrect && spellingRetryAfter),
      spellingWrongHidesAnswer,
      spellingShowAnswerReveals,
      spellingPersistenceFailureSafe,
      detailRevealedAfterClick: true,
      refreshedReviewText,
      updateStatusText,
    };
  } finally {
    frame.remove();
  }
}

async function runUpgradeVocabularyMergeSmoke() {
  const previousLegacy = await getAppStoreValue(APP_KV_STORE, "vocabularyItems", undefined);
  const now = new Date().toISOString();
  const legacyOnly = {
    term: "upgrade legacy only",
    normalizedTerm: "upgrade legacy only",
    savedAt: now,
    updatedAt: now,
    archivedAt: null,
    original: { phonetic: "legacy", englishMeanings: ["legacy meaning"], englishMeaningSource: "test", chineseMeanings: ["legacy"], tags: [] },
    user: { phonetic: "legacy", englishMeanings: ["legacy meaning"], chineseMeanings: ["legacy"] },
    review: { lastRating: "again", dueAt: now, reviewCount: 0 },
  };
  const recordOnly = {
    term: "upgrade record only",
    normalizedTerm: "upgrade record only",
    savedAt: now,
    updatedAt: now,
    archivedAt: null,
    original: { phonetic: "record", englishMeanings: ["record meaning"], englishMeaningSource: "test", chineseMeanings: ["record"], tags: [] },
    user: { phonetic: "record", englishMeanings: ["record meaning"], chineseMeanings: ["record"] },
    review: { lastRating: "again", dueAt: now, reviewCount: 0 },
  };

  await putAppStoreValue(APP_KV_STORE, "vocabularyItems", [legacyOnly]);
  await putAppStoreValue(APP_VOCABULARY_STORE, recordOnly.normalizedTerm, recordOnly);

  const frame = document.createElement("iframe");
  frame.hidden = true;
  frame.src = `/?suite-upgrade-merge=${Date.now()}`;
  document.body.append(frame);
  try {
    const state = await new Promise((resolve, reject) => {
      const startedAt = performance.now();
      const timer = window.setInterval(() => {
        unlockMainAppFrame(frame);
        const app = frame.contentWindow?.WordLoverApp;
        const currentState = app?.getState?.();
        if (currentState?.vocabularyItems?.some((item) => item.normalizedTerm === legacyOnly.normalizedTerm)
          && currentState?.vocabularyItems?.some((item) => item.normalizedTerm === recordOnly.normalizedTerm)) {
          window.clearInterval(timer);
          resolve(currentState);
          return;
        }
        if (performance.now() - startedAt > 20000) {
          window.clearInterval(timer);
          reject(new Error("Upgrade merge smoke did not load both legacy and record vocabulary items."));
        }
      }, 250);
    });
    return {
      passed: true,
      legacyOnlyPresent: state.vocabularyItems.some((item) => item.normalizedTerm === legacyOnly.normalizedTerm),
      recordOnlyPresent: state.vocabularyItems.some((item) => item.normalizedTerm === recordOnly.normalizedTerm),
    };
  } finally {
    frame.remove();
    await deleteAppStoreValue(APP_VOCABULARY_STORE, legacyOnly.normalizedTerm);
    await deleteAppStoreValue(APP_VOCABULARY_STORE, recordOnly.normalizedTerm);
    if (previousLegacy === undefined) await deleteAppStoreValue(APP_KV_STORE, "vocabularyItems");
    else await putAppStoreValue(APP_KV_STORE, "vocabularyItems", previousLegacy);
  }
}

async function runCheckpointRollbackSmoke() {
  const frame = document.createElement("iframe");
  frame.hidden = true;
  frame.src = `/?suite-checkpoint-rollback=${Date.now()}`;
  document.body.append(frame);
  try {
    await new Promise((resolve, reject) => {
      const startedAt = performance.now();
      const timer = window.setInterval(() => {
        unlockMainAppFrame(frame);
        const app = frame.contentWindow?.WordLoverApp;
        if (app?.getState?.().loaded) {
          window.clearInterval(timer);
          resolve();
          return;
        }
        if (performance.now() - startedAt > 60000) {
          window.clearInterval(timer);
          reject(new Error("Checkpoint rollback smoke timed out waiting for the app to load."));
        }
      }, 250);
    });
    const app = frame.contentWindow.WordLoverApp;
    const beforeTerms = new Set(app.getState().vocabularyItems.map((item) => item.normalizedTerm));
    await app.createCheckpoint("automation-rollback");
    const candidate = ["capacity", "temporary", "sufficient", "evidence"].find((term) => !beforeTerms.has(normalizeTerm(term))) ?? "capacity";
    const lookup = app.lookupTerm(candidate);
    if (lookup.status !== "found") throw new Error(`Checkpoint rollback smoke lookup failed for ${candidate}.`);
    await app.saveVocabularyItem(lookup, "checkpoint-rollback-test");
    if (!app.getState().vocabularyItems.some((item) => item.normalizedTerm === normalizeTerm(candidate))) {
      throw new Error("Checkpoint rollback smoke did not save the candidate word.");
    }
    const rollbackPromise = app.rollbackLatestCheckpoint();
    await new Promise((resolve, reject) => {
      const startedAt = performance.now();
      const timer = window.setInterval(() => {
        const submit = frame.contentDocument?.querySelector("[data-modal-submit]");
        if (submit) {
          submit.click();
          window.clearInterval(timer);
          resolve();
          return;
        }
        if (performance.now() - startedAt > 10000) {
          window.clearInterval(timer);
          reject(new Error("Checkpoint rollback smoke did not show rollback confirmation."));
        }
      }, 100);
    });
    await rollbackPromise;
    const afterRollbackTerms = new Set(app.getState().vocabularyItems.map((item) => item.normalizedTerm));
    return {
      passed: !afterRollbackTerms.has(normalizeTerm(candidate)) && afterRollbackTerms.size === beforeTerms.size,
      candidate,
      beforeCount: beforeTerms.size,
      afterRollbackCount: afterRollbackTerms.size,
      checkpointCount: (await app.listCheckpoints()).length,
    };
  } finally {
    frame.remove();
  }
}

async function runEarlyPracticePersistenceTest() {
  const frame = document.createElement("iframe");
  frame.hidden = true;
  frame.src = `/?suite-early-practice-persist=${Date.now()}`;
  document.body.append(frame);
  try {
    await new Promise((resolve, reject) => {
      const startedAt = performance.now();
      const timer = window.setInterval(() => {
        unlockMainAppFrame(frame);
        const app = frame.contentWindow?.WordLoverApp;
        if (app?.getState?.().loaded) {
          window.clearInterval(timer);
          resolve();
          return;
        }
        if (performance.now() - startedAt > 60000) {
          window.clearInterval(timer);
          reject(new Error("Early practice persistence test timed out waiting for app load."));
        }
      }, 250);
    });

    const app = frame.contentWindow.WordLoverApp;
    const entry = await app.addUserDictionaryEntryForTest("early practice persist word", "a test definition", "测试定义");
    const lookup = app.lookupTerm(entry.word);
    if (lookup.status !== "found") throw new Error("Early practice persistence: dictionary lookup failed.");
    const item = await app.saveVocabularyItem(lookup, "early-practice-persist-test");

    const futureIso = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    item.review.dueAt = futureIso;
    item.review.intervalDays = 10;
    item.review.fsrsCard = { ...(item.review.fsrsCard ?? {}), due: futureIso };
    await app.persistVocabularyItemForTest(item);
    const itemStoreKey = item.learningTrackId ? `${item.learningTrackId}::${item.normalizedTerm}` : item.normalizedTerm;

    const originalDueAt = item.review.dueAt;
    const originalIntervalDays = item.review.intervalDays;
    const originalFsrsReps = item.review.fsrsCard?.reps ?? 0;
    // Capture the encrypted blob now; since AES-GCM uses a random IV each write,
    // an identical blob after practice means the record was never re-written.
    const blobAfterSetup = await getAppStoreValue(APP_VOCABULARY_STORE, itemStoreKey);

    // Practice pass/hard → early-practice-record-only → event type "practice", item unchanged
    await app.recordReviewRating(item, "hard", "pass", 12000, "practice", "early-practice-persist-test");
    const eventsAfterPractice = app.getStudyEvents();
    const practiceEvent = eventsAfterPractice[eventsAfterPractice.length - 1];
    const practiceEventType = practiceEvent?.type;
    const practiceItemDueUnchanged = item.review.dueAt === originalDueAt;
    const practiceItemIntervalUnchanged = item.review.intervalDays === originalIntervalDays;
    const practiceItemFsrsUnchanged = (item.review.fsrsCard?.reps ?? 0) === originalFsrsReps;

    // Verify IndexedDB blob is unchanged after practice (data is AES-GCM encrypted;
    // a re-write produces a new random IV, so an identical blob = no write occurred).
    const blobAfterPractice = await getAppStoreValue(APP_VOCABULARY_STORE, itemStoreKey);
    const practiceNotUpdatedInDb = JSON.stringify(blobAfterPractice) === JSON.stringify(blobAfterSetup);

    // Practice again/miss → early-practice-full-failure → event type "review", item updated
    await app.recordReviewRating(item, "again", "miss", 5000, "practice", "early-practice-fail-test");
    const eventsAfterFail = app.getStudyEvents();
    const failEvent = eventsAfterFail[eventsAfterFail.length - 1];
    const failEventType = failEvent?.type;
    const failItemDueChanged = item.review.dueAt !== originalDueAt;

    // Verify IndexedDB blob changed after full review (new encrypted write = different blob).
    const blobAfterFail = await getAppStoreValue(APP_VOCABULARY_STORE, itemStoreKey);
    const failUpdatedInDb = JSON.stringify(blobAfterFail) !== JSON.stringify(blobAfterSetup);

    return {
      passed: practiceEventType === "practice" && practiceItemDueUnchanged && practiceItemIntervalUnchanged && practiceItemFsrsUnchanged && practiceNotUpdatedInDb && failEventType === "review" && failItemDueChanged && failUpdatedInDb,
      practiceEventType,
      failEventType,
      practiceItemDueUnchanged,
      practiceItemIntervalUnchanged,
      practiceItemFsrsUnchanged,
      practiceNotUpdatedInDb,
      failItemDueChanged,
      failUpdatedInDb,
    };
  } finally {
    frame.remove();
  }
}

// Apostrophe handling across every word-input surface: validation, lookup, user-dictionary,
// vocabulary/spelling save, spelling answer matching, and the AI-quiz comparison logic.
// Contractions ("it's", "they're") and curly/variant apostrophes ("it’s") must behave identically.
async function runApostropheHandlingTest() {
  const frame = document.createElement("iframe");
  frame.hidden = true;
  frame.src = `/?suite-apostrophe=${Date.now()}`;
  document.body.append(frame);
  try {
    await new Promise((resolve, reject) => {
      const startedAt = performance.now();
      const timer = window.setInterval(() => {
        unlockMainAppFrame(frame);
        const app = frame.contentWindow?.WordLoverApp;
        if (app?.getState?.().loaded) {
          window.clearInterval(timer);
          resolve();
          return;
        }
        if (performance.now() - startedAt > 60000) {
          window.clearInterval(timer);
          reject(new Error("Apostrophe handling test timed out waiting for app load."));
        }
      }, 250);
    });

    const app = frame.contentWindow.WordLoverApp;

    // 1. Contractions and apostrophe variants are valid input (never invalid_input).
    const validContractions = ["it's", "they're", "it’s", "they’re", "don’t", "don`t", "itʼs", "it＇s"];
    const allContractionsValid = validContractions.every((term) => app.isValidEnglishTerm(term) === true);
    // Punctuation must still be rejected; leading/trailing separators are not allowed.
    const rejectsBadInput = [
      "'word",
      "word'",
      "-word",
      "word.",
      "wo!rd",
      "",
    ].every((term) => app.isValidEnglishTerm(term) === false);

    // 2. All apostrophe variants normalize to ASCII "'".
    const normalizesVariants = ["it’s", "it`s", "itʼs", "it＇s", "IT'S", "  it's  "]
      .every((term) => app.normalizeTerm(term) === "it's");

    // 3. The duplicate test-harness normalizeTerm/TERM_RE stays in lockstep with the app.
    const harnessParity = validContractions.every((term) =>
      normalizeTerm(term) === app.normalizeTerm(term) && TERM_RE.test(normalizeTerm(term)));

    // 4. A user-dictionary contraction normalizes, persists, and is searchable via straight + curly forms.
    await app.addUserDictionaryEntryForTest("it's", "used in the third person singular present", "它是");
    const userDictHasContraction = app.getUserDictionary().some((entry) => entry.normalizedTerm === "it's");
    const straightLookup = app.lookupTerm("it's");
    const curlyLookup = app.lookupTerm("it’s");
    const contractionSearchable = straightLookup.status === "found" && curlyLookup.status === "found";

    // 5. Saveable to vocabulary and to the spelling list.
    const vocabItem = await app.saveVocabularyItem(straightLookup, "apostrophe-test");
    const savedToVocabulary = Boolean(vocabItem) && app.getVocabulary().some((item) => item.normalizedTerm === "it's");
    const spellingItem = await app.saveSpellingItem(straightLookup, "apostrophe-test");
    const savedToSpelling = Boolean(spellingItem) && app.getSpelling().some((item) => item.normalizedTerm === "it's");

    // 6. Spelling review accepts both straight and curly apostrophes; case is ignored; "its" is not "it's".
    const spellingAccepts = app.spelling.answerMatches("it's", "it's") === true
      && app.spelling.answerMatches("it’s", "it's") === true
      && app.spelling.answerMatches("IT'S", "it's") === true
      && app.spelling.answerMatches("its", "it's") === false;

    // 7. AI-quiz word answers compare via normalizeTerm (same logic #aiFillInput / #aiZhEnInput use):
    //    a curly-apostrophe answer must equal the straight-apostrophe target.
    const aiQuizMatches = app.normalizeTerm("it’s") === app.normalizeTerm("it's")
      && app.normalizeTerm("THEY’RE") === app.normalizeTerm("they're");

    const passed = allContractionsValid && rejectsBadInput && normalizesVariants && harnessParity
      && userDictHasContraction && contractionSearchable && savedToVocabulary && savedToSpelling
      && spellingAccepts && aiQuizMatches;

    return {
      passed,
      allContractionsValid,
      rejectsBadInput,
      normalizesVariants,
      harnessParity,
      userDictHasContraction,
      contractionSearchable,
      straightLookupStatus: straightLookup.status,
      curlyLookupStatus: curlyLookup.status,
      savedToVocabulary,
      savedToSpelling,
      spellingAccepts,
      aiQuizMatches,
    };
  } finally {
    frame.remove();
  }
}

async function runStudyOneMoreSkipCooldownTest() {
  const frame = document.createElement("iframe");
  frame.hidden = true;
  frame.src = `/?suite-skip-cooldown=${Date.now()}`;
  document.body.append(frame);
  try {
    await new Promise((resolve, reject) => {
      const startedAt = performance.now();
      const timer = window.setInterval(() => {
        unlockMainAppFrame(frame);
        const app = frame.contentWindow?.WordLoverApp;
        if (app?.getState?.().loaded) {
          window.clearInterval(timer);
          resolve();
          return;
        }
        if (performance.now() - startedAt > 60000) {
          window.clearInterval(timer);
          reject(new Error("Skip cooldown test timed out waiting for app load."));
        }
      }, 250);
    });

    const app = frame.contentWindow.WordLoverApp;
    const cooldownDays = app.studyOneMore.SKIP_COOLDOWN_DAYS;
    const nowMs = Date.now();
    const msPerDay = 24 * 60 * 60 * 1000;

    const makeEvent = (term, type, daysAgo) => ({
      id: `test-event-${term}-${daysAgo}`,
      type,
      normalizedTerm: term,
      occurredAt: new Date(nowMs - daysAgo * msPerDay).toISOString(),
      track: "vocabulary",
    });

    // Skipped today → excluded
    const skippedTodayEvent = makeEvent("skiptest_today", "study-one-more-skipped", 0);
    const exclusionsTodaySkip = app.studyOneMore.buildExclusionSets({
      vocabulary: [], spelling: [], events: [skippedTodayEvent], known: [],
    });
    const skippedTodayExcluded = exclusionsTodaySkip.skippedRecently.has("skiptest_today");

    // Skipped 7 days ago (within cooldown) → excluded
    const skippedMidCooldownEvent = makeEvent("skiptest_mid", "study-one-more-skipped", 7);
    const exclusionsMidCooldown = app.studyOneMore.buildExclusionSets({
      vocabulary: [], spelling: [], events: [skippedMidCooldownEvent], known: [],
    });
    const skippedMidCooldownExcluded = exclusionsMidCooldown.skippedRecently.has("skiptest_mid");

    // Skipped cooldown+1 days ago (after cooldown) → included
    const skippedAfterCooldownEvent = makeEvent("skiptest_old", "study-one-more-skipped", cooldownDays + 1);
    const exclusionsAfterCooldown = app.studyOneMore.buildExclusionSets({
      vocabulary: [], spelling: [], events: [skippedAfterCooldownEvent], known: [],
    });
    const skippedAfterCooldownIncluded = !exclusionsAfterCooldown.skippedRecently.has("skiptest_old");

    // Permanently ignored via ignoredAt on vocabulary item → in archivedIgnoredOrMastered
    const ignoredItem = { normalizedTerm: "ignoretest_word", ignoredAt: new Date().toISOString(), archivedAt: new Date().toISOString() };
    const exclusionsIgnored = app.studyOneMore.buildExclusionSets({
      vocabulary: [ignoredItem], spelling: [], events: [], known: [],
    });
    const ignoredWordExcluded = exclusionsIgnored.archivedIgnoredOrMastered.has("ignoretest_word");

    return {
      passed: skippedTodayExcluded && skippedMidCooldownExcluded && skippedAfterCooldownIncluded && ignoredWordExcluded,
      cooldownDays,
      skippedTodayExcluded,
      skippedMidCooldownExcluded,
      skippedAfterCooldownIncluded,
      ignoredWordExcluded,
    };
  } finally {
    frame.remove();
  }
}

async function collectDeviceDiagnostics() {
  const storageEstimate = navigator.storage?.estimate ? await navigator.storage.estimate() : null;
  const persistedBefore = navigator.storage?.persisted ? await navigator.storage.persisted() : null;
  const persistGranted = navigator.storage?.persist ? await navigator.storage.persist() : null;
  const persistedAfter = navigator.storage?.persisted ? await navigator.storage.persisted() : null;
  const userAgent = navigator.userAgent;
  return {
    userAgent,
    platform: navigator.platform,
    secureContext: window.isSecureContext,
    displayMode: window.matchMedia("(display-mode: standalone)").matches
      ? "standalone"
      : window.navigator.standalone
        ? "ios-standalone"
        : "browser",
    indexedDb: "indexedDB" in window,
    webAssembly: "WebAssembly" in window,
    webCrypto: Boolean(crypto?.subtle),
    opfs: Boolean(navigator.storage?.getDirectory),
    storagePersistedBefore: persistedBefore,
    storagePersistRequestResult: persistGranted,
    storagePersistedAfter: persistedAfter,
    storageEstimate,
    isAndroid: /Android/i.test(userAgent),
    isIphoneOrIpad: /iPhone|iPad/i.test(userAgent),
  };
}

async function runManualExportFieldsTest() {
  const frame = document.createElement("iframe");
  frame.hidden = true;
  frame.src = `/?suite-export-fields=${Date.now()}`;
  document.body.append(frame);
  try {
    await new Promise((resolve, reject) => {
      const startedAt = performance.now();
      const timer = window.setInterval(() => {
        unlockMainAppFrame(frame);
        const app = frame.contentWindow?.WordLoverApp;
        if (app?.getState?.().loaded) {
          window.clearInterval(timer);
          resolve();
          return;
        }
        if (performance.now() - startedAt > 60000) {
          window.clearInterval(timer);
          reject(new Error("Manual export fields test timed out waiting for app load."));
        }
      }, 250);
    });

    const snapshot = frame.contentWindow.WordLoverApp.buildUserDataSnapshot();
    const hasKnownWords = "knownWords" in snapshot && Array.isArray(snapshot.knownWords);
    const hasUiPreferencesStudyOneMoreLevel = snapshot.uiPreferences != null && "studyOneMoreFilter" in snapshot.uiPreferences;
    const hasStudyGoals = "studyGoals" in snapshot;
    const hasTheme = "theme" in snapshot;
    const hasVocabularyItems = "vocabularyItems" in snapshot && Array.isArray(snapshot.vocabularyItems);
    const hasStudyEvents = "studyEvents" in snapshot && Array.isArray(snapshot.studyEvents);
    const hasSpellingItems = "spellingItems" in snapshot && Array.isArray(snapshot.spellingItems);
    const hasSpellingEvents = "spellingEvents" in snapshot && Array.isArray(snapshot.spellingEvents);

    const passed = hasKnownWords && hasUiPreferencesStudyOneMoreLevel && hasStudyGoals && hasTheme
      && hasVocabularyItems && hasStudyEvents && hasSpellingItems && hasSpellingEvents;
    if (!passed) {
      throw new Error(`Manual export snapshot missing required fields: ${JSON.stringify({ hasKnownWords, hasUiPreferencesStudyOneMoreLevel, hasStudyGoals, hasTheme, hasVocabularyItems, hasStudyEvents, hasSpellingItems, hasSpellingEvents })}`);
    }
    return { passed, hasKnownWords, hasUiPreferencesStudyOneMoreLevel, hasStudyGoals, hasTheme, hasVocabularyItems, hasStudyEvents, hasSpellingItems, hasSpellingEvents };
  } finally {
    frame.remove();
  }
}

async function runLearningTracksImportExportTest() {
  const frame = document.createElement("iframe");
  frame.hidden = true;
  frame.src = `/?suite-learning-tracks-import=${Date.now()}`;
  document.body.append(frame);
  try {
    await new Promise((resolve, reject) => {
      const startedAt = performance.now();
      const timer = window.setInterval(() => {
        unlockMainAppFrame(frame);
        const app = frame.contentWindow?.WordLoverApp;
        if (app?.getState?.().loaded && app?.learningTracks?.exportBackupForTest) {
          window.clearInterval(timer);
          resolve();
          return;
        }
        if (performance.now() - startedAt > 60000) {
          window.clearInterval(timer);
          reject(new Error("Learning tracks import/export test timed out waiting for app load."));
        }
      }, 250);
    });

    const app = frame.contentWindow.WordLoverApp;
    const FileCtor = frame.contentWindow.File;
    const catchesAsync = async (fn) => {
      try {
        await fn();
        return false;
      } catch {
        return true;
      }
    };
    const beforeRoot = app.learningTracks.rootForTest();
    const beforeTrackIds = Object.keys(beforeRoot?.tracks ?? {});
    const entry = await app.addUserDictionaryEntryForTest("learning tracks import fsrs", "fsrs import definition", "fsrs import");
    const item = await app.saveVocabularyItem(app.lookupTerm(entry.word), "learning-tracks-import-test");
    item.review = {
      ...(item.review ?? {}),
      dueAt: "2026-07-01T00:00:00.000Z",
      lastReviewedAt: "2026-06-01T00:00:00.000Z",
      lastRating: "good",
      intervalDays: 30,
      reviewCount: 12,
      fsrsCard: {
        ...(item.review?.fsrsCard ?? {}),
        due: "2026-07-01T00:00:00.000Z",
        stability: 12.345,
        difficulty: 6.789,
        reps: 12,
        scheduled_days: 30,
        scheduledDays: 30,
      },
    };
    await app.persistVocabularyItemForTest(item);
    const backup = await app.learningTracks.exportBackupForTest();
    const exportedSchemaOk = backup.app === "WordFan" && backup.schemaVersion === 1 && Object.keys(backup.tracks ?? {}).length >= 1;

    const rejectedInvalidJson = await catchesAsync(() => app.learningTracks.importForTest(new FileCtor(["{"], "bad.json", { type: "application/json" })));
    const rejectedUnsupportedVersion = await catchesAsync(() => app.learningTracks.importForTest(new FileCtor([JSON.stringify({ ...backup, schemaVersion: 99 })], "bad-version.json", { type: "application/json" })));
    const malformedItemBackup = JSON.parse(JSON.stringify(backup));
    malformedItemBackup.tracks[malformedItemBackup.activeTrackId].wordLists.vocabulary[0].review.lastRating = "easyy";
    const rejectedMalformedRecord = await catchesAsync(() => app.learningTracks.importForTest(new FileCtor([JSON.stringify(malformedItemBackup)], "bad-record.json", { type: "application/json" })));
    const malformedEventBackup = JSON.parse(JSON.stringify(backup));
    malformedEventBackup.tracks[malformedEventBackup.activeTrackId].reviewLogs = [{ id: "bad", type: "review", term: "bad", rating: "easyy", occurredAt: "2026-06-01T00:00:00.000Z" }];
    const rejectedMalformedEvent = await catchesAsync(() => app.learningTracks.importForTest(new FileCtor([JSON.stringify(malformedEventBackup)], "bad-event.json", { type: "application/json" })));
    const oversizedFile = new FileCtor([new Uint8Array(25 * 1024 * 1024 + 1)], "too-large.json", { type: "application/json" });
    const rejectedOversized = await catchesAsync(() => app.learningTracks.importForTest(oversizedFile));

    const importResult = await app.learningTracks.importForTest(new FileCtor([JSON.stringify(backup)], "wordfan-backup.json", { type: "application/json" }));
    const afterRoot = app.learningTracks.rootForTest();
    const afterTrackIds = Object.keys(afterRoot?.tracks ?? {});
    const importedItem = app.getVocabulary().find((candidate) => candidate.normalizedTerm === item.normalizedTerm);
    const importedFsrsPreserved =
      importedItem?.review?.dueAt === item.review.dueAt
      && importedItem.review.fsrsCard?.stability === item.review.fsrsCard.stability
      && importedItem.review.fsrsCard?.difficulty === item.review.fsrsCard.difficulty
      && importedItem.review.reviewCount === item.review.reviewCount
      && importedItem.review.lastRating === item.review.lastRating;
    const importedAsNewTrack =
      importResult.importedCount >= 1
      && afterTrackIds.length > beforeTrackIds.length
      && beforeTrackIds.every((id) => afterRoot.tracks[id])
      && app.learningTracks.activeTrackIdForTest() === importResult.activeTrackId;

    const secondImport = await app.learningTracks.importForTest(new FileCtor([JSON.stringify(backup)], "wordfan-backup-again.json", { type: "application/json" }));
    const names = Object.values(app.learningTracks.rootForTest().tracks).map((track) => track.name);
    const duplicateNamesRenamed = new Set(names).size === names.length;
    const activeDeleteRejected = await catchesAsync(() => app.learningTracks.deleteForTest(app.learningTracks.activeTrackIdForTest()));
    await app.learningTracks.switchForTest(importResult.activeTrackId);
    await app.learningTracks.deleteForTest(secondImport.activeTrackId);
    const nonActiveDeleteWorked = !app.learningTracks.rootForTest().tracks[secondImport.activeTrackId];

    const savedAfterImportEntry = await app.addUserDictionaryEntryForTest("learning tracks encrypted save", "encrypted save definition", "encrypted save");
    const savedAfterImport = await app.saveVocabularyItem(app.lookupTerm(savedAfterImportEntry.word), "learning-tracks-post-import-save");
    const storedAfterImport = await getAppStoreValue(APP_VOCABULARY_STORE, `${app.learningTracks.activeTrackIdForTest()}::${savedAfterImport.normalizedTerm}`);
    const normalSaveEncrypted = isEncryptedRecord(storedAfterImport);

    // Per-track Study One More filter: each learning track keeps its own filter. Set filter A on
    // the original default track, filter B on the imported track, then switch back and confirm
    // each track restores its own filter (in memory and in the popup DOM).
    const trackA = beforeTrackIds[0];
    const trackB = importResult.activeTrackId;
    const filterDoc = frame.contentDocument;
    const popupFreqMin = () => filterDoc.querySelector("#filterIncludeFreqMin")?.value ?? "";
    const popupFreqMax = () => filterDoc.querySelector("#filterIncludeFreqMax")?.value ?? "";
    await app.learningTracks.switchForTest(trackA);
    await app.studyOneMore.setFilter({ includeFreqMin: 1000, includeFreqMax: 4000 });
    await app.learningTracks.switchForTest(trackB);
    await app.studyOneMore.setFilter({ includeFreqMin: 7000, includeFreqMax: 9000 });
    await app.learningTracks.switchForTest(trackA);
    const restoredFilterA = app.studyOneMore.getFilter();
    const perTrackFilterAOk =
      restoredFilterA.includeFreqMin === 1000
      && restoredFilterA.includeFreqMax === 4000
      && popupFreqMin() === "1000"
      && popupFreqMax() === "4000";
    await app.learningTracks.switchForTest(trackB);
    const restoredFilterB = app.studyOneMore.getFilter();
    const perTrackFilterBOk =
      restoredFilterB.includeFreqMin === 7000
      && restoredFilterB.includeFreqMax === 9000
      && popupFreqMin() === "7000"
      && popupFreqMax() === "9000";
    const perTrackStudyOneMoreFilter = perTrackFilterAOk && perTrackFilterBOk;
    if (!perTrackStudyOneMoreFilter) {
      throw new Error(`Per-track Study One More filter did not restore: ${JSON.stringify({ restoredFilterA, restoredFilterB, popup: { min: popupFreqMin(), max: popupFreqMax() } })}`);
    }

    return {
      passed: exportedSchemaOk
        && rejectedInvalidJson
        && rejectedUnsupportedVersion
        && rejectedMalformedRecord
        && rejectedMalformedEvent
        && rejectedOversized
        && importedAsNewTrack
        && importedFsrsPreserved
        && duplicateNamesRenamed
        && activeDeleteRejected
        && nonActiveDeleteWorked
        && normalSaveEncrypted
        && perTrackStudyOneMoreFilter,
      exportedSchemaOk,
      rejectedInvalidJson,
      rejectedUnsupportedVersion,
      rejectedMalformedRecord,
      rejectedMalformedEvent,
      rejectedOversized,
      importedAsNewTrack,
      importedFsrsPreserved,
      duplicateNamesRenamed,
      activeDeleteRejected,
      nonActiveDeleteWorked,
      normalSaveEncrypted,
      perTrackStudyOneMoreFilter,
      importResult,
    };
  } finally {
    frame.remove();
  }
}

function runModuleSmokeTests() {
  const failures = [];
  function assert(label, got, expected) {
    if (JSON.stringify(got) !== JSON.stringify(expected)) {
      failures.push(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(got)}`);
    }
  }

  // persistence.js
  const bytes = new Uint8Array([72, 101, 108, 108, 111]);
  const b64 = bytesToBase64(bytes);
  assert("bytesToBase64", b64, "SGVsbG8=");
  const roundTrip = base64ToBytes(b64);
  assert("base64ToBytes length", roundTrip.length, 5);
  assert("base64ToBytes[0]", roundTrip[0], 72);
  assert("checksumText is string", typeof checksumText("test"), "string");
  assert("checksumText length", checksumText("test").length, 8);
  assert("isEncryptedRecord false for plain obj", isEncryptedRecord({ foo: "bar" }), false);
  assert("isEncryptedRecord true for encrypted shape", isEncryptedRecord({ __encrypted: true, iv: "x", ciphertext: "y" }), true);

  // spelling.js
  assert("ratingFromRetries 0 => easy", ratingFromRetries(0), "easy");
  assert("ratingFromRetries 1 => good", ratingFromRetries(1), "good");
  assert("ratingFromRetries 2 => hard", ratingFromRetries(2), "hard");
  assert("ratingFromRetries 3 => again", ratingFromRetries(3), "again");
  assert("spellingThreshold 0 retries => 1", spellingThreshold(0), 1);
  assert("spellingThreshold 1 retry => 3", spellingThreshold(1), 3);

  // ui-preferences.js
  assert("normalizeTrack spelling", normalizeTrack("spelling"), "spelling");
  assert("normalizeTrack unknown", normalizeTrack("other"), "vocabulary");
  assert("normalizeHistoryGranularity weeks", normalizeHistoryGranularity("weeks"), "weeks");
  assert("normalizeHistoryGranularity invalid", normalizeHistoryGranularity("hourly"), "days");
  assert("normalizeGoalsPeriod week", normalizeGoalsPeriod("week"), "week");
  assert("normalizeGoalsPeriod invalid", normalizeGoalsPeriod("decade"), "day");
  assert("normalizeStudyOneMoreLevel valid", normalizeStudyOneMoreLevel("easy"), "easy");
  assert("normalizeStudyOneMoreLevel invalid", normalizeStudyOneMoreLevel("unknown"), "very_easy");
  assert("normalizeFontScale valid", normalizeFontScale(1.5), 1.5);
  assert("normalizeFontScale NaN => default", normalizeFontScale(NaN), DEFAULT_FONT_SCALE);
  assert("normalizeFontScale clamp high", normalizeFontScale(99), 2);
  assert("STUDY_ONE_MORE_LEVELS has 6 items", STUDY_ONE_MORE_LEVELS.length, 6);
  const prefs = normalizeUiPreferences({ todayTrack: "spelling" }, {});
  assert("normalizeUiPreferences todayTrack", prefs.todayTrack, "spelling");
  assert("normalizeUiPreferences vocabularyTrack default", prefs.vocabularyTrack, "vocabulary");

  // study-one-more.js
  assert("fallbackStudyOneMoreLevel very_easy", fallbackStudyOneMoreLevel({ frq: 100, normalizedTerm: "cat" }), "very_easy");
  assert("studyOneMoreLevelSql very_easy nonempty", studyOneMoreLevelSql("very_easy").length > 0, true);
  const exclusions = buildStudyOneMoreExclusionSets({
    vocabulary: [{ normalizedTerm: "cat", archivedAt: null }],
    spelling: [],
    events: [],
    known: [],
  });
  assert("buildStudyOneMoreExclusionSets memorizeTerms has cat", exclusions.memorizeTerms.has("cat"), true);
  assert("buildStudyOneMoreExclusionSets spellingTerms empty", exclusions.spellingTerms.size, 0);

  // sync.js
  assert("studyEventTrack vocabulary event", studyEventTrack({ track: "vocabulary" }), "vocabulary");
  assert("studyEventTrack spelling id prefix", studyEventTrack({ id: "spelling-123" }), "spelling");
  const merged = mergeStudyEventSources(
    [{ type: "review", normalizedTerm: "cat", occurredAt: "2025-01-02T00:00:00.000Z", rating: "good", id: "e1" }],
    [{ type: "review", normalizedTerm: "cat", occurredAt: "2025-01-01T00:00:00.000Z", rating: "hard", id: "e2" }],
  );
  assert("mergeStudyEventSources length", merged.length, 2);
  assert("mergeStudyEventSources sorted", merged[0].occurredAt < merged[1].occurredAt, true);
  const history = mergeHistoryItems(
    [{ term: "cat", queriedAt: "2025-01-02T00:00:00.000Z" }],
    [{ term: "cat", queriedAt: "2025-01-01T00:00:00.000Z" }],
  );
  assert("mergeHistoryItems keeps newer", history[0].queriedAt, "2025-01-02T00:00:00.000Z");
  const activeTerms = activeStudyTermsFromItems([{ normalizedTerm: "cat", archivedAt: null }], []);
  assert("activeStudyTermsFromItems", activeTerms.has("cat"), true);
  const known = mergeKnownSources(
    [{ normalizedTerm: "dog", knownAt: "2025-01-01T00:00:00.000Z" }],
    [],
    new Set(),
  );
  assert("mergeKnownSources length", known.length, 1);
  const vocabMerged = mergeVocabularySources(
    [{ term: "cat", normalizedTerm: "cat", savedAt: "2025-01-01T00:00:00.000Z", review: {} }],
    [],
  );
  assert("mergeVocabularySources length", vocabMerged.length, 1);
  assert("mergeVocabularySources normalizedTerm", vocabMerged[0].normalizedTerm, "cat");
  assert("mergeVocabularySources has review.dueAt", typeof vocabMerged[0].review?.dueAt, "string");
  const userDict = mergeUserDictionarySources(
    [{ word: "cat", normalizedTerm: "cat", updatedAt: "2025-01-02T00:00:00.000Z" }],
    [{ word: "cat", normalizedTerm: "cat", updatedAt: "2025-01-01T00:00:00.000Z" }],
  );
  assert("mergeUserDictionarySources deduped", userDict.length, 1);
  assert("mergeUserDictionarySources prefers newer", userDict[0].updatedAt, "2025-01-02T00:00:00.000Z");

  // goal-forecast.js — predictRating thresholds (deterministic, no userStats).
  assert("predictRating null retrievability => good", predictRating({}, null, {}), "good");
  assert("predictRating 0.95 => easy", predictRating({}, 0.95, {}), "easy");
  assert("predictRating 0.85 => good", predictRating({}, 0.85, {}), "good");
  assert("predictRating 0.70 => hard", predictRating({}, 0.7, {}), "hard");
  assert("predictRating 0.50 => again", predictRating({}, 0.5, {}), "again");

  // normalizeForecastInput clamps and defaults.
  const normInput = normalizeForecastInput({ dailyNewWords: 5, desiredRetention: 2, forecastDays: 1000 });
  assert("normalizeForecastInput defaults retention", normInput.desiredRetention, 0.9);
  assert("normalizeForecastInput clamps forecastDays", normInput.forecastDays, 90);
  assert("normalizeForecastInput goalMode default", normInput.goalMode, "new_words_first");

  // forecastGoalWorkload — shape, determinism, no card mutation, monotonicity.
  const forecastNow = Date.parse("2026-06-07T08:00:00.000Z");
  const seededCard = scheduleFromFsrsRating({}, "good", "2026-05-20T08:00:00.000Z");
  const reviewedCard = { fsrsCard: seededCard.fsrsCard, dueAt: seededCard.dueAt, reviewCount: 1 };
  const dueNewCard = { fsrsCard: null, dueAt: "2026-06-01T08:00:00.000Z", reviewCount: 0 };
  const sampleCards = [reviewedCard, dueNewCard];
  const cardsBefore = JSON.stringify(sampleCards);

  const baseForecast = forecastGoalWorkload(
    { dailyNewWords: 5, desiredRetention: 0.9, forecastDays: 30, startMs: forecastNow },
    sampleCards,
    {},
  );
  assert("forecast does not mutate input cards", JSON.stringify(sampleCards), cardsBefore);
  assert("forecast has dailyBreakdown length 30", baseForecast.dailyBreakdown.length, 30);
  assert("forecast exposes today due reviews number", typeof baseForecast.todayDueReviews, "number");
  assert("forecast minutes range has low and high", typeof baseForecast.estimatedMinutesPerDay.low === "number" && typeof baseForecast.estimatedMinutesPerDay.high === "number", true);
  assert("forecast is deterministic", JSON.stringify(forecastGoalWorkload({ dailyNewWords: 5, desiredRetention: 0.9, forecastDays: 30, startMs: forecastNow }, sampleCards, {})), JSON.stringify(baseForecast));

  const lowNewWords = forecastGoalWorkload({ dailyNewWords: 2, desiredRetention: 0.9, forecastDays: 30, startMs: forecastNow }, sampleCards, {});
  const highNewWords = forecastGoalWorkload({ dailyNewWords: 20, desiredRetention: 0.9, forecastDays: 30, startMs: forecastNow }, sampleCards, {});
  assert("more daily new words => higher avg review load", highNewWords.avgReviews30Days > lowNewWords.avgReviews30Days, true);

  const lowRetention = forecastGoalWorkload({ dailyNewWords: 10, desiredRetention: 0.8, forecastDays: 30, startMs: forecastNow }, sampleCards, {});
  const highRetention = forecastGoalWorkload({ dailyNewWords: 10, desiredRetention: 0.95, forecastDays: 30, startMs: forecastNow }, sampleCards, {});
  assert("higher desired retention => at least as many reviews", highRetention.avgReviews30Days >= lowRetention.avgReviews30Days, true);

  const heavyForecast = forecastGoalWorkload({ dailyNewWords: 50, desiredRetention: 0.95, forecastDays: 30, maxStudyMinutesPerDay: 5, startMs: forecastNow }, sampleCards, {});
  assert("heavy goal is flagged heavy or too_heavy", heavyForecast.sustainability === "heavy" || heavyForecast.sustainability === "too_heavy", true);
  assert("heavy goal yields a lower suggested new-word count", typeof heavyForecast.suggestedDailyNewWords === "number" && heavyForecast.suggestedDailyNewWords < 50, true);

  // tracks.js — learning-track backup / migration / import
  const throws = (fn) => { try { fn(); return false; } catch { return true; } };
  const trackToday = "2026-06-07";

  // 1) Old single-track data migrates into Default Track.
  const legacyRoot = migrateLegacyToRoot("2026-06-01T00:00:00.000Z");
  assert("migrateLegacyToRoot activeTrackId", legacyRoot.activeTrackId, "track_default");
  assert("migrateLegacyToRoot default track name", legacyRoot.tracks.track_default.name, "Default Track");

  const sampleFsrsCard = { stability: 12.5, difficulty: 6.3, due: "2026-07-01T00:00:00.000Z", state: "Review" };
  const sampleVocab = [
    { term: "abandon", normalizedTerm: "abandon", savedAt: "2026-06-01T00:00:00.000Z", archivedAt: null, ignoredAt: null, review: { dueAt: "2026-07-01T00:00:00.000Z", fsrsCard: sampleFsrsCard, reviewCount: 7, lastRating: "good" } },
    { term: "old word", normalizedTerm: "old word", savedAt: "2026-05-01T00:00:00.000Z", archivedAt: "2026-05-02T00:00:00.000Z", ignoredAt: "2026-05-02T00:00:00.000Z", review: { dueAt: "2026-06-01T00:00:00.000Z", fsrsCard: null } },
  ];
  const sampleEvents = [{ id: "e1", eventKey: "k1", type: "review", normalizedTerm: "abandon", rating: "good", occurredAt: "2026-06-02T00:00:00.000Z" }];
  const exportTracks = { track_default: { id: "track_default", name: "Default Track", createdAt: "2026-06-01T00:00:00.000Z", updatedAt: "2026-06-01T00:00:00.000Z" } };
  const backup = buildBackup({
    activeTrackId: "track_default",
    tracks: exportTracks,
    globalSettings: { theme: "sunrise", fontScale: 1, onReturnAction: "vocabulary", speakOnReturn: false, uiPreferences: {}, geminiApiKey: "SECRET-KEY", googleAccessToken: "SECRET-TOKEN", backupPassphrase: "SECRET-PASS" },
    trackData: { track_default: { vocabulary: sampleVocab, studyEvents: sampleEvents, spelling: [], spellingEvents: [], userDictionary: [], known: [], history: [{ term: "abandon", searchedAt: "2026-06-03T00:00:00.000Z", queriedAt: "2026-06-03T00:00:00.000Z" }], goals: { dailyNewWords: 5 }, studyOneMoreFilter: null } },
  }, "2026-06-07T00:00:00.000Z");

  // 2) Export creates valid schemaVersion 1 JSON.
  assert("backup schemaVersion is 1", backup.schemaVersion, BACKUP_SCHEMA_VERSION);
  assert("backup app is WordFan", backup.app, "WordFan");
  assert("backup activeTrackId", backup.activeTrackId, "track_default");
  assert("backup has track_default", typeof backup.tracks.track_default, "object");
  assert("backup pretty-prints to JSON", typeof JSON.stringify(backup, null, 2), "string");

  // 3) Export excludes secrets / API keys / auth tokens.
  assert("backup keeps theme", backup.globalSettings.theme, "sunrise");
  assert("backup drops gemini key field", "geminiApiKey" in backup.globalSettings, false);
  assert("backup drops google token field", "googleAccessToken" in backup.globalSettings, false);
  const backupJson = JSON.stringify(backup);
  assert("backup JSON has no secret key", backupJson.includes("SECRET-KEY"), false);
  assert("backup JSON has no secret token", backupJson.includes("SECRET-TOKEN"), false);
  assert("backup JSON has no secret passphrase", backupJson.includes("SECRET-PASS"), false);
  assert("backup ignoredWords derived", backup.tracks.track_default.ignoredWords.includes("old word"), true);
  assert("backup fsrsCards projection", backup.tracks.track_default.fsrsCards.abandon.stability, 12.5);

  // 4) Import rejects invalid JSON / unsupported schemaVersion / bad shape.
  assert("validateBackup rejects null", throws(() => validateBackup(null)), true);
  assert("validateBackup rejects wrong app", throws(() => validateBackup({ app: "Other", schemaVersion: 1, tracks: { t: {} } })), true);
  assert("validateBackup rejects unsupported schemaVersion", throws(() => validateBackup({ app: "WordFan", schemaVersion: 99, tracks: { t: {} } })), true);
  assert("validateBackup rejects empty tracks", throws(() => validateBackup({ app: "WordFan", schemaVersion: 1, tracks: {} })), true);
  assert("validateBackup rejects malformed track record", throws(() => validateBackup({ app: "WordFan", schemaVersion: 1, tracks: { t: { name: "Bad", wordLists: { vocabulary: [{ savedAt: "not-a-date" }] } } } })), true);
  assert("validateBackup rejects malformed review event", throws(() => validateBackup({ app: "WordFan", schemaVersion: 1, tracks: { t: { name: "Bad", reviewLogs: [{ id: "bad", type: "review", term: "bad", rating: "easyy", occurredAt: "2026-06-01T00:00:00.000Z" }] } } })), true);
  assert("validateBackup repairs missing normalizedTerm", validateBackup({ app: "WordFan", schemaVersion: 1, tracks: { t: { name: "Repair", wordLists: { vocabulary: [{ term: "Mixed Case", savedAt: "2026-06-01T00:00:00.000Z" }] } } } }).tracks.t.wordLists.vocabulary[0].normalizedTerm, "mixed case");
  assert("validateBackup accepts a valid backup", validateBackup(backup).app, "WordFan");
  const legacyBackup = validateBackup({
    app: "wordlover",
    exportedAt: "2026-06-05T00:00:00.000Z",
    vocabularyItems: sampleVocab,
    studyEvents: sampleEvents,
    spellingItems: [],
    spellingEvents: [],
    userDictionary: [],
    knownWords: [],
    historyItems: [{ term: "legacy history", searchedAt: "2026-06-04T00:00:00.000Z" }],
  });
  assert("legacy snapshot converts app", legacyBackup.app, "WordFan");
  assert("legacy snapshot imports as one track", Object.keys(legacyBackup.tracks).length, 1);
  assert("legacy snapshot default name", legacyBackup.tracks.legacy_snapshot.name, "Imported legacy snapshot - 2026-06-05");
  assert("legacy snapshot carries search history", legacyBackup.tracks.legacy_snapshot.searchHistory[0].term, "legacy history");

  // 5) Duplicate imported track names are renamed safely.
  assert("dedupeTrackName no collision keeps name", dedupeTrackName(["A"], "B", trackToday), "B");
  assert("dedupeTrackName collision stamps date", dedupeTrackName(["B"], "B", trackToday), `B (Imported - ${trackToday})`);
  assert("dedupeTrackName double collision adds counter", dedupeTrackName(["B", `B (Imported - ${trackToday})`], "B", trackToday), `B (Imported - ${trackToday}) (2)`);

  // 6) Import creates a NEW track, keeps existing, switches active, preserves FSRS + logs.
  const existingRoot = { activeTrackId: "track_default", tracks: { track_default: { id: "track_default", name: "Default Track", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" } } };
  let importCounter = 0;
  const fixedId = () => `track_import_${++importCounter}`;
  const plan = planImport(existingRoot, backup, trackToday, fixedId);
  assert("planImport keeps existing track", typeof plan.registry.tracks.track_default, "object");
  assert("planImport adds exactly one track", Object.keys(plan.registry.tracks).length, 2);
  assert("planImport mints a new id", plan.imported[0].id, "track_import_1");
  assert("planImport switches active to imported", plan.newActiveTrackId, "track_import_1");
  assert("planImport registry active matches", plan.registry.activeTrackId, "track_import_1");
  assert("planImport renames duplicate track name", plan.imported[0].meta.name, `Default Track (Imported - ${trackToday})`);
  let collisionCounter = 0;
  const collisionPlan = planImport(existingRoot, backup, trackToday, () => (collisionCounter++ === 0 ? "track_default" : "track_import_safe"));
  assert("planImport avoids generated id collisions", collisionPlan.imported[0].id, "track_import_safe");
  const importedRecords = trackRecords(plan.imported[0].track);
  assert("import preserves fsrs stability", importedRecords.vocabulary[0].review.fsrsCard.stability, 12.5);
  assert("import preserves fsrs difficulty", importedRecords.vocabulary[0].review.fsrsCard.difficulty, 6.3);
  assert("import preserves due date (no recompute)", importedRecords.vocabulary[0].review.dueAt, "2026-07-01T00:00:00.000Z");
  assert("import preserves review count", importedRecords.vocabulary[0].review.reviewCount, 7);
  assert("import preserves last rating", importedRecords.vocabulary[0].review.lastRating, "good");
  assert("import preserves review logs", importedRecords.studyEvents[0].eventKey, "k1");
  assert("import preserves track-specific search history", importedRecords.history[0].term, "abandon");

  // 7) Track deletion rules: active cannot be deleted; non-active can (when >1 track).
  const twoTrackRoot = { activeTrackId: "track_default", tracks: { track_default: { id: "track_default", name: "Default Track" }, track_b: { id: "track_b", name: "B" } } };
  assert("canDeleteTrack false for active", canDeleteTrack(twoTrackRoot, "track_default", "track_default"), false);
  assert("canDeleteTrack true for non-active", canDeleteTrack(twoTrackRoot, "track_b", "track_default"), true);
  assert("canDeleteTrack false for only track", canDeleteTrack(existingRoot, "track_default", "other"), false);

  // 8) Google Drive sync merges two plain learning-track backups by stable id (the union of
  // tracks, never dropping or duplicating), so an imported track travels across devices.
  const importedTrack = serializeTrack(
    { id: "track_imported_x", name: "Imported TOEFL", createdAt: "2026-06-05T00:00:00.000Z", updatedAt: "2026-06-06T00:00:00.000Z" },
    { vocabulary: [{ term: "ephemeral", normalizedTerm: "ephemeral", savedAt: "2026-06-05T00:00:00.000Z", review: { dueAt: "2026-07-01T00:00:00.000Z", fsrsCard: null } }], studyEvents: [], spelling: [], spellingEvents: [], userDictionary: [], known: [], history: [], goals: null, studyOneMoreFilter: null },
  );
  const remoteBackup = {
    schemaVersion: 1, app: "WordFan", exportedAt: "2026-06-06T00:00:00.000Z", activeTrackId: "track_imported_x", globalSettings: { theme: "ink" },
    tracks: {
      track_default: serializeTrack(
        { id: "track_default", name: "Default Track", createdAt: "2026-06-01T00:00:00.000Z", updatedAt: "2026-06-01T00:00:00.000Z" },
        { vocabulary: [{ term: "brave", normalizedTerm: "brave", savedAt: "2026-06-04T00:00:00.000Z", review: { dueAt: "2026-07-02T00:00:00.000Z", fsrsCard: null } }], studyEvents: [], spelling: [], spellingEvents: [], userDictionary: [], known: [], history: [], goals: null, studyOneMoreFilter: null },
      ),
      track_imported_x: importedTrack,
    },
  };
  const mergedBackup = mergeLearningTracksBackups(backup, remoteBackup, Date.parse("2026-06-08T00:00:00.000Z"));
  assert("merge keeps both track ids", Object.keys(mergedBackup.tracks).sort().join(","), "track_default,track_imported_x");
  assert("merge recreates imported track by id", mergedBackup.tracks.track_imported_x.name, "Imported TOEFL");
  assert("merge imported track keeps its word", mergedBackup.tracks.track_imported_x.wordLists.vocabulary[0].normalizedTerm, "ephemeral");
  assert("merge unions shared-track vocabulary", mergedBackup.tracks.track_default.wordLists.vocabulary.map((v) => v.normalizedTerm).sort().join(","), "abandon,brave,old word");
  assert("merge prefers local active track id", mergedBackup.activeTrackId, "track_default");
  assert("merge prefers local global settings", mergedBackup.globalSettings.theme, "sunrise");
  assert("merged backup validates", validateBackup(mergedBackup).app, "WordFan");
  assert("merged backup is plain JSON (no ciphertext fields)", /ciphertext|"iv"|"salt"|"tag"/.test(JSON.stringify(mergedBackup)), false);
  // A fresh device (no local tracks) recreates exactly the remote tracks and adopts remote active.
  const freshMerge = mergeLearningTracksBackups({ tracks: {}, activeTrackId: null, globalSettings: {} }, remoteBackup, Date.parse("2026-06-08T00:00:00.000Z"));
  assert("fresh device recreates imported track", freshMerge.tracks.track_imported_x.wordLists.vocabulary[0].normalizedTerm, "ephemeral");
  assert("fresh device adopts remote active track", freshMerge.activeTrackId, "track_imported_x");

  return {
    passed: failures.length === 0,
    failures,
    assertionCount: 119,
  };
}

async function runAllPocs() {
  setStatus("Running");
  progressList.innerHTML = "";
  summary.innerHTML = "";
  rawResults.textContent = "{}";
  addProgress("Collecting browser and storage diagnostics.");
  const diagnostics = await collectDeviceDiagnostics();

  addProgress("Running module smoke tests (pure-function unit checks).");
  const moduleSmokeTests = runModuleSmokeTests();

  addProgress("Registering service worker and checking app shell cache.");
  const serviceWorker = await registerServiceWorker();
  const offlineShell = await checkOfflineShellCache();

  addProgress("Running real main-app dictionary search smoke.");
  const mainAppDictionarySearch = await runMainAppDictionarySmoke();

  addProgress("Running real main-app new-word study smoke.");
  const mainAppStudyFlow = await runMainAppStudySmoke();

  addProgress("Running upgrade vocabulary merge smoke.");
  const upgradeVocabularyMerge = await runUpgradeVocabularyMergeSmoke();

  addProgress("Running checkpoint rollback smoke.");
  const checkpointRollback = await runCheckpointRollbackSmoke();

  addProgress("Running early-practice persistence test.");
  const earlyPracticePersistence = await runEarlyPracticePersistenceTest();

  addProgress("Running Study One More skip cooldown and ignore test.");
  const studyOneMoreSkipCooldown = await runStudyOneMoreSkipCooldownTest();

  addProgress("Running apostrophe / contraction handling test across word inputs.");
  const apostropheHandling = await runApostropheHandlingTest();

  addProgress("Verifying manual export snapshot includes all required fields.");
  const manualExportFields = await runManualExportFieldsTest();

  addProgress("Checking Learning Tracks import/export safety.");
  const learningTracksImportExport = await runLearningTracksImportExportTest();

  addProgress("Checking app DB schema has all required object stores.");
  const appDbSchema = await runAppDbSchemaTest();

  addProgress("Fetching current SQLite dictionary.");
  let dictionary = await fetchDictionary();
  const dictionaryFetchMetrics = dictionary.metrics;

  addProgress("Opening SQLite dictionary and running timed lookups.");
  const opened = await openDictionary(dictionary.bytes);
  const benchmark = await benchmarkDictionary(opened.db);
  opened.db.close();

  addProgress("Saving dictionary package to IndexedDB.");
  const indexedDbSaveMs = await saveDictionaryToIndexedDb(dictionary.bytes);

  addProgress("Saving dictionary package to OPFS when available.");
  const opfs = await saveDictionaryToOpfs(dictionary.bytes);
  addProgress("Opening OPFS dictionary with wa-sqlite worker when available.");
  const waSqliteOpfs = await runWaSqliteOpfsSmoke();
  const originalChecksum = dictionary.metrics.sampleChecksum;
  dictionary = null;

  addProgress("Reloading dictionary package from IndexedDB and proving it can query.");
  const indexedDbLoad = await loadDictionaryFromIndexedDb();
  const indexedDbOpened = await openDictionary(indexedDbLoad.bytes);
  const indexedDbLookup = lookupTerm(indexedDbOpened.db, "abandon");
  indexedDbOpened.db.close();

  addProgress("Running encrypted tar export/import recovery test.");
  const exportImport = await runExportImportPoc();

  addProgress("Running mock Google Drive encrypted snapshot sync test.");
  const mockSync = await runMockGoogleDriveSyncPoc(exportImport);

  addProgress("Running review, quiz, and FSRS-rating automation tests.");
  const reviewQuizRating = runReviewQuizRatingTests();

  addProgress("Recording iPhone and Windows device coverage status.");
  const deviceCoverage = {
    windowsPoc: diagnostics.platform?.startsWith("Win") ? "executed-on-windows-browser" : "not-windows-browser",
    iphonePoc: diagnostics.isIphoneOrIpad ? "executed-on-ios-browser" : "not-executed-on-ios-from-this-browser",
    note: "Run this same page on iPhone Safari/Home Screen to collect real mobile rows automatically. Android validation is deferred until the end.",
  };

  const completedAt = new Date().toISOString();
  const results = {
    completedAt,
    verdict: {
        moduleSmokeTests: moduleSmokeTests.passed ? "pass" : "fail",
      sqliteWasmDirection: benchmark.allFound && benchmark.timing.p95Ms < 1000 ? "pass" : "investigate",
      indexedDbDictionaryPersistence: indexedDbLookup.status === "found" ? "pass" : "fail",
      opfsDictionaryPersistence: opfs.supported ? (opfs.sampleChecksum === originalChecksum ? "pass" : "fail") : "not-supported",
      waSqliteOpfs: waSqliteOpfs.supported ? (waSqliteOpfs.passed ? "pass" : "investigate") : "not-supported",
      offlineShellCacheReadiness: offlineShell.allShellAssetsCached ? "pass" : "partial",
      mainAppDictionarySearch: mainAppDictionarySearch.passed ? "pass" : "fail",
      mainAppStudyFlow: mainAppStudyFlow.passed ? "pass" : "fail",
      upgradeVocabularyMerge: upgradeVocabularyMerge.passed ? "pass" : "fail",
      checkpointRollback: checkpointRollback.passed ? "pass" : "fail",
      earlyPracticePersistence: earlyPracticePersistence.passed ? "pass" : "fail",
      studyOneMoreSkipCooldown: studyOneMoreSkipCooldown.passed ? "pass" : "fail",
      apostropheHandling: apostropheHandling.passed ? "pass" : "fail",
      manualExportFields: manualExportFields.passed ? "pass" : "fail",
      learningTracksImportExport: learningTracksImportExport.passed ? "pass" : "fail",
      appDbSchema: appDbSchema.passed ? "pass" : "fail",
      encryptedExportImport: exportImport.roundTripMatches ? "pass" : "fail",
      mockCloudSync: mockSync.synced ? "pass" : "fail",
      reviewQuizRating: reviewQuizRating.passed ? "pass" : "fail",
      androidDeferred: "deferred-until-end",
      timedBenchmark: benchmark.timing.p95Ms < 1000 ? "pass" : "fail",
    },
    diagnostics,
    serviceWorker,
    offlineShell,
    mainAppDictionarySearch,
    mainAppStudyFlow,
    upgradeVocabularyMerge,
    checkpointRollback,
    earlyPracticePersistence,
    studyOneMoreSkipCooldown,
    apostropheHandling,
    manualExportFields,
    learningTracksImportExport,
    appDbSchema,
    dictionaryFetch: dictionaryFetchMetrics,
    dictionaryOpen: opened.metrics,
    benchmark,
    indexedDbPersistence: {
      saveMs: indexedDbSaveMs,
      loadMs: indexedDbLoad.loadMs,
      bytes: indexedDbLoad.bytes.byteLength,
      sampleChecksum: sampleChecksum(indexedDbLoad.bytes),
      reopenedRows: indexedDbOpened.metrics.rows,
      lookup: indexedDbLookup,
    },
    opfsPersistence: opfs,
    waSqliteOpfs,
    exportImport,
    mockGoogleDriveSync: mockSync,
    reviewQuizRating,
    deviceCoverage,
    moduleSmokeTests,
  };
  await saveStoreValue(KV_STORE, "lastResults", results);
  localStorage.setItem("wordlover-product-test-last-results", JSON.stringify(results));
  return results;
}

async function sendResultsToServer(results) {
  const response = await fetch("/__test_results", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(results),
  });
  if (!response.ok) throw new Error(`Result upload failed: ${response.status}`);
  return response.json();
}

function renderResults(results) {
  const verdictRows = Object.entries(results.verdict)
    .map(([key, value]) => `<div><strong>${key}</strong><span>${value}</span></div>`)
    .join("");
  const lookup = results.benchmark.timing;
  summary.innerHTML = `
    ${verdictRows}
    <div><strong>Dictionary</strong><span>${results.dictionaryOpen.rows.toLocaleString()} rows</span></div>
    <div><strong>Lookup p95</strong><span>${Math.round(lookup.p95Ms)} ms across ${lookup.count} lookups</span></div>
    <div><strong>IndexedDB dictionary</strong><span>${(results.indexedDbPersistence.bytes / 1024 / 1024).toFixed(1)} MB restored</span></div>
  `;
  rawResults.textContent = JSON.stringify(results, null, 2);
}

runButton.addEventListener("click", async () => {
  runButton.disabled = true;
  downloadButton.disabled = true;
  sendButton.disabled = true;
  try {
    lastResults = await runAllPocs();
    renderResults(lastResults);
    setStatus("Complete");
    downloadButton.disabled = false;
    sendButton.disabled = !canSendResults();
    if (isAutorun() && canSendResults()) {
      addProgress("Sending iPhone/browser result JSON back to the Windows HTTPS server.");
      const upload = await sendResultsToServer(lastResults);
      lastResults.upload = upload;
      renderResults(lastResults);
      setStatus("Sent");
    }
  } catch (error) {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    rawResults.textContent = message;
    setStatus("Failed");
  } finally {
    runButton.disabled = false;
  }
});

sendButton.addEventListener("click", async () => {
  if (!lastResults) return;
  sendButton.disabled = true;
  const previous = statusPill.textContent;
  try {
    setStatus("Sending");
    const upload = await sendResultsToServer(lastResults);
    lastResults.upload = upload;
    renderResults(lastResults);
    setStatus("Sent");
  } catch (error) {
    rawResults.textContent = `${rawResults.textContent}\n\nUpload failed: ${error instanceof Error ? error.message : String(error)}`;
    setStatus("Send failed");
  } finally {
    sendButton.disabled = false;
    if (statusPill.textContent === "Sending") setStatus(previous);
  }
});

downloadButton.addEventListener("click", () => {
  if (!lastResults) return;
  const blob = new Blob([JSON.stringify(lastResults, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `wordlover-product-tests-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
});

window.WordLoverPhase0 = { runAllPocs };

async function initSavedResults() {
  const saved = await loadStoreValue(KV_STORE, "lastResults", null);
  if (saved) {
    lastResults = saved;
    renderResults(saved);
    downloadButton.disabled = false;
    sendButton.disabled = !canSendResults();
  }
  if (!isAutorun()) return;
  runButton.click();
}

void initSavedResults();
