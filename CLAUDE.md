# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

WordLover is a local-first vocabulary/dictionary PWA. The runtime app is plain HTML/JS/CSS served from `apps/wordlover-pwa/public/` — there is no bundler, no `package.json`, no `node_modules`. The current build is `app.js` + `sw.js` loaded directly as ES modules. A Vite/TypeScript migration is planned but not started.

Platform priority is deliberate and load-bearing: **iPhone first, Windows second (used as the automation/stress-test fallback for anything that can't be automated on iPhone), Android deferred**. Don't add Android-specific code paths or polish before iPhone and Windows are stable. See `docs/architecture-design.md` for full rationale and `prd.md` (Status column = current source of truth for which requirements are `done`/`partial`/`open`/`deferred`).

## Two run paths (deliberate, both needed)

### Windows (HTTP, used for development + automation)

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File apps\wordlover-pwa\scripts\start-windows.ps1 -Port 4173
```

Then open `http://127.0.0.1:4173/?fresh=v34` (the `?fresh=...` cache-buster matters — see "Cache versioning" below). The automated suite lives at `/automated-tests.html?fresh=v34` and is run by clicking **Run automated tests** in the page, or with `?autorun=1`. Results JSON is POSTed to `/__test_results` (HTTPS server only) and saved under `apps/wordlover-pwa/received-results/` (gitignored).

### iPhone (HTTPS, required because PWA APIs need a secure context)

```powershell
.\start-iphone-https.ps1
```

This wraps `apps/wordlover-pwa/scripts/serve-https.py`, which adds `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` (required for OPFS + threaded WASM) and serves over TLS using certs under `apps/wordlover-pwa/certs/` (gitignored). First-time setup uses `apps/wordlover-pwa/scripts/create-local-ca-and-cert.ps1 -IpAddress <LAN-IP>`.

Both server scripts prefer the Codex-bundled Python at `~/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe` and fall back to `python` on PATH.

## Dictionary data pipeline (separate from the app)

The dictionary is built offline by Python scripts under `scripts/` from ECDICT source data and consumed by the PWA as a static asset. The generated SQLite files are **gitignored** — rebuild from source rather than committing them.

```powershell
python scripts/build_dictionary.py              # ECDICT zip → data/dictionary.sqlite (~197 MB, ~770k rows)
python scripts/augment_dictionary_wordnet.py    # fill missing English defs from WordNet 3.0
python scripts/augment_dictionary_opted.py      # fill remaining from OPTED/Webster 1913
python scripts/build_slim_dictionary.py         # data/dictionary.sqlite → data/dictionary-slim.sqlite (~32 MB, ~100k rows)
python scripts/package_dictionary_web.py --copy-sqlite   # → public/dictionary.sqlite + .zst + manifest (uses slim by default)
```

The product PWA ships **only the slim 100k-entry dictionary** (~32 MB raw, ~15 MB zstd). The full ~200 MB / ~770k-row dictionary stays under `data/` as the build-time source of truth, never packaged into the install bundle. The slim set is composed of all TOEFL-tagged entries + all single words with any frequency signal (frq/bnc/Collins/Oxford) + phrases whose constituents are all in the slim set, ranked by average constituent frequency. See `docs/dictionary-data.md` for full details.

`package_dictionary_web.py` defaults to `data/dictionary-slim.sqlite`; pass `--input data/dictionary.sqlite` if you need a full-dictionary build for memory benchmarking.

**Upgrade behavior for already-installed devices**: the app fetches `/dictionary-manifest.json` on every dictionary load (service worker bypasses cache for it), compares the manifest's `dictionaryDataVersion` against the locally-stored value, and on mismatch invalidates the local IndexedDB / OPFS copy before re-downloading. So a device that previously installed the 200 MB dictionary drops to the 32 MB slim version automatically on the next online launch with this build.

Source dataset details (counts, TOEFL coverage, source priority for meaning display) are in `docs/dictionary-data.md`.

## Cache versioning — the easiest thing to break

The service worker pre-caches a fixed list of versioned URLs. Three things must move together when shipping changes that affect the app shell:

1. `CACHE_NAME` and `SHELL_CACHE_VERSION` constant (`sw.js` line 1, `app.js` near top, `automated-tests.js` `SHELL_CACHE_NAME`) — bump to the new shell version.
2. `?v=YYYYMMDD-N` query strings on every shell asset reference in `index.html`, `automated-tests.html`, `sw.js` `SHELL_ASSETS`, and `automated-tests.js` `SHELL_ASSETS` — bump in lockstep.
3. `APP_VERSION` in `app.js` (user-visible in the menu).

If you only bump one, users will see a stale shell, or the service worker will fail to pre-cache (mismatched URLs), or the automated test suite's shell-cache readiness check will report the wrong version. The service worker is **never** allowed to call `skipWaiting()` during install — only after the user clicks **Apply update** in the menu (the app posts a `SKIP_WAITING` message). Don't bypass this; the manual update flow is a product requirement, not an oversight.

## Dictionary engine: two paths, one production gate

The shipped query engine is `sql.js`, which loads the entire SQLite file into WASM memory. With the **slim 32 MB dictionary** that's now ~32 MB resident, which fits comfortably under the 50 MB iPhone DRAM target — the architecture's `wa-sqlite` + OPFS engine remains the production direction for larger future dictionaries but is no longer the only path that can meet the memory target. The wa-sqlite vendor bundle is present under `public/vendor/wa-sqlite/` and a smoke-test worker exists at `public/wa-sqlite-opfs-worker.js`.

Confirm the 50 MB target with a real iPhone measurement before declaring it met; the previous gap was specifically that `sql.js` + 200 MB dictionary blew through the budget by ~4×.

Either way, route dictionary access through the repository abstraction in `app.js` rather than calling `sql.js` directly from UI/vocabulary/quiz code — the whole point is to be able to swap the engine.

## App-level data architecture

Two stores, kept separate on purpose:

- **Dictionary** (read-only, rebuildable): `dictionary.sqlite` lives in OPFS / IndexedDB blob, plus the in-app `sql.js` instance.
- **User data** (authoritative, must survive shell updates): encrypted records in IndexedDB (`wordlover-user` DB, stores: `kv`, `files`, `keys`, `vocabularyRecords`, `studyEventRecords`, `checkpoints`). Encryption uses Web Crypto AES-GCM with a passphrase-wrapped DEK.

Service-worker cache replacement may delete old shell caches **only** — it must never clear IndexedDB / OPFS / local storage / vocabulary / study events / dictionary packages. Migrations between data format versions must merge legacy and current stores (legacy aggregate vocabulary list + per-record store), not replace one with the other. Snapshot restore (e.g. Google Drive sync) must use an atomic IndexedDB transaction so an interrupted restore can't leave stores empty.

Study events are immutable; mutable vocabulary state is separate. `syncVersion` lives on every event so the future event-log sync (Tier 2) can be added without redesigning the store. The current sync (Tier 1) is full encrypted snapshot upsert to Drive `appDataFolder`.

## When making changes

- Treat `prd.md`'s Status column as the source of truth for what's actually shipped. Don't claim a requirement is `done` just because code references it — check it works in the app.
- Local development passphrase before v34 was silently `wordlover-localhost-development-passphrase`; users who never set their own need this value to unlock encrypted records on Windows.
- Mac iPhone simulator / Safari Web Inspector / Xcode Instruments is the only reliable way to measure iPhone DRAM. Don't infer iPhone memory from Windows browser numbers — note the limitation explicitly when measurement isn't available.
- The `?q=...&report=1` and `?autorun=1` URL parameters drive automated smoke tests; preserve them when touching `app.js` startup logic.
- iPhone validation reports land in `apps/wordlover-pwa/received-results/` (gitignored) via POST to the HTTPS server's `/__test_results` endpoint; Windows results are saved manually under `docs/validation/phase0-automation/`.

## Headless smoke harness

`apps/wordlover-pwa/scripts/smoke-headless.py` drives the running Windows HTTP server through Playwright Chromium for non-interactive validation. It loads the page, waits for `window.WordLoverApp` to initialize, forces a dictionary load, then exercises a few API entry points (manual unknown-term save, `lookupTerm`, vocabulary state). Run it with the local server already up:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File apps\wordlover-pwa\scripts\start-windows.ps1 -Port 4173   # in one window
python -m pip install --user playwright
python -m playwright install chromium
python apps\wordlover-pwa\scripts\smoke-headless.py
```

It is not a replacement for the in-browser `automated-tests.html` suite (which exercises service worker readiness, OPFS persistence, encrypted export/import, mock sync, and timed lookup benchmarks) but it is the cheapest way to catch a regression in the main app shell before paying for an iPhone validation cycle.
