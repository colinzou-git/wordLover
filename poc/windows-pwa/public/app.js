const loadButton = document.querySelector("#loadDictionary");
const exportButton = document.querySelector("#exportState");
const termInput = document.querySelector("#termInput");
const result = document.querySelector("#result");
const metrics = document.querySelector("#metrics");
const diagnostics = document.querySelector("#diagnostics");
const historyList = document.querySelector("#history");
const pwaStatus = document.querySelector("#pwaStatus");

const DB_NAME = "wordlover-poc-user";
const STORE = "kv";
const TERM_RE = /^[a-z]+(?:[ '-][a-z]+){0,5}$/;

let SQL = null;
let dictionaryDb = null;
let loaded = false;
let historyItems = [];
let lastMetrics = null;
let debounceHandle = 0;

function formatMs(value) {
  return `${Math.round(value)} ms`;
}

function normalizeTerm(term) {
  return term.trim().replace(/[\u2019`]/g, "'").replace(/\s+/g, " ").toLowerCase();
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
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveValue(key, value) {
  const db = await openUserDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function loadValue(key, fallback) {
  const db = await openUserDb();
  const tx = db.transaction(STORE, "readonly");
  const value = await requestToPromise(tx.objectStore(STORE).get(key));
  db.close();
  return value ?? fallback;
}

function renderMetrics() {
  const dictionary = lastMetrics
    ? `${lastMetrics.entries.toLocaleString()} rows, ${(lastMetrics.bytes / 1024 / 1024).toFixed(1)} MB, fetch ${formatMs(lastMetrics.fetchMs)}, SQL init ${formatMs(lastMetrics.initMs)}, open ${formatMs(lastMetrics.openMs)}`
    : "Dictionary not loaded";
  const storage = "storage" in navigator ? "Storage API available" : "Storage API unavailable";
  metrics.innerHTML = `
    <div><strong>Dictionary</strong><span>${dictionary}</span></div>
    <div><strong>Persistence</strong><span>IndexedDB history enabled; ${storage}</span></div>
    <div><strong>Target</strong><span>Local lookup under 1 second after dictionary load</span></div>
  `;
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

function renderHistory() {
  historyList.innerHTML = historyItems
    .map((item) => `<li><button type="button" data-term="${item.term}">${item.term}</button><span>${formatMs(item.queryMs)}</span></li>`)
    .join("");
}

function renderResult(data) {
  if (data.status === "invalid_input") {
    result.innerHTML = `<p class="muted">Invalid input. Use letters, spaces, hyphens, or apostrophes.</p>`;
    return;
  }
  if (data.status === "not_found") {
    result.innerHTML = `<p class="muted">No exact dictionary match found.</p><p class="small">Query time: ${formatMs(data.queryMs ?? 0)}</p>`;
    return;
  }
  result.innerHTML = `
    <div class="result-head">
      <div>
        <h2>${data.term}</h2>
        <p>${data.entryType}${data.phonetic ? ` - ${data.phonetic}` : ""}</p>
      </div>
      <span>${formatMs(data.queryMs ?? 0)}</span>
    </div>
    <div class="meaning-grid">
      <section>
        <h3>English <em>${data.englishMeaningSource ?? ""}</em></h3>
        ${data.englishMeanings?.length ? data.englishMeanings.map((line) => `<p>${line}</p>`).join("") : '<p class="muted">No English definition.</p>'}
      </section>
      <section>
        <h3>Chinese</h3>
        ${data.chineseMeanings?.length ? data.chineseMeanings.map((line) => `<p>${line}</p>`).join("") : '<p class="muted">No Chinese translation.</p>'}
      </section>
    </div>
    <p class="small">${data.tags?.length ? `Tags: ${data.tags.join(", ")}` : "No tags"}</p>
  `;
}

async function loadDictionary() {
  const start = performance.now();
  const response = await fetch("/dictionary.sqlite");
  if (!response.ok) throw new Error(`Dictionary fetch failed: ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const fetched = performance.now();
  SQL ??= await initSqlJs({ locateFile: (file) => `/vendor/${file}` });
  const initialized = performance.now();
  dictionaryDb?.close();
  dictionaryDb = new SQL.Database(bytes);
  const opened = performance.now();
  const count = dictionaryDb.exec("SELECT count(*) AS count FROM dictionary_entries")[0].values[0][0];
  return {
    fetchMs: fetched - start,
    initMs: initialized - fetched,
    openMs: opened - initialized,
    bytes: bytes.byteLength,
    entries: count,
  };
  await saveValue("lastMetrics", lastMetrics);
  await renderDiagnostics();
  return lastMetrics;
}

function lookupTerm(input) {
  const normalized = normalizeTerm(input);
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
    if (!statement.step()) return { status: "not_found", term: input, queryMs: performance.now() - start };
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

async function addHistory(item) {
  historyItems = [item, ...historyItems.filter((entry) => entry.term !== item.term)].slice(0, 10);
  await saveValue("history", historyItems);
  renderHistory();
}

async function runLookup() {
  if (!loaded) return;
  const value = termInput.value;
  if (!value.trim()) {
    result.innerHTML = `<p class="muted">Type a term to test local lookup.</p>`;
    return;
  }
  try {
    const data = lookupTerm(value);
    renderResult(data);
    if (data.status === "found") {
      await addHistory({ term: data.term, searchedAt: new Date().toISOString(), queryMs: data.queryMs ?? 0 });
    }
  } catch (error) {
    result.innerHTML = `<p class="error">${error instanceof Error ? error.message : String(error)}</p>`;
  }
}

async function init() {
  historyItems = await loadValue("history", []);
  lastMetrics = await loadValue("lastMetrics", null);
  renderHistory();
  renderMetrics();
  result.innerHTML = `<p class="muted">Load the local dictionary to start the benchmark.</p>`;

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
}

loadButton.addEventListener("click", async () => {
  loadButton.disabled = true;
  loadButton.textContent = "Loading dictionary...";
  result.innerHTML = `<p class="muted">Fetching and opening local SQLite dictionary.</p>`;
  try {
    lastMetrics = await loadDictionary();
    loaded = true;
    loadButton.textContent = "Dictionary loaded";
    renderMetrics();
    await runLookup();
  } catch (error) {
    loadButton.disabled = false;
    loadButton.textContent = "Retry load";
    result.innerHTML = `<p class="error">${error instanceof Error ? error.message : String(error)}</p>`;
  }
});

termInput.addEventListener("input", () => {
  window.clearTimeout(debounceHandle);
  debounceHandle = window.setTimeout(() => void runLookup(), 150);
});

historyList.addEventListener("click", (event) => {
  if (!(event.target instanceof HTMLButtonElement)) return;
  termInput.value = event.target.dataset.term ?? "";
  void runLookup();
});

exportButton.addEventListener("click", () => {
  const payload = {
    exportedAt: new Date().toISOString(),
    app: "wordlover-windows-pwa-poc",
    historyItems,
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

void init();
