const runButton = document.querySelector("#runSuite");
const downloadButton = document.querySelector("#downloadResults");
const sendButton = document.querySelector("#sendResults");
const statusPill = document.querySelector("#suiteStatus");
const progressList = document.querySelector("#progressList");
const summary = document.querySelector("#summary");
const rawResults = document.querySelector("#rawResults");

const AUTOMATION_DB = "wordlover-phase0-poc";
const KV_STORE = "kv";
const FILE_STORE = "files";
const DICTIONARY_KEY = "dictionary.sqlite";
const SHELL_CACHE_NAME = "wordlover-shell-v22";
const TERM_RE = /^[a-z]+(?:[ '-][a-z]+){0,5}$/;
const BENCHMARK_TERMS = ["abandon", "take off", "in terms of", "abundant", "accurate"];
const SHELL_ASSETS = [
  "/",
  "/app.js?v=20260525-4",
  "/styles.css?v=20260525-4",
  "/wordlover-config.js?v=20260525-4",
  "/manifest.webmanifest",
  "/icon.svg",
  "/vendor/sql-wasm.js",
  "/vendor/sql-wasm.wasm",
  "/poc-suite.html",
  "/poc-suite.js?v=20260525-4",
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

function scheduleFromFsrsRatingForTest(rating, nowMs, debugMode = false, reviewState = {}) {
  const normalDayMs = 24 * 60 * 60 * 1000;
  const debugDayMs = 20 * 1000;
  const realDelay = (virtualMs) => (debugMode ? virtualMs / (normalDayMs / debugDayMs) : virtualMs);
  const reps = (reviewState.reps ?? 0) + 1;
  const previousStability = reviewState.stability ?? 0;
  const nextStability = rating === "again" ? Math.max(0.05, previousStability * 0.35) : rating === "hard" ? previousStability || 1 : rating === "good" ? previousStability * 1.75 || 3 : previousStability * 2.5 || 7;
  const mastered = nextStability >= 90 && reps >= 3 && rating !== "again";
  if (mastered) return { dueInMs: null, mastered: true, stability: nextStability, reps };
  if (rating === "again") return { dueInMs: realDelay(10 * 60 * 1000), mastered: false, stability: nextStability, reps };
  const intervalDays = Math.max(rating === "easy" ? 2 : 1, Math.round(nextStability));
  return { dueInMs: realDelay(intervalDays * normalDayMs), mastered: false, stability: nextStability, reps };
}

function runReviewQuizRatingTests() {
  const ratings = [
    { name: "wrong answer maps to Again", actual: inferFsrsRatingForTest(false, 700), expected: "again" },
    { name: "fast correct answer maps to Easy", actual: inferFsrsRatingForTest(true, 2500), expected: "easy" },
    { name: "medium correct answer maps to Good", actual: inferFsrsRatingForTest(true, 9000), expected: "good" },
    { name: "slow correct answer maps to Hard", actual: inferFsrsRatingForTest(true, 20000), expected: "hard" },
  ];
  const nowMs = Date.now();
  const debugHard = scheduleFromFsrsRatingForTest("hard", nowMs, true);
  const normalHard = scheduleFromFsrsRatingForTest("hard", nowMs, false);
  const scheduleChecks = [
    { name: "debug hard due is about 20 seconds", pass: debugHard.dueInMs >= 19_000 && debugHard.dueInMs <= 21_000 },
    { name: "normal hard due is about one day", pass: normalHard.dueInMs === 24 * 60 * 60 * 1000 },
    { name: "first easy does not immediately master", pass: scheduleFromFsrsRatingForTest("easy", nowMs, true).mastered === false },
    { name: "high-stability easy can master after repeated reviews", pass: scheduleFromFsrsRatingForTest("easy", nowMs, true, { stability: 45, reps: 2 }).mastered === true },
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
  const response = await fetch("/dictionary.sqlite", { cache: "no-store" });
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
    dataFormatVersion: "poc-1",
    exportedAt: new Date().toISOString(),
    vocabulary: [
      { term: "abandon", rating: "Again", source: "ECDICT" },
      { term: "take off", rating: "Hard", source: "ECDICT" },
    ],
    stats: { newSavedToday: 2, reviewedToday: 1, masteredToday: 0 },
  };
  const passphrase = "wordlover-phase0-recovery-passphrase";
  const encrypted = await encryptJson(userData, passphrase);
  const manifest = {
    app: "wordlover",
    exportFormat: "encrypted-tar-poc",
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
  const snapshot = {
    provider: "mock-google-drive",
    statusSequence: ["pending", "synced"],
    appVersion: "poc",
    dataFormatVersion: "poc-1",
    createdAt: new Date().toISOString(),
    encryptedArchiveBytes: exportImportResult.archiveBytes,
  };
  await saveStoreValue(KV_STORE, "mockDriveManifest", snapshot);
  const restored = await loadStoreValue(KV_STORE, "mockDriveManifest");
  return {
    mode: "mock",
    oauthPerformed: false,
    synced: restored?.statusSequence?.at(-1) === "synced",
    statusSequence: restored?.statusSequence ?? [],
    note: "Real Google Drive OAuth/upload needs user account authorization and cannot be completed silently by automation.",
  };
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
  const originalChecksum = dictionary.metrics.sampleChecksum;
  dictionary = null;

  addProgress("Reloading dictionary package from IndexedDB and proving it can query.");
  const indexedDbLoad = await loadDictionaryFromIndexedDb();
  const indexedDbOpened = await openDictionary(indexedDbLoad.bytes);
  const indexedDbLookup = lookupTerm(indexedDbOpened.db, "abandon");
  indexedDbOpened.db.close();

  addProgress("Running encrypted tar export/import recovery POC.");
  const exportImport = await runExportImportPoc();

  addProgress("Running mock Google Drive encrypted snapshot sync POC.");
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
      offlineShellCacheReadiness: offlineShell.allShellAssetsCached ? "pass" : "partial",
      encryptedExportImport: exportImport.roundTripMatches ? "pass" : "fail",
      mockCloudSync: mockSync.synced ? "pass" : "fail",
      reviewQuizRating: reviewQuizRating.passed ? "pass" : "fail",
      androidDeferred: "deferred-until-end",
      timedBenchmark: benchmark.timing.p95Ms < 1000 ? "pass" : "fail",
    },
    diagnostics,
    serviceWorker,
    offlineShell,
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
    exportImport,
    mockGoogleDriveSync: mockSync,
    reviewQuizRating,
    deviceCoverage,
  };
  await saveStoreValue(KV_STORE, "lastResults", results);
  localStorage.setItem("wordlover-phase0-last-results", JSON.stringify(results));
  return results;
}

async function sendResultsToServer(results) {
  const response = await fetch("/__poc_results", {
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
  anchor.download = `wordlover-phase0-poc-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
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
