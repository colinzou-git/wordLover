# WordLover Product PWA

This is the formal WordLover PWA product app. iPhone is the primary user target; Windows is the repeatable automation and stress-test fallback for checks that cannot be fully automated on iPhone.

## Prepare

From the repo root:

```powershell
Copy-Item data\dictionary.sqlite apps\wordlover-pwa\public\dictionary.sqlite -Force
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
http://127.0.0.1:4173
```

Keep that PowerShell window open while using WordLover. If the server is closed, an already-open browser tab can still show the app shell from cache, but first-time dictionary install cannot fetch `dictionary.sqlite`.

To run the automated suite, open:

```text
http://127.0.0.1:4173/automated-tests.html?fresh=v28
```

If the test suite shows `Dictionary fetch failed before an HTTP response`, the browser tab is still open but the local server is not running. Start the server again, reload the page, and rerun the suite.

Click **Run automated tests**. The suite includes a real main-app smoke test that opens WordLover in an iframe and verifies actual dictionary searches for `abandon` and `take off`, then continues with dictionary persistence, offline shell cache readiness, encrypted export/import, mock sync, review/quiz scheduling, and timed lookup benchmarks.

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
