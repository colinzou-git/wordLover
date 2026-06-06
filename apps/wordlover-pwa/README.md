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
python apps\wordlover-pwa\scripts\create-ci-dictionary.py
```

That script reuses the slim dictionary schema and FTS population helper, writes
`dictionary.sqlite`, `dictionary.sqlite.zst`, and `dictionary-manifest.json`,
and includes only the terms required by browser smoke coverage such as
`abandon`, `take off`, `in terms of`, `abundant`, and `accurate`. It is a CI
fixture only; do not commit generated dictionary packages from this path.

## Run On iPhone

Use the HTTPS server:

```powershell
.\start-iphone-https.ps1
```

If you are already in `apps\wordlover-pwa\public`, the local `start-iphone-https.ps1` wrapper works from there too.

## Offline Dictionary Fallback Test

The app saves the dictionary into IndexedDB after a successful online load. If `/dictionary.sqlite` cannot be fetched later, **Load local SQLite dictionary** falls back to the saved copy and shows:

```text
source indexedDB offline copy
```

Windows fallback automation verified this by stopping the local server, reloading the app from the service worker cache, loading the dictionary from IndexedDB, and searching `take off` successfully.

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
