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

## Phase 0: Finish iPhone Feasibility

Goal: prove the fundamental iPhone technical path before expanding features.

Scope:

- Run updated iPhone offline dictionary persistence test.
- Run iPhone automated timed suite with `?autorun=1`.
- Verify iPhone result upload into `poc/iphone-pwa/received-results`.
- Test iPhone close/reopen and iPhone restart persistence.
- Test basic Google OAuth feasibility only after OAuth client setup exists.

Exit criteria:

- iPhone Home Screen PWA opens offline.
- Dictionary loads from local persisted storage while offline.
- `abandon` and `take off` search successfully while offline.
- iPhone lookup p95 is under 1 second after dictionary load.
- Storage quota is enough for dictionary plus user data.
- Result JSON is captured for repeatability.

## Phase 1: Fundamental Dictionary App

Goal: make the iPhone dictionary feature usable as the first real application slice.

Scope:

- iPhone-friendly home screen with search as the first interaction.
- Dictionary install/load state clearly visible.
- Exact word and short phrase search.
- Prefix suggestions for typed input.
- English meaning, Chinese meaning, IPA/pronunciation field, source, tags, and lookup latency.
- Recent valid searches.
- Offline dictionary load from IndexedDB.
- Diagnostics hidden behind an advanced panel.
- PWA install/update behavior that reliably refreshes service worker assets.

Current implementation started:

- Search-first iPhone UI added in the PWA.
- Dictionary status cards added.
- Prefix suggestions added.
- Versioned app assets added to avoid stale service worker JavaScript/CSS.
- URL-based automated search smoke added, for example `/?q=take%20off&report=1`.

Exit criteria:

- On iPhone, user can open app, load dictionary, search `abandon`, search `take off`, close/reopen, and repeat.
- If dictionary has been loaded once, the same searches work without Wi-Fi.
- UI is readable and touch-friendly on iPhone.

## Phase 2: Vocabulary Save And Local User Data

Goal: connect dictionary search to the one-user vocabulary list.

Scope:

- Save current dictionary result to vocabulary list.
- Autosave valid dictionary search after dwell period.
- Disable autosave setting.
- Recent valid search history.
- Edit saved English/Chinese meaning and pronunciation.
- Preserve original dictionary meaning separately from user edits.
- Archive/hide terms.
- Encrypted local user-data storage.

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
- Encrypted full snapshot upload/download.
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
