# WordLover — PRD & Architecture Review

> Reviewed: 2026-05-24  
> Files reviewed: `prd.md`, `architecture-design.md`

---

## Overall Assessment

Both documents are strong for a personal project. The PRD has 159 uniquely-IDed, categorized requirements; the architecture responds to them systematically with a clean traceability table. Coverage is unusually complete — input validation, normalization, autosave, conflict handling, offline operation, security, accessibility, and diagnostics are all addressed.

The primary risks are in the PWA stack choices (SQLite WASM on iOS, storage eviction, key management) and in several requirements that conflict with or underspecify each other. The sections below call out each issue and provide a concrete recommendation.

---

## Part 1 — PRD Review

### PRD-1 · Empty tracking columns

**Issue:** The `Status` columns are blank for all 159 requirements. They exist for a reason — blank columns make the table a reference artifact, not an active tracking tool.

**Suggestion:** Before Phase 1 begins, populate `Status` with at least a minimal vocabulary such as `open`

---

### PRD-2 · Tension between Req 2 and Req 28

**Issue:** Req 2 says the app "only proposes meanings when the input exactly matches a dictionary word or phrase." Req 28 says the search "shows the closest matching term" and "should prefer exact matches over prefix or fuzzy matches." These describe different behaviors — Req 2 is strict exact-only; Req 28 allows near-matches.

**Suggestion:** These two requirements cover different UI surfaces and should be separated explicitly. Req 2 governs the vocabulary-input flow (the user is intentionally adding a term and should only see a save prompt when there is an exact match). Req 28 governs the dictionary-search flow (the user is browsing and a closest-match is helpful). Rewrite them to say:

- *Input flow (Req 2):* "The vocabulary-save input only pre-fills and proposes meanings when the normalized input is an exact match in the dictionary. Prefix and fuzzy suggestions are not shown in this flow."
- *Search flow (Req 28):* "The dictionary search input shows the closest matching term, ranked as: exact match, then prefix match, then fuzzy match. If no match exists at any rank, the result area is empty."

This removes the conflict by scoping each rule to its context.

---

### PRD-3 · Autosave trigger is underspecified (Req 33)

**Issue:** Req 33 says "when a dictionary search matches a dictionary entry, the app automatically saves the searched term." It must also say *when* the save fires — on match, after a dwell period, on navigation away, or on some other trigger. Autosave timing is user-visible behavior and belongs in the PRD.

**Suggestion:** Add a sub-clause to Req 33 that specifies the trigger. A recommended formulation:

> "Autosave fires when all of the following are true: (a) autosave is enabled, (b) a dictionary match is active in the search result, (c) the matched term is not already in the user's vocabulary list, and (d) the user has not dismissed or replaced the result within a dwell period of at least 5 seconds."

This makes the dwell period a tracked PRD requirement rather than an undocumented implementation detail, and it gives the developer a clear checklist of all conditions.

---

### PRD-4 · Manual ratings must not conflict with FSRS rating (Req 126, Req 147)

**Issue:** The product should not expose a separate manual review rating scale that conflicts with FSRS. FSRS natively accepts ratings (`again`, `hard`, `good`, `easy`). Conflating a user-picked rating with an FSRS input will cause implementation confusion.

**Suggestion:** align the PRD with FSRS ratings (`again`, `hard`, `good`, `easy`) and state that the quiz component infers the rating from correctness, response time, and quiz mode instead of asking the user to pick a rating.

---

### PRD-5 · Proactive word frequency source not specified (Req 51)

**Issue:** Req 51 says the app picks words from "the most frequently used words not already in the user's vocabulary list." No frequency source is named.

**Suggestion:** Update Req 51 to name the source explicitly:

> "The proactive new-word study button selects candidates from the ECDICT frequency rank field, preferring words with the highest usage frequency that are not already active or archived in the user's vocabulary list."

If the ECDICT frequency field is sparse or unreliable for common words, a supplementary short frequency list (e.g., top-5000 words from a public word-frequency corpus such as COCA or BNC) could be bundled as a lightweight JSON file and consulted first before falling back to ECDICT frequency. Add a secondary requirement: "If the dictionary frequency field is missing for a candidate, the app falls back to a bundled high-frequency word list ranked by corpus frequency."

---

### PRD-6 · Diagnostic upload to Git is underspecified (Req 84)

**Issue:** Req 84 says the app "provides a button to upload the compressed diagnostic log bundle to a configured Git repository." A PWA cannot run `git push`. This requires calling a Git hosting REST API, managing a personal access token, and choosing a repository and file path. The mechanism is not described.

**Suggestion:** replace the Git upload with an email-share option (using the Web Share API or `navigator.share`), which works natively across iOS, Android, and Windows without requiring token management. This is lower friction for a personal debugging workflow. Git upload could be an advanced option rather than the primary path.

---

### PRD-7 · No requirement for first-time dictionary setup UX

**Issue:** The architecture carefully handles dictionary download, hash validation, storage quota checks, and resumable initialization, but the PRD has no requirement describing what the user sees during first-time setup. Req 143 (1-second search) implicitly requires the dictionary to already be installed, but the setup path is absent.

**Suggestion:** Add a requirement group for first-time setup, for example:

> **Req 160 (P1, setup):** On first launch, if the local dictionary is not installed, the app displays an initial setup screen that shows estimated download size, a download progress indicator, and an estimated time to completion.
> **Req 161 (P1, setup):** If the dictionary download is interrupted, the app saves download progress and allows the user to resume from where it left off on next launch.
> **Req 162 (P1, setup):** Before starting the dictionary download, the app checks available device storage and warns the user if available storage is insufficient, with guidance on how to free space.
> **Req 163 (P2, setup):** When a new dictionary version is available, the app notifies the user and offers a background update that installs alongside the current version before switching.

---

### PRD-8 · No requirement for dictionary update behavior

**Issue:** The architecture designs for side-by-side dictionary package installs and version switching. The PRD never mentions that dictionary data can be updated or what the user experience of an update looks like.

**Suggestion:** Add a requirement for dictionary updates:

> **Req 164 (P2, dictionary):** The app can update its bundled dictionary data to a newer version. The update downloads and validates the new package alongside the current one before switching, so the current dictionary remains usable if the update fails.
> **Req 165 (P2, dictionary):** Dictionary data updates do not modify or overwrite user-edited meanings, pronunciation edits, or any user-specific data.

---

## Part 2 — Architecture Review

### ARCH-1 · SQLite WASM on iPhone Safari — highest risk item

**Issue:** The entire dictionary engine depends on SQLite WASM working reliably in Safari with durable OPFS persistence. OPFS support in Safari was incomplete before iOS 17. Performance with a 300 MB+ dictionary on older iPhones is unvalidated. Phase 0 is listed but has no pass/fail criteria.

**Suggestion:** Define explicit Phase 0 pass/fail criteria before any Phase 1 code is written:

| Criterion                        | Pass threshold                     | Device             |
| -------------------------------- | ---------------------------------- | ------------------ |
| Cold dictionary search latency   | ≤ 1 second                         | iPhone 12 (iOS 17) |
| App shell visible on launch      | ≤ 1 second                         | iPhone 12 (iOS 17) |
| OPFS persistence across sessions | Data survives app close and reopen | iPhone 12 Safari   |
| Storage quota available          | ≥ 400 MB grantable                 | iPhone 12 Safari   |
| WASM memory limit                | Dictionary loads without OOM       | iPhone 12 Safari   |

If any criterion fails, activate the fallback path immediately: replace SQLite WASM with a sharded prefix-search index (dictionary entries split into alphabetically-keyed JSON shards, loaded on demand). This path is already described as Option 2 in the architecture. Promote it to a first-class fallback with its own schema and build target so it is not developed under time pressure if Phase 0 fails.

Also consider using `[wa-sqlite](https://github.com/rhashimoto/wa-sqlite)` with its OPFS VFS rather than `sql.js`, as `wa-sqlite` has better Safari compatibility and lower memory overhead for read-heavy workloads.

---

### ARCH-2 · Encryption key management deferred but blocks sync

**Issue:** The architecture lists three key options and correctly labels this an open decision. However, this decision determines how sync works, how data is recovered on a new device, and whether the local-first-without-sign-in promise holds. It must be resolved before Phase 1, not Phase 4.

**Suggestion:** Choose Option C (local generated key + export recovery key) as the default, with Option B available after Google sign-in. Here is a concrete model:

- On first use, the app generates a random AES-256-GCM data encryption key (DEK) using `crypto.getRandomValues`.
- The DEK is stored in `localStorage` or IndexedDB in a browser-accessible form (no secure enclave in PWA). This is a known limitation — document it explicitly.
- The app immediately prompts the user to export a recovery file containing the DEK encrypted with a user-chosen passphrase (AES-256-GCM, PBKDF2 or Argon2id). This file is the recovery key.
- Optionally, after Google sign-in, the DEK is wrapped with a Google-account-derived key and stored in the user's Google Drive (a small `key-wrap.enc` file separate from user data). This enables seamless cross-device access.
- On a new device, the user can recover by either: (a) importing the recovery file and entering the passphrase, or (b) signing in with Google and retrieving the wrapped DEK from Drive.

This gives the user a no-Google path (recovery file) and a convenient Google path (auto-wrapped key), without either being mandatory.

Add a spec table to the architecture:

```
Key hierarchy:
  DEK (AES-256-GCM)         — encrypts all user data
  KEK from passphrase       — wraps DEK in recovery export (PBKDF2/Argon2id)
  KEK from Google account   — wraps DEK in Drive key-wrap file (optional)

Storage locations:
  DEK                       — IndexedDB (cleartext in browser sandbox)
  Recovery export           — user-downloaded file
  Drive key-wrap            — Google Drive app folder (optional, post sign-in)
```

---

### ARCH-3 · PWA storage eviction on iOS underweighted

**Issue:** iOS can evict PWA storage (IndexedDB, OPFS) silently if the app has not been opened for several weeks or if device storage is critically low. A user who returns after a long break could lose all local vocabulary and review progress. The architecture mentions cloud sync as the "main cross-device backup" but does not mitigate the eviction risk for users who have not set up sync.

**Suggestion:** Add the following mitigations to the architecture:

1. **Request persistent storage.** Call `navigator.storage.persist()` after install. On iOS this does not guarantee persistence, but on Android and desktop Chrome it does. Document the difference.
2. **Eviction warning.** On each app open, check `navigator.storage.estimate()`. If usage is above 80% of quota or if a long interval has passed since last sync, show an inline banner: "Your data is stored locally. Set up cloud sync or export a backup to protect it across devices."
3. **Pre-eviction export prompt.** If the app detects it has been unused for N days (based on a timestamp written on each open), show a prompt on next open: "You haven't used WordLover in X days. Your local data may have been cleared. Tap to check." Then validate that the local database is intact.
4. **Document the risk.** In install documentation, add a section: "iOS Storage Note — iOS may clear app data for apps that haven't been used recently. Enable cloud sync or export a backup regularly to protect your vocabulary list."

---

### ARCH-4 · Full-copy sync will not scale

**Issue:** The sync engine uploads a full encrypted snapshot on every sync operation. For a user with years of history, study events, checkpoints, and generated materials, the snapshot could grow to tens of megabytes. Every sync would upload and download the full package, which is slow and wastes Google Drive quota.

**Suggestion:** Design for a two-tier sync strategy from the start, even if only Tier 1 is implemented in Phase 4:

**Tier 1 (Phase 4 — full snapshot):** Upload the full encrypted snapshot. Simple to implement. Acceptable when user-data snapshot is under ~5 MB.

**Tier 2 (future — event log sync):** Append an immutable event log (since study events are already designed as immutable records) to Drive in addition to the full snapshot. On sync, download only new events since the last sync version. Merge locally. Upload a new full snapshot only when a threshold number of events accumulate or on explicit user request.

To make Tier 2 easy to add later, the architecture should:

- Keep the `syncVersion` as a monotonically increasing integer (already specified).
- Store study events in their own IndexedDB object store, separate from mutable vocabulary state, and include `syncVersion` on every event.
- Define the full snapshot as a *compaction* of the event log, so Tier 2 is a natural extension.

Add a note in the architecture: "Full-snapshot sync is the Phase 4 baseline. Event-log sync is the planned Phase 6+ extension. The sync version field and immutable study event design are prerequisites for both."

---

### ARCH-5 · Autosave dwell period belongs in the PRD

**Issue:** The architecture specifies the dwell period before autosaving, but autosave timing is user-visible behavior. If it lives only in the architecture, it is invisible to PRD-level review and can silently drift during implementation.

**Suggestion:** Move the dwell period definition to the PRD as a sub-requirement of Req 33 (see PRD-3 above), and in the architecture reference it. The current requirement is at least 5 seconds. This keeps the single source of truth in the PRD and the implementation detail in the architecture.

Additionally, make the dwell period a named constant in code (`AUTOSAVE_DWELL_MS = 5000`) rather than an anonymous magic number, so it is easy to change and test.

---

### ARCH-6 · FSRS integration detail missing

**Issue:** The architecture references FSRS but does not specify the TypeScript library, how FSRS's internal state fields (`stability`, `difficulty`, `elapsed_days`, `scheduled_days`, `reps`, `lapses`, `state`) map to the `ReviewState` schema, or how the quiz component infers FSRS ratings.

**Suggestion:** Add an FSRS integration spec section to the architecture:

**Recommended library:** `[ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs)` — a TypeScript-native FSRS 5 implementation, actively maintained, and used by several open-source flashcard apps.

`**ReviewState` schema extension:**

```text
ReviewState
  vocabularyItemId
  fsrsRating: again|hard|good|easy
  fsrsCard                     — serialized FSRS Card object (stability, difficulty,
                                  elapsed_days, scheduled_days, reps, lapses, state)
  nextReviewAt                 — derived from fsrsCard.due
  lastReviewedAt
  isMastered                   — true when stability > MASTERY_THRESHOLD
  difficultMode                — true when recent app-inferred ratings include Again/Hard
```

**Rating inference:**

The user does not manually pick a rating. The quiz component infers Again, Hard, Good, or Easy from correctness, response time, quiz mode, and repeated misses.

**Mastery threshold:** Set `isMastered = true` when FSRS-predicted retention at 90 days exceeds 0.90. Mastered terms are excluded from normal due-review lists but FSRS scheduling continues in background.

---

### ARCH-7 · ChatGPT integration is architecturally ambiguous

**Issue:** The architecture offers two options: deep-link to ChatGPT.com with context, or use the OpenAI API if the user configures credentials. These are very different UX flows. Deep-linking exits the app and loses state. API key entry requires users to have an OpenAI API account, which is separate from a ChatGPT subscription and has separate billing.

**Suggestion:** **Gemini  (free tier, user's Google account)**

- The user already has a Google account (they're using Google Drive for sync)
- No second account or key needed — reuse the same Google OAuth flow
- Genuinely free, no card, no expiration
- Strong English-Chinese bilingual capability

---

### ARCH-8 · Diagnostic upload to Git lacks a concrete mechanism

**Issue:** The architecture says "upload to configured Git repository" but a PWA cannot `git push`. The architecture lists this as an open decision but does not sketch even a rough solution.

**Suggestion:** As a simpler primary path, replace Git upload with the [Web Share API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Share_API) (`navigator.share({ files: [bundleFile] })`), which on iOS opens the native share sheet (AirDrop, Mail, Files, etc.) and on Android opens the system share sheet. No token management required. Git upload becomes an advanced/optional flow for users who want automated structured upload. Add this decision to the Open Decisions section with a recommended answer.

---

### ARCH-9 · `isUserPreferred` boolean is insufficient for multi-meaning ordering

**Issue:** The `Meaning` entity uses `isUserPreferred` as a boolean flag. When a term has multiple meanings from multiple sources (e.g., three ECDICT meanings, two WordNet meanings, one AI-generated meaning), a single boolean does not define display order among non-preferred meanings.

**Suggestion:** Replace `isUserPreferred` with a `displayOrder` integer (or a `userRank` nullable integer):

```text
Meaning
  id
  vocabularyItemId
  language: en | zh
  text
  source: ECDICT | WordNet | user_edited | AI_assisted
  sourceRef
  displayOrder          — integer, lower = shown first; default from source priority
  userRank              — nullable integer, set by user drag-to-reorder; overrides displayOrder
  createdAt
```

Default `displayOrder` assignment:

1. User-edited meanings (rank 0)
2. ECDICT meanings in frequency order (rank 1–N)
3. WordNet meanings in frequency order (rank N+1–M)
4. AI-assisted meanings (rank M+1–P)

If the user reorders meanings, write `userRank` values and sort by `userRank` when non-null, otherwise `displayOrder`. This is backward-compatible: existing code that looked for "the preferred meaning" can take `ORDER BY COALESCE(userRank, displayOrder) ASC LIMIT 1`.

---

### ARCH-10 · Immutable study events need a size budget and pruning strategy

**Issue:** The architecture correctly makes study events immutable for reproducible stats and safe sync. However, a user who reviews vocabulary daily will accumulate thousands of events over months or years. There is no defined pruning or archival strategy.

**Suggestion:** Add a study event retention policy to the architecture:

- Keep all events for the current and previous calendar year as active records.
- Archive older events into a compressed yearly summary blob (e.g., `study-events-2024.cbor.zst`) stored in OPFS. Summary blobs are included in cloud sync and export.
- The active event store is used for stats, scheduler, and sync. Summary blobs are used only for historical stats views.
- Define an approximate size budget: an active event with all fields is roughly 200–400 bytes. 1,000 events/year × 400 bytes ≈ 400 KB/year uncompressed — manageable. If a user reviews 10 words/day, that is ~3,600 events/year. Active store stays small as long as old events are archived.

Add this as a new section under the Data Architecture heading: "Study Event Retention Policy."

---

## Part 3 — Cross-cutting Suggestions

### CROSS-1 · Add a decision log

Several architectural decisions are listed under "Open Decisions" but have no record of *why* alternatives were rejected. As the project grows and revisits these choices (e.g., switching from SQLite WASM to sharded JSON after Phase 0), there will be no record of the original reasoning.

**Suggestion:** Add a `decisions/` folder (or an `ADR` section at the bottom of the architecture document) with one entry per significant decision. A minimal format:

```markdown
## ADR-001 — PWA over native iOS app
Date: 2026-05-24
Status: Accepted
Context: No-fee long-term iPhone install required.
Decision: PWA via Safari Add to Home Screen.
Alternatives considered: React Native (requires Apple Developer Program), Capacitor (same constraint).
Consequences: Storage eviction risk on iOS; no push notifications on older iOS.
```

This takes 10 minutes per decision and saves hours of re-litigation later.

---

### CROSS-2 · Define supported device and OS baseline

Neither the PRD nor the architecture defines a minimum supported OS version. This matters because OPFS, Web Crypto, and service worker behavior differ significantly between iOS 15, iOS 16, and iOS 17.

**Suggestion:** Add a supported platform table to the architecture:

| Platform        | Minimum version | Notes                                |
| --------------- | --------------- | ------------------------------------ |
| iPhone / Safari | iOS 17.0        | OPFS stable; Web Crypto full support |
| iPad / Safari   | iOS 17.0        | Same as iPhone                       |
| Android Chrome  | Chrome 109+     | Full PWA install; OPFS stable        |
| Windows Edge    | Edge 109+       | PWA install; OPFS stable             |
| Windows Chrome  | Chrome 109+     | Same as Edge                         |

Anything below these baselines gets a "browser may not support all features" banner rather than a broken experience. Add a corresponding PRD requirement: "The app must display a clear compatibility warning on browsers that do not support required features, and must degrade gracefully without crashing."

---

### CROSS-3 · Phase 0 should produce a written validation report

**Issue:** Phase 0 is listed as a set of validation tasks but has no specified output artifact. If Phase 0 results are not written down, the team (even if it is one person) will not have a baseline to refer back to when debugging performance regressions or platform bugs in later phases.

**Suggestion:** Require a short Phase 0 Validation Report as the exit criterion for Phase 0. The report should record:

- Device models and OS versions tested
- SQLite WASM library version and persistence mode used
- Measured startup and search latency (median and p95 over 20 runs)
- Storage quota available and granted
- Whether offline launch worked after install
- Whether export/import tar worked in the browser
- Decision on encryption key recovery model
- Pass or fail verdict with rationale

This document becomes the foundation for Phase 1 architecture decisions and can be committed to the repository alongside the architecture doc.

---

*End of review — 2026-05-24*
