# WordLover Windows PWA POC

This POC is the automation and stress-test fallback for the iPhone-first product path. It checks whether a browser-installed Windows PWA can load the current local SQLite dictionary, run local lookups, persist dictionary/user state in IndexedDB, register an offline shell service worker, and export user data.

Windows is not the primary user target. Use it to automate repeatable tests and stress tests that are difficult to run fully automatically on iPhone.

## Prepare

From the repo root:

```powershell
Copy-Item data\dictionary.sqlite poc\windows-pwa\public\dictionary.sqlite -Force
New-Item -ItemType Directory -Force poc\windows-pwa\public\vendor
Invoke-WebRequest https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.13.0/sql-wasm.js -OutFile poc\windows-pwa\public\vendor\sql-wasm.js
Invoke-WebRequest https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.13.0/sql-wasm.wasm -OutFile poc\windows-pwa\public\vendor\sql-wasm.wasm
```

## Run

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File poc\windows-pwa\start-windows-pwa.ps1 -Port 4173
```

Then open:

```text
http://127.0.0.1:4173
```

Keep that PowerShell window open while using WordLover. If the server is closed, an already-open browser tab can still show the app shell from cache, but first-time dictionary install cannot fetch `dictionary.sqlite`.

To run the broader automated suite, open:

```text
http://127.0.0.1:4173/poc-suite.html?fresh=v27
```

If the test suite shows `Dictionary fetch failed before an HTTP response`, the browser tab is still open but the local server is not running. Start the server again, reload the page, and rerun the suite.

Click **Run automated tests**. The suite now includes a real main-app smoke test that opens the WordLover app in an iframe and verifies actual dictionary searches for `abandon` and `take off`, then continues with dictionary persistence, offline shell cache readiness, encrypted export/import, mock sync, and timed lookup benchmarks.

For iPhone testing, use the HTTPS server instead:

```powershell
.\start-iphone-https.ps1
```

If you are already in this `poc\windows-pwa\public` folder, the local `start-iphone-https.ps1` wrapper works from here too.

## Offline Dictionary Fallback Test

The main POC now saves the dictionary into IndexedDB after a successful online load. If `/dictionary.sqlite` cannot be fetched later, **Load local SQLite dictionary** falls back to the saved copy and shows:

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
- Export button downloads a user data JSON file.
