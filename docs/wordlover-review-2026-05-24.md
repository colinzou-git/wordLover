# WordLover Project Review

**Date:** 2026-05-24  
**Reviewed files:** `prd.md`, `docs/architecture-design.md`, `docs/development-plan.md`, `docs/dictionary-data.md`, `apps/wordlover-pwa/public/app.js`, `apps/wordlover-pwa/public/sw.js`, `apps/wordlover-pwa/public/automated-tests.js`, `apps/wordlover-pwa/public/index.html`, `docs/validation/iphone-results-2026-05-24.md`, `docs/validation/phase0-automation/RESULTS.md`, `apps/wordlover-pwa/RESULTS.md`, `docs/validation/iphone-next-validation.md`, `gaps.md`

---

## Executive Summary

WordLover is a well-conceived vocabulary learning app with strong documentation, clear phase separation, and a sound PWA-first architecture. The Phase 0 prototype proves the core technical direction is feasible. However, several structural problems in the current implementation and design will cause real pain if not addressed before Phase 1 begins. The top concerns are (1) sql.js loading 197 MB into main-thread RAM, (2) the absence of a build pipeline making cache management brittle, (4) no actual encryption in the live app despite being a PRD Priority 1 requirement, and (5) an IndexedDB access pattern that will degrade under production use. The top opportunities are adopting wa-sqlite+OPFS, adding a Vite build pipeline immediately, compressing the dictionary package, automating the dictionary install step, and building the FTS search index during the Python pipeline step.

---

## Part 1: Top Problems

---

### Problem 1 — sql.js Loads 197 MB into Main-Thread RAM

**Severity: Critical**

The prototype uses `sql.js`, which loads the entire SQLite database as a `Uint8Array` into the JavaScript heap and then into WASM linear memory. The Windows prototype measured 197 MB, the iPhone prototype measured 206 MB. This runs on the **main thread**, meaning the browser UI is blocked for the duration of the WASM init + open + memory allocation cycle.

From the Windows prototype results:

- Dictionary fetch time: 1006.5 ms (already at the 1-second PRD limit)
- SQL.js init: 31.9 ms
- SQLite open: 77.8 ms
- Total before first query: ~1116 ms

On an older iPhone (iPhone 12 is the stated baseline for iOS 17), these numbers will be worse. The combined fetch+open time already touches the PRD's 1-second limit on a fast Windows machine. On mobile, WASM memory allocation for a 200 MB heap competes with the app shell, Safari's own memory, and OS overhead. iOS has historically killed pages that allocate large buffers during initial load.

**Why this matters beyond performance:** sql.js keeps the entire 197 MB in memory for the lifetime of the session. On older iPhones, this will trigger memory pressure warnings and potential Safari tab termination, especially when the app is in the background.

**Suggested solution:**

Switch to `wa-sqlite` with the OPFS AccessHandle VFS for production. `wa-sqlite` operates file-by-file through the Origin Private File System, meaning SQLite's page cache controls memory use and the full database is never loaded into the JS heap at once.

```
Implementation steps:
1. In Phase 0 remaining work, run the wa-sqlite + OPFS VFS benchmark on the 
   same iPhone test device alongside the current sql.js + IndexedDB test.
   Compare: peak memory, startup latency, and lookup latency.
2. Wrap the SQLite engine behind an interface (e.g., DictionaryEngine) so 
   the production path can swap sql.js → wa-sqlite without changing callers.
3. If wa-sqlite passes iPhone memory and latency criteria, use it as the 
   production engine. Demote sql.js to a fallback for browsers that lack 
   OPFS support (e.g., Firefox private mode, some Android WebViews).
4. If OPFS is unavailable, fall back to the sql.js + IndexedDB pattern 
   already validated.

Target: peak memory during normal use should stay under ~50 MB for the 
dictionary engine, not 200+ MB.
```

Architecture already recommends evaluating `wa-sqlite` (ADR-002). This should be treated as a blocking Phase 0 item, not a nice-to-have.

---

### Problem 2 — No Build Pipeline; Service Worker Cache Versioning Is Manual and Error-Prone

**Severity: High**

The current implementation manually increments version strings in multiple places:

```js
// sw.js
const CACHE_NAME = "wordlover-shell-v12";

// index.html
<script type="module" src="/app.js?v=20260524-2"></script>
<link rel="stylesheet" href="/styles.css?v=20260524-2" />
```

And the same version strings are duplicated in `automated-tests.js`:

```js
const SHELL_CACHE_NAME = "wordlover-shell-v12";
const SHELL_ASSETS = [
  "/app.js?v=20260524-2",
  "/styles.css?v=20260524-2",
  ...
];
```

The risk is concrete: if a developer updates `app.js` but forgets to bump `v=` in `index.html` or `SHELL_ASSETS` in the service worker, users will receive stale cached JS with no indication anything is wrong. This has already happened once (the prototype notes the service worker cache was initially too small — a human missed adding assets). As the app grows to 15–20 source files, manual tracking becomes unmaintainable.

Additionally, without a bundler there is no tree-shaking, no dead-code elimination, no TypeScript type checking, and no code splitting.

**Suggested solution:**

Add Vite as the build tool before Phase 1 feature development begins.

```
1. Initialize Vite with the PWA plugin (vite-plugin-pwa), which uses 
   Workbox to auto-generate the service worker with content-hashed assets.

   npm create vite@latest wordlover-app -- --template react-ts
   npm install -D vite-plugin-pwa workbox-window

2. Replace the hand-maintained sw.js with a Vite/Workbox-generated service 
   worker. Content hashes replace version suffixes:
   /app.abc123.js instead of /app.js?v=20260524-2

3. The Workbox precache manifest is generated at build time and includes 
   all shell assets automatically. Manual SHELL_ASSETS arrays go away.

4. Configure injectManifest mode for the service worker so custom offline 
   dictionary-bypass logic (the current "don't cache dictionary.sqlite" 
   handler) can be preserved alongside Workbox's precache behavior.

5. Add a TypeScript strict-mode tsconfig.json and progressively migrate 
   the prototype JS to typed modules. This prevents an entire class of bugs
   (null reference, wrong key type in IndexedDB, etc.) that will surface 
   at scale.

Estimated cost: 1–2 days to set up Vite before Phase 1 starts. The cost 
of not doing this is discovering stale-cache user-support issues months 
later.
```

---

### Problem 3 — there is no Chinese to English translation

**Severity: High**

when input a chinese word to the input field, there is no chinese to english word translation.

**Suggested solution :**

Integrate a chinese word to english feature and corresponding dictionatory. When user input to the same input field in the app, it automatically detects it is chinese word. then it automatically translated the chinese word to english word, including some synanyms.

---

### Problem 4 — No Encryption in the Live App Despite Being a Priority 1 Requirement

**Severity: High**

PRD Req 149 is Priority 1: "User-specific data must be encrypted locally on the device." The architecture describes AES-256-GCM encryption with a DEK, recovery KEK, and optional Google KEK wrapper. The `automated-tests.js` successfully validates the Web Crypto round-trip.

However, the main `app.js` stores all user data — search history, metrics, preferences — in **plaintext IndexedDB** with no encryption at all:

```js
// app.js — plaintext write
async function saveValue(key, value) {
  const db = await openUserDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);  // No encryption
    ...
  });
}
```

This is understandable for a prototype, but Phase 1 will add vocabulary items, user-edited meanings, and review progress — all user-created content that the PRD requires to be encrypted. If encryption is deferred to Phase 3 (as currently planned), there will be a live production app with unencrypted user data between Phase 1 launch and Phase 3 launch.

**Suggested solution:**

Implement the encryption layer before Phase 1 ships user-created vocabulary to production storage.

```typescript
// Create an EncryptedStore wrapper before Phase 1 vocabulary save work:

class EncryptedUserRepository {
  private dek: CryptoKey;
  
  // Initialize with a generated DEK stored in IndexedDB
  // wrapped by a user passphrase (PBKDF2 or Argon2id)
  static async initialize(): Promise<EncryptedUserRepository> {
    const existingWrappedDek = await loadRawValue("enc-dek");
    if (existingWrappedDek) {
      // Prompt user for passphrase, unwrap DEK
    } else {
      // First run: generate DEK, wrap with passphrase, store wrapped key
      // Prompt user to download recovery file
    }
    return new EncryptedUserRepository(dek);
  }

  async set(key: string, value: unknown): Promise<void> {
    const plaintext = JSON.stringify(value);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv }, 
      this.dek, 
      new TextEncoder().encode(plaintext)
    );
    await saveRawValue(key, { iv, ciphertext: new Uint8Array(ciphertext) });
  }

  async get<T>(key: string): Promise<T | null> {
    const record = await loadRawValue(key);
    if (!record) return null;
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: record.iv }, 
      this.dek, 
      record.ciphertext
    );
    return JSON.parse(new TextDecoder().decode(plaintext));
  }
}
```

The key decision (passphrase-only vs. auto-generated vs. Google-wrapped) can be made independently of the storage API shape. Define the interface first, then fill in the key management strategy.

---

### Problem 5 — IndexedDB Opens a New Connection on Every Read/Write

**Severity: Medium-High**

In both `app.js` and `automated-tests.js`, every single read or write opens and closes the IndexedDB connection:

```js
async function saveValue(key, value) {
  const db = await openUserDb();  // Opens connection
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();  // Closes connection
}
```

This is a meaningful performance problem. `indexedDB.open()` is an async operation that checks schema versions and may trigger `onupgradeneeded`. In the prototype, this is called for every keystroke (the debounce saves the search history on every lookup). In a full product with encrypted records, vocabulary save, review state updates, and stats updates all happening together, this pattern will create a queue of DB open calls that degrades both latency and battery life.

**Suggested solution:**

Use Dexie.js (already recommended by the architecture) which maintains a persistent connection and transaction management:

```typescript
import Dexie, { type Table } from 'dexie';

export class WordLoverDatabase extends Dexie {
  kv!: Table<{ key: string; value: unknown }>;
  files!: Table<{ key: string; data: Uint8Array }>;

  constructor() {
    super('wordlover-user-data');
    this.version(1).stores({
      kv: 'key',
      files: 'key'
    });
  }
}

// Singleton — one connection for the lifetime of the app
export const userDb = new WordLoverDatabase();

// Usage is now simple and connection-efficient:
await userDb.kv.put({ key: 'history', value: historyItems });
const result = await userDb.kv.get('history');
```

Dexie handles version migrations, transaction coalescing, and connection lifecycle. It also types records properly for TypeScript.

---

### Problem 6 — Dictionary Offline Load Requires an Explicit Manual User Action

**Severity: Medium**

When the app starts and the dictionary is already installed, the UI shows:

> "Dictionary is installed. Tap **Install/load dictionary** to start searching."

The user must manually tap a button before they can search. This is a prototype affordance that should not exist in the production app. The PRD (Req 144) requires: "App startup time must be within 1 second to the point where the home screen search input is visible and **usable** on supported devices." Usable implies the dictionary is searchable, not waiting for a manual load tap.

The actual auto-load logic exists in `init()` but is conditional:

```js
if (installed && !smokeTerm) {
  void ensureDictionaryLoaded().then(() => {
    if (termInput.value.trim()) void runLookup();
  });
}
```

This does auto-load when `installed === true`, but it shows a confusing interim state with a "Tap Install/load dictionary" message while loading silently in the background. If the load takes 600ms–1000ms (as measured), the user sees an apparently-broken UI.

**Suggested solution:**

Show a loading indicator immediately on startup if the dictionary is installed and being loaded. Make the search input focusable but disabled with a clear "Loading dictionary…" placeholder. As soon as loading completes, enable the input and autofocus it.

```typescript
// On startup:
if (await isDictionaryInstalled()) {
  searchInput.placeholder = "Loading dictionary…";
  searchInput.disabled = true;
  showLoadingSpinner(); 
  
  try {
    await loadDictionary();  // ~600ms from IndexedDB
    searchInput.placeholder = "abandon, take off, in terms of…";
    searchInput.disabled = false;
    searchInput.focus();     // Ready to type
  } catch (error) {
    showInstallPrompt();     // First time: prompt to download
  }
} else {
  showFirstTimeInstallScreen();  // PRD Req 160
}
```

For the first-time install case, the PRD (Req 160) requires an explicit setup screen with download progress. These two states — first install vs. returning user — should have completely different UX flows.

---

### Problem 7 — Fuzzy and Phrase Search Are Not Yet Implemented

**Severity: Medium**

PRD Req 28 requires four tiers of dictionary search: exact → prefix → phrase → fuzzy. The current implementation has only two working tiers: exact match (in `lookupTerm`) and basic prefix match (in `suggestTerms`).

The prefix search uses a SQL `BETWEEN` range query on `normalized_word`, which works well for single-word prefixes but has a specific gap: it will not match phrases mid-word. Searching "take" shows suggestions for "take", "taken", "takes" — but not necessarily "take off" because "take off" sorts after "taken" in the range and may be cut off by the LIMIT 6.

There is also no fuzzy matching at all. A user who types "abanden" (misspelling of "abandon") gets no results. For an English learner who doesn't know the correct spelling, this is a poor experience.

**Suggested solution:**

Add a SQLite FTS5 virtual table during the Python build pipeline. FTS5 supports prefix search, phrase search, and can be configured for reasonable fuzzy behavior.

```python
# In build_dictionary.py, after main table creation:

cursor.execute("""
    CREATE VIRTUAL TABLE IF NOT EXISTS dictionary_search_fts 
    USING fts5(
        word,
        normalized_word,
        definition,
        translation,
        content='dictionary_entries',
        content_rowid='rowid',
        tokenize='unicode61 remove_diacritics 2'
    )
""")

cursor.execute("""
    INSERT INTO dictionary_search_fts(rowid, word, normalized_word, 
                                       definition, translation)
    SELECT rowid, word, normalized_word, definition, translation 
    FROM dictionary_entries
""")

# Also add a simple edit-distance index for fuzzy suggestions
# (trigram approach or pre-built Levenshtein candidates)
```

Then the search service can query:

```sql
-- Tier 1: exact match (current, keep as-is)
SELECT * FROM dictionary_entries WHERE normalized_word = :term LIMIT 1

-- Tier 2: prefix match using FTS5
SELECT * FROM dictionary_search_fts 
WHERE normalized_word MATCH :prefix || '*'
ORDER BY rank LIMIT 10

-- Tier 3: phrase match  
SELECT * FROM dictionary_search_fts
WHERE word MATCH '"' || :phrase || '"'
ORDER BY rank LIMIT 10

-- Tier 4: fuzzy (FTS5 with loose tokenization, or a pre-built 
-- trigram index for Levenshtein-1 candidates)
```

This keeps all search logic in the SQLite engine (no custom JS fuzzy code) and benefits from SQLite's query planner and indexes.

---

###

---

### Problem 9 — Dictionary Fetch Can Fail Silently on Poor Connections

**Severity: Medium**

The `loadDictionary()` function fetches the 197 MB SQLite file with a single `fetch()` call and no chunked progress, no retry logic, and no resumability:

```js
const response = await fetch("/dictionary.sqlite", { cache: "no-store" });
if (!response.ok) throw new Error(`Dictionary fetch failed: ${response.status}`);
bytes = new Uint8Array(await response.arrayBuffer());
```

On a cellular connection, a 197 MB download takes several minutes. If the user backgrounds the app mid-download, iOS may suspend the page and the fetch will silently fail or timeout. On next open, the app tries the dictionary.sqlite fetch again from the beginning.

The PRD (Req 161) explicitly requires: "If dictionary download or installation is interrupted, the app saves progress where possible and allows the user to resume from where it left off on the next launch."

**Suggested solution:**

Use the `Range` header and chunked download with progress tracking. Store each downloaded chunk to OPFS as it arrives so the download is resumable.

```typescript
async function downloadDictionaryWithResume(url: string, expectedBytes: number) {
  const CHUNK_SIZE = 4 * 1024 * 1024; // 4 MB chunks
  
  // Check existing progress in OPFS
  let downloadedBytes = await getStoredDownloadProgress();
  const chunks: Uint8Array[] = downloadedBytes > 0 
    ? [await loadPartialDownload()] 
    : [];
  
  while (downloadedBytes < expectedBytes) {
    const rangeEnd = Math.min(downloadedBytes + CHUNK_SIZE - 1, expectedBytes - 1);
    const response = await fetch(url, {
      headers: { Range: `bytes=${downloadedBytes}-${rangeEnd}` }
    });
    
    const chunk = new Uint8Array(await response.arrayBuffer());
    chunks.push(chunk);
    downloadedBytes += chunk.byteLength;
    
    await savePartialDownload(chunks, downloadedBytes);  // Save progress to OPFS
    onProgress(downloadedBytes / expectedBytes);         // Update progress UI
  }
  
  return concatenateChunks(chunks);
}
```

The dictionary manifest JSON (already planned in the architecture) should include `totalBytes` so the progress bar can show a percentage.

---

### Problem 10 — Sync Conflict Resolution Strategy Has an Implicit Gap

**Severity: Medium (design risk)**

The architecture defines full-snapshot sync (Tier 1) where "local user data is authoritative while offline." The conflict resolution rule is: "preserve user-edited meanings and pronunciation data and resolves conflicts without deleting user-created content silently."

However, consider this scenario with two devices:

- Device A (iPhone): User archives a vocabulary term "abandon" while offline.
- Device B (Windows): User edits the Chinese meaning of "abandon" while offline.
- Both devices come online and sync.

The full-snapshot merge has to reconcile these two changes. "Preserve user-edited meanings" suggests the edit from Device B should win for the meaning field. But what about the archive status from Device A? The architecture does not define a field-level merge strategy — it only says preserve edits and don't delete content silently.

Without a field-level last-write-wins or CRDT approach, the merge function in Phase 4 will be making implicit decisions that may surprise users.

**Suggested solution:**

Define the merge strategy at the field level before Phase 4 implementation, and record it as ADR-004.

```
Proposed merge rules per VocabularyItem field:

- status (active/archived/deleted): 
    Take the "most restrictive" change: 
    archived wins over active, deleted wins over archived.
    Rationale: prevents a device from silently un-archiving what another 
    device archived.

- userEditedMeanings: 
    Last-write-wins by updatedAt timestamp per meaning.
    If both devices edited the same meaning independently, the later 
    timestamp wins. Show a merge notice to the user.

- reviewState.fsrsCard: 
    Take the state with more recent lastReviewedAt.
    Rationale: the most recently reviewed state is more accurate.

- savedAt, term, normalizedTerm: 
    Immutable after first save. No merge needed.
```

This can be encoded in a `mergeVocabularyItem(local, remote)` function that handles each field explicitly rather than doing a top-level object replacement.

---

## Part 2: Top Opportunities

---

### Opportunity 1 — Switch Dictionary Storage to wa-sqlite + OPFS for Production

The architecture correctly identifies this as the preferred production path but hasn't acted on it yet. `wa-sqlite` with the `OPFSCoopSyncVFS` or `AccessHandlePoolVFS` backend is specifically designed for browser-based SQLite that doesn't load the whole DB into RAM.

**Concrete gains:**

| Metric                   | sql.js (current prototype)           | wa-sqlite + OPFS (expected)          |
| ------------------------ | ------------------------------ | ------------------------------------ |
| Peak memory              | ~200 MB (full DB in WASM heap) | ~8–16 MB (SQLite page cache only)    |
| First open time          | 77.8 ms (after fetch)          | ~20–40 ms (file already on disk)     |
| Initial load requirement | 197 MB fetch or IndexedDB read | File already in OPFS, no copy needed |
| Older device safety      | Risky on 2–3 GB RAM phones     | Safe on any iOS 17+ device           |

**Implementation path:**

```typescript
// DictionaryEngine interface — keeps callers independent of backend:
interface DictionaryEngine {
  isReady(): boolean;
  lookup(normalizedTerm: string): DictionaryEntry | null;
  suggest(prefix: string, limit: number): SuggestionEntry[];
  close(): void;
}

// Concrete implementations:
class WaSqliteOPFSEngine implements DictionaryEngine { ... }  // Production
class SqlJsIndexedDBEngine implements DictionaryEngine { ... }  // Fallback

// Factory chooses the right engine at runtime:
async function createDictionaryEngine(): Promise<DictionaryEngine> {
  if (await isOPFSSupported()) {
    return new WaSqliteOPFSEngine();
  }
  return new SqlJsIndexedDBEngine();  // Firefox private mode, older Safari
}
```

Running the dictionary in a dedicated Web Worker (already called for in the architecture) also removes any main-thread blocking during search.

---

###

---

### Opportunity 3 — Add a Progressive Dictionary Tier for Instant First Search

Even after compression, first-time setup requires downloading and writing 70–90 MB before the user can search anything. For an iPhone on LTE, this is 10–30 seconds. The PRD's 1-second search target only applies "after the app and local dictionary data are installed" — but the first-install UX is a critical retention moment.

**Suggested approach — a two-tier dictionary bundle:**

```
Tier 1 ("starter"):  ~500 KB compressed
  - All TOEFL entries (~6,974)
  - Top 5,000 words by frq
  - Available immediately on first launch
  - Downloaded as part of the app shell (inlined or bundled)

Tier 2 ("full"):     ~80 MB compressed
  - Complete 770,611-entry SQLite database
  - Downloaded in the background after first launch
  - Progress shown in a non-blocking banner: "Downloading full dictionary 
    (47%)… You can search common words now."
```

The starter tier could be a compact JSON or small SQLite file embedded in the service worker cache manifest. Once the full dictionary finishes downloading, the app transparently switches to it. The user can search TOEFL vocabulary immediately after first install with zero wait.

```typescript
async function initializeDictionary() {
  const fullInstalled = await isFullDictionaryInstalled();
  
  if (fullInstalled) {
    await loadFullDictionary();  // Normal path: ~600ms from OPFS
  } else {
    await loadStarterDictionary();  // First install: instant
    showProgress("Downloading full dictionary…");
    downloadFullDictionaryInBackground();  // Non-blocking
  }
}
```

---

### Opportunity 4 — Build the FTS5 Search Index During the Python Pipeline (Not at Runtime)

As described in Problem 7, the search implementation currently only does exact and basic prefix matching. Adding an FTS5 virtual table to the SQLite build would give phrase search, ranked results, and a path to fuzzy matching — all without any additional JS code.

**Key benefit:** FTS5 index creation is expensive (takes minutes on a 770K-row table), but that cost is paid once during the Python build pipeline on the developer's machine, not on the user's phone. The resulting `dictionary.sqlite` already includes the FTS5 indexes when it's downloaded.

```python
# In build_dictionary.py, add after main table population:

print("Building FTS5 search index (this takes a few minutes)...")
cursor.execute("""
    CREATE VIRTUAL TABLE dictionary_fts USING fts5(
        word,
        normalized_word,
        definition,
        translation,
        content='dictionary_entries',
        content_rowid='rowid'
    )
""")
cursor.execute("""
    INSERT INTO dictionary_fts(rowid, word, normalized_word, definition, translation)
    SELECT rowid, word, normalized_word, definition, translation
    FROM dictionary_entries
""")
# Optimize the FTS index for read performance
cursor.execute("INSERT INTO dictionary_fts(dictionary_fts) VALUES('optimize')")
```

The trade-off is a larger SQLite file (FTS5 indexes add ~30–40% file size), but with compression in place the net effect on download size should be manageable.

---

### Opportunity 5 — Add a Frequency-Ranked "Word of the Day" / Proactive Study Preview Before Phase 3

PRD Req 50–58 define the proactive new-word study flow, planned for Phase 3. However, the data needed to support it — the ECDICT frequency rank (`frq`) field — is already in the SQLite dictionary. A lightweight version of this feature can be added in Phase 1 with minimal code and would significantly improve first-day user retention.

**Phase 1 lightweight version:** On the home screen, display one "word to explore today" drawn from the top 1,000 frequency-ranked words the user hasn't searched yet. Tapping it pre-fills the search input and shows the definition. This is not the full proactive study flow — it's just a discovery prompt — but it gives users something to do immediately on first launch before they've built a vocabulary list.

```typescript
async function suggestWordOfTheDay(): Promise<string | null> {
  const searchedTerms = new Set(await getSearchHistory().map(h => h.term));
  
  const result = db.prepare(`
    SELECT word FROM dictionary_entries
    WHERE tag LIKE '%toefl%'
      AND definition IS NOT NULL
    ORDER BY frq ASC  -- lowest frq number = most frequent
    LIMIT 100
  `);
  
  const candidates = result.filter(row => !searchedTerms.has(row.word));
  if (!candidates.length) return null;
  
  // Rotate through candidates based on the day (deterministic per user per day)
  const dayIndex = Math.floor(Date.now() / 86400000) % candidates.length;
  return candidates[dayIndex].word;
}
```

---

###

---

### Opportunity 7 — Use IndexedDB Indexes for History and Vocabulary Rather Than KV Blobs

The current pattern stores arrays as serialized blobs in a key-value store:

```js
// Current: entire history array stored under one key
await saveValue("history", historyItems);  // [{term, searchedAt, queryMs}, ...]
```

This means every history read requires loading the entire array, every history write rewrites the entire array, and there is no way to query a subset (e.g., "show me searches from today"). As vocabulary grows to hundreds or thousands of items, this pattern will cause observable latency and unnecessary data transfer.

**Suggested alternative:** Use proper IndexedDB object stores with indexes from the start.

```typescript
// With Dexie, vocabulary items are individual records with queryable indexes:
this.version(1).stores({
  vocabularyItems: '++id, userId, normalizedTerm, savedAt, status, [userId+status]',
  meanings: '++id, vocabularyItemId, language, source',
  searchHistory: '++id, userId, normalizedTerm, searchedAt',
  reviewStates: 'vocabularyItemId, nextReviewAt, isMastered',
  studyEvents: '++id, vocabularyItemId, eventType, occurredAt',
});

// Now efficient queries are easy:
const dueItems = await db.reviewStates
  .where('nextReviewAt').belowOrEqual(Date.now())
  .toArray();

const todaysHistory = await db.searchHistory
  .where('searchedAt').above(startOfToday().toISOString())
  .toArray();
```

This makes Phase 2 (vocabulary save), Phase 3 (review due list), and Phase 4 (sync with proper change tracking) all substantially simpler to implement correctly.

---

### Opportunity 8 — Design the Event Log and syncVersion Fields Now, Even If Tier 2 Sync Ships Later

The architecture correctly identifies that Tier 2 sync (event-log-based incremental sync) requires `syncVersion` on every event. But it defers the design to "a future extension." If Phase 1 and Phase 2 ship study events and vocabulary items **without** `syncVersion` fields, adding them in Phase 4 requires a data migration across every user's device. Data migrations in offline-first PWAs are notoriously tricky.

**Suggested:** Add `syncVersion` (a monotonically increasing integer per device) and `deviceId` to every `StudyEvent`, `VocabularyItem`, and `ReviewState` record from Phase 1, even if Phase 4 Tier 1 sync never uses them for merging. The cost of adding these fields now is trivial; the cost of migrating 10,000 records later is not.

```typescript
interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
  createdDeviceId: string;  // Which device created this record
  syncVersion: number;       // Monotonic counter, incremented on each write to this record
  isSynced: boolean;         // Has this version been uploaded to cloud?
}
```

---

### Opportunity 9 — Add iPhone-Specific UX Hardening for PWA Install Flow

The current install process relies on the user knowing to use Safari (not Chrome), tap the Share button, and find "Add to Home Screen." For a non-technical English learner, this is not obvious.

**Suggested additions to Phase 1:**

1. **Browser detection banner:** If the user opens the app in Chrome or Firefox on iOS, show a friendly banner: "For offline use, please open this page in Safari and add it to your Home Screen." Include a step-by-step illustration.
2. **Install prompt:** After the user has used the app for 3+ minutes (indicating genuine interest), show a subtle install prompt with step-by-step animation.
3. **Post-install onboarding:** The first time the app launches in standalone mode (detected via `window.navigator.standalone`), show a brief "You're all set! Now let's download the dictionary (197 MB)" onboarding screen. This is PRD Req 160 for the product.

```typescript
function detectInstallContext() {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isInSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
  const isInstalled = window.navigator.standalone === true;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  
  if (isIOS && !isInSafari && !isInstalled) return 'ios-wrong-browser';
  if (isIOS && isInSafari && !isInstalled) return 'ios-safari-not-installed';
  if (isInstalled || isStandalone) return 'installed';
  return 'browser';
}
```

---

### Opportunity 10 — Validate wa-sqlite + OPFS on a Specific Older iPhone Before Committing to Phase 1

The current Phase 0 testing was done on an iPhone 17 Pro — the most capable iPhone in the baseline. The architecture states iOS 17 as the minimum baseline, which includes iPhone XR (2018, 3 GB RAM) and iPhone 12 (2020, 4 GB RAM). These devices have significantly tighter WASM memory budgets than the iPhone 17 Pro.

The transition from sql.js (full heap) to wa-sqlite (page cache) matters most on these older devices. Running the updated OPFS persistence prototype on an iPhone 12 or XR before Phase 1 starts would confirm whether the architecture is safe for the full stated device range, or whether the sharded dictionary fallback needs to be activated for older devices. This is a one-device, one-afternoon test that could prevent a major architectural change mid-Phase 1.

**Checklist for the older-device test:**

- Peak memory during dictionary load (via Safari DevTools remote inspect)
- Search latency p50/p95 after dictionary is in OPFS
- Does the page survive 10 consecutive searches without Safari killing it?
- Does the OPFS file persist after app close and iOS restart?

---

##

---

*Review prepared 2026-05-24. All code suggestions are illustrative and should be adapted to the final chosen framework (React+TS or SvelteKit+TS) per the architecture decision.*
