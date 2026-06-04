import {
  State,
  ratingToFsrs,
  reviveFsrsCard,
  scheduleFromFsrsRating,
} from "./fsrs-scheduler.js?v=20260603-21";

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
const SHELL_CACHE_NAME = "wordlover-shell-v95";
const APP_DB = "wordlover-user";
const APP_DB_VERSION = 7;
const APP_KV_STORE = "kv";
const APP_VOCABULARY_STORE = "vocabularyRecords";
const APP_STUDY_EVENT_STORE = "studyEventRecords";
const APP_KNOWN_STORE = "knownRecords";
const TERM_RE = /^[a-z]+(?:[ '-][a-z]+){0,5}$/;
const BENCHMARK_TERMS = ["abandon", "take off", "in terms of", "abundant", "accurate"];
const SHELL_ASSETS = [
  "/",
  "/app.js?v=20260603-21",
  "/fsrs-scheduler.js?v=20260603-21",
  "/styles.css?v=20260603-21",
  "/wordlover-config.js?v=20260603-21",
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
  "/automated-tests.js?v=20260603-21",
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
      if (!db.objectStoreNames.contains(APP_VOCABULARY_STORE)) db.createObjectStore(APP_VOCABULARY_STORE);
      if (!db.objectStoreNames.contains(APP_STUDY_EVENT_STORE)) db.createObjectStore(APP_STUDY_EVENT_STORE);
      if (!db.objectStoreNames.contains(APP_KNOWN_STORE)) db.createObjectStore(APP_KNOWN_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
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

function normalizeTerm(term) {
  return term.trim().replace(/[\u2019`]/g, "'").replace(/\s+/g, " ").toLowerCase();
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
    } = {}) => ({
      memorizeTerms: new Set(memorize),
      spellingTerms: new Set(spelling),
      introducedToday: new Set(introducedToday),
      firstTryPassed: new Set(firstTryPassed),
      knownTerms: new Set(known),
      archivedIgnoredOrMastered: new Set(archivedIgnoredOrMastered),
    });
    const studyOneMoreTests = {
      excludesMemorizeWords: frameWindow.WordLoverApp.studyOneMore.pickFromCandidates(candidateRows, "very_easy", fakeSets({ memorize: ["echo"] })).normalizedTerm === "delta",
      excludesSpellingWords: frameWindow.WordLoverApp.studyOneMore.pickFromCandidates(candidateRows, "very_easy", fakeSets({ spelling: ["echo"] })).normalizedTerm === "delta",
      excludesKnownWords: frameWindow.WordLoverApp.studyOneMore.pickFromCandidates(candidateRows, "very_easy", fakeSets({ known: ["echo"] })).normalizedTerm === "delta",
      excludesWordsStudiedToday: frameWindow.WordLoverApp.studyOneMore.pickFromCandidates(candidateRows, "very_easy", fakeSets({ introducedToday: ["echo"] })).normalizedTerm === "delta",
      choosesLowestFrequencyRankCandidate: frameWindow.WordLoverApp.studyOneMore.pickFromCandidates(candidateRows, "very_easy", fakeSets()).normalizedTerm === "echo",
      fallsBackWhenNoCefrExists: frameWindow.WordLoverApp.studyOneMore.levelFor({ word: "fallback", normalized_word: "fallback", frq: 2500 }) === "very_easy"
        && frameWindow.WordLoverApp.studyOneMore.levelFor({ word: "intermediate", normalized_word: "intermediate", frq: 9000 }) === "medium",
    };
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

    await frameWindow.WordLoverApp.uiPreferences.set({
      todayTrack: "spelling",
      vocabularyTrack: "spelling",
      historyTrack: "spelling",
    });
    const uiPreferenceSnapshot = frameWindow.WordLoverApp.buildUserDataSnapshot();
    const uiPreferencesIncludedInSnapshot =
      uiPreferenceSnapshot.uiPreferences?.todayTrack === "spelling"
      && uiPreferenceSnapshot.uiPreferences?.vocabularyTrack === "spelling"
      && uiPreferenceSnapshot.uiPreferences?.historyTrack === "spelling";
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
      && uiPreferencesIncludedInSnapshot;
    if (!uiPreferencesSurviveReload) {
      throw new Error(`UI preferences should survive app reload/update: ${JSON.stringify({ reloadedUiPreferences, uiPreferenceSnapshot: uiPreferenceSnapshot.uiPreferences })}`);
    }

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

    click("#studyNewWord");
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
    const knownAfterCorrect = frameWindow.WordLoverApp
      .getKnownWords()
      .find((record) => record.normalizedTerm === firstCandidate.normalizedTerm);
    if (!knownAfterCorrect) throw new Error("Correct first-try Study One More did not create a Known record.");
    if (knownAfterCorrect.review || knownAfterCorrect.fsrsCard) throw new Error("Known record should not include FSRS review state.");
    if ((frameDocument.querySelector("#quizPanel")?.textContent ?? "").includes("Mastered")) {
      throw new Error("Study One More Known result should not be labeled Mastered.");
    }
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
    const masteredBeforeManualAdd = frameWindow.WordLoverApp
      .getVocabulary()
      .filter((item) => item.review?.masteredAt).length;
    if (frameDocument.querySelector("[data-study-one-more-meaning]")) throw new Error("Study One More disclosed the full meaning before tapping Show.");
    click("[data-study-one-more-show]");
    if (!frameDocument.querySelector("[data-study-one-more-meaning]") || !/English/i.test(frameDocument.querySelector("#quizPanel")?.textContent ?? "")) {
      throw new Error("Study One More did not show the full meaning after tapping Show.");
    }
    click('[data-study-one-more-add="memorize"]');
    await new Promise((resolve, reject) => {
      const startedAt = performance.now();
      const timer = window.setInterval(() => {
        const saved = frameWindow.WordLoverApp
          .getVocabulary()
          .some((item) => item.normalizedTerm === firstCandidate.normalizedTerm);
        const knownCleared = !frameWindow.WordLoverApp
          .getKnownWords()
          .some((record) => record.normalizedTerm === firstCandidate.normalizedTerm);
        if (saved && knownCleared && frameDocument.querySelector("[data-study-next]")) {
          window.clearInterval(timer);
          resolve();
          return;
        }
        if (performance.now() - startedAt > 10000) {
          window.clearInterval(timer);
          reject(new Error("Main app study smoke did not save the Study One More word to Memorize."));
        }
      }, 100);
    });
    const masteredAfterManualAdd = frameWindow.WordLoverApp
      .getVocabulary()
      .filter((item) => item.review?.masteredAt).length;
    if (masteredAfterManualAdd !== masteredBeforeManualAdd) throw new Error("Known should not count as Mastered.");
    click("[data-study-next]");
    const secondTerm = await waitForStudyOneMoreCard(firstTerm);
    const secondCandidate = frameWindow.WordLoverApp.studyOneMore.current();
    if (!secondCandidate || secondCandidate.normalizedTerm === firstCandidate.normalizedTerm) throw new Error("Study One More repeated an introduced-today word.");
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
    click('[data-study-one-more-add="spelling"]');
    await new Promise((resolve, reject) => {
      const startedAt = performance.now();
      const timer = window.setInterval(() => {
        const saved = frameWindow.WordLoverApp
          .getSpelling()
          .some((item) => item.normalizedTerm === secondCandidate.normalizedTerm);
        if (saved && frameDocument.querySelector("[data-study-next]")) {
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

    click("[data-study-next]");
    const thirdTerm = await waitForStudyOneMoreCard(secondTerm);
    const thirdCandidate = frameWindow.WordLoverApp.studyOneMore.current();
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
        if (saved && reviewEvent && frameDocument.querySelector("[data-study-next]")) {
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
    const vocabularyReviewAutoOne = await frameWindow.WordLoverApp.addUserDictionaryEntryForTest("review due auto one", "review due auto one meaning", "review due auto one");
    const vocabularyReviewAutoTwo = await frameWindow.WordLoverApp.addUserDictionaryEntryForTest("review due auto two", "review due auto two meaning", "review due auto two");
    const vocabularyReviewAutoThree = await frameWindow.WordLoverApp.addUserDictionaryEntryForTest("review due auto three", "review due auto three meaning", "review due auto three");
    const vocabularyReviewAutoItems = [];
    for (const [index, entry] of [vocabularyReviewAutoOne, vocabularyReviewAutoTwo, vocabularyReviewAutoThree].entries()) {
      const lookup = frameWindow.WordLoverApp.lookupTerm(entry.word);
      const item = await frameWindow.WordLoverApp.saveVocabularyItem(lookup, "debug-review-due-auto-advance");
      const dueAt = new Date(Date.now() - 1_800_000 + index * 60_000).toISOString();
      item.review.dueAt = dueAt;
      item.review.fsrsCard = { ...(item.review.fsrsCard ?? {}), due: dueAt };
      item.review.masteredAt = null;
      item.archivedAt = null;
      vocabularyReviewAutoItems.push(item);
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
    const answerActiveVocabularyQuiz = async () => {
      const quizBefore = frameWindow.WordLoverApp.getActiveQuiz();
      if (!quizBefore?.entry?.term) throw new Error("Vocabulary Review due auto-advance test has no active quiz.");
      click("[data-quiz-reveal]");
      const revealedQuiz = frameWindow.WordLoverApp.getActiveQuiz();
      const correctIndex = revealedQuiz.options.findIndex((option) => option.correct);
      if (correctIndex < 0) throw new Error(`Vocabulary quiz for ${revealedQuiz.entry.term} has no correct option.`);
      click(`[data-quiz-option="${correctIndex}"]`);
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
      return quizBefore.entry.term;
    };
    await frameWindow.WordLoverApp.startDueReview();
    const reviewDueFirstTerm = await waitForVocabularyQuizTerm();
    await answerActiveVocabularyQuiz();
    const reviewDueSecondTerm = await waitForVocabularyQuizTerm(reviewDueFirstTerm);
    await answerActiveVocabularyQuiz();
    const reviewDueThirdTerm = await waitForVocabularyQuizTerm(reviewDueSecondTerm);
    const reviewDueAutoAdvancesPastSecondWord =
      reviewDueThirdTerm
      && reviewDueThirdTerm !== reviewDueFirstTerm
      && reviewDueThirdTerm !== reviewDueSecondTerm;
    if (!reviewDueAutoAdvancesPastSecondWord) {
      throw new Error(`Review due should advance past the second answered word. Terms: ${JSON.stringify({ reviewDueFirstTerm, reviewDueSecondTerm, reviewDueThirdTerm })}`);
    }
    for (const item of vocabularyReviewAutoItems) item.archivedAt = new Date().toISOString();

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
    frameWindow.WordLoverApp.spelling.answer(spellingFirstTryBefore.currentTerm);
    const spellingFirstTryAfter = await waitForSpellingState(
      (state) => state && state.completed >= 1 && state.currentTerm !== spellingFirstTryBefore.currentTerm,
      "Spelling did not auto-advance after a first-try correct answer",
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
    await frameWindow.WordLoverApp.checkForAppUpdate();
    const updateStatusText = frameDocument.querySelector("#updateStatus")?.textContent ?? "";
    if (/Failed to fetch|Could not check the server app version/i.test(updateStatusText)) {
      throw new Error(`App update check failed in main app smoke: ${updateStatusText}`);
    }

    return {
      passed: Boolean(firstTerm && secondTerm && firstTerm !== secondTerm),
      firstTerm,
      secondTerm,
      studyOneMoreMemorizeSaved: true,
      studyOneMoreSpellingSaved: true,
      studyOneMoreTests,
      reviewSchedulingTests,
      eventSourcedMergeRebuiltFsrs,
      uiPreferencesSurviveReload,
      googleExpiredSessionAutoReconnectMessage,
      localDateKeyUsesLocalTime,
      historyWritesBothTimestampFields,
      historyMergeUsesSearchedAtFallback,
      studyOneMoreMissCreatesAgainReview,
      firstQuizIpa,
      vocabularyStatsRendered: true,
      againCount,
      pageWordCount: wordButtons.length,
      visibleIpaCount,
      archivedExcluded,
      masteredDueIncluded,
      reviewDueRatingButtonsVisible,
      reviewDueAutoAdvancesPastSecondWord,
      spellingDueIncluded,
      snapshotIntegrityIncludesSpelling,
      spellingAutoAdvanceAfterFirstTry: Boolean(spellingFirstTryAfter),
      spellingRequiresThreeCorrectAfterMiss: Boolean(spellingAfterOneRetryCorrect && spellingRetryAfter),
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

async function runAllPocs() {
  setStatus("Running");
  progressList.innerHTML = "";
  summary.innerHTML = "";
  rawResults.textContent = "{}";
  addProgress("Collecting browser and storage diagnostics.");
  const diagnostics = await collectDeviceDiagnostics();

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
      sqliteWasmDirection: benchmark.allFound && benchmark.timing.p95Ms < 1000 ? "pass" : "investigate",
      indexedDbDictionaryPersistence: indexedDbLookup.status === "found" ? "pass" : "fail",
      opfsDictionaryPersistence: opfs.supported ? (opfs.sampleChecksum === originalChecksum ? "pass" : "fail") : "not-supported",
      waSqliteOpfs: waSqliteOpfs.supported ? (waSqliteOpfs.passed ? "pass" : "investigate") : "not-supported",
      offlineShellCacheReadiness: offlineShell.allShellAssetsCached ? "pass" : "partial",
      mainAppDictionarySearch: mainAppDictionarySearch.passed ? "pass" : "fail",
      mainAppStudyFlow: mainAppStudyFlow.passed ? "pass" : "fail",
      upgradeVocabularyMerge: upgradeVocabularyMerge.passed ? "pass" : "fail",
      checkpointRollback: checkpointRollback.passed ? "pass" : "fail",
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
