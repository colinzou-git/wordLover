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
cd poc\windows-pwa\public
python -m http.server 4173
```

Then open:

```text
http://127.0.0.1:4173
```

To run the broader Phase 0 automated suite, open:

```text
http://127.0.0.1:4173/poc-suite.html
```

Or use the helper script from the repo root:

```powershell
poc\windows-pwa\start-windows-pwa.ps1 -Port 4173
```

If the test suite shows `Dictionary fetch failed before an HTTP response`, the browser tab is still open but the local server is not running. Start the server again, reload the page, and rerun the suite.

Click **Run all automated POCs**. The suite covers dictionary persistence, offline shell cache readiness, encrypted export/import, mock sync, and timed lookup benchmarks.

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
