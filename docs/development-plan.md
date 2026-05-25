# WordLover Development Plan

Date: 2026-05-24

This plan follows the current product priority:

1. iPhone first.
2. Windows second as automation and stress-test fallback.
3. Android last, after iPhone and Windows are stable.

## Current Technical Baseline

- PWA-first path is accepted for no-fee long-term iPhone use.
- Current generated SQLite dictionary has `770,611` rows and is about `197 MB`.
- Windows browser POCs prove SQLite WASM lookup speed is far under the 1 second target.
- iPhone online POC works: app starts fast and dictionary loads fast.
- Initial iPhone offline test found a real gap: shell starts offline, but dictionary search did not work until dictionary persistence was added.
- The POC now saves the dictionary into IndexedDB after online load and falls back to the saved copy offline.
- Windows fallback automation verifies offline dictionary load/search from IndexedDB works.
- iPhone automated suite reports now verify service worker readiness, IndexedDB dictionary persistence, OPFS persistence, encrypted export/import, mock sync, and p95 lookup time well under 1 second after open.
- Latest iPhone Home Screen PWA suite runs reported standalone display mode, persistent storage granted, shell cache `wordlover-poc-shell-v13`, dictionary fetch about `7.31 s`, SQLite open about `14-17 ms`, and lookup p95 about `0.28 ms`.
- The current `sql.js` POC still fetches about 206 MB for first install and uses a full in-memory SQLite buffer. This works on iPhone 17 Pro but does not satisfy the production memory direction; assume it exceeds the <= 50 MB iPhone DRAM target until proven otherwise.
- The live app now has passphrase-wrapped encrypted user records, a persistent IndexedDB connection, Chinese-to-English lookup, fuzzy misspelling suggestions, startup auto-load UX, a resumable chunked dictionary installer, an iPhone install-context banner, a compact three-dot app menu, theme selection, Google/Gemini integration surfaces, and a debug review acceleration mode.

## Phase 0: Finish iPhone Feasibility

Goal: prove the fundamental iPhone technical path before expanding features.

Scope:

- Run updated iPhone offline dictionary persistence test.
- Run iPhone automated timed suite with `?autorun=1`. Status: passed on iPhone Safari.
- Verify iPhone result upload into `poc/iphone-pwa/received-results`. Status: passed.
- Test iPhone close/reopen and iPhone restart persistence.
- POC `wa-sqlite` + OPFS on iPhone and compare with `sql.js` memory/startup behavior before choosing the production dictionary engine.
- Replace the current `sql.js` dictionary query runtime with a real `wa-sqlite`+OPFS query engine or sharded package before claiming the 50 MB iPhone memory target.
- Measure peak and steady-state iPhone memory during dictionary install, open, lookup, background, and relaunch. Production target is <= 50 MB normal-use incremental memory.
- Confirm the app version/update menu can activate a new service worker on the real iPhone Home Screen PWA.
- Add Vite + TypeScript + Workbox before Phase 1 grows beyond the current single-page POC.
- Test basic Google OAuth feasibility only after OAuth client setup exists.

Exit criteria:

- iPhone Home Screen PWA opens offline.
- Dictionary loads from local persisted storage while offline.
- `abandon` and `take off` search successfully while offline.
- iPhone lookup p95 is under 1 second after dictionary load.
- Storage quota is enough for dictionary plus user data.
- Normal-use iPhone memory is <= 50 MB, or the dictionary engine is changed before production Phase 1 continues.
- Result JSON is captured for repeatability.

## Phase 1: Fundamental Dictionary App

Goal: make the iPhone dictionary feature usable as the first real application slice.

Scope:

- iPhone-friendly home screen with search as the first interaction.
- Dictionary install/load state clearly visible.
- Exact word and short phrase search.
- Prefix, phrase, Chinese-to-English, and fuzzy misspelling suggestions for typed input.
- English meaning, Chinese meaning, IPA/pronunciation field, source, tags, and lookup latency.
- Recent valid searches.
- Offline dictionary load from IndexedDB.
- Encrypted storage for user-specific POC records before vocabulary data is introduced.
- Persistent IndexedDB connection instead of opening a new database connection per read/write.
- Resumable dictionary install checkpoints for interrupted first-time dictionary download.
- Lightweight frequency-ranked "Explore next" word prompt.
- Diagnostics hidden behind an advanced panel.
- PWA install/update behavior that reliably refreshes service worker assets.
- Three built-in color schemes and saved theme selection.
- Compact three-dot menu beside the search controls.

Current implementation started:

- Search-first iPhone UI added in the PWA.
- Dictionary status cards added.
- Prefix suggestions added.
- Chinese-to-English lookup and fuzzy misspelling suggestions added.
- Startup auto-load now shows a loading state instead of asking the user to tap after install.
- User-specific POC records are encrypted with Web Crypto before storage.
- IndexedDB access now reuses one connection for the app lifetime.
- Dictionary installer now stores 4 MB chunk checkpoints when the server supports `Range`.
- Frequency-ranked "Explore next" prompt added.
- Versioned app assets added to avoid stale service worker JavaScript/CSS.
- Compact app menu added with app version, user-data format version, dictionary engine, sync status, memory-target note, export state, and update controls.
- Three color schemes added: Calm teal, Ink focus, and Sunrise.
- Menu moved beside the clear search button as a compact three-dot control.
- URL-based automated search smoke added, for example `/?q=take%20off&report=1`.
- End-user home screen compacted by removing always-visible developer/status panels.
- Recent searches now appear on search-input focus and disappear once a recent term is selected.

Exit criteria:

- On iPhone, user can open app, load dictionary, search `abandon`, search `take off`, close/reopen, and repeat.
- If dictionary has been loaded once, the same searches work without Wi-Fi.
- UI is readable and touch-friendly on iPhone.

## Phase 2: Vocabulary Save And Local User Data

Goal: connect dictionary search to the one-user vocabulary list.

Scope:

- Save current dictionary result to vocabulary list.
- Autosave valid dictionary search after an at-least-5-second dwell period.
- Disable autosave setting.
- Recent valid search history.
- Edit saved English/Chinese meaning and pronunciation.
- Preserve original dictionary meaning separately from user edits.
- Archive/hide terms.
- Encrypted local user-data storage.

Current implementation started:

- Vocabulary panel added to the PWA home screen.
- Manual save from the current dictionary result added.
- Saved-state button prevents duplicate active entries.
- Autosave setting added and persisted per user; valid dictionary results autosave only after an at-least-5-second dwell.
- Saved vocabulary items preserve original dictionary meanings/source separately from editable user meanings.
- Edit flow added for English meaning, Chinese meaning, and pronunciation.
- Archive and restore controls added.
- Vocabulary records include `createdDeviceId`, `syncVersion`, and `isSynced` fields to support later sync/version work.
- Browser smoke verified manual save, autosave, archive, restore, saved-state rendering, and iPhone-width layout.

Exit criteria:

- User can search, save, edit, archive, and restore terms offline.
- Saved user data survives app close/reopen.

## Phase 3: Review And Learning Loop

Goal: make saved words studyable.

Scope:

- Daily stats: new saved, reviewed, mastered.
- Review due list.
- Proactive new-word button.
- First-attempt multiple-choice quiz.
- Fast encoding mode.
- FSRS-compatible scheduling.
- Difficult word mode.

Current implementation started:

- Home screen daily stats added for new saved terms, reviewed terms, and mastered terms.
- Saved vocabulary terms now have review state with FSRS-compatible rating (`again`, `hard`, `good`, `easy`), due time, review count, and mastered timestamp.
- Due-review button starts a multiple-choice review for saved due terms.
- Review completion reveals the answer first and then records the user's explicit FSRS rating: Again, Hard, Good, or Easy. Debug automation can still assign ratings automatically for repeat tests.
- "Study one more" starts a first-attempt multiple-choice quiz from frequent unsaved TOEFL terms.
- Passing the first-attempt new-word quiz does not add the term to the vocabulary list.
- Missing the first-attempt quiz saves the word to the vocabulary list for future review.
- Study events are encrypted as individual local records and include term, rating/result, timestamp, and device id.
- Browser smoke verified due review, explicit FSRS rating capture, proactive new-word quiz, stats updates, and iPhone-width layout.
- Diagnostics debug speed added: one review day elapses every 20 seconds and debug-created data is purged when disabled.
- Automated review, quiz, and FSRS-rating checks added to the browser test suite.

Exit criteria:

- User can study new words and review due words fully offline.
- Review events update stats and scheduling.

## Phase 4: Export, Checkpoint, Diagnostics

Goal: make the app recoverable and debuggable before cloud sync.

Scope:

- Encrypted tar export/import.
- Local checkpoints.
- Rollback to known-good checkpoint.
- Redacted diagnostic bundle.
- Browser download and Web Share where available.
- Optional result upload endpoint remains POC-only, not product behavior.

Exit criteria:

- User can export, delete local data, import, and recover vocabulary progress.
- Diagnostics can be shared without leaking sensitive content by default.

## Phase 5: Google Drive Sync

Goal: sync user-specific data across devices.

Scope:

- Google OAuth with PKCE.
- First-install Google sign-in prompt with a clear Skip option for offline-only use.
- Current implementation surface can load Google Identity Services and connect when `wordlover-config.js` contains a production OAuth client ID.
- Encrypted full snapshot upload/download. The current app upserts one passphrase-encrypted Drive app-data snapshot and can restore the latest encrypted snapshot after confirmation.
- Sync status: synced, pending, failed, offline.
- Conflict-safe merge or restore prompt.
- Cloud copy includes app version and user data format version.

Exit criteria:

- Same user can restore vocabulary progress on another browser/device.
- Offline edits queue and sync later.

## Phase 6: AI-Assisted Details

Goal: add optional online enrichment without weakening offline core.

Scope:

- AI provider abstraction.
- Gemini default no-additional-fee path if feasible.
- Gemini access should reuse the signed-in Google account when feasible and remain optional/online-only.
- Current implementation surface adds a Gemini details button to dictionary results, calls the configured Gemini model after Google auth succeeds, requests structured JSON, validates it, and renders learner cards instead of raw JSON.
- Optional ChatGPT/OpenAI provider.
- Structured examples, cloze sentences, common phrases, and follow-up prompts.
- User can save AI-assisted content separately from dictionary/user-edited meanings.

Exit criteria:

- Core dictionary and study still work without AI.
- AI content is source-labeled and validated before saving.

## Phase 7: Android Deferred Work

Goal: validate Android only after iPhone and Windows paths are stable.

Scope:

- Android Chrome PWA install.
- Android storage quota and offline dictionary persistence.
- Android UI touch pass.
- Optional Android TWA/APK only if useful.

Exit criteria:

- Android does not require redesign of the iPhone-first architecture.
