# WordLover Project Review — Update

**Date:** 2026-05-25  
**Previous review:** `docs/wordlover-review-2026-05-24.md`  
**Reviewed files (new):** `apps/wordlover-pwa/public/app.js` (v0.4.1, 2033 lines), `apps/wordlover-pwa/public/sw.js` (v20), `apps/wordlover-pwa/public/wordlover-config.js`, `apps/wordlover-pwa/public/index.html`, `apps/wordlover-pwa/public/styles.css`, `scripts/build_dictionary.py`, `apps/wordlover-pwa/received-results/*.json` (9 iPhone result files), `docs/full-product-gaps.md`, `docs/validation/phase0-automation/RESULTS.md` (updated), `docs/validation/iphone-results-2026-05-24.md` (updated)

---

## What Changed Since the Last Review

A large amount of work landed between the two zips. Most of the previously identified issues have been addressed, and new product surfaces have been added.

**Fixed from the previous review:**

- Encryption is now implemented: AES-256-GCM via Web Crypto, per-record IV, encrypted write-through on `saveValue()`.
- IndexedDB now uses a singleton connection (`getUserDb()`) instead of open/close per call.
- Resumable dictionary download with 4 MB range chunks and progress checkpointing is implemented (`fetchDictionaryWithResume()`).
- FTS5 search index is now built in `build_dictionary.py` (unless `--skip-fts` is passed).
- Fuzzy Levenshtein search (`findFuzzySuggestions()`) and Chinese-to-English lookup (`lookupChineseTerm()`) are both implemented.
- `suggestTerms()` now queries exact → phrase → prefix tiers with TOEFL weighting.
- Vocabulary save, edit, archive, autosave dwell, and duplicate prevention are all implemented.
- Study stats, quiz, review flow, proactive new-word study, and debug time acceleration are all implemented.
- Google OAuth PKCE flow and Google Drive snapshot sync are wired up.
- Gemini AI detail request is implemented.
- Word-of-the-day prompt uses TOEFL frequency ranking.
- `syncVersion`, `deviceId`, and `isSynced` fields are on vocabulary items from Phase 1.
- Install browser detection banner is implemented.
- Service worker update check/apply flow is implemented.
- Three UI themes are selectable.
- Product title changed from the prototype label to "WordLover".
- Real iPhone results received: 9 result files; two full suite runs in standalone mode passed all verdicts.

**Key measured iPhone numbers (from `20260524T225251Z-iphone-test-results.json`, standalone Home Screen PWA, iOS 18.7):**

| Metric                     | Value                      |
| -------------------------- | -------------------------- |
| Dictionary network fetch   | 7,314 ms (206 MB over LAN) |
| SQLite init + open         | 24 ms                      |
| Lookup p50                 | 0.04 ms                    |
| Lookup p95                 | 0.28 ms                    |
| Lookup max                 | 0.74 ms                    |
| IndexedDB save (206 MB)    | 600 ms                     |
| IndexedDB load (206 MB)    | 138 ms                     |
| OPFS save (206 MB)         | 222 ms                     |
| OPFS load (206 MB)         | 277 ms                     |
| Storage quota available    | ~41 GB                     |
| Persistent storage granted | Yes                        |

Lookup performance is excellent. The 7.3-second first-time download and the full-buffer memory usage remain the two main unresolved risks.

---

## Part 1: Top Problems

---

### Problem 1 — Encryption Key Is Stored Unprotected in IndexedDB

**Severity: Critical**

The encryption implementation is a meaningful improvement over the previous version, but there is a fundamental gap: the raw AES-256 key bytes are written directly to IndexedDB with no protection.

```js
// app.js line 233–238
let rawKey = await loadRawValue(KEY_STORE, "localAesGcmKey");
if (!rawKey) {
  rawKey = crypto.getRandomValues(new Uint8Array(32));
  await saveRawValue(KEY_STORE, "localAesGcmKey", rawKey);  // Plaintext key in IndexedDB
}
return crypto.subtle.importKey("raw", rawKey, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
```

This means that encrypting user data and storing the decryption key in the same IndexedDB database provides no real security. Anyone who can access the browser's IndexedDB (another same-origin script, a browser extension, or a future XSS vulnerability) can read both the ciphertext and the key. The data looks encrypted at rest in storage dumps, but any code running on the same origin can transparently decrypt it.

The architecture explicitly planned for a DEK wrapped by a passphrase-derived KEK (PBKDF2 or Argon2id) and an optional Google KEK. The current implementation skips the key wrapping entirely.

**Why this matters:** PRD Req 149 is Priority 1: "User-specific data must be encrypted locally on the device." The intent is to protect vocabulary, study progress, and personal data from unauthorized access. Storing the key in plaintext alongside the ciphertext does not satisfy that intent.

**Suggested solution:**

The full passphrase-protected DEK model can be phased in. A minimal improvement that meaningfully raises the bar is to use the Web Crypto `exportKey("jwk", ...)` / `importKey` path with a device-bound wrapping key, or to use the PKCE state from Google OAuth as the KEK material for signed-in users. Here is the recommended minimal approach for the PWA context:

```javascript
// Phase A: passphrase-protected DEK (blocks first-time UX minimally)

async function deriveKek(passphrase, salt) {
  const material = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 200_000, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false, ["wrapKey", "unwrapKey"]
  );
}

async function initEncryptionKey(passphrase) {
  const stored = await loadRawValue(KEY_STORE, "wrappedDek");
  if (stored) {
    // Existing user: unwrap DEK with passphrase
    const kek = await deriveKek(passphrase, stored.salt);
    return crypto.subtle.unwrapKey(
      "raw", stored.wrappedKey, kek, { name: "AES-GCM", iv: stored.wrapIv },
      { name: "AES-GCM" }, false, ["encrypt", "decrypt"]
    );
  }
  // New user: generate DEK, wrap with passphrase, store wrapped key only
  const dek = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const wrapIv = crypto.getRandomValues(new Uint8Array(12));
  const kek = await deriveKek(passphrase, salt);
  const wrappedKey = await crypto.subtle.wrapKey("raw", dek, kek, { name: "AES-GCM", iv: wrapIv });
  await saveRawValue(KEY_STORE, "wrappedDek", { wrappedKey: new Uint8Array(wrappedKey), salt, wrapIv });
  // Never store the raw DEK bytes in IndexedDB
  return dek;
}
```

For the personal single-user PWA context, the passphrase could be a device-PIN entered once per session, or the app can generate a random passphrase and ask the user to save a recovery file. The architecture already specified this path (ADR-003). What matters is that the raw key bytes never touch IndexedDB.

---

### Problem 2 — Google Drive Sync Uploads Plaintext User Data

**Severity: Critical**

PRD Req 150 (Priority 1): "User-specific data must be encrypted when stored in cloud storage." The current `syncToGoogleDrive()` uploads a plaintext JSON snapshot.

```js
// app.js line 1538–1563
async function syncToGoogleDrive() {
  const snapshot = buildUserDataSnapshot();  // Returns plain JS object with vocabulary, history, etc.
  const body = [..., JSON.stringify(snapshot, null, 2), ...].join("\r\n");
  // Uploaded as Content-Type: application/json — fully readable text
  const response = await googleFetch(`${GOOGLE_DRIVE_UPLOAD_URL}?uploadType=multipart`, {
    method: "POST", body,
  });
}
```

The function's UI text says "Syncing encrypted local snapshot metadata" but the body is unencrypted. The vocabulary list, study history, and user preferences are stored as readable JSON in Google Drive's `appDataFolder`.

**Suggested solution:**

Encrypt the snapshot before upload using the same DEK that protects local data. After fixing Problem 1 (key management), this becomes straightforward:

```javascript
async function syncToGoogleDrive() {
  const snapshot = buildUserDataSnapshot();
  const plaintext = new TextEncoder().encode(JSON.stringify(snapshot));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await getEncryptionKey();
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    { name: "AES-GCM", iv }, key, plaintext
  ));
  
  // Upload: { format: "aes-gcm-v1", iv: base64(iv), data: base64(ciphertext) }
  const encrypted = {
    format: "aes-gcm-v1",
    appVersion: APP_VERSION,
    userDataFormatVersion: USER_DATA_FORMAT_VERSION,
    encryptedAt: nowIso(),
    iv: btoa(String.fromCharCode(...iv)),
    data: btoa(String.fromCharCode(...ciphertext)),
  };
  
  // Use PATCH if file exists, POST if new (see Problem 4 for dedup fix)
  await uploadToDrive(encrypted);
}
```

On restore, download → decrypt → JSON.parse → validate format version → merge into local state.

---

### Problem 3 — The Spaced Repetition Scheduler Is Not Real FSRS

**Severity: High**

The PRD (Req 126, 147) requires FSRS with adaptive scheduling based on memory stability and difficulty. The current implementation is a fixed-interval lookup table with no adaptive component:

```js
// app.js line 1124–1131
function scheduleFromFsrsRating(rating) {
  if (rating === "again")  return { intervalDays: 0, dueAt: now + 10min, masteredAt: null };
  if (rating === "hard")   return { intervalDays: 1, dueAt: now + 1day,  masteredAt: null };
  if (rating === "good")   return { intervalDays: 3, dueAt: now + 3days, masteredAt: null };
  return { intervalDays: null, dueAt: null, masteredAt: nowIso() };  // "easy" → mastered immediately
}
```

Several concrete problems:

**A) Mastery on first "easy" rating is too aggressive.** A user can master a word they've only seen once by answering quickly (within 5 seconds, see `inferFsrsRating`). After mastery, the word is permanently excluded from review. A learner who answers their first quiz quickly because the word happens to be guessable will never see it again.

**B) Every user gets the same intervals.** In real FSRS, a word the user finds consistently easy gets progressively longer intervals (7 days → 14 → 30 → 90 days). A word the user struggles with gets shorter intervals. The current scheduler gives everyone 10 minutes / 1 day / 3 days regardless of past performance.

**C) No stability or difficulty tracking.** FSRS stores a per-card `stability` (estimated days until 90% retention) and `difficulty` (how hard this card is for this user). Without these, the "spaced" part of spaced repetition is missing.

**Suggested solution:**

Install the `ts-fsrs` library (recommended in the architecture) and use it for all scheduling decisions. It is TypeScript-native, works in browsers, and handles the FSRS algorithm without a backend.

```javascript
// Using ts-fsrs (https://github.com/open-spaced-repetition/ts-fsrs)
import { createEmptyCard, fsrs, generatorParameters, Rating } from "ts-fsrs";

// On new word save:
const fsrsParams = generatorParameters();  // Default FSRS-5 parameters
const scheduler = fsrs(fsrsParams);

function createReviewState() {
  return { fsrsCard: createEmptyCard(), nextReviewAt: new Date().toISOString() };
}

// On quiz answer:
function scheduleFromFsrsRating(reviewState, ratingStr) {
  const ratingMap = { again: Rating.Again, hard: Rating.Hard, good: Rating.Good, easy: Rating.Easy };
  const rating = ratingMap[ratingStr];
  const result = scheduler.next(reviewState.fsrsCard, new Date(), rating);
  return {
    fsrsCard: result.card,  // Updated stability, difficulty, state
    nextReviewAt: result.card.due.toISOString(),
    isMastered: result.card.stability > 90,  // App-level mastery rule: 90-day stability
  };
}
```

The review state schema already includes `intervalDays`, `dueAt`, and `masteredAt` — these map cleanly to the FSRS card fields. The main change is replacing the fixed-interval function with the ts-fsrs scheduler call. The stored `review` object on each `VocabularyItem` would gain a `fsrsCard` sub-object.

---

### Problem 4 — Google Drive Sync Always Creates a New File Instead of Updating

**Severity: High**

Every call to `syncToGoogleDrive()` uses HTTP `POST` to create a new file in the Drive `appDataFolder`. The `appDataFolder` in Google Drive supports multiple files with the same name — there is no automatic deduplication. After 10 sync operations, the user's app folder has 10 copies of `wordlover-user-data.json`.

```js
// app.js line 1558: Always POST (creates new)
const response = await googleFetch(`${GOOGLE_DRIVE_UPLOAD_URL}?uploadType=multipart&fields=id,name,modifiedTime`, {
  method: "POST", ...
});
```

The correct behavior is: check if the file exists → `PATCH` (update) if it does → `POST` (create) if it does not. The Drive API also supports "update if file exists" via the Files.create with `enforceSingleParent`, but the explicit check-then-upsert approach is more reliable.

**Suggested solution:**

```javascript
async function syncToGoogleDrive() {
  // Step 1: Find existing file ID in appDataFolder
  const listResponse = await googleFetch(
    `${GOOGLE_DRIVE_FILES_URL}?spaces=appDataFolder&fields=files(id,name,modifiedTime)&q=name='${CONFIG.googleDriveFileName}'`
  );
  const { files } = await listResponse.json();
  const existingFileId = files?.[0]?.id ?? null;

  // Step 2: Encrypt snapshot (see Problem 2)
  const encryptedBody = await buildEncryptedSnapshot();
  
  if (existingFileId) {
    // Update existing file (PATCH)
    await googleFetch(
      `${GOOGLE_DRIVE_UPLOAD_URL}/${existingFileId}?uploadType=media`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(encryptedBody) }
    );
  } else {
    // Create new file (POST with metadata)
    await googleFetch(/* ... multipart create as currently implemented ... */);
  }
}
```

This also requires implementing a download/restore path for multi-device sync (currently missing entirely — only upload is implemented, but not download or conflict resolution).

---

###

---

### Problem 6 — inferFsrsRating Uses Response Time as a Proxy for Confidence

**Severity: Medium-High**

```js
// app.js line 1133–1137
function inferFsrsRating(passed, responseMs) {
  if (!passed) return "again";
  if (responseMs <= 5000)  return "easy";
  if (responseMs <= 15000) return "good";
  return "hard";
}
```

This infers confidence purely from wall-clock response time. There are several failure modes:

- A user reads a question, thinks for 3 seconds before clicking → rated "easy" even if it felt effortful.
- A user is distracted and takes 20 seconds → rated "hard" even if they immediately knew the answer.
- First-time learners typically respond slower simply because the interface is new → everything starts as "hard".
- On iPhone, touch latency and scroll position can add 1–2 seconds of mechanical delay before the tap registers.

More critically, the quiz currently offers no way for the user to express their own confidence. FSRS was designed to be explicit about this: the user rates their own recall quality. Inferring it from time is a known SM-2-era workaround that FSRS improves upon.

**Suggested solution:**

Show the rating buttons explicitly after the answer is revealed. This is the standard FSRS UX and is already supported by the architecture's quiz mode design:

```javascript
// After revealing the correct answer:
quizPanel.insertAdjacentHTML("beforeend", `
  <p>How well did you remember this?</p>
  <div class="quiz-actions fsrs-ratings">
    <button data-rating="again" class="secondary-button">Again</button>
    <button data-rating="hard" class="secondary-button">Hard</button>
    <button data-rating="good">Good</button>
    <button data-rating="easy">Easy</button>
  </div>
`);
```

For the debug review automation, the automatic rating logic can remain as a test-only path. For real user sessions, show the four rating buttons explicitly.

---

### Problem 7 — FTS5 Index Is Built But Never Queried

**Severity: Medium**

`build_dictionary.py` now correctly builds a `dictionary_search_fts` FTS5 virtual table during the Python pipeline. But none of the search functions in `app.js` query it. `lookupTerm()` uses a direct `WHERE normalized_word = :term` index scan. `suggestTerms()` uses `WHERE normalized_word >= :prefix AND normalized_word < :upper`. `findFuzzySuggestions()` uses a manual Levenshtein loop over ~700 candidates fetched from the same range query.

The FTS5 table is present in the SQLite file (adding ~30–40% to the database size) but delivering zero benefit.

**Suggested solution:**

Use the FTS5 table for the phrase-match tier and as a replacement for the fuzzy candidate fetch. The FTS5 tokenizer handles phrase matching and prefix matching natively:

```javascript
// Tier 3: phrase match using FTS5 (replaces manual LIKE :phrasePrefix%)
function suggestPhrasesViafts(normalized, limit = 5) {
  const statement = dictionaryDb.prepare(`
    SELECT d.word, d.definition, d.translation
    FROM dictionary_search_fts fts
    JOIN dictionary_entries d ON d.id = fts.rowid
    WHERE fts.normalized_word MATCH :query
    ORDER BY d.is_toefl DESC, d.frq IS NULL, d.frq, d.bnc IS NULL, d.bnc
    LIMIT :limit
  `);
  // FTS5 MATCH supports: "take off" for phrase, "take*" for prefix
  statement.bind({ ":query": `"${normalized}"`, ":limit": limit });
  // ...
}

// Tier 4: fuzzy via FTS5 instead of manual Levenshtein over 700 candidates
function suggestFuzzyViaFts(normalized, limit = 4) {
  // FTS5 doesn't do edit distance natively, but fetching prefix candidates
  // and running Levenshtein on them is more targeted with FTS:
  const statement = dictionaryDb.prepare(`
    SELECT d.word, d.normalized_word, d.definition, d.translation
    FROM dictionary_search_fts fts
    JOIN dictionary_entries d ON d.id = fts.rowid
    WHERE fts.word MATCH :prefix
    LIMIT 300
  `);
  statement.bind({ ":prefix": normalized.slice(0, 2) + "*" });
  // Then run levenshteinWithin() on the ~300 candidates
}
```

If FTS5 prefix/phrase search doesn't cover all cases, keeping the manual Levenshtein as a fallback is fine — but the FTS5 query is faster and more accurate for phrase discovery.

---

### Problem 8 — studyEvents and vocabularyItems Are Stored as Single Array Blobs

**Severity: Medium**

Both core data structures are serialized as single IndexedDB values:

```js
// Every review saves ALL vocabulary items at once:
async function persistVocabulary() {
  await saveValue("vocabularyItems", vocabularyItems);  // Full array, re-encrypted every time
}

// Every review also saves the last 500 study events:
async function persistStudyEvents() {
  await saveValue("studyEvents", studyEvents.slice(-500));  // Capped at 500, rest lost
}
```

Two problems:

**A) Write amplification.** If the user has 200 vocabulary items and reviews one word, the entire 200-item array (with all nested meanings, review states, and metadata) is serialized, encrypted, and written to IndexedDB. At 300 items, this write becomes the dominant operation after every quiz answer.

**B) Study events are capped and lost.** Truncating to 500 events means that after roughly 500 reviews (a few months of normal use), older events are silently discarded. Sync, stats accuracy, and the review scheduler history all degrade. The architecture defined immutable study events as a key correctness requirement.

**Suggested solution:**

Move to per-record writes using separate object stores. This is the Dexie.js approach recommended in the architecture:

```javascript
// Schema: each vocabulary item and each study event is its own record
const schema = {
  vocabularyItems: "normalizedTerm, savedAt, status, [userId+status]",
  studyEvents: "++id, normalizedTerm, type, occurredAt",
};

// Now a single review only writes 2 records:
await db.vocabularyItems.put(updatedItem);      // 1 write: just this item
await db.studyEvents.add(newEvent);             // 1 write: new event only

// No truncation needed — events accumulate naturally
// Queries are indexed: dueItems, todayEvents, etc. work without full scan
```

This is a meaningful data model change that should happen before Phase 2 ships vocabulary to production users, because migrating from the single-blob pattern to per-record stores requires a schema migration.

---

### Problem 9 — Chinese Reverse Lookup Does a Full Table Scan

**Severity: Medium**

The Chinese-to-English lookup uses `LIKE '%term%'` on the `translation` column:

```sql
-- app.js line 767
WHERE translation LIKE :term  -- where :term = '%放弃%'
```

SQLite cannot use any index for a leading-wildcard LIKE query. On 770,611 rows, this is a full table scan every time a Chinese character is typed. On iPhone, with the dictionary loaded in memory via sql.js, this will be noticeably slower than the indexed English lookup path.

The FTS5 table includes the `translation` column and is tokenized with `unicode61 remove_diacritics 2`, which means it should handle CJK content well (each character is a separate token).

**Suggested solution:**

```sql
-- Use FTS5 for Chinese reverse lookup:
SELECT d.word, d.translation, d.definition, d.frq, d.bnc
FROM dictionary_search_fts fts
JOIN dictionary_entries d ON d.id = fts.rowid
WHERE fts.translation MATCH :term
ORDER BY d.is_toefl DESC, d.frq IS NULL, d.frq, d.bnc IS NULL, d.bnc
LIMIT 10
```

This uses the FTS5 inverted index rather than a full table scan. The FTS5 `unicode61` tokenizer splits CJK text at character boundaries, so searching `放弃` will match entries whose `translation` contains those characters.

If FTS5 tokenization of Chinese characters proves imprecise (FTS5's tokenizer may not ideally segment compound Chinese words), a supplementary index on a `translation_hash` column or a pre-built character n-gram index can be added as a build-time step.

---

### Problem 10 — AUTOSAVE_DWELL_MS Is 5000 ms, PRD Requires 2–3 Seconds

**Severity: Low-Medium**

```js
// app.js line 62
const AUTOSAVE_DWELL_MS = 5000;
```

PRD Req 33 explicitly requires a "dwell period of 2 to 3 seconds." The implementation uses 5 seconds. PRD is not up to date in this case.

**Suggested solution:**

Change PRD Req 33 to require a "dwell period of 5 seconds."

---

### Problem 11 — Error Messages Are Injected into innerHTML Without Escaping

**Severity: Medium**

In two places, raw error messages are inserted directly into `innerHTML` without `escapeHtml()`:

```js
// app.js line 714 — dictionary load error
result.innerHTML = `<p class="error">${error instanceof Error ? error.message : String(error)}</p>`;

// app.js line 1442 — lookup error
result.innerHTML = `<p class="error">${error instanceof Error ? error.message : String(error)}</p>`;
```

Compare with `aiDetailPanel` on line 1605, which correctly uses `escapeHtml()`. While the current error messages originate from the app's own code, future errors from network responses or third-party libraries may contain HTML-unsafe characters. Error messages from the Google Drive API or Gemini API could contain `<` or `>` characters that would be interpreted as HTML.

**Suggested solution:**

Apply `escapeHtml()` consistently to all error message insertions:

```js
result.innerHTML = `<p class="error">${escapeHtml(error instanceof Error ? error.message : String(error))}</p>`;
```

---

## Part 2: Top Opportunities

---

### Opportunity 1 — Implement wa-sqlite + OPFS Engine Now (Phase 0 Gate)

This remains the most impactful single technical action. The iPhone test data now confirms OPFS is available, persistent storage is granted, and lookup latency after dictionary open is 0.28 ms p95. The blocker is that the dictionary is still loaded as a 206 MB buffer into WASM memory.

The `DICTIONARY_ENGINE` constant in the code already says: `"OPFS package store active; wa-sqlite OPFS engine pending bundle install"` — the intent is recognized but not yet implemented.

The iPhone test data makes the risk concrete and actionable:

```
Current: 206 MB WASM heap + sql.js runtime heap ≈ ~220–240 MB peak RSS
Target:  ≤ 50 MB (per MEMORY_TARGET_NOTE constant in app.js)
Gap:     ~4–5× over target
```

With wa-sqlite + OPFS AccessHandle VFS, the database file lives in OPFS and SQLite's page cache handles memory. Typical peak RSS for a 200 MB SQLite database with normal lookup access patterns is 8–20 MB (only the pages actually accessed are loaded).

The `DictionaryEngine` interface abstraction is the right shape to add now. The production path switches to `WaSqliteOPFSEngine` and the fallback stays as `SqlJsIndexedDBEngine`.

---

### Opportunity 2 — Add Dictionary Compression to Reduce First-Time Download

The 7.3-second first-time download measured on the iPhone was over local LAN WiFi. On a cellular connection, the same 206 MB transfer will take 30–90 seconds depending on signal strength. This is the largest UX barrier for new users.

The `fetchDictionaryWithResume()` function already handles chunked download and progress display. Adding compression only requires:

1. A one-time change to `build_dictionary.py` to compress the output with zstd.
2. A new `dictionary.sqlite.zst` served alongside the existing file.
3. A WASM zstd decompressor (~30 KB) that decompresses in a Web Worker before writing to OPFS.

**Estimated impact:** 206 MB → ~75–90 MB (based on typical SQLite compression ratios with zstd level 3). Download time on LAN: 7.3s → ~2.5–3s. On LTE: from minutes to ~30–45 seconds.

```python
# End of build_dictionary.py
import zstandard as zstd
with open(output_path, "rb") as f:
    data = f.read()
cctx = zstd.ZstdCompressor(level=3)
compressed = cctx.compress(data)
zst_path = output_path.with_suffix(".sqlite.zst")
with open(zst_path, "wb") as f:
    f.write(compressed)
print(f"Compressed: {len(data)/1e6:.1f} MB → {len(compressed)/1e6:.1f} MB ({len(compressed)/len(data):.1%})")
```

---

### Opportunity 3 — Add a Production HTTPS Host So iPhone Install Is One Step

Currently, every iPhone install requires: (a) Windows PC on the same LAN, (b) IP-specific certificate, (c) certificate installation on iPhone, (d) Safari to specific IP address, (e) Add to Home Screen. The `full-product-gaps.md` identifies this: "Host WordLover from a stable HTTPS domain."

For a personal app this doesn't require a paid hosting tier. Options:

- **GitHub Pages** (free): Deploy `apps/wordlover-pwa/public/` to GitHub Pages. Automatic HTTPS via GitHub's TLS. iPhone install is: open URL in Safari → Add to Home Screen. The 206 MB dictionary file exceeds GitHub's 100 MB file limit, but this will be resolved by dictionary compression (Opportunity 2) since the compressed file will be ~75–90 MB. The compressed file could also be hosted on a CDN like Cloudflare R2 (free tier).

The install certificate workflow can be eliminated entirely by hosting at a public URL. This removes 12+ manual steps from the iPhone setup process and makes the app accessible to non-developer users.

---

### Opportunity 4 — Add a Drive Download Path for Multi-Device Sync

The sync implementation uploads to Google Drive but never downloads. A user on a second device has no way to restore their vocabulary. This makes the "sync" effectively a one-way backup rather than cross-device sync.

```javascript
async function restoreFromGoogleDrive() {
  // Step 1: List files in appDataFolder
  const listResponse = await googleFetch(
    `${GOOGLE_DRIVE_FILES_URL}?spaces=appDataFolder&q=name='${CONFIG.googleDriveFileName}'&fields=files(id,modifiedTime)`
  );
  const { files } = await listResponse.json();
  if (!files?.length) {
    googleAuthStatus.textContent = "No cloud backup found.";
    return;
  }
  
  // Step 2: Download the most recent file
  const fileId = files[0].id;
  const downloadResponse = await googleFetch(
    `${GOOGLE_DRIVE_FILES_URL}/${fileId}?alt=media`
  );
  const encrypted = await downloadResponse.json();
  
  // Step 3: Decrypt and merge (once encryption is fixed per Problem 2)
  const decrypted = await decryptSnapshot(encrypted);
  await mergeOrReplaceLocalData(decrypted);  // Prompt user: replace or merge?
  
  googleAuthStatus.textContent = `Restored from Drive backup (${files[0].modifiedTime}).`;
}
```

The merge-vs-replace prompt is important: a second device may already have some local vocabulary that differs from the cloud copy.

---

### Opportunity 5 — Introduce a Two-Tier Dictionary for Instant First-Search

Even with compression, first-time setup requires downloading a large file before the user can search anything. A learner who opens the app for the first time and immediately wants to look up a word must wait for the download to complete.

The TOEFL-tagged entries are ~~6,974 words. Extracted into a compact JSON or small SQLite file (~~2–5 MB compressed), they can be bundled as part of the app shell and available immediately on first launch. The full dictionary download completes in the background.

```javascript
// On first launch, before full dictionary arrives:
await loadStarterDictionary();   // ~1 MB, bundled in SW cache, available instantly
showDownloadProgress("Full dictionary (75 MB) downloading...");  // Non-blocking
downloadFullDictionaryInBackground();  // Resumes with chunked download

// switchDictionary() called when full download completes:
function switchToFullDictionary() {
  dictionaryDb.close();
  dictionaryDb = new SQL.Database(fullDictionaryBytes);
  renderWordPrompt();  // Now shows from full TOEFL + general vocabulary
}
```

This turns a "wait before using" first-run experience into "use immediately, download in background."

---

### Opportunity 6 — Add a Structured Gemini Response Schema

The current Gemini request asks for JSON but doesn't validate the response structure:

```js
// app.js line 1575–1591
const text = payload.candidates?.[0]?.content?.parts?.map(p => p.text).join("\n") ?? JSON.stringify(payload, null, 2);
// Displayed directly as <pre> text — raw JSON from Gemini, unvalidated
```

The PRD (Req 170) requires AI output to be validated before displaying. The Gemini API supports `responseSchema` in the generation config, which guarantees structured JSON output.

```javascript
async function requestGeminiDetails(data) {
  const responseSchema = {
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
  
  const response = await googleFetch(endpoint, {
    method: "POST",
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema,  // Enforces structure
      },
    }),
  }, true);
  
  const payload = await response.json();
  const structuredText = payload.candidates?.[0]?.content?.parts?.[0]?.text;
  const detail = JSON.parse(structuredText);  // Now type-safe
  
  // Render meanings as proper cards, not raw JSON
  renderAiDetailCards(detail);
}
```

This also allows storing AI content in a structured format (per PRD Req 79) that can be copied to the vocabulary item with source attribution.

---

### Opportunity 7 — Add a `translation` Column Index for Chinese Lookup Speed

Until FTS5 is used for Chinese lookup (Problem 9), an immediate low-cost improvement is to add a partial index on the `translation` column in the Python build pipeline. A trigram or character-level index would make the `LIKE '%term%'` query dramatically faster for short Chinese input.

```python
# In build_dictionary.py schema section:
cursor.execute("""
    CREATE INDEX IF NOT EXISTS idx_dictionary_entries_translation
    ON dictionary_entries(translation)
    WHERE translation IS NOT NULL
""")
```

A standard B-tree index on `translation` doesn't help with leading wildcards, but adding a trigram index (SQLite 3.44+ supports `CREATE VIRTUAL TABLE ... USING fts5(content="", tokenize="trigram")`) would turn Chinese LIKE queries into FTS5 trigram lookups. This is the same index type used by PostgreSQL's `pg_trgm` extension.

---

### Opportunity 8 — Make the Debug Time Acceleration Available as a User Setting

The debug mode with `DEBUG_TIME_SCALE = NORMAL_DAY_MS / DEBUG_DAY_MS` (where 1 virtual day = 20 real seconds) is very well implemented for automated testing. The automation review test passed: "correct answer → Easy, wrong answer → Again."

Exposing this as a user-facing "study session simulator" mode would let the developer and any early testers validate the full learning loop in minutes instead of weeks. Consider making it accessible from the app menu (currently hidden behind `debugModeToggle` in the HTML) as a "fast-forward review testing" mode labeled clearly as a test feature.

---

##

---

*Review prepared 2026-05-25. All code samples are illustrative and adapt to the project's current vanilla JS style.*
