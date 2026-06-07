# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

WordFan is a local-first vocabulary/dictionary PWA for English learners. The runtime app is **plain HTML/CSS/ES modules** served from `apps/wordlover-pwa/public/` — no bundler, no build step, no `node_modules` at runtime. The app brand is "WordFan" in UI and manifest; internal identifiers, IndexedDB names, and Drive file names stay as "wordlover" for data continuity.

**Platform priority (load-bearing):** iPhone first, Windows second (automation/stress-test fallback), Android deferred. Don't add Android code paths before iPhone and Windows are stable.

Before searching code, read `docs/ai/AUTO_SYMBOL_MAP.md` — it maps feature areas to functions and line numbers, saving token-heavy file reads.

## Development commands

### Run on Windows (HTTP, dev + automation)

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File apps\wordlover-pwa\scripts\start-windows.ps1 -Port 4173
```

Open `http://127.0.0.1:4173/?fresh=v<N>` — the `?fresh=` cache-buster matters, use the current shell version number.

### Run on iPhone (HTTPS, required for PWA APIs)

```powershell
.\start-iphone-https.ps1
```

Wraps `apps/wordlover-pwa/scripts/serve-https.py`, which adds the COOP/COEP headers required for OPFS + threaded WASM and serves over TLS using certs under `apps/wordlover-pwa/certs/` (gitignored).

### Automated in-browser test suite

Open `http://127.0.0.1:4173/automated-tests.html?fresh=v<N>` and click **Run automated tests**, or append `?autorun=1` for unattended mode.

### Headless smoke test (cheapest regression check)

```powershell
python apps\wordlover-pwa\scripts\smoke-headless.py
```

Requires the Windows server to be running and Playwright/Chromium installed (`python -m playwright install chromium`).

### CI checks (run locally before pushing)

```powershell
# JS syntax check
cd apps/wordlover-pwa/public
node --check app.js; node --check sw.js; node --check automated-tests.js

# Cache-version lockstep
python apps/wordlover-pwa/scripts/check_versions.py

# Shell-asset manifest validation
cd apps/wordlover-pwa && npm run validate:shell-assets
```

### CI dictionary fixture (for headless smoke without production data)

```powershell
python apps\wordlover-pwa\scripts\create-ci-dictionary.py --force
```

Writes a tiny `dictionary.sqlite` + `.zst` + `dictionary-manifest.json` with only the terms CI needs (`abandon`, `take off`, etc.). Do not commit generated dictionary files.

**The fixture overwrites the same `public/` files the app serves.** To avoid silently replacing the shipped ~100k-entry dictionary (and committing the fixture manifest, as happened once), the script **refuses to overwrite a production manifest** (`variant != "ci-fixture"`) unless `--force` is passed. CI uses `--force` in a throwaway checkout. Locally, prefer `npm run test:browser:ci` (`run-browser-tests-ci.py`), which snapshots and restores the production dictionary around the run. If you ever run with `--force` directly on a dev box, restore production afterward with `python scripts/package_dictionary_web.py --copy-sqlite`.

## Cache versioning — the easiest thing to break

**Three things must be bumped together** every time app shell files change:

1. `CACHE_NAME` / `SHELL_CACHE_VERSION` — in `sw.js` line 1, `app.js` near top, and `automated-tests.js` `SHELL_CACHE_NAME`.
2. `?v=YYYYMMDD-N` query strings — on every shell asset reference in `index.html`, `automated-tests.html`, `sw.js` `SHELL_ASSETS`, and `automated-tests.js` `SHELL_ASSETS`. All must match.
3. `APP_VERSION` in `app.js` (user-visible in the menu).

If only one moves, users see stale shells or the service worker fails to pre-cache. `check_versions.py` enforces this in CI.

**Never** add `skipWaiting()` to the install handler. The service worker only calls it after the user clicks **Apply update** (via `SKIP_WAITING` message). This is a product requirement.

## Architecture

### App entry points

| File | Role |
|------|------|
| `apps/wordlover-pwa/public/app.js` | Single-file app (~8000+ lines): dictionary engine, vocabulary/spelling CRUD, FSRS scheduling, review/quiz UI, Google Auth, Drive sync, Gemini AI, checkpoints |
| `apps/wordlover-pwa/public/sw.js` | Service worker: shell pre-cache, offline fetch, `SKIP_WAITING` handler |
| `apps/wordlover-pwa/public/fsrs-scheduler.js` | FSRS scheduling helpers (imported by `app.js`) |
| `apps/wordlover-pwa/public/wordlover-config.js` | Local configuration overrides (Google client ID, Gemini key, passphrase) |
| `apps/wordlover-pwa/public/index.html` | Static DOM shell with versioned asset URLs |
| `apps/wordlover-pwa/public/automated-tests.html/js` | In-browser test suite |

### Two data stores (kept separate on purpose)

- **Dictionary** (read-only, rebuildable): `dictionary.sqlite` fetched on first online launch, stored in IndexedDB blob (OPFS optional). Queried via `sql.js` (WASM, entire file in memory). The shipped dictionary is the slim ~32 MB / ~100k-entry set.
- **User data** (authoritative, must survive shell updates): IndexedDB `wordlover-user` DB, stores `kv`, `files`, `keys`, `vocabularyRecords`, `studyEventRecords`, `spellingRecords`, `spellingEventRecords`, `userDictionary`, `known`, `checkpoints`. Encrypted with Web Crypto AES-GCM (passphrase-wrapped DEK).

Service-worker cache replacement may delete old shell caches **only** — it must never clear IndexedDB, OPFS, local storage, or any user data.

### Dictionary engine

Current production path: `sql.js` loads the 32 MB slim SQLite file into WASM memory. The `wa-sqlite` + OPFS engine is vendored at `public/vendor/wa-sqlite/` and tested via a smoke worker (`public/wa-sqlite-opfs-worker.js`) but is not yet the default — it's the production target when iPhone memory validation runs. Route all dictionary access through the abstraction in `app.js` (not directly to `sql.js`) to keep the engine swappable.

### Google Drive sync

Tier 1: full encrypted snapshot upsert to Drive `appDataFolder`. Study events carry a `syncVersion` for the planned Tier 2 event-log sync. Snapshot restore uses an atomic IndexedDB transaction.

### Feature routing (quick reference)

| Feature | Look in |
|---------|---------|
| Dictionary search / install | `app.js`: `loadDictionary`, `lookupTerm`, `lookupChineseTerm`, `suggestTerms` |
| Vocabulary save / edit / archive | `app.js`: `saveVocabularyItem`, `resultToVocabularyItem`, `renderVocabulary` |
| Review / scheduling | `app.js`: `getDueVocabularyItems`, `scheduleFromFsrsRating`, `recordReviewRating` |
| Spelling track | `app.js`: `startSpellingReview`, `checkSpelling`, `recordSpellingReview` |
| Offline shell / update flow | `sw.js` + `app.js`: `checkForAppUpdate`, `applyAppUpdate` |
| Google auth / Drive sync | `app.js`: `requestGoogleAccessToken`, `syncToGoogleDrive`, `restoreFromGoogleDrive` |
| Gemini AI / AI chat | `app.js`: `requestGeminiDetails`, `openAiChatPanel`, `prefetchAiChat` |
| Checkpoints / rollback | `app.js`: `createCheckpoint`, `rollbackLatestCheckpoint` |
| Study goals | `app.js`: `openGoalsWizard`, `renderGoalsPanel`, `saveStudyGoals` |

## Dictionary data pipeline (offline, separate from the app)

Generated SQLite files are **gitignored** — rebuild from source:

```powershell
python scripts/build_dictionary.py              # ECDICT → data/dictionary.sqlite (~197 MB)
python scripts/augment_dictionary_wordnet.py    # fill missing English defs from WordNet
python scripts/augment_dictionary_opted.py      # fill remaining from OPTED/Webster 1913
python scripts/build_slim_dictionary.py         # → data/dictionary-slim.sqlite (~32 MB, ~100k rows)
python scripts/package_dictionary_web.py --copy-sqlite  # → public/dictionary.sqlite + .zst + manifest
```

The app compares `dictionaryDataVersion` in the manifest against the locally-stored version on every load; a mismatch invalidates the local copy and triggers a re-download.

## Key invariants

- **prd.md Status column** is the source of truth for what's actually shipped. `done` means verified working in the app, not just referenced in code.
- **Windows passphrase for pre-v34 local data**: `wordlover-localhost-development-passphrase`. Users who never set their own passphrase need this to unlock local records.
- **iPhone memory**: don't infer from Windows numbers. Mac iPhone Simulator / Safari Web Inspector / Xcode Instruments is the only reliable path. Note explicitly when measurement isn't available.
- **`?q=...&report=1`** and **`?autorun=1`** URL params drive automated smoke; preserve them when touching `app.js` startup logic.
- Migrations must merge legacy and current stores (never replace one with the other). Snapshot restore must use an atomic IndexedDB transaction.

## After adding new source files

1. Update `scripts/generate_code_map.py` to include the new file.
2. Run `python scripts/generate_code_map.py` to regenerate `docs/ai/AUTO_SYMBOL_MAP.md`.

## Creating PRs

Use `gh` at `C:\Program Files\GitHub CLI\gh.exe`.
