# WordLover Windows PWA POC

This POC checks whether a browser-installed Windows PWA can load the current local SQLite dictionary, run local lookups, persist small user state in IndexedDB, register an offline shell service worker, and export user data.

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

## Pass Criteria

- App shell visible in under 1 second.
- Service worker registers.
- Dictionary loads without browser crash.
- Exact searches such as `abandon`, `take off`, and `in terms of` return in under 1 second after dictionary load.
- Valid searches persist in IndexedDB history after reload.
- Export button downloads a user data JSON file.
