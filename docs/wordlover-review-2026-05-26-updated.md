# WordLover Project Review — v3

**Date:** 2026-05-26  
**App version reviewed:** `0.5.4-product.20260525-v32` (sw shell v32)  
**Previous reviews:** `docs/wordlover-review-2026-05-24.md`, `wordlover-review-2026-05-25.md`  
**Files reviewed:** `prd.md` (190 requirements, status-audited), `docs/architecture-design.md`, `docs/development-plan.md`, `apps/wordlover-pwa/public/app.js` (2774 lines), `apps/wordlover-pwa/public/sw.js`, `apps/wordlover-pwa/public/automated-tests.js` (947 lines), `docs/validation/iphone-results-2026-05-24.md`, `docs/validation/iphone-next-validation.md`, `docs/validation/phase0-automation/RESULTS.md`, `docs/validation/windows-pwa-results-2026-05-24.md`, `docs/dictionary-data.md`

---

---

## Part 1: Top Problems

---

### Problem 1 — `window.prompt()` Is Used for Passphrase Entry and Vocabulary Editing

**Severity: High**

`window.prompt()` is called in two different contexts:

**A) Passphrase entry on first load:**

```js
// app.js line 314
const entered = window.prompt("Enter your WordLover local data passphrase...");
if (!entered) throw new Error("A local data passphrase is required...");
encryptionPassphrase = entered;
```

**B) Vocabulary editing:**

```js
// app.js line 1313–1317
const english = window.prompt("Edit English meaning...", summarizeLines(...));
const chinese = window.prompt("Edit Chinese meaning...", summarizeLines(...));
const phonetic = window.prompt("Edit pronunciation / IPA.", ...);
```

Both are problematic for different reasons.

For passphrase entry, `window.prompt()` is a browser-native blocking dialog. On iOS Safari in standalone (Home Screen PWA) mode, `window.prompt()` works, but it is visually disruptive, cannot be styled, has no "show/hide password" toggle, gives no validation feedback, and breaks completely if the user dismisses it (the app throws an error and becomes unusable until reload). PRD Req 126 says the review UI "reveals the answer first and then asks the user to choose the FSRS rating explicitly" — the same principle should apply to passphrase entry: an in-page form that the user can interact with naturally.

For vocabulary editing, `window.confirm()` and `window.prompt()` are also called in `restoreFromGoogleDrive()` (line 2178). The architecture explicitly lists "Replace prompt-based editing with proper forms" as a product gap.

**Suggested solution:**

Create a modal overlay component for both passphrase entry and vocabulary editing:

```javascript
// Passphrase entry modal — rendered in-page, not a browser dialog
function showPassphraseModal(onSubmit) {
  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal-panel" role="dialog" aria-modal="true" aria-labelledby="passphrase-title">
      <h2 id="passphrase-title">Unlock WordLover</h2>
      <p class="muted">Enter the passphrase for this device's encrypted study data.</p>
      <div class="field-row">
        <input id="passphraseInput" type="password" autocomplete="current-password"
               placeholder="Enter passphrase" />
        <button type="button" id="passphraseToggle" aria-label="Show/hide passphrase">👁</button>
      </div>
      <p id="passphraseError" class="error" hidden></p>
      <div class="modal-actions">
        <button id="passphraseSubmit" type="button">Unlock</button>
      </div>
    </div>
  `;
  document.body.append(modal);
  modal.querySelector("#passphraseInput").focus();
  modal.querySelector("#passphraseSubmit").addEventListener("click", () => {
    const value = modal.querySelector("#passphraseInput").value;
    if (!value) {
      modal.querySelector("#passphraseError").textContent = "Passphrase cannot be empty.";
      modal.querySelector("#passphraseError").hidden = false;
      return;
    }
    modal.remove();
    onSubmit(value);
  });
}
```

For the Drive restore confirm, replace `window.confirm()` with a similarly styled in-page confirmation panel showing the backup date, what will be replaced, and explicit Restore / Cancel buttons.

---

### Problem 2 — Service Worker `skipWaiting()` on Install Bypasses the User-Controlled Update Flow

**Severity: High**

The service worker calls `self.skipWaiting()` unconditionally in the install handler:

```js
// sw.js line 17
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)));
  self.skipWaiting();  // ← activates immediately, bypassing user choice
});
```

This directly contradicts PRD Req 179 ("The user can check whether a newer app shell is available, review the current version, choose whether to apply the update") and the architecture's "Apply update" UX.

What happens in practice: as soon as a new service worker finishes installing (which happens on any navigation while online), it immediately takes control of all open pages. The `controllerchange` event fires, and `app.js` calls `window.location.reload()`. The user gets an involuntary reload mid-session — mid-quiz, mid-vocabulary-edit, mid-dictionary-search — with no warning or choice.

The user-controlled `applyAppUpdate()` path (which posts `SKIP_WAITING` to a waiting worker) is rendered inert because the SW never stays in the waiting state.

**Suggested solution:**

Remove `self.skipWaiting()` from the install handler. The service worker should wait until the user explicitly applies the update:

```js
// sw.js — remove skipWaiting from install
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
    // No skipWaiting here — stay in waiting state until user chooses
  );
});

// Only skip waiting when explicitly requested
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
```

Then `checkForAppUpdate()` in `app.js` reliably finds a `registration.waiting` worker when an update is available, and the user's "Apply update" tap is the only trigger. The `controllerchange` reload becomes intentional rather than surprise.

Note: `self.clients.claim()` in the activate handler is fine to keep — it lets a newly activated worker take control of already-open tabs after the user applies the update.

---

### Problem 3 — Passphrase Is Cached in a Mutable Global Variable for the App Lifetime

**Severity: High**

After the passphrase is entered once, it is stored in `encryptionPassphrase`, a module-level `let` variable:

```js
// app.js line 123, 316–317
let encryptionPassphrase = null;
// ...
encryptionPassphrase = entered;  // Cached for the session lifetime
return encryptionPassphrase;
```

This creates two problems:

**A) The passphrase lives in the JS heap for the entire session.** Any memory inspector, extension with page access, or future XSS vulnerability can read it. The DEK itself is protected by Web Crypto's non-exportable key mechanism (`extractable: false`), but the passphrase that could be used to derive a new KEK and unwrap a new DEK is plainly readable.

**B) There is no session lock.** After the user has unlocked the app, anyone who picks up the phone with the app open can access all encrypted data without re-entering the passphrase. There is no idle timeout, no screen-lock trigger, and no re-lock mechanism.

**Suggested solution:**

The passphrase caching is largely unavoidable in a browser context — the alternative (prompting on every decrypt) is unusable. The practical mitigation is to hold the derived `CryptoKey` instead of the passphrase:

```javascript
// Keep the CryptoKey (Web Crypto non-extractable), not the passphrase string
let sessionEncryptionKey = null;  // CryptoKey, not string passphrase

async function getEncryptionKey() {
  if (sessionEncryptionKey) return sessionEncryptionKey;
  const passphrase = await showPassphraseModal();  // in-page modal, not window.prompt
  const wrapped = await loadRawValue(KEY_STORE, "wrappedDek");
  const kek = await deriveKek(passphrase, new Uint8Array(wrapped.salt));
  sessionEncryptionKey = await crypto.subtle.unwrapKey(...);
  // passphrase string is now eligible for GC — not held in any variable
  return sessionEncryptionKey;
}
```

Once the DEK is unwrapped as a non-extractable `CryptoKey`, the passphrase string can fall out of scope and be garbage collected. The `CryptoKey` object is still in memory but is not extractable by JS code. This is the best practical security posture available in a browser PWA, as the architecture's ADR-003 acknowledges.

---

###

---

### Problem 5 — `applyUserDataSnapshot()` Has a Destructive Clear-Before-Write Gap

**Severity: High**

When restoring from Google Drive or (in future) importing a tar file, the current implementation clears both stores before writing the new data:

```js
// app.js line 2160–2168
await clearRawStore(VOCABULARY_STORE);   // ← All vocabulary deleted
await clearRawStore(STUDY_EVENT_STORE);  // ← All study events deleted
await persistVocabulary();               // ← New data written (can fail)
await persistStudyEvents();              // ← New data written (can fail)
```

If the app crashes, loses power, or encounters an error between the `clearRawStore` calls and the `persistVocabulary` calls, the user loses all local data with no recovery path. This is a data-safety gap that affects PRD Req 90 ("Before applying cloud sync changes, the app creates a checkpoint of the current local user data").

There are no checkpoints yet, so there is no rollback if the write fails partway through.

**Suggested solution:**

Use a write-then-replace pattern, not clear-then-write. IndexedDB transactions guarantee atomic behavior within a single transaction:

```javascript
async function applyUserDataSnapshot(snapshot) {
  if (snapshot?.app !== "wordlover") throw new Error("Not a WordLover snapshot.");
  
  // Step 1: Validate the incoming data before touching anything
  const incoming = {
    vocabularyItems: Array.isArray(snapshot.vocabularyItems) ? snapshot.vocabularyItems : [],
    studyEvents: Array.isArray(snapshot.studyEvents) ? snapshot.studyEvents : [],
  };
  
  // Step 2: Write new records to a staging IDB transaction
  //         (IndexedDB put() replaces by key, so this is safe to run before clearing)
  const db = await getUserDb();
  
  // Clear + write in a single readwrite transaction so there's no gap
  await new Promise((resolve, reject) => {
    const tx = db.transaction([VOCABULARY_STORE, STUDY_EVENT_STORE], "readwrite");
    tx.objectStore(VOCABULARY_STORE).clear();
    tx.objectStore(STUDY_EVENT_STORE).clear();
    for (const item of incoming.vocabularyItems) {
      tx.objectStore(VOCABULARY_STORE).put(/* encrypted */ item, item.normalizedTerm);
    }
    for (const event of incoming.studyEvents) {
      tx.objectStore(STUDY_EVENT_STORE).put(/* encrypted */ event, event.id);
    }
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(new Error("Snapshot restore transaction aborted."));
  });
  
  // Step 3: Update in-memory state only after successful write
  vocabularyItems = incoming.vocabularyItems;
  studyEvents = incoming.studyEvents;
  // ... rest of UI updates
}
```

A single IDB transaction that clears and writes atomically eliminates the gap. Either the whole transaction succeeds or it rolls back entirely.

---

### Problem 6 — `loadAllRecordValues()` Decrypts Every Record Sequentially on Startup

**Severity: Medium-High**

On startup, `init()` calls `loadAllRecordValues(VOCABULARY_STORE)` and `loadAllRecordValues(STUDY_EVENT_STORE)`, which fetch and decrypt every record sequentially:

```js
// app.js line 401–417
async function loadAllRecordValues(storeName) {
  const values = await requestToPromise(tx.objectStore(storeName).getAll());  // All records at once
  for (const value of values) {
    records.push(await decryptValue(value));  // Sequential AES-GCM decrypt per record
  }
  return records;
}
```

Each `decryptValue()` call is an async Web Crypto operation. On a user with 200 vocabulary items and 1000 study events, this is 1200 sequential AES-GCM decryptions before the UI becomes interactive. Web Crypto operations are generally fast (~0.1ms each), but sequential await chains don't parallelize — they process one at a time through the microtask queue, adding roughly 120–200ms to startup time beyond the dictionary load.

**Suggested solution:**

Use `Promise.all()` to parallelize the decryption operations, since each record is independently encrypted:

```javascript
async function loadAllRecordValues(storeName) {
  const db = await getUserDb();
  const tx = db.transaction(storeName, "readonly");
  const values = await requestToPromise(tx.objectStore(storeName).getAll());
  
  // Decrypt all records in parallel instead of sequentially
  const results = await Promise.allSettled(
    values.map(async (value) => {
      if (!isEncryptedRecord(value)) return value;
      return decryptValue(value);
    })
  );
  
  return results
    .filter((r) => r.status === "fulfilled")
    .map((r) => r.value);
}
```

`Promise.allSettled()` (not `Promise.all()`) is preferred so one undecryptable record doesn't abort loading the rest. The parallel approach should be 5–10× faster for stores with many records.

---

### Problem 7 — The Custom FSRS Implementation Diverges from the FSRS-5 Algorithm

**Severity: Medium-High**

The `scheduleFromFsrsRating()` function is a custom approximation of FSRS. It has structural similarity (stability, difficulty, reps, lapses) but uses hardcoded multipliers that differ from the published FSRS-5 parameters:

```js
// app.js custom implementation
const difficultyDelta = { again: 1.2, hard: 0.6, good: -0.15, easy: -0.45 }[rating] ?? 0;
// Stability for "good":
stability = previousStability ? clamp(previousStability * (1.75 + (10 - difficulty) * 0.03), 2, 3650) : 3;
```

The FSRS-5 algorithm uses 17 learned weight parameters (`w[0]` through `w[16]`) that are derived from user performance data. The stability growth formulas are:

```
// FSRS-5 stability increase for "good" recall:
S' = S * e^(w[8] * (11 - D) * S^(-w[9]) * (e^(w[10] * (1 - R)) - 1) + 1)
```

The custom implementation uses a simpler linear formula that will produce materially different schedules from real FSRS — especially for high-stability cards (words the user knows well) and difficult cards (words the user struggles with). Over months of use, this divergence compounds into noticeably worse review timing than the published algorithm.

Additionally, the mastery rule is hardcoded to `stability >= 90 && reps >= 3`, which doesn't match the architecture's stated rule ("predicted retention at 90 days greater than 0.90 plus recent successful review history") and has no retrievability calculation.

**Suggested solution:**

Switch to `ts-fsrs`, the TypeScript-native reference implementation. It is tree-shakeable, works in browsers without a build tool via its CDN-importable ESM bundle, and uses the correct FSRS-5 weight parameters:

```javascript
// Via CDN (no build tool required for current vanilla JS setup):
import { createEmptyCard, fsrs, generatorParameters, Rating } from
  "https://esm.sh/ts-fsrs@4.0.0";

const scheduler = fsrs(generatorParameters());

function scheduleFromFsrsRating(reviewState, ratingStr) {
  const ratingMap = { again: Rating.Again, hard: Rating.Hard, good: Rating.Good, easy: Rating.Easy };
  const card = reviewState.fsrsCard
    ? { ...reviewState.fsrsCard, due: new Date(reviewState.dueAt ?? nowIso()) }
    : createEmptyCard();
  
  const result = scheduler.next(card, new Date(), ratingMap[ratingStr]);
  const nextCard = result.card;
  
  // App-level mastery: stability > 90 days AND retrievability > 0.9 at 90 days
  const isMastered = nextCard.stability >= 90 && nextCard.reps >= 3
    && ratingStr !== "again";
  
  return {
    fsrsCard: { ...nextCard, due: nextCard.due.toISOString(), lastReview: nowIso() },
    intervalDays: nextCard.scheduled_days,
    dueAt: isMastered ? null : nextCard.due.toISOString(),
    masteredAt: isMastered ? nowIso() : null,
  };
}
```

Since the current user data stores a `fsrsCard` object, the `ts-fsrs` card shape is compatible. The main difference is replacing the custom multipliers with the FSRS-5 weight vector, which produces significantly better spaced repetition calibration as vocabulary size grows.

---

### Problem 8 — Review Grace Window Not Implemented (PRD Req 169, Architecture Constant)

**Severity: Medium**

The architecture defines `REVIEW_GRACE_WINDOW_HOURS = 12` and PRD Req 169 requires it. The `getDueVocabularyItems()` function doesn't apply any grace window:

```js
// app.js line 1487–1493 — no grace window
function getDueVocabularyItems() {
  const now = appNowMs();
  return vocabularyItems.filter((item) => {
    if (item.archivedAt || item.review?.masteredAt) return false;
    return !item.review?.dueAt || Date.parse(item.review.dueAt) <= now;  // strict: due <= now only
  });
}
```

Without a grace window, a word due at 8pm will not appear in a review session started at 6pm, even though reviewing it 2 hours early has negligible impact on spaced repetition quality. This forces users to return for a late evening session or miss that day's review entirely.

**Suggested solution:**

Add the constant and apply it in the filter:

```javascript
const REVIEW_GRACE_WINDOW_MS = 12 * 60 * 60 * 1000;  // 12 hours

function getDueVocabularyItems() {
  const now = appNowMs();
  const cutoff = now + REVIEW_GRACE_WINDOW_MS;  // Items due within the next 12 hours
  return vocabularyItems.filter((item) => {
    if (item.archivedAt || item.review?.masteredAt) return false;
    return !item.review?.dueAt || Date.parse(item.review.dueAt) <= cutoff;
  }).sort((a, b) => {
    // Items already due first, then by due time ascending
    const aDue = Date.parse(a.review?.dueAt ?? "0");
    const bDue = Date.parse(b.review?.dueAt ?? "0");
    return aDue - bDue;
  });
}
```

The grace window does not change the stored `dueAt` — it only affects which items appear in the current review session. The FSRS scheduler's stored state remains unmodified.

---

### Problem 9 — No Storage Quota Check Before Dictionary Download (PRD Req 162 Open)

**Severity: Medium**

PRD Req 162 (Priority 1): "Before starting dictionary download or import, the app checks available device storage and warns the user if available storage is insufficient."

The architecture also specifies calling `navigator.storage.estimate()` before dictionary setup and warning when usage approaches quota (above ~80%). The diagnostics panel shows the storage estimate after the fact, but `fetchDictionaryWithResume()` starts downloading without checking available space first.

On an iPhone with limited free storage (< 250 MB), starting a 206 MB download that cannot complete will waste bandwidth and leave the user with a corrupted partial download that must be cleaned up.

**Suggested solution:**

Add a pre-download quota check to `loadDictionary()`:

```javascript
async function checkStorageBeforeInstall(requiredBytes) {
  if (!navigator.storage?.estimate) return { ok: true };  // Can't check; proceed optimistically
  
  const { quota, usage } = await navigator.storage.estimate();
  const available = quota - usage;
  const usagePercent = usage / quota;
  
  if (available < requiredBytes * 1.1) {  // Need 10% headroom beyond dict size
    return {
      ok: false,
      message: `Not enough storage. Dictionary needs about ${(requiredBytes / 1e6).toFixed(0)} MB `
             + `but only ${(available / 1e6).toFixed(0)} MB is available. `
             + `Free space on your iPhone and try again.`,
    };
  }
  if (usagePercent > 0.8) {
    return {
      ok: true,  // Proceed but warn
      warning: `Storage is ${(usagePercent * 100).toFixed(0)}% full. `
             + `Consider backing up your data before installing the dictionary.`,
    };
  }
  return { ok: true };
}

// In loadDictionary(), before fetchDictionaryWithResume():
const DICTIONARY_ESTIMATED_BYTES = 210 * 1024 * 1024;
const storageCheck = await checkStorageBeforeInstall(DICTIONARY_ESTIMATED_BYTES);
if (!storageCheck.ok) {
  result.innerHTML = `<p class="error">${escapeHtml(storageCheck.message)}</p>`;
  setSearchLoading(false);
  loadButton.hidden = false;
  return;
}
if (storageCheck.warning) {
  result.innerHTML = `<p class="notice">${escapeHtml(storageCheck.warning)}</p>`;
}
```

The `dictionary-manifest.json` recommended by the architecture should include `uncompressedBytes` so the check can use the exact expected size rather than a hardcoded estimate.

---

### Problem 10 — `automated-tests.js` Duplicates Version Strings and Uses a Separate DB

**Severity: Medium**

`automated-tests.js` hardcodes the shell cache name and asset list that must stay in sync with `sw.js`:

```js
// automated-tests.js line 11–26
const SHELL_CACHE_NAME = "wordlover-shell-v32";  // Must match sw.js manually
const SHELL_ASSETS = [
  "/app.js?v=20260525-14",    // Must match sw.js manually
  "/styles.css?v=20260525-14",
  ...
];
```

When `sw.js` is updated to v33, `automated-tests.js` must also be updated or the "shell cache readiness" test reports false failures.

It also opens a completely separate IndexedDB database (`wordlover-product-tests`) rather than the app's own database (`wordlover-user`). This means the test suite cannot verify that the app's actual stored dictionary (in `wordlover-user`) loads correctly — it downloads and stores its own copy. A bug where the app's IDB is corrupted but the test DB is fine would pass all tests.

**Suggested solution for version strings:** export the constants from a shared config module:

```javascript
// wordlover-config.js (already loaded by both app and tests)
window.WORDLOVER_CONFIG = {
  ...CONFIG,
  shellCacheName: "wordlover-shell-v32",  // Single source of truth
  shellAssets: ["/app.js?v=20260525-14", ...],
};
```

Both `sw.js` and `automated-tests.js` then read from `WORDLOVER_CONFIG` rather than maintaining their own copies.

**Suggested solution for DB separation:** the test suite's main-app smoke test already loads the app in an iframe and reads from `WordLoverApp.getState()`. Extend `getState()` to expose the DB connection reference, or add a test-only API that returns IDB diagnostics from the actual app DB.

---

### Problem 11 — `getLocalDataPassphrase()` Uses a Hardcoded Dev Passphrase on Localhost

**Severity: Medium**

```js
// app.js line 306–311
const isLocalhost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
if (isLocalhost) {
  encryptionPassphrase = "wordlover-localhost-development-passphrase";
  return encryptionPassphrase;
}
```

This hardcoded passphrase is committed to version control. It means:

- Any developer who clones the repo can decrypt user data stored by another developer on localhost.
- If a developer accidentally syncs their localhost data to Google Drive (Drive sync is not domain-restricted), the hardcoded passphrase decrypts it.
- The `wordlover-config.js` has a `localDevelopmentPassphrase` field that provides a configurable override, but the localhost hardcoded value is a silent fallback that requires no configuration to activate.

**Suggested solution:**

Remove the hardcoded fallback. Require explicit configuration for the dev passphrase:

```javascript
function getLocalDataPassphrase() {
  if (encryptionPassphrase) return encryptionPassphrase;
  const configured = String(CONFIG.localDevelopmentPassphrase ?? "").trim();
  if (configured) {
    encryptionPassphrase = configured;
    return encryptionPassphrase;
  }
  // No hardcoded fallback — always show the passphrase modal
  return null;  // getEncryptionKey() will trigger the modal
}
```

Document in `wordlover-config.js` that `localDevelopmentPassphrase` must be set for local development. Add it to `.gitignore` or provide a `.env`-style local override that is not committed.

---

## Part 2: Top Opportunities

---

### Opportunity 1 — Implement `wa-sqlite` + OPFS Engine (Still the Phase 0 Blocker)

This is unchanged from the previous two reviews and is still the single most impactful open item. The app correctly shows `DICTIONARY_ENGINE = "OPFS package store active; wa-sqlite OPFS engine pending bundle install"` — it knows the work is needed.

The current iPhone test data (from iPhone 17 Pro, iOS 18.7) confirms all OPFS prerequisites are met: OPFS is available, persistent storage is granted, storage quota is ~41 GB. The only remaining blocker is that `sql.js` loads 206 MB into WASM memory, which exceeds the 50 MB PRD target by ~4×.

The architecture correctly describes the DictionaryRepository interface approach. The implementation is now substantial enough that adding `wa-sqlite` behind the interface is the cleanest path — one concrete engine replaces another without touching the dictionary service callers.

**The one-weekend implementation path:**

```javascript
// 1. Install wa-sqlite (CDN import or bundled)
// 2. Create WaSqliteOPFSEngine class implementing the same interface
class WaSqliteOPFSEngine {
  async initialize(dictKey) {
    const { default: sqlite3InitModule } = await import("https://esm.sh/wa-sqlite@0.9.13");
    const sqlite3 = await sqlite3InitModule();
    const vfs = await sqlite3.installOpfsVfs(); // Registers OPFS VFS
    this.db = await sqlite3.open_v2("dictionary.sqlite",
      sqlite3.SQLITE_OPEN_READONLY, "opfs");
    // The dictionary file was already written to OPFS by saveOpfsFile()
    // wa-sqlite reads it page-by-page — no full-buffer load
  }
  lookup(normalizedTerm) { /* same SQL as current */ }
  suggest(prefix, limit) { /* same SQL as current */ }
}

// 3. Factory selects engine based on capability
async function createDictionaryEngine() {
  if (await isOpfsAvailable()) return new WaSqliteOPFSEngine();
  return new SqlJsIndexedDBEngine();  // existing fallback
}
```

The current app already writes the dictionary to OPFS via `saveOpfsFile()`. `wa-sqlite` with the OPFS VFS can open that file directly, eliminating the full-buffer load.

---

### Opportunity 2 — Move to Vite + TypeScript + Workbox Before Phase 1 Grows Further

The app is now 2774 lines of vanilla JS across `app.js` and another 947 lines in `automated-tests.js`. The manual version string synchronization problem across 4 files (`sw.js`, `app.js`, `automated-tests.js`, `index.html`) grows more fragile with each addition.

The development plan explicitly calls for "Add Vite + TypeScript + Workbox before Phase 1 grows beyond the current single-page validation." Phase 1 has already grown substantially beyond that point. The longer the migration is deferred, the larger the refactor becomes.

With TypeScript, the `VocabularyItem`, `ReviewState`, `FsrsCard`, `StudyEvent`, and `DictionaryEntry` types that are currently implied by runtime behavior would be explicit at compile time. Several of the bugs found in previous reviews (wrong field names in FSRS card, incorrect null checks, missing fields on sync) would be caught by the type checker before they reach the device.

**Migration path that doesn't require rewriting everything at once:**

```
1. Run: npm create vite@latest wordlover-app -- --template vanilla-ts
2. Copy app.js into src/main.ts and fix type errors incrementally
3. Install vite-plugin-pwa → replaces sw.js and its manual asset list
4. Install ts-fsrs → replaces the custom FSRS implementation
5. Workbox generates sw.js with content-hashed assets automatically
6. The manual ?v= version suffixes disappear; Workbox handles cache busting
```

---

### Opportunity 3 — Compress the Dictionary with zstd for Faster First-Time Install

The 206 MB first-time download over LAN takes 7.3 seconds on iPhone 17 Pro. Over cellular it would take 30–90 seconds. This is the single biggest UX barrier for new users and the biggest reason the first-time setup experience feels slow.

zstd level 3 typically compresses SQLite files to 40–55% of their original size. The `fetchDictionaryWithResume()` function already handles progress reporting and chunked writes; decompression can happen in a Web Worker after the final chunk arrives.

**Expected improvement:** 206 MB → ~80–90 MB → LAN install time ~2.5–3s, cellular ~15–30s.

The Python build pipeline already exists. Adding compression is a one-day change to `build_dictionary.py` + a WASM zstd decompressor added to the app shell.

---

### Opportunity 4 — Add a Two-Tier Starter Dictionary for Instant First Search

Even with compression, the user must wait for a download before searching anything on first launch. A small starter dictionary (~500 KB compressed) containing TOEFL words and the top 5,000 frequency-ranked terms can be bundled as part of the app shell and made available instantly. The full dictionary downloads in the background.

The TOEFL entries are already tagged in the SQLite database (`is_toefl = 1`, 6,974 entries). The starter bundle could be a small SQLite file or a compact JSON index.

This turns the first-launch experience from "wait to search" to "search immediately; full dictionary arriving in background."

---

### Opportunity 5 — Add a Production HTTPS Host (Removes 12-Step iPhone Setup)

The current installation process requires: Windows PC on the same LAN, IP-specific certificate, iPhone certificate trust install, Safari navigation to IP address, then Add to Home Screen. PRD Req 181 (Priority 1): "Production iPhone installation should be one step where possible and at most two user-visible steps."

GitHub Pages and Cloudflare Pages both offer free static hosting with automatic HTTPS. With dictionary compression (Opportunity 3) bringing the dictionary to ~80–90 MB, it fits within GitHub's file size limit for LFS.

The install then becomes: open URL in Safari → Add to Home Screen. No Windows PC, no certificate, no LAN.

---

### Opportunity 6 — Checkpoint/Rollback System (12+ Open PRD Requirements)

PRD Req 88–97 (all Priority 1) describe local checkpoints — the single largest block of open requirements. All 12 are `open`. The checkpoint system is a prerequisite for safe import (Req 109–111), safe sync restore, and safe migration.

The architecture defines the checkpoint shape and the `user-data-current.tar.enc` cloud layout. A minimal Phase 4 implementation could start with a single "pre-sync checkpoint" that saves the current encrypted snapshot to a well-known OPFS key before any restore or sync merge:

```javascript
async function createCheckpoint(reason) {
  const snapshot = buildUserDataSnapshot();
  const encrypted = await encryptSnapshotPayload(snapshot);
  const timestamp = nowIso().replace(/[:.]/g, "-");
  const key = `checkpoint-${timestamp}-${reason}`;
  await saveOpfsFile(key, new TextEncoder().encode(JSON.stringify(encrypted)));
  // Keep only the last 5 checkpoints
  await pruneOldCheckpoints(5);
  return key;
}

// Called before any restore or sync merge:
await createCheckpoint("pre-sync-restore");
await applyUserDataSnapshot(snapshot);
```

This is 30–40 lines of code that closes 12 Priority 1 requirements and eliminates the data-loss risk in Problem 5.

---

### Opportunity 7 — Extract Shared Utilities Between `app.js` and `automated-tests.js`

`automated-tests.js` reimplements several functions that already exist in `app.js`:

- `normalizeTerm()` — duplicated verbatim
- `createTar()` / `parseTar()` — implemented only in automated-tests.js but needed by export
- `deriveKey()` / `encryptJson()` / `decryptJson()` — parallel implementations with different PBKDF2 iteration counts (120,000 in tests vs 200,000 in app)

The differing iteration counts are a latent bug: a backup encrypted by the test suite (120,000 iterations) cannot be decrypted by the app (200,000 iterations), and vice versa. This may explain why the automated export/import test passes but might not work in a real recovery scenario.

**Fix:** extract shared utilities into a `wordlover-shared.js` file loaded by both `app.js` and `automated-tests.js`, and consolidate the iteration count to a single `KDF_ITERATIONS = 200_000` constant.

---

### Opportunity 8 — Expose a Public `WordLoverApp` API Surface for Test Automation

`automated-tests.js` already accesses the app via `frame.contentWindow.WordLoverApp.getState()`. The current `getState()` implementation (visible in the test file) exposes `loaded` and `appVersion`, but the study smoke test needs to interact with the full app (click review buttons, answer quizzes, check stats).

Adding a richer controlled test API would let automated tests cover the full review loop without relying on DOM selectors that break with UI changes:

```javascript
// In app.js, expose a test API:
window.WordLoverApp = {
  getState: () => ({
    loaded, appVersion: APP_VERSION, vocabularyCount: vocabularyItems.length,
    dueCount: getDueVocabularyItems().length, studyEventCount: studyEvents.length,
  }),
  // Test-only methods (gated by debugMode.enabled):
  test: {
    lookupTerm: (term) => debugMode.enabled ? lookupTerm(term) : null,
    saveVocabularyItem: (data) => debugMode.enabled ? saveVocabularyItem(data) : null,
    startDueReview: () => debugMode.enabled ? startDueReview() : null,
    handleFsrsRating: (rating) => debugMode.enabled ? handleFsrsRating(rating) : null,
    getTodayStats: () => debugMode.enabled ? getTodayStats() : null,
  },
};
```

Gating on `debugMode.enabled` means the test API is inert in production and only usable during automated test runs where debug mode is explicitly activated.

---

### Opportunity 9 — Add Storage Eviction Detection on Launch (Architecture Requirement)

The architecture specifies tracking `lastOpenedAt`, `lastSuccessfulLocalValidationAt`, and `lastSuccessfulSyncAt` and validating local data and dictionary files on next open if the app has not been opened for a long interval. None of these are currently implemented.

iOS may silently evict PWA storage if the app is unused for weeks. A user who returns after a long absence and finds their dictionary and vocabulary gone with no explanation will be confused. A simple startup check costs almost nothing and prevents a frustrating silent failure:

```javascript
// In init(), after loading user data:
const lastOpened = await loadValue("lastOpenedAt", null);
const now = nowIso();
await saveValue("lastOpenedAt", now);

if (lastOpened) {
  const daysSinceOpen = (Date.now() - Date.parse(lastOpened)) / (1000 * 86400);
  if (daysSinceOpen > 30) {
    // Validate that dictionary and user data are still present
    const dictOk = await hasInstalledDictionary();
    const vocabOk = vocabularyItems.length > 0 || (await loadAllRecordValues(VOCABULARY_STORE)).length === 0;
    if (!dictOk) {
      showStorageEvictionWarning("Dictionary not found — it may have been cleared by iOS. Please reinstall the dictionary while online.");
    }
  }
}
```

---

##
