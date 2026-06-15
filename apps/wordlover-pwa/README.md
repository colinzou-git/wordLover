# WordLover Product PWA

This is the formal WordLover PWA product app. iPhone is the primary user target; Windows is the repeatable automation and stress-test fallback for checks that cannot be fully automated on iPhone.

## Prepare

From the repo root:

```powershell
python scripts\build_slim_dictionary.py
python scripts\package_dictionary_web.py --copy-sqlite
New-Item -ItemType Directory -Force apps\wordlover-pwa\public\vendor
Invoke-WebRequest https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.13.0/sql-wasm.js -OutFile apps\wordlover-pwa\public\vendor\sql-wasm.js
Invoke-WebRequest https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.13.0/sql-wasm.wasm -OutFile apps\wordlover-pwa\public\vendor\sql-wasm.wasm
```

## Run On Windows

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File apps\wordlover-pwa\scripts\start-windows.ps1 -Port 4173
```

Then open:

```text
http://127.0.0.1:4173/?fresh=latest
```

Keep that PowerShell window open while using WordLover. If the server is closed, an already-open browser tab can still show the app shell from cache, but first-time dictionary install cannot fetch `dictionary.sqlite`.

If the menu still shows an older app version, open the cache-busting URL above, then use **Menu > Check update > Apply update**. Older builds used a cache-first app shell, so opening only `http://127.0.0.1:4173/` can keep showing the previous installed shell.

When the app asks to unlock encrypted local data on Windows, enter the passphrase you used before. Local builds before v34 silently used `wordlover-localhost-development-passphrase`; use that value if you never chose your own passphrase.

To run the automated suite, open:

```text
http://127.0.0.1:4173/automated-tests.html?fresh=latest
```

If the test suite shows `Dictionary fetch failed before an HTTP response`, the browser tab is still open but the local server is not running. Start the server again, reload the page, and rerun the suite.

Click **Run automated tests**. The suite includes a real main-app smoke test that opens WordLover in an iframe and verifies actual dictionary searches for `abandon` and `take off`, then continues with dictionary persistence, offline shell cache readiness, encrypted export/import, mock sync, review/quiz scheduling, and timed lookup benchmarks.

The suite also checks that `wa-sqlite` can open the OPFS dictionary from a worker when the bundled vendor files are present. The normal app still keeps the `sql.js` path as a fallback until the iPhone memory validation accepts the `wa-sqlite` engine.

To create the compressed production dictionary package:

```powershell
python -m pip install zstandard
python scripts\package_dictionary_web.py --copy-sqlite
```

## Local test commands (from apps/wordlover-pwa/)

Run the same checks that CI runs, from a fresh checkout:

```powershell
# Static checks (JS syntax + version lockstep + shell-asset manifest)
npm run build

# In-browser automated suite — requires a running server and a dictionary
# Option A: you already have a server running on port 4173
npm run test:browser

# Option B: one-shot — creates CI dictionary, starts a temp server, runs suite, stops it
python -m pip install playwright && python -m playwright install chromium
npm run test:browser:ci
```

## CI Dictionary Fixture

The production web dictionary is generated from offline source data and is not
committed. A clean GitHub Actions checkout therefore does not have
`public/dictionary.sqlite`, but the smoke and browser suites intentionally load
the real app dictionary path.

CI prepares a tiny valid SQLite package before serving `public/`:

```powershell
python apps\wordlover-pwa\scripts\create-ci-dictionary.py --force
```

That script reuses the slim dictionary schema and FTS population helper, writes
`dictionary.sqlite`, `dictionary.sqlite.zst`, and `dictionary-manifest.json`,
and includes only the terms required by browser smoke coverage such as
`abandon`, `take off`, `in terms of`, `abundant`, and `accurate`. It is a CI
fixture only; do not commit generated dictionary packages from this path.

Because it overwrites the same `public/` files the app serves, the script
**refuses to clobber a production manifest** (`variant != "ci-fixture"`) unless
`--force` is given. Run the local browser suite via `npm run test:browser:ci`
(`run-browser-tests-ci.py`) — it passes `--force` but snapshots and restores the
production dictionary around the run, so it never leaves the fixture in place.

## Run On iPhone

Use the HTTPS server:

```powershell
.\start-iphone-https.ps1
```

If you are already in `apps\wordlover-pwa\public`, the local `start-iphone-https.ps1` wrapper works from there too.

## Offline startup contract

After WordFan has been opened successfully online **once** (so the service worker
finishes installing the shell), it works offline:

- **Bounded startup fetches.** Every startup-critical service-worker request uses
  network-first with a short timeout (≈2.5s for navigation/document/script/style,
  ≈5s for other runtime requests, ≈10–15s for required assets during install), then
  falls back to the cached shell. This is the fix for the iOS hang where a
  "connected but useless" network (no internet, stalled DNS/TLS, captive portal)
  left an unbounded `fetch()` pending forever and the cached fallback was never
  reached. Startup never waits indefinitely on the network.
- **Offline reload and cold launch.** Reloading offline, and launching the installed
  PWA from the Home Screen while offline, both load the cached shell promptly.
- **Local dictionary stays local.** `dictionary.sqlite` / `.zst` / the manifest are
  never shell-cached; an installed dictionary opens from IndexedDB (OPFS optional),
  and `source indexedDB offline copy` is shown.
- **Local study features work offline:** lookup, vocabulary, review, spelling,
  history, goals, known words, and learning tracks.
- **Online-only features degrade gracefully.** Google sign-in/sync, Gemini, remote
  update checks, and remote dictionary downloads report that the network is
  unavailable but never block startup or rendering.
- **No correct-asset substitution.** A missing script/style is never answered with
  `/` or `index.html` (which would break as JS/CSS); it fails cleanly. A required
  asset that fails during install aborts the install — the incomplete shell is never
  activated and the previous valid shell cache is preserved.
- **Before the first successful online install** the app cannot work offline; the
  service worker returns a small 503 page explaining that WordFan must be opened
  online once.

The service worker exposes a `CHECK_OFFLINE_READY` message that reports whether every
required shell asset is cached; the app reports meaningful states (Installing offline
shell / Waiting to activate / Active but not yet controlling this page / Offline ready
/ Offline shell incomplete / Service-worker installation failed) instead of declaring
success just because `register()` resolved. A service-worker takeover reloads the page
at most once per shell-cache version (a `sessionStorage` guard prevents reload loops).

`scripts/smoke-offline-dictionary.py` exercises this contract end to end: offline
reload, true cold offline launch, hanging-network timeout fallback, missing-JS clean
failure, incomplete-install rejection, reload-loop prevention, and reconnect.

## Pass Criteria

- App shell visible in under 1 second.
- Service worker registers.
- Dictionary loads without browser crash.
- Exact searches such as `abandon`, `take off`, and `in terms of` return in under 1 second after dictionary load.
- Valid searches persist in IndexedDB history after reload.
- Review due flow, proactive study flow, and FSRS ratings work.
- Export button downloads a user data JSON file.
# Build and Deploy Strategy

`public/` is the deployed WordFan app and the GitHub Pages source of truth. The
current app intentionally ships as static HTML/CSS/JS modules plus vendored
runtime files; Vite is kept only as a dependency-management bridge for future
bundling work and must not emit unused production bundles into `public/`.

Use `npm run build` from `apps/wordlover-pwa` to validate that the public shell
assets referenced by the service worker exist and that dictionary packages are
not accidentally included in the shell cache. GitHub Pages should serve the
contents of `public/` exactly.
